"""Tool definitions for the Scene Builder agent.

Comprehensive schema covering all major neural network layer types.
The frontend renders 3D blocks with colors based on `type` and
sizes based on `params`.
"""

import copy

# All layer types supported by the frontend renderer
LAYER_TYPES = [
    # ── Input / Output ──
    "input",                  # Network input
    "output",                 # Final output

    # ── Convolution ──
    "conv2d",                 # 2D convolution (+ optional BN/ReLU folded in)
    "conv1d",                 # 1D convolution
    "depthwise_conv",         # Depthwise separable convolution
    "deconv",                 # Transposed convolution (upsampling)

    # ── Pooling / Resampling ──
    "pooling",                # MaxPool, AvgPool, AdaptivePool
    "upsample",               # Upsample / interpolate

    # ── Fully Connected ──
    "dense",                  # Linear / FC / MLP layer

    # ── Normalization ──
    "batchnorm",              # Batch normalization
    "layernorm",              # Layer normalization
    "groupnorm",              # Group normalization
    "instancenorm",           # Instance normalization

    # ── Activation ──
    "activation",             # ReLU, GELU, SiLU, Sigmoid, Softmax, etc.

    # ── Regularization ──
    "dropout",                # Dropout / DropPath

    # ── Reshape ──
    "flatten",                # Flatten spatial dims
    "reshape",                # General reshape / permute

    # ── Attention ──
    "multi_head_attention",   # Self-attention
    "cross_attention",        # Cross-attention (Q from one path, K/V from another)
    "self_attention",         # Alias for multi_head_attention

    # ── Embedding ──
    "embedding",              # Token / patch embedding
    "positional_encoding",    # Positional encoding

    # ── Transformer ──
    "feed_forward",           # FFN / MLP inside transformer
    "transformer_block",      # Full transformer layer

    # ── Residual / Skip ──
    "residual_block",         # Residual block (conv + skip)
    "squeeze_excitation",     # SE block (channel attention)

    # ── U-Net ──
    "unet_down_block",        # Encoder stage
    "unet_up_block",          # Decoder stage
    "unet_bottleneck",        # Mid / bottleneck block

    # ── VAE / Generative ──
    "vae_encoder",
    "vae_decoder",
    "latent_space",

    # ── RNN ──
    "lstm",
    "gru",
    "rnn",

    # ── Detection / Segmentation ──
    "roi_pool",
    "anchor_head",
    "segmentation_head",

    # ── Merge operations ──
    "concatenate",            # Concat along channel dim
    "add",                    # Element-wise add (residual merge)
    "multiply",               # Element-wise multiply (gating)

    # ── Catch-all ──
    "custom",
]

CONNECTION_TYPES = [
    "sequential",
    "skip",
    "attention",
    "cross_attention",
    "unet_skip",
    "feedback",
    "adversarial",
]

SCENE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "model_name": {"type": "string"},
        "model_family": {
            "type": "string",
            "enum": ["feedforward", "cnn", "transformer", "diffusion", "autoencoder", "gan", "rnn", "hybrid"]
        },
        "total_params": {"type": "string", "description": "e.g. '138M', '11.2B'"},
        "layers": {
            "type": "array",
            "description": "Each layer = one 3D block. Size computed from params. Color from type.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Unique ID, e.g. 'conv1', 'enc_attn_3'"},
                    "type": {
                        "type": "string",
                        "enum": LAYER_TYPES,
                        "description": "Determines block color in 3D"
                    },
                    "label": {"type": "string", "description": "Short label, e.g. 'Conv2d', 'Self Attn'"},
                    "params": {
                        "type": "object",
                        "description": """Output tensor shape — determines block SIZE.

Spatial (conv, pool, input, deconv, upsample):
  {"H": 224, "W": 224, "C": 64}

Dense / FC:
  {"neurons": 4096}  → renders as 1×1×4096

Attention (self, cross, multi_head):
  {"heads": 12, "dim": 768, "seq_len": 197}

Embedding:
  {"vocab_size": 30000, "dim": 768}

Transformer block:
  {"dim": 768, "seq_len": 197}

Flatten:
  {"in_features": 25088}

Normalization (batch, layer, group, instance):
  {"features": 512}

Dropout:
  {"rate": 0.5}

Activation:
  {"function": "relu"}  — or gelu, silu, sigmoid, softmax, swish, mish

RNN / LSTM / GRU:
  {"hidden_size": 512, "seq_len": 100}

Merge (concatenate, add, multiply):
  Use output shape, e.g. {"H": 32, "W": 32, "C": 640}

Squeeze-excitation:
  {"C": 512, "reduction": 16}

Detection heads:
  {"num_classes": 80, "num_anchors": 9}"""
                    },
                    "repeat": {
                        "type": "integer",
                        "description": "Compress N identical blocks → one block with ×N badge"
                    }
                },
                "required": ["id", "type", "label", "params"]
            }
        },
        "connections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "from_id": {"type": "string"},
                    "to_id": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": CONNECTION_TYPES
                    },
                },
                "required": ["from_id", "to_id"]
            }
        },
        "groups": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "label": {"type": "string"},
                    "layer_ids": {"type": "array", "items": {"type": "string"}},
                    "repeat": {"type": "integer"},
                },
                "required": ["id", "label", "layer_ids"]
            }
        },
    },
    "required": ["model_name", "model_family", "layers", "connections"]
}

TOOL_DEFINITIONS = [
    {
        "name": "replace_scene",
        "description": "Create or replace the 3D feature map. Every layer MUST have params with correct output tensor dimensions. Use repeat to compress identical consecutive layers.",
        "input_schema": {
            "type": "object",
            "properties": {"scene_json": SCENE_JSON_SCHEMA},
            "required": ["scene_json"]
        }
    },
]

DEFAULT_SCENE = {
    "background_color": "#ffffff",
    "camera_position": [0, 5, 18],
    "ambient_light": 0.6,
    "directional_light": 0.8,
}


def execute_tool(tool_name: str, tool_input: dict, current_scene: dict | None) -> tuple[dict | None, str]:
    if tool_name == "replace_scene":
        scene = tool_input.get("scene_json", {})
        scene.setdefault("animation", {"enabled": False})
        default_sc = DEFAULT_SCENE.copy()
        if "scene" in scene and scene["scene"]:
            default_sc.update(scene["scene"])
        scene["scene"] = default_sc
        scene.setdefault("groups", [])
        return scene, f"Scene created: {scene.get('model_name', 'Unknown')} with {len(scene.get('layers', []))} layers."

    return current_scene, f"Unknown tool: {tool_name}"