"""Three-stage agent: Planner → Pipeline Builder → Scene Builder.

Planner: architecture analysis + layout design (no tools)
Pipeline Builder: generates beautiful HTML diagram (no tools, raw text output)
Scene Builder: generates 3D scene JSON (has tools)
"""

import json
import anthropic
from src.prompts import PLANNER_PROMPT, PIPELINE_BUILDER_PROMPT, SCENE_BUILDER_PROMPT
from src.tools import TOOL_DEFINITIONS, execute_tool


def run_planner(client, conversation_history, current_scene_json, model, on_progress=None):
    """Stage 1: Plan the architecture and layout."""
    def progress(s, d=""):
        if on_progress: on_progress(s, d)

    progress("Analyzing", "Understanding the architecture...")

    system = PLANNER_PROMPT
    if current_scene_json:
        lines = []
        for l in current_scene_json.get("layers", []):
            p = l.get("params", {})
            dims = ""
            if p.get("H") and p.get("W") and p.get("C"):
                dims = f"{p['H']}×{p['W']}×{p['C']}"
            elif p.get("neurons"):
                dims = f"1×1×{p['neurons']}"
            elif p.get("dim"):
                dims = f"dim={p['dim']}"
            rep = f" ×{l['repeat']}" if l.get("repeat", 1) > 1 else ""
            lines.append(f"  {l['id']}: {l.get('label', l['type'])} [{dims}]{rep}")
        system += f"\n\n## Current Scene\nModel: {current_scene_json.get('model_name', '?')}\nLayers:\n" + "\n".join(lines)
        if current_scene_json.get("pipeline_html"):
            system += f"\n\nA pipeline diagram already exists. For minor edits (colors, labels, adding/removing a block), plan MINIMAL changes and note 'APPROACH: edit existing diagram'. For major restructuring, plan from scratch with 'APPROACH: full rebuild'."

    messages = [{"role": m["role"], "content": m["content"]} for m in conversation_history]
    progress("Planning", "Designing layout and visual hierarchy...")

    resp = client.messages.create(model=model, max_tokens=4096, system=system, messages=messages)
    return "".join(b.text for b in resp.content if b.type == "text")


def run_pipeline_builder(client, plan, model, current_html=None, user_request=None, on_progress=None):
    """Stage 2A: Generate beautiful HTML pipeline diagram. No tools — raw text output."""
    def progress(s, d=""):
        if on_progress: on_progress(s, d)

    progress("Drawing pipeline", "Generating HTML diagram...")

    system = PIPELINE_BUILDER_PROMPT

    # Build the user message
    parts = [f"Generate the HTML pipeline diagram for this plan:\n\n{plan}"]

    # If editing, give the builder the existing HTML and the user's request
    if current_html and user_request:
        parts = [
            f"## Current Diagram HTML\n\n{current_html}\n\n---\n\n"
            f"## User's Edit Request\n\n{user_request}\n\n---\n\n"
            f"## Updated Plan\n\n{plan}\n\n---\n\n"
            f"Modify the existing diagram according to the user's request and the updated plan. "
            f"Keep the existing layout and style as much as possible — only change what the user asked for."
        ]

    resp = client.messages.create(
        model=model,
        max_tokens=12000,
        system=system,
        messages=[{"role": "user", "content": parts[0]}],
    )

    html = "".join(b.text for b in resp.content if b.type == "text").strip()

    # Clean up: remove markdown code fences if present
    if html.startswith("```html"):
        html = html[7:]
    elif html.startswith("```"):
        html = html[3:]
    if html.endswith("```"):
        html = html[:-3]
    html = html.strip()

    # Ensure it starts from the actual HTML
    doctype_idx = html.lower().find('<!doctype')
    html_idx = html.lower().find('<html')
    div_idx = html.find('<div')
    start = -1
    if doctype_idx >= 0:
        start = doctype_idx
    elif html_idx >= 0:
        start = html_idx
    elif div_idx >= 0:
        start = div_idx
    if start > 0:
        html = html[start:]

    return html


def run_scene_builder(client, plan, user_request, current_scene_json, model, on_progress=None):
    """Stage 2B: Generate 3D scene JSON via tools. Single call — no refinement loop."""
    def progress(s, d=""):
        if on_progress: on_progress(s, d)

    progress("Building 3D", "Generating feature map scene...")

    system = SCENE_BUILDER_PROMPT
    if current_scene_json:
        ctx = {k: v for k, v in current_scene_json.items() if k != "pipeline_html"}
        system += f"\n\n## Current Scene\n```json\n{json.dumps(ctx, separators=(',', ':'))}\n```"

    messages = [{
        "role": "user",
        "content": f"## Plan\n\n{plan}\n\n---\nBuild the 3D scene from the plan's 3D LAYERS and 3D CONNECTIONS sections."
    }]

    scene = current_scene_json
    text = ""

    resp = client.messages.create(
        model=model, max_tokens=8000, system=system,
        tools=TOOL_DEFINITIONS, messages=messages,
    )

    for b in resp.content:
        if b.type == "text":
            text += b.text
        elif b.type == "tool_use":
            progress("Executing", f"{b.name}...")
            updated, msg = execute_tool(b.name, b.input, scene)
            if updated:
                scene = updated
            # Use tool result message as summary if no text
            if not text:
                text = msg

    return scene, text


def run_agent(client, conversation_history, current_scene_json=None,
              model="claude-sonnet-4-5-20250929", on_progress=None):
    """Three-stage pipeline: Planner → Pipeline Builder + Scene Builder."""
    def progress(s, d=""):
        if on_progress: on_progress(s, d)

    user_request = ""
    for m in reversed(conversation_history):
        if m["role"] == "user":
            user_request = m["content"]
            break

    # ── Stage 1: Plan ──
    plan = run_planner(client, conversation_history, current_scene_json, model, on_progress)
    # This progress call is a Streamlit yield point — stop can trigger here
    progress("Plan ready", "Now building pipeline diagram and 3D scene...")

    # ── Stage 2A: Pipeline HTML (no tools, just text) ──
    current_html = current_scene_json.get("pipeline_html") if current_scene_json else None
    pipeline_html = run_pipeline_builder(
        client, plan, model,
        current_html=current_html,
        user_request=user_request if current_html else None,
        on_progress=on_progress,
    )
    # Another yield point — stop can trigger here
    progress("Pipeline ready", "Now building 3D feature map...")

    # ── Stage 2B: Scene JSON (tools) ──
    scene_json, builder_text = run_scene_builder(
        client, plan, user_request, current_scene_json, model, on_progress
    )

    # ── Combine: store pipeline HTML in scene ──
    if scene_json and pipeline_html:
        scene_json["pipeline_html"] = pipeline_html

    progress("Rendering", "Preparing visualization...")

    response_text = builder_text.strip() or "Visualization built."
    return scene_json, response_text