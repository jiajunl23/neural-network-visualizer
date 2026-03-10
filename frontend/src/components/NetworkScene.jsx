import React, { useMemo } from 'react';
import { computeLayout } from '../layout/layoutEngine';
import LayerMesh from './LayerMesh';
import Connection from './Connection';

export default function NetworkScene({ sceneData }) {
  const layout = useMemo(() => computeLayout(sceneData), [sceneData]);
  const layers = sceneData.layers || [];
  const connections = sceneData.connections || [];

  // Compute ground plane extent from layout
  const bounds = useMemo(() => {
    const positions = Object.values(layout);
    if (positions.length === 0) return { minX: -5, maxX: 5, minY: 0, minZ: -3, maxZ: 3 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity, maxZ = -Infinity;
    positions.forEach(({ position: p, size: s }) => {
      minX = Math.min(minX, p[0] - s[0] / 2);
      maxX = Math.max(maxX, p[0] + s[0] / 2);
      minY = Math.min(minY, p[1] - s[1] / 2);
      minZ = Math.min(minZ, p[2] - s[2] / 2);
      maxZ = Math.max(maxZ, p[2] + s[2] / 2);
    });
    return { minX, maxX, minY, minZ, maxZ };
  }, [layout]);

  const groundY = bounds.minY - 0.08;
  const groundWidth = (bounds.maxX - bounds.minX) + 3;
  const groundDepth = (bounds.maxZ - bounds.minZ) + 3;
  const groundCenterX = (bounds.minX + bounds.maxX) / 2;

  return (
    <group>
      {/* Subtle ground shadow plane */}
      <mesh position={[groundCenterX, groundY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundWidth, groundDepth]} />
        <meshBasicMaterial color="#f0f0f0" transparent opacity={0.4} />
      </mesh>

      {/* Connections (non-sequential only — Connection component filters) */}
      {connections.map((conn, i) => {
        const fl = layout[conn.from_id];
        const tl = layout[conn.to_id];
        if (!fl || !tl) return null;
        return (
          <Connection
            key={`${conn.from_id}-${conn.to_id}-${i}`}
            from={fl.position}
            to={tl.position}
            fromSize={fl.size}
            toSize={tl.size}
            type={conn.type || 'sequential'}
            color={conn.color}
          />
        );
      })}

      {/* Layers */}
      {layers.map(layer => {
        const l = layout[layer.id];
        if (!l) return null;
        return (
          <LayerMesh
            key={layer.id}
            layer={{ ...layer, repeat: l.repeat }}
            position={l.position}
            size={l.size}
            annotation={l.annotation}
          />
        );
      })}
    </group>
  );
}
