"""Tool definitions for Claude API and execution handlers."""

import json
import copy


# === TOOL DEFINITIONS (sent to Claude API) ===

SCENE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "model_name": {"type": "string"},
        "model_family": {
            "type": "string",
            "enum": ["feedforward", "cnn", "transformer", "diffusion", "autoencoder", "gan", "rnn", "hybrid"]
        },
        "total_params": {"type": "string", "description": "e.g. '86M', '175B'"},
        "layers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "type": {"type": "string"},
                    "label": {"type": "string"},
                    "params": {
                        "type": "object",
                        "description": "REQUIRED. Output tensor shape. Spatial: {H, W, C}. Dense: {neurons}. Attention: {heads, dim, seq_len}. Flatten: {in_features}. Dropout: {rate}. Activation: {function}."
                    },
                    "color": {"type": "string"},
                    "scale": {"type": "array", "items": {"type": "number"}, "description": "Manual [x,y,z] override."},
                    "repeat": {"type": "integer", "description": "Repeated blocks. Shows ×N badge."}
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
                    "color": {"type": "string"},
                },
                "required": ["from_id", "to_id"]
            }
        },
        "groups": {
            "type": "array",
            "description": "Visual grouping boxes shown in the pipeline diagram. Group related layers with dashed borders.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "label": {"type": "string", "description": "Group label shown on the box, e.g. 'Encoder', 'DiT Block', 'VAE-Decoder'"},
                    "layer_ids": {"type": "array", "items": {"type": "string"}, "description": "IDs of layers in this group"},
                    "repeat": {"type": "integer", "description": "If the entire group repeats, e.g. 12 for transformer blocks"},
                    "style": {"type": "string", "enum": ["dashed", "solid"], "description": "Border style. Default: dashed"},
                    "color": {"type": "string", "description": "Hex color for the group border"},
                },
                "required": ["id", "label", "layer_ids"]
            }
        },
        "animation": {"type": "object"},
        "scene": {"type": "object"},
    },
    "required": ["model_name", "model_family", "layers", "connections"]
}

TOOL_DEFINITIONS = [
    {
        "name": "replace_scene",
        "description": "Create or completely replace the visualization. MUST include groups for pipeline diagram styling. Every layer MUST have params with output tensor dimensions.",
        "input_schema": {
            "type": "object",
            "properties": { "scene_json": SCENE_JSON_SCHEMA },
            "required": ["scene_json"]
        }
    },
    {
        "name": "add_layer",
        "description": "Add a new layer. Specify after_layer_id to insert and auto-rewire.",
        "input_schema": {
            "type": "object",
            "properties": {
                "layer": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"}, "type": {"type": "string"},
                        "label": {"type": "string"}, "params": {"type": "object"},
                        "color": {"type": "string"}, "scale": {"type": "array", "items": {"type": "number"}},
                        "repeat": {"type": "integer"}
                    },
                    "required": ["id", "type", "label", "params"]
                },
                "after_layer_id": {"type": ["string", "null"]}
            },
            "required": ["layer"]
        }
    },
    {
        "name": "remove_layer",
        "description": "Remove a layer by ID. Connections are automatically rewired.",
        "input_schema": {
            "type": "object",
            "properties": { "layer_id": {"type": "string"} },
            "required": ["layer_id"]
        }
    },
    {
        "name": "modify_layer",
        "description": "Modify properties of an existing layer.",
        "input_schema": {
            "type": "object",
            "properties": {
                "layer_id": {"type": "string"},
                "changes": {"type": "object"}
            },
            "required": ["layer_id", "changes"]
        }
    },
    {
        "name": "add_connection",
        "description": "Add a connection between two layers.",
        "input_schema": {
            "type": "object",
            "properties": {
                "from_id": {"type": "string"}, "to_id": {"type": "string"},
                "type": {"type": "string", "enum": ["sequential", "skip", "attention", "cross_attention", "unet_skip"]},
                "color": {"type": "string"},
            },
            "required": ["from_id", "to_id"]
        }
    },
    {
        "name": "remove_connection",
        "description": "Remove a connection between two layers.",
        "input_schema": {
            "type": "object",
            "properties": { "from_id": {"type": "string"}, "to_id": {"type": "string"} },
            "required": ["from_id", "to_id"]
        }
    },
    {
        "name": "update_config",
        "description": "Update scene or animation settings.",
        "input_schema": {
            "type": "object",
            "properties": {
                "scene": {"type": "object"},
                "animation": {"type": "object"}
            }
        }
    }
]


