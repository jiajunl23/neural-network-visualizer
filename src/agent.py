"""Two-stage agent: Planner → Builder.

Stage 1 (Planner): No tools. Analyzes the architecture, decides visual hierarchy,
    grouping, parallel paths, what to emphasize vs compress.
Stage 2 (Builder): Has tools. Mechanically converts the plan into scene JSON.
"""

import json
import anthropic
from src.prompts import PLANNER_PROMPT, BUILDER_PROMPT
from src.tools import TOOL_DEFINITIONS, execute_tool


def run_planner(
    client: anthropic.Anthropic,
    conversation_history: list[dict],
    current_scene_json: dict | None,
    model: str,
    on_progress: callable = None,
) -> str:
    """Stage 1: Planner — pure reasoning, no tools."""

    def progress(step, detail=""):
        if on_progress:
            on_progress(step, detail)

    progress("Analyzing", "Understanding the architecture...")

    system = PLANNER_PROMPT
    if current_scene_json:
        # Give planner awareness of current state for modifications
        layer_summary = []
        for l in current_scene_json.get("layers", []):
            dims = ""
            p = l.get("params", {})
            if p.get("H") and p.get("W") and p.get("C"):
                dims = f"{p['H']}×{p['W']}×{p['C']}"
            elif p.get("neurons"):
                dims = f"1×1×{p['neurons']}"
            elif p.get("dim"):
                dims = f"dim={p['dim']}"
            rep = f" ×{l['repeat']}" if l.get("repeat", 1) > 1 else ""
            layer_summary.append(f"  {l['id']}: {l.get('label', l['type'])} [{dims}]{rep}")

        group_summary = []
        for g in current_scene_json.get("groups", []):
            rep = f" ×{g['repeat']}" if g.get("repeat") else ""
            group_summary.append(f"  {g['label']}: [{', '.join(g.get('layer_ids', []))}]{rep}")

        system += f"\n\n## Current Scene (for modification requests)\n"
        system += f"Model: {current_scene_json.get('model_name', '?')}\n"
        system += f"Layers:\n" + "\n".join(layer_summary) + "\n"
        if group_summary:
            system += f"Groups:\n" + "\n".join(group_summary) + "\n"
        system += f"\nIf the user wants a modification, plan the minimal changes needed."
        system += f"\nIf the user wants a new architecture, plan from scratch."

    messages = [{"role": msg["role"], "content": msg["content"]} for msg in conversation_history]

    progress("Planning", "Designing visual hierarchy and grouping...")

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system,
        messages=messages,
    )

    plan = ""
    for block in response.content:
        if block.type == "text":
            plan += block.text

    return plan


def run_builder(
    client: anthropic.Anthropic,
    plan: str,
    user_request: str,
    current_scene_json: dict | None,
    model: str,
    on_progress: callable = None,
) -> tuple[dict | None, str]:
    """Stage 2: Builder — converts plan into tool calls."""

    def progress(step, detail=""):
        if on_progress:
            on_progress(step, detail)

    progress("Building", "Converting plan to visualization...")

    system = BUILDER_PROMPT
    if current_scene_json:
        compact = json.dumps(current_scene_json, separators=(",", ":"))
        system += f"\n\n## Current Scene State\n```json\n{compact}\n```\nModify or replace based on the plan."

    # Builder gets the plan as context + the original user request
    messages = [
        {
            "role": "user",
            "content": (
                f"## Visualization Plan\n\n{plan}\n\n"
                f"---\n\n"
                f"## Original User Request\n\n{user_request}\n\n"
                f"---\n\n"
                f"Follow the plan above and call the appropriate tools to build the visualization."
            ),
        }
    ]

    scene_json = current_scene_json
    assistant_text = ""
    max_iterations = 10

    for iteration in range(max_iterations):
        if iteration > 0:
            progress("Refining", f"Processing tool results (step {iteration + 1})...")

        response = client.messages.create(
            model=model,
            max_tokens=8192,
            system=system,
            tools=TOOL_DEFINITIONS,
            messages=messages,
        )

        tool_results = []
        assistant_content = response.content

        for block in response.content:
            if block.type == "text":
                assistant_text += block.text
            elif block.type == "tool_use":
                progress("Executing", f"{block.name}...")
                updated_scene, result_msg = execute_tool(
                    tool_name=block.name,
                    tool_input=block.input,
                    current_scene=scene_json,
                )
                if updated_scene is not None:
                    scene_json = updated_scene
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_msg,
                })

        if response.stop_reason == "end_turn" or not tool_results:
            break

        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})

    return scene_json, assistant_text


def run_agent(
    client: anthropic.Anthropic,
    conversation_history: list[dict],
    current_scene_json: dict | None,
    model: str = "claude-sonnet-4-5-20250929",
    on_progress: callable = None,
) -> tuple[dict | None, str]:
    """
    Two-stage pipeline: Planner → Builder.

    Stage 1 (Planner): Analyzes architecture, decides visual hierarchy,
        grouping strategy, parallel paths, what to emphasize vs compress.
    Stage 2 (Builder): Converts the plan into tool calls that produce scene JSON.

    Returns:
        (scene_json, text_response)
    """

    def progress(step, detail=""):
        if on_progress:
            on_progress(step, detail)

    # Get the latest user message
    user_request = ""
    for msg in reversed(conversation_history):
        if msg["role"] == "user":
            user_request = msg["content"]
            break

    # ── Stage 1: Plan ──
    plan = run_planner(
        client=client,
        conversation_history=conversation_history,
        current_scene_json=current_scene_json,
        model=model,
        on_progress=on_progress,
    )

    progress("Plan ready", "Visual strategy decided, now building...")

    # ── Stage 2: Build ──
    scene_json, builder_text = run_builder(
        client=client,
        plan=plan,
        user_request=user_request,
        current_scene_json=current_scene_json,
        model=model,
        on_progress=on_progress,
    )

    progress("Rendering", "Preparing visualization...")

    # Combine: use builder's summary, but if it's empty, generate one from plan
    response_text = builder_text.strip()
    if not response_text:
        # Extract first 2 lines of plan as fallback
        plan_lines = [l.strip() for l in plan.split("\n") if l.strip()]
        response_text = " ".join(plan_lines[:2]) if plan_lines else "Visualization built."

    return scene_json, response_text