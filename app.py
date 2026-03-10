"""Neural Network Visualizer — Streamlit App (v6)."""

import json
import streamlit as st
import anthropic
from src.agent import run_agent

st.set_page_config(
    page_title="Neural Network Visualizer",
    page_icon="◇",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS ───────────────────────────────────────────────────────────────────────

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
.stApp {
    font-family: 'Inter', sans-serif;
    background: #ffffff !important;
}
#MainMenu, footer { visibility: hidden; }

/* ── FORCE hide ALL chat avatars ── */
.stChatMessage > div:first-child {
    display: none !important;
    width: 0 !important;
    min-width: 0 !important;
    max-width: 0 !important;
    overflow: hidden !important;
}
[data-testid="chatAvatarIcon-user"],
[data-testid="chatAvatarIcon-assistant"],
[data-testid="stChatMessageAvatarContainer"] {
    display: none !important;
}

/* ── Chat messages ── */
.stChatMessage {
    background: transparent !important;
    border: none !important;
    padding: 0.2rem 0 !important;
    gap: 0 !important;
}

/* User bubble */
[data-testid="stChatMessage-user"] [data-testid="stMarkdownContainer"] p {
    background: #f0f1f5;
    border-radius: 14px;
    padding: 9px 15px;
    display: inline-block;
    font-size: 13px;
    color: #1a1a2e;
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
}

/* Assistant text */
[data-testid="stChatMessage-assistant"] [data-testid="stMarkdownContainer"] p {
    font-size: 13px;
    color: #333;
    line-height: 1.55;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: #fafbfc !important;
    border-right: 1px solid #eaeaef;
}

/* ── Status widget — hide activity icons (bike, swimming, etc.) ── */
[data-testid="stStatus"] [data-testid="stStatusIcon"],
[data-testid="stStatus"] img,
[data-testid="stStatus"] svg:not([data-testid="stExpanderToggleIcon"]),
[data-testid="stStatusWidget"] [data-testid="stStatusIcon"],
[data-testid="stStatus"] > summary > div > div:first-child > span {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
}
[data-testid="stStatus"] {
    border-radius: 10px !important;
    border: 1px solid #e8e8ef !important;
    background: #fafbfc !important;
}

/* ── Chat input ── */
[data-testid="stChatInput"] textarea {
    border-radius: 12px !important;
    border: 1px solid #d4d4dc !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
    padding-left: 16px !important;
}

/* ── Viewport card ── */
.viewport-card {
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid #e2e4e9;
    box-shadow: 0 2px 16px rgba(0,0,0,0.04);
    background: #ffffff;
}

/* ── Text overflow everywhere ── */
[data-testid="stMarkdownContainer"],
[data-testid="stMarkdownContainer"] p,
[data-testid="stMarkdownContainer"] li {
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
    max-width: 100% !important;
}

/* ── Form submit button ── */
.stForm [data-testid="stFormSubmitButton"] button {
    background: #1a1a2e !important;
    color: #ffffff !important;
    border-radius: 10px !important;
    border: none !important;
    padding: 0.5rem 1.2rem !important;
    font-weight: 500 !important;
    font-size: 13px !important;
    letter-spacing: 0.3px !important;
}
.stForm [data-testid="stFormSubmitButton"] button:hover {
    background: #2d2d4e !important;
}

/* ── Example chip buttons ── */
.example-chips {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin: 6px 0 10px 0;
}
.example-chips button {
    all: unset;
    cursor: pointer;
    background: rgba(255,255,255,0.9);
    border: 1px solid #e2e4e9;
    border-radius: 18px;
    padding: 6px 14px;
    font-size: 12px;
    font-family: 'Inter', sans-serif;
    color: #666;
    transition: border-color 0.15s, color 0.15s;
}
.example-chips button:hover {
    border-color: #6366f1;
    color: #6366f1;
}
</style>
""", unsafe_allow_html=True)

# ── Session State ─────────────────────────────────────────────────────────────

if "messages" not in st.session_state:
    st.session_state.messages = []
if "scene_json" not in st.session_state:
    st.session_state.scene_json = None
if "validated_key" not in st.session_state:
    st.session_state.validated_key = None
if "pending_example" not in st.session_state:
    st.session_state.pending_example = None

key_valid = st.session_state.validated_key is not None

# ── Sidebar ───────────────────────────────────────────────────────────────────

with st.sidebar:
    if key_valid:
        st.markdown("### ⚙️ Settings")
        model = st.selectbox(
            "Model",
            options=[
                "claude-sonnet-4-5-20250929",
                "claude-opus-4-6",
                "claude-haiku-4-5-20251001",
            ],
            format_func=lambda x: {
                "claude-sonnet-4-5-20250929": "Sonnet 4.5 (recommended)",
                "claude-opus-4-6": "Opus 4.6 (most capable)",
                "claude-haiku-4-5-20251001": "Haiku 4.5 (fastest)",
            }[x],
        )
        st.session_state.model = model
        st.divider()

        if st.session_state.scene_json:
            # Build standalone HTML with scene data baked in
            try:
                with open("dist/index.html", "r") as f:
                    export_html = f.read()
                injection = f"<script>window.__SCENE_DATA__ = {json.dumps(st.session_state.scene_json)};</script>"
                export_html = export_html.replace("</head>", injection + "</head>")
                model_name = st.session_state.scene_json.get("model_name", "network").replace(" ", "_")
                st.download_button(
                    "📥 Export as HTML",
                    data=export_html,
                    file_name=f"{model_name}_visualization.html",
                    mime="text/html",
                    use_container_width=True,
                )
            except FileNotFoundError:
                st.warning("Frontend not built.")
        if st.button("🗑️ Clear & reset", use_container_width=True):
            st.session_state.scene_json = None
            st.session_state.messages = []
            st.rerun()

        st.divider()
        new_key = st.text_input("Change API Key", type="password", placeholder="sk-ant-api03-...")
        if new_key and new_key != st.session_state.validated_key:
            try:
                client = anthropic.Anthropic(api_key=new_key)
                client.messages.create(model="claude-sonnet-4-5-20250929", max_tokens=10, messages=[{"role": "user", "content": "hi"}])
                st.session_state.validated_key = new_key
                st.session_state.client = client
                st.success("✓ Key updated")
                st.rerun()
            except Exception:
                st.error("Invalid key.")
        st.caption("Session-only · never stored.")
    else:
        st.caption("Enter your API key on the main page.")

# ── Landing HTML (no example chips — those are Streamlit buttons below) ───────

LANDING_HTML = """
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; }
  canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  .content {
    position: relative; z-index: 10; width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 24px;
  }
  .title { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-bottom: 6px; letter-spacing: -0.5px; }
  .subtitle { font-size: 13.5px; color: #6b7280; max-width: 460px; line-height: 1.6; margin-bottom: 20px; }
  .features { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
  .feature {
    background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);
    border: 1px solid #e8e8ef; border-radius: 12px;
    padding: 14px 16px; width: 185px; text-align: left;
  }
  .feature-icon { font-size: 17px; margin-bottom: 5px; }
  .feature-title { font-size: 11.5px; font-weight: 600; color: #1a1a2e; margin-bottom: 2px; }
  .feature-desc { font-size: 10.5px; color: #888; line-height: 1.4; }
</style>
</head>
<body>
<canvas id="bg"></canvas>
<div class="content">
  <div class="title">Neural Network Visualizer</div>
  <div class="subtitle">
    Describe any neural network in plain English and get an interactive 3D visualization.
    Refine through conversation — add layers, change colors, resize blocks.
  </div>
  <div class="features">
    <div class="feature"><div class="feature-icon">📐</div><div class="feature-title">Dimension Accurate</div><div class="feature-desc">Blocks sized proportionally to H×W×C</div></div>
    <div class="feature"><div class="feature-icon">💬</div><div class="feature-title">Chat Refinement</div><div class="feature-desc">Refine your visualization with natural language</div></div>
    <div class="feature"><div class="feature-icon">🔮</div><div class="feature-title">Interactive 3D</div><div class="feature-desc">Orbit, zoom, pan around your architecture</div></div>
  </div>
</div>
<script>
(function(){var c=document.getElementById('bg'),x=c.getContext('2d'),w,h,N=[],L=8,nN=9,aL=0,f=0;
function R(){w=c.width=c.offsetWidth;h=c.height=c.offsetHeight;N=[];var mx=w*.06,my=h*.08,sx=(w-mx*2)/(L-1);
for(var l=0;l<L;l++){var ly=[],cn=l==0||l==L-1?5:nN,sy=(h-my*2)/(cn-1||1);
for(var n=0;n<cn;n++)ly.push({x:mx+l*sx+(Math.random()-.5)*10,y:my+n*sy+(Math.random()-.5)*10,r:2+Math.random()*1.5});N.push(ly)}}
function D(){x.clearRect(0,0,w,h);aL=Math.floor(f/100)%L;var p=(f%100)/100,pu=Math.sin(p*Math.PI);
for(var l=0;l<N.length-1;l++){var fr=N[l],to=N[l+1];for(var i=0;i<fr.length;i++)for(var j=0;j<to.length;j++){
if(Math.abs(i/fr.length-j/to.length)>.35)continue;var a=(l==aL||l+1==aL)?.04+.05*pu:.018;
x.beginPath();x.moveTo(fr[i].x,fr[i].y);x.lineTo(to[j].x,to[j].y);
x.strokeStyle=(l==aL||l+1==aL)?'rgba(99,102,241,'+a+')':'rgba(180,180,200,'+a+')';
x.lineWidth=(l==aL||l+1==aL)?1:.4;x.stroke()}}
for(var l=0;l<N.length;l++){var ac=l==aL;for(var k=0;k<N[l].length;k++){var nd=N[l][k],r=ac?nd.r+pu*2.5:nd.r;
x.beginPath();x.arc(nd.x,nd.y,r,0,Math.PI*2);
x.fillStyle=ac?'rgba(99,102,241,'+(0.12+pu*.18)+')':'rgba(180,180,200,0.04)';x.fill();
if(ac&&pu>.3){x.beginPath();x.arc(nd.x,nd.y,r+6,0,Math.PI*2);x.fillStyle='rgba(99,102,241,'+(pu*.04)+')';x.fill()}}}
f++;requestAnimationFrame(D)}window.addEventListener('resize',R);R();D()})();
</script>
</body>
</html>
"""

EXAMPLES = ["VGG-16", "ResNet-18", "Vision Transformer (ViT-B/16)", "Simple 3-layer MLP"]

# ── Helper: run agent ─────────────────────────────────────────────────────────

def run_and_update(prompt_text):
    """Run agent for a prompt, update session state, rerun."""
    st.session_state.messages.append({"role": "user", "content": prompt_text})

    with st.status("Building visualization...", expanded=True) as status:
        def on_progress(step, detail):
            status.update(label=f"{step}...", state="running")
            st.write(f"**{step}** — {detail}")

        try:
            scene_json, text = run_agent(
                client=st.session_state.client,
                conversation_history=st.session_state.messages,
                current_scene_json=st.session_state.scene_json,
                model=st.session_state.get("model", "claude-sonnet-4-5-20250929"),
                on_progress=on_progress,
            )
            if scene_json:
                st.session_state.scene_json = scene_json
            status.update(label="Done!", state="complete", expanded=False)
            st.session_state.messages.append({"role": "assistant", "content": text or "Visualization updated."})
        except anthropic.APIError as e:
            status.update(label="Error", state="error")
            st.session_state.messages.append({"role": "assistant", "content": f"API error: {e}"})
        except Exception as e:
            status.update(label="Error", state="error")
            st.session_state.messages.append({"role": "assistant", "content": f"Error: {e}"})

    st.rerun()


# ════════════════════════════════════════════════════════════════════════════════
# MAIN FLOW — exactly ONE chat_input per execution path
# ════════════════════════════════════════════════════════════════════════════════

# ── STATE 1: No API key ──────────────────────────────────────────────────────

if not key_valid:
    st.components.v1.html(LANDING_HTML, height=420, scrolling=False)

    col_l, col_m, col_r = st.columns([1.2, 2, 1.2])
    with col_m:
        with st.form("api_key_form", clear_on_submit=False, border=False):
            st.markdown(
                '<p style="text-align:center;font-size:13px;font-weight:500;color:#555;margin-bottom:4px;">'
                'Claude API Key required</p>',
                unsafe_allow_html=True,
            )
            api_key = st.text_input(
                "Claude API Key",
                type="password",
                placeholder="sk-ant-api03-...",
                label_visibility="collapsed",
            )
            submitted = st.form_submit_button("Submit", use_container_width=True)

        if submitted and api_key:
            with st.spinner("Validating..."):
                try:
                    client = anthropic.Anthropic(api_key=api_key)
                    client.messages.create(
                        model="claude-sonnet-4-5-20250929",
                        max_tokens=10,
                        messages=[{"role": "user", "content": "hi"}],
                    )
                    st.session_state.validated_key = api_key
                    st.session_state.client = client
                    st.rerun()
                except anthropic.AuthenticationError:
                    st.error("Invalid API key.")
                except Exception as e:
                    st.error(f"Connection error: {e}")

        st.markdown(
            '<p style="text-align:center;font-size:11px;color:#bbb;margin-top:2px;">'
            'Your key is session-only and never stored. '
            '<a href="https://console.anthropic.com/" target="_blank" style="color:#6366f1;">Get a key →</a></p>',
            unsafe_allow_html=True,
        )
    st.stop()

# ── STATE 2: Key valid, no scene, no messages ────────────────────────────────

if not st.session_state.scene_json and not st.session_state.messages:
    st.components.v1.html(LANDING_HTML, height=420, scrolling=False)

    # Clickable example chips
    st.markdown('<p style="text-align:center;font-size:10px;color:#bbb;text-transform:uppercase;'
                'letter-spacing:1.5px;margin:8px 0 4px 0;">Try an example</p>',
                unsafe_allow_html=True)

    chip_cols = st.columns(len(EXAMPLES))
    for i, example in enumerate(EXAMPLES):
        with chip_cols[i]:
            if st.button(example, use_container_width=True, key=f"example_{i}"):
                st.session_state.pending_example = example
                st.rerun()

    # Single chat input for this state
    prompt = st.chat_input("Describe a neural network architecture...")

    # Handle example click
    if st.session_state.pending_example:
        prompt = st.session_state.pending_example
        st.session_state.pending_example = None

    if prompt:
        run_and_update(prompt)

    st.stop()

# ── STATE 3: Workspace (has messages or scene) ───────────────────────────────

viz_col, chat_col = st.columns([3, 2], gap="medium")

with viz_col:
    if st.session_state.scene_json:
        st.markdown('<div class="viewport-card">', unsafe_allow_html=True)
        try:
            with open("dist/index.html", "r") as f:
                html = f.read()
            injection = f"<script>window.__SCENE_DATA__ = {json.dumps(st.session_state.scene_json)};</script>"
            html = html.replace("</head>", injection + "</head>")
            st.components.v1.html(html, height=640, scrolling=False)
        except FileNotFoundError:
            st.warning("Frontend not built. Run `cd frontend && npm install && npm run build`.")
        st.markdown('</div>', unsafe_allow_html=True)
    else:
        st.markdown(
            '<div style="height:640px;display:flex;align-items:center;justify-content:center;'
            'background:#fafbfc;border-radius:14px;border:1px solid #e8e8ef;">'
            '<p style="color:#bbb;font-size:14px;">Generating visualization...</p></div>',
            unsafe_allow_html=True,
        )

with chat_col:
    chat_container = st.container(height=580)
    with chat_container:
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

# Single chat input for workspace state
prompt = st.chat_input("Refine the visualization or describe a new network...")
if prompt:
    run_and_update(prompt)