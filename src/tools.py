"""Tool definitions for the Scene Builder agent."""

import copy

SCENE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "model_name": {"type": "string"},
        "model_family": {
            "type": "string",
            "enum": ["feedforward", "cnn", "transformer", "diffusion", "autoencoder", "gan", "rnn", "hybrid"]
        },
        "total_params": {"type": "string"},
        "layers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "type": {"type": "string"},
                    "label": {"type": "string"},
                    "params": {"type": "object"},
                    "repeat": {"type": "integer"}
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
                    "type": {"type": "string", "enum": ["sequential", "skip", "attention", "cross_attention", "unet_skip"]},
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
        "description": "Create or replace the 3D feature map scene. Every layer MUST have params with output tensor dimensions.",
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