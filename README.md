# Neural Network Visualizer

Describe any neural network in plain English and get two complementary visualizations: a publication-quality pipeline diagram and an interactive 3D feature map.

## Quick Start

```bash
pip install -r requirements.txt
streamlit run app.py
```

Enter your Claude API key and start describing architectures.

## How It Works

The app uses a three-agent pipeline powered by Claude:

**1. Planner** — Analyzes your request and designs the visualization. Decides the layout shape (U-shape for UNet, vertical stack for transformers, horizontal flow for CNNs), which layers to show vs compress, how to group blocks, and where to route arrows.

**2. Pipeline Builder** — Takes the plan and generates a complete HTML page with CSS and inline SVG. Has full creative freedom — each architecture gets a unique, publication-quality diagram tailored to its structure. The result renders in an iframe with pan/zoom.

**3. Scene Builder** — Takes the same plan and produces a JSON scene for the 3D view. Each layer becomes a block sized proportionally to its output tensor (H×W×C). Channels map to the flow axis, spatial dimensions map to height and width.

On edits, the pipeline builder receives the existing diagram and modifies it rather than rebuilding from scratch.

## Features

- **Pipeline Diagram** — Beautiful HTML diagrams with architecture-appropriate layouts. U-Net gets a U-shape, transformers get a vertical stack with loop arrows, CNNs get a horizontal flow. Pan and zoom to explore.
- **Features in 3D** — Every block represents the output feature tensor after that layer, sized proportionally to H×W×C. Drag to pan, right-click to rotate, scroll to zoom.
- **Resizable Split** — Drag the handle between the two views to resize.
- **Chat Refinement** — Edit the visualization through conversation: "add dropout after each conv", "make the encoder blocks larger", "show the skip connections".
- **Export** — Download the visualization as a standalone HTML file that opens in any browser.

## Example Prompts

- "VGG-16"
- "ResNet-50 with skip connections"
- "Vision Transformer ViT-B/16"
- "Stable Diffusion UNet"
- "Simple 3-layer MLP for MNIST"

## Cost

Each query makes 3 API calls (planner + pipeline builder + scene builder). Typical cost is $0.08–0.15 per query with Sonnet 4.5.

## Example Output

An example exported VGG-16 visualization is in the `examples/` folder.

## Development

To modify the frontend and rebuild:

```bash
cd frontend && npm install && npm run build && cd ..
```

The pre-built `dist/index.html` is included — this step is only needed if you edit files in `frontend/src/`.

Note: `frontend/index.html` is the source template (16 lines). `dist/index.html` is the build output (~1.1MB). These are separate files — don't mix them up.