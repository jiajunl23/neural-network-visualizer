"""JSON schema for the neural network scene.

Layers, connections, groups, animation, and scene configuration.
"""

SCENE_SCHEMA = {
    "type": "object",
    "required": ["model_name", "model_family", "layers", "connections"],
    "properties": {
        "model_name": {"type": "string"},
        "model_family": {
            "type": "string",
            "enum": [
                "cnn", "transformer", "diffusion", "autoencoder",
                "gan", "rnn", "feedforward",
            ],
        },
        "total_params": {"type": "string"},
        "layers": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id", "type", "label"],
                "properties": {
                    "id": {"type": "string"},
                    "type": {"type": "string"},
                    "label": {"type": "string"},
                    "params": {"type": "object"},
                    "repeat": {"type": "integer", "minimum": 1},
                    "color": {"type": "string"},
                    "scale": {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3},
                },
            },
        },
        "connections": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["from_id", "to_id"],
                "properties": {
                    "from_id": {"type": "string"},
                    "to_id": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": ["sequential", "skip", "attention", "cross_attention", "unet_skip"],
                    },
                    "color": {"type": "string"},
                },
            },
        },
        "groups": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id", "label", "layer_ids"],
                "properties": {
                    "id": {"type": "string"},
                    "label": {"type": "string"},
                    "layer_ids": {"type": "array", "items": {"type": "string"}},
                    "repeat": {"type": "integer"},
                    "style": {"type": "string", "enum": ["dashed", "solid"]},
                    "color": {"type": "string"},
                },
            },
        },
        "animation": {"type": "object"},
        "scene": {"type": "object"},
    },
}