# === EXECUTION HANDLERS ===

DEFAULT_ANIMATION = {"enabled": False}
DEFAULT_SCENE = {
    "background_color": "#ffffff",
    "camera_position": [0, 5, 18],
    "ambient_light": 0.6,
    "directional_light": 0.8,
}


def execute_tool(tool_name: str, tool_input: dict, current_scene: dict | None) -> tuple[dict | None, str]:
    if tool_name == "replace_scene":
        scene = tool_input.get("scene_json", {})
        # Force defaults
        default_anim = DEFAULT_ANIMATION.copy()
        default_sc = DEFAULT_SCENE.copy()
        if "animation" in scene and scene["animation"]:
            default_anim.update(scene["animation"])
        scene["animation"] = default_anim
        if "scene" in scene and scene["scene"]:
            default_sc.update(scene["scene"])
        scene["scene"] = default_sc
        # Ensure groups exists
        if "groups" not in scene:
            scene["groups"] = []
        return scene, f"Scene created: {scene.get('model_name', 'Unknown')} with {len(scene.get('layers', []))} layers."

    if current_scene is None:
        return None, "Error: No scene exists yet. Use replace_scene first."

    scene = copy.deepcopy(current_scene)

    if tool_name == "add_layer":
        layer = tool_input["layer"]
        after_id = tool_input.get("after_layer_id")
        scene["layers"].append(layer)
        if after_id:
            new_id = layer["id"]
            rewired = []
            for conn in scene["connections"]:
                if conn["from_id"] == after_id:
                    rewired.append({"from_id": new_id, "to_id": conn["to_id"], "type": conn.get("type", "sequential")})
                    conn["to_id"] = new_id
            scene["connections"].extend(rewired)
        return scene, f"Added layer '{layer['id']}' ({layer['label']})"

    elif tool_name == "remove_layer":
        layer_id = tool_input["layer_id"]
        incoming = [c for c in scene["connections"] if c["to_id"] == layer_id]
        outgoing = [c for c in scene["connections"] if c["from_id"] == layer_id]
        new_connections = []
        for inc in incoming:
            for out in outgoing:
                new_connections.append({"from_id": inc["from_id"], "to_id": out["to_id"], "type": inc.get("type", "sequential")})
        scene["connections"] = [c for c in scene["connections"] if c["from_id"] != layer_id and c["to_id"] != layer_id]
        scene["connections"].extend(new_connections)
        scene["layers"] = [l for l in scene["layers"] if l["id"] != layer_id]
        # Also remove from groups
        for g in scene.get("groups", []):
            g["layer_ids"] = [lid for lid in g.get("layer_ids", []) if lid != layer_id]
        return scene, f"Removed layer '{layer_id}' and rewired."

    elif tool_name == "modify_layer":
        layer_id = tool_input["layer_id"]
        changes = tool_input["changes"]
        for layer in scene["layers"]:
            if layer["id"] == layer_id:
                for key, value in changes.items():
                    layer[key] = value
                return scene, f"Modified layer '{layer_id}': {', '.join(changes.keys())}"
        return scene, f"Error: Layer '{layer_id}' not found."

    elif tool_name == "add_connection":
        conn = {"from_id": tool_input["from_id"], "to_id": tool_input["to_id"], "type": tool_input.get("type", "sequential")}
        if "color" in tool_input:
            conn["color"] = tool_input["color"]
        scene["connections"].append(conn)
        return scene, f"Added connection: {conn['from_id']} -> {conn['to_id']}"

    elif tool_name == "remove_connection":
        from_id, to_id = tool_input["from_id"], tool_input["to_id"]
        before = len(scene["connections"])
        scene["connections"] = [c for c in scene["connections"] if not (c["from_id"] == from_id and c["to_id"] == to_id)]
        return scene, f"Removed connection: {from_id} -> {to_id}" if len(scene["connections"]) < before else "Connection not found."

    elif tool_name == "update_config":
        if "scene" in tool_input and tool_input["scene"]:
            scene.setdefault("scene", {}).update(tool_input["scene"])
        if "animation" in tool_input and tool_input["animation"]:
            scene.setdefault("animation", {}).update(tool_input["animation"])
        return scene, "Configuration updated."

    return current_scene, f"Unknown tool: {tool_name}"
