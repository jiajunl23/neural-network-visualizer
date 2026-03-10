# Neural Network Visualizer

Describe any neural network → get a dual pipeline + 3D feature visualization → refine with chat.

## Quick Start

```bash
pip install -r requirements.txt
streamlit run app.py
```

Enter your Claude API key and start describing architectures.

## Features

- **Dual view**: 2D pipeline diagram (operation flow, groups, arrows) + 3D feature map (output tensor shapes)
- **Pipeline diagram**: Pan/zoom, group boxes with dashed borders, repeat badges, hover tooltips
- **Features in 3D**: Dimension-proportional blocks sized to H×W×C, pan/rotate/zoom
- **Resizable split**: Drag the handle between views to resize
- **Planner → Builder pipeline**: AI planner analyzes visual hierarchy before builder generates the scene
- **Chat refinement**: "Add dropout after each conv", "Change skip connections to purple"
- **Export**: Download as standalone HTML file — opens in any browser

## Example Prompts

- "VGG-16 architecture"
- "ResNet-18 with skip connections"
- "Vision Transformer (ViT-B/16)"
- "Simple 3-layer MLP"
- "Stable Diffusion U-Net"

## Example Output:

An example exported output of VGG16 is in the examples folder

## Development

To modify the frontend source and rebuild:

```bash
cd frontend && npm install && npm run build && cd ..
```

The pre-built `dist/index.html` is included — this step is only needed if you edit files in `frontend/src/`.