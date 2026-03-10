/**
 * Layout engine v6 — Unified tensor sizing
 *
 * EVERYTHING is an H×W×C tensor:
 *   Conv 224×224×64  → tall wide thin slab
 *   Conv 7×7×512     → tiny chunky cube
 *   FC 4096          → 1×1×4096 → flat thick bar
 *   FC 1000          → 1×1×1000 → flat medium bar
 *   Softmax 1000     → 1×1×1000 → same as FC but different color
 *
 * Visual mapping:
 *   X axis = channel depth (C)  → channelToVisual()
 *   Y axis = spatial height (H) → spatialToVisual()
 *   Z axis = spatial width (W)  → spatialToVisual()
 *
 * All blocks center-aligned on Y=0, Z=0.
 */

const SPATIAL_REF = 224;
const SPATIAL_MAX = 4.0;
const SPATIAL_MIN = 0.15;     // minimum so 1×1 layers are visible
const SPATIAL_POWER = 0.65;

const CHANNEL_REF_SQRT = Math.sqrt(512);
const CHANNEL_SCALE = 2.8;
const CHANNEL_MIN = 0.06;
const CHANNEL_MAX = 6.0;      // raised: allows FC-4096 to be clearly thicker than conv-512

const SAME_TYPE_GAP = 0.03;
const TRANSITION_GAP = 0.25;

function spatialToVisual(dim) {
  if (!dim || dim <= 0) return SPATIAL_MIN;
  return Math.max(Math.pow(dim / SPATIAL_REF, SPATIAL_POWER) * SPATIAL_MAX, SPATIAL_MIN);
}

function channelToVisual(c) {
  if (!c || c <= 0) return 0.1;
  return Math.max(Math.min((Math.sqrt(c) / CHANNEL_REF_SQRT) * CHANNEL_SCALE, CHANNEL_MAX), CHANNEL_MIN);
}

/**
 * Unified block sizing. Everything becomes H×W×C.
 */
export function computeBlockSize(layer) {
  const p = layer.params || {};

  // Extract spatial params
  let H = p.H || p.height || null;
  let W = p.W || p.width || null;
  let C = p.C || p.channels || p.filters || null;
  const neurons = p.neurons || p.units || null;
  const dim = p.dim || p.d_model || null;
  const heads = p.heads || null;
  const seqLen = p.seq_len || null;
  const features = p.features || null;
  const vocabSize = p.vocab_size || null;
  const rate = p.rate || null;
  const fn = p.function || p.activation || null;
  const inFeatures = p.in_features || null;

  // Manual override
  if (layer.scale && layer.scale.length === 3) {
    let ann = '';
    if (H && W && C) ann = `${H}×${W}×${C}`;
    else if (neurons) ann = `1×1×${neurons}`;
    return { size: layer.scale, annotation: ann };
  }

  // ── Spatial layers: conv, pooling, input (H×W×C) ──
  if (H && W && C) {
    return {
      size: [channelToVisual(C), spatialToVisual(H), spatialToVisual(W)],
      annotation: `${H}×${W}×${C}`
    };
  }

  // ── Dense/FC layers → 1×1×neurons (unified with conv) ──
  if (neurons) {
    return {
      size: [channelToVisual(neurons), SPATIAL_MIN, SPATIAL_MIN],
      annotation: `1×1×${neurons}`
    };
  }

  // ── Attention ──
  if (heads && dim) {
    const s = Math.max(Math.min(Math.sqrt(dim) / 8, 2.5), 0.5);
    const sx = Math.max(Math.min(heads * 0.1, 2.0), 0.3);
    return { size: [sx, s, s], annotation: `${seqLen || '?'}×${dim}` };
  }

  // ── Embedding ──
  if (vocabSize && dim) {
    const s = Math.max(Math.min(Math.pow(vocabSize / 30000, 0.3) * 2.0, 3.0), 0.5);
    const sx = Math.max(Math.min(Math.sqrt(dim) / 12, 1.5), 0.2);
    return { size: [sx, s, s * 0.6], annotation: `${vocabSize}×${dim}` };
  }

  // ── Transformer block ──
  if (dim) {
    const s = Math.max(Math.min(Math.sqrt(dim) / 8, 2.5), 0.5);
    return { size: [0.5, s, s], annotation: `${seqLen || '?'}×${dim}` };
  }

  // ── Flatten → output is 1×1×features ──
  if (inFeatures) {
    return {
      size: [channelToVisual(inFeatures) * 0.3, SPATIAL_MIN, SPATIAL_MIN],
      annotation: `1×1×${inFeatures}`
    };
  }

  // ── Normalization — passes through shape, show features ──
  if (features) {
    const s = Math.max(Math.min(Math.sqrt(features) / 10, 2.0), 0.3);
    return { size: [0.04, s, s], annotation: `${features}` };
  }

  // ── Dropout — shape passthrough, no annotation needed ──
  if (rate !== null && rate !== undefined) {
    return { size: [0.06, 0.5, 0.5], annotation: '' };
  }

  // ── Activation — shape passthrough, no annotation needed ──
  if (fn) {
    return { size: [0.06, 0.5, 0.5], annotation: '' };
  }

  // ── Fallback ──
  return { size: [0.3, 0.6, 0.6], annotation: '' };
}

function sameGroup(typeA, typeB) {
  if (!typeA || !typeB) return false;
  if (typeA === typeB) return true;
  const convGroup = new Set(['conv2d', 'conv1d', 'batchnorm', 'activation', 'layernorm']);
  if (convGroup.has(typeA) && convGroup.has(typeB)) return true;
  const denseGroup = new Set(['dense', 'activation', 'dropout']);
  if (denseGroup.has(typeA) && denseGroup.has(typeB)) return true;
  return false;
}

function layoutSequential(layers) {
  const result = {};
  let x = 0;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const { size, annotation } = computeBlockSize(layer);

    let gap = TRANSITION_GAP;
    if (i > 0) {
      gap = sameGroup(layers[i - 1].type, layer.type) ? SAME_TYPE_GAP : TRANSITION_GAP;
    }
    if (i > 0) x += gap;
    x += size[0] / 2;
    result[layer.id] = { position: [x, 0, 0], size, annotation, repeat: layer.repeat || 1 };
    x += size[0] / 2;
  }

  const offsetX = x / 2;
  Object.values(result).forEach(v => { v.position[0] -= offsetX; });
  return result;
}

function layoutTransformer(layers) {
  const result = {};
  let y = 0;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const { size, annotation } = computeBlockSize(layer);

    let gap = i > 0 ? (sameGroup(layers[i - 1].type, layer.type) ? SAME_TYPE_GAP : TRANSITION_GAP * 0.7) : 0;
    if (i > 0) y += gap;
    y += size[1] / 2;
    result[layer.id] = { position: [0, y, 0], size, annotation, repeat: layer.repeat || 1 };
    y += size[1] / 2;
  }

  const offsetY = y / 2;
  Object.values(result).forEach(v => { v.position[1] -= offsetY; });
  return result;
}

function layoutUNet(layers) {
  const result = {};
  const down = [], up = [], other = [];
  let bottle = null;

  layers.forEach(l => {
    if (l.type === 'unet_down_block' || l.type === 'vae_encoder') down.push(l);
    else if (l.type === 'unet_up_block' || l.type === 'vae_decoder') up.push(l);
    else if (l.type === 'unet_bottleneck' || l.type === 'latent_space') bottle = l;
    else other.push(l);
  });

  const armX = 4, levelGap = 3;

  down.forEach((layer, i) => {
    const { size, annotation } = computeBlockSize(layer);
    result[layer.id] = { position: [-armX, -i * levelGap, 0], size, annotation, repeat: layer.repeat || 1 };
  });

  if (bottle) {
    const { size, annotation } = computeBlockSize(bottle);
    result[bottle.id] = { position: [0, -(down.length) * levelGap, 0], size, annotation, repeat: 1 };
  }

  up.forEach((layer, i) => {
    const { size, annotation } = computeBlockSize(layer);
    const startY = bottle ? -((down.length - 1) * levelGap) : -(up.length * levelGap);
    result[layer.id] = { position: [armX, startY + i * levelGap, 0], size, annotation, repeat: layer.repeat || 1 };
  });

  let ey = 3;
  other.forEach(layer => {
    const { size, annotation } = computeBlockSize(layer);
    result[layer.id] = { position: [0, ey, 0], size, annotation, repeat: layer.repeat || 1 };
    ey += size[1] + 1.5;
  });

  return result;
}

export function computeLayout(sceneData) {
  const family = sceneData.model_family || 'feedforward';
  const layers = sceneData.layers || [];

  switch (family) {
    case 'cnn': case 'feedforward': case 'rnn': case 'gan':
      return layoutSequential(layers);
    case 'transformer':
      return layoutTransformer(layers);
    case 'diffusion': case 'autoencoder':
      return layoutUNet(layers);
    default:
      return layoutSequential(layers);
  }
}
