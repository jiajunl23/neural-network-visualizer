
### Note:
(The submitted zip on Gradescope already contains the entire project, but in case there is any corruption or issues with the zip file the project code can also be obtained on this github page https://github.com/jiajunl23/neural-network-visualizer (already shared with mspertus). Note: the video because of its size is only in the zip Submitted to Gradescope)

# Neural Network Visualizer

Describe any neural network in plain English and visualization of the neural network: a pipeline diagram and if the network is a CNN or feedforward network then also a features in 3D visualization will be created.

## Project Summary PDF and Demonstration Video

Please see **project summary pdf** and **demonstration video** (Only in the Zip Submitted on Gradescope) first before looking at the more detailed things in this README file.

## Example Outputs

Some example exported visualizations can be found in the examples folder

## Quick Start

The Python version need to be >= 3.10

```bash
pip install -r requirements.txt
streamlit run app.py
```

Enter your Claude API key and start describing architectures.

## Built With

- **[Anthropic Claude API](https://docs.anthropic.com/)** — Powers the three-agent pipeline (Planner, Pipeline Builder, Scene (Features in 3D) Builder). Uses tool use for structured scene generation and raw text output for HTML diagram creation.
- **[Streamlit](https://streamlit.io/)** — Web application framework. Handles the chat interface, session state, layout, and component rendering.
- **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)** — React renderer for Three.js. Drives the interactive 3D feature map with orbit controls, lighting, and proportional block rendering.
- **[@react-three/drei](https://github.com/pmndrs/drei)** — Helper components for React Three Fiber. Used for billboard text annotations, orbit controls, and camera management.
- **[Vite](https://vitejs.dev/)** — Frontend build tool. Bundles the React/Three.js frontend into a single self-contained HTML file via `vite-plugin-singlefile`.
- **HTML/CSS/SVG** — Pipeline diagrams are generated as complete HTML documents with custom CSS styling and inline SVG arrows. Rendered in an iframe with pan/zoom.
- **Custom Claude Tools** — The Scene (Features in 3D) Builder uses Anthropic's [tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) feature. A custom `replace_scene` tool is defined with a JSON schema that specifies the exact structure Claude must produce:
  - **Layer types** — The schema enumerates 40+ types (`conv2d`, `pooling`, `dense`, `multi_head_attention`, `unet_down_block`, `cross_attention`, `embedding`, etc.) which the frontend maps to distinct colors in the 3D view.
  - **Tensor params** — Each layer requires a `params` object describing its output tensor shape. The schema documents the format per category: spatial layers use `{"H": 224, "W": 224, "C": 64}`, dense layers use `{"neurons": 4096}`, attention uses `{"heads": 12, "dim": 768, "seq_len": 197}`, and so on.
  - **Repeat compression** — A `repeat` integer field lets Claude represent N identical consecutive layers as a single block with a ×N badge, reducing both token cost and visual clutter.
  - **Execution flow** — Claude receives the planner's output and the tool schema, then generates a `replace_scene` tool call with the full scene JSON. The app intercepts this call locally in `execute_tool()` (no external API), injects default scene settings, and passes the result to the React frontend.
  - **Layout engine** — A client-side layout engine (`layoutEngine.js`) converts the tensor params into proportional 3D block sizes using power-curve scaling for spatial dimensions and square-root scaling for channels, then positions blocks sequentially along the flow axis.

## How It Works

The app uses a multi-agent pipeline powered by Claude:

**1. Planner** — Analyzes your request and designs the visualization. Decides the layout shape (U-shape for UNet, vertical stack for transformers, horizontal flow for CNNs), which layers to show vs compress, how to group blocks, and where to route arrows.

**2. Pipeline Builder** — Takes the plan and generates a complete HTML page with CSS and inline SVG. Has full creative freedom — each architecture gets a unique, publication-quality diagram tailored to its structure. The result renders in an iframe with pan/zoom.

**3. Scene (Features in 3D) Builder** (CNN/feedforward only) — Takes the same plan and produces a JSON scene for the 3D view. Each layer becomes a block sized proportionally to its output feature tensor (H×W×C). Channels map to the flow axis, spatial dimensions map to height and width. Skipped for non-CNN architectures where 3D tensor blocks aren't meaningful (transformers, diffusion, GANs).

On edits, the pipeline builder receives the existing diagram and modifies it rather than rebuilding from scratch.

## Features

- **Pipeline Diagram** — Beautiful HTML diagrams with architecture-appropriate layouts. U-Net gets a U-shape, transformers get a vertical stack with loop arrows, CNNs get a horizontal flow. Pan and zoom to explore.
- **Features in 3D** (CNN/feedforward) — Every block represents the output feature tensor after that layer, sized proportionally to H×W×C. Drag to pan, right-click to rotate, scroll to zoom.
- **Resizable Split** — Drag the handle between the two views to resize.
- **Chat Refinement** — Edit the visualization through conversation: "add dropout after each conv", "make the encoder blocks larger", "show the skip connections".
- **Export** — Download the visualization as a standalone HTML file that opens in any browser.

## Example Prompts

- "VGG-16"
- "ResNet-50 with skip connections"
- "Vision Transformer ViT-B/16"
- "Stable Diffusion UNet"
- "Simple 3-layer MLP for MNIST"

## Development

To modify the frontend and rebuild:

```bash
cd frontend && npm install && npm run build && cd ..
```