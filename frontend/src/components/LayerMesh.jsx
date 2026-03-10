import React from 'react';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

const TYPE_COLORS = {
  input:                { fill: '#c8ddf5', edge: '#5b8fd4' },
  conv2d:               { fill: '#fde0d8', edge: '#e06040' },
  conv1d:               { fill: '#fde0d8', edge: '#e06040' },
  pooling:              { fill: '#c892e0', edge: '#8040b0' },
  dense:                { fill: '#b8d8f4', edge: '#2e7abb' },
  batchnorm:            { fill: '#eaeaea', edge: '#aaaaaa' },
  layernorm:            { fill: '#eaeaea', edge: '#aaaaaa' },
  dropout:              { fill: '#f0f0f0', edge: '#bbbbbb' },
  activation:           { fill: '#d0f0d0', edge: '#3d9e3d' },
  flatten:              { fill: '#ddd0f0', edge: '#7c5cbf' },
  embedding:            { fill: '#e8c8f4', edge: '#9345b8' },
  positional_encoding:  { fill: '#f0d8f4', edge: '#a05cc0' },
  multi_head_attention: { fill: '#fdd0e0', edge: '#d44080' },
  cross_attention:      { fill: '#f8e4c4', edge: '#d48830' },
  feed_forward:         { fill: '#b8d8f4', edge: '#2e7abb' },
  transformer_block:    { fill: '#ddd0ee', edge: '#7040b0' },
  residual_block:       { fill: '#fde0d8', edge: '#e06040' },
  unet_down_block:      { fill: '#b8e8e0', edge: '#208878' },
  unet_up_block:        { fill: '#c4ecc4', edge: '#389038' },
  unet_bottleneck:      { fill: '#f4b0b0', edge: '#c03030' },
  vae_encoder:          { fill: '#ddd0ee', edge: '#7040b0' },
  vae_decoder:          { fill: '#ddd0ee', edge: '#7040b0' },
  latent_space:         { fill: '#f4b0b0', edge: '#c03030' },
  output:               { fill: '#f8eeb0', edge: '#c0a020' },
  custom:               { fill: '#eaeaea', edge: '#999999' },
};
const DEFAULT_COLORS = { fill: '#d8d8d8', edge: '#888888' };

export default function LayerMesh({ layer, position, size, annotation }) {
  const colors = TYPE_COLORS[layer.type] || DEFAULT_COLORS;
  const fillColor = layer.color || colors.fill;
  const edgeColor = colors.edge;
  const repeat = layer.repeat || 1;

  const maxDim = Math.max(size[1], size[2], 0.3);
  const annotSize = Math.max(Math.min(maxDim * 0.085, 0.2), 0.09);

  const edgesGeo = React.useMemo(() => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]);
    return new THREE.EdgesGeometry(box);
  }, [size[0], size[1], size[2]]);

  return (
    <group position={position}>
      {/* Single solid block */}
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={fillColor} roughness={0.5} metalness={0.0} />
      </mesh>

      {/* Edge outline */}
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color={edgeColor} transparent opacity={0.6} />
      </lineSegments>

      {/* Repeat badge */}
      {repeat > 1 && (
        <Billboard position={[size[0] / 2 + 0.12, size[1] / 2, 0]}>
          <mesh position={[0.12, 0, -0.001]}>
            <planeGeometry args={[0.35, 0.2]} />
            <meshBasicMaterial color="#ff9800" />
          </mesh>
          <Text fontSize={0.12} color="#ffffff" anchorX="center" anchorY="middle" position={[0.12, 0, 0]}>
            {`×${repeat}`}
          </Text>
        </Billboard>
      )}

      {/* Billboard annotation — type + dimension, always faces camera */}
      {annotation && (
        <Billboard position={[0, size[1] / 2 + 0.15, 0]}>
          <Text fontSize={annotSize} color="#444444" anchorX="center" anchorY="bottom">
            {annotation}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

export { TYPE_COLORS };
