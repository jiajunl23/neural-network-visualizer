import React, { useMemo } from 'react';
import * as THREE from 'three';

const COLORS = {
  skip:            '#6366f1',
  attention:       '#ec407a',
  cross_attention: '#ff9800',
  unet_skip:       '#f59e0b',
};

/**
 * Only renders non-sequential connections.
 * Sequential flow is implied by adjacency — no lines needed.
 */
export default function Connection({ from, to, fromSize, toSize, type = 'sequential', color }) {
  // Skip sequential — adjacency implies flow
  if (type === 'sequential') return null;

  const lineColor = color || COLORS[type] || '#6366f1';

  const geometry = useMemo(() => {
    const start = new THREE.Vector3(
      from[0] + (fromSize ? fromSize[0] / 2 : 0),
      from[1],
      from[2]
    );
    const end = new THREE.Vector3(
      to[0] - (toSize ? toSize[0] / 2 : 0),
      to[1],
      to[2]
    );

    let curve;
    if (type === 'skip' || type === 'unet_skip') {
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
      const dist = start.distanceTo(end);
      mid.y += dist * 0.3;
      mid.z -= dist * 0.12;
      curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    } else {
      const q = new THREE.Vector3().lerpVectors(start, end, 0.25);
      const tq = new THREE.Vector3().lerpVectors(start, end, 0.75);
      q.z += 0.6;
      tq.z -= 0.6;
      curve = new THREE.CubicBezierCurve3(start, q, tq, end);
    }

    return new THREE.TubeGeometry(curve, 24, 0.025, 5, false);
  }, [from, to, fromSize, toSize, type]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={lineColor} transparent opacity={0.55} />
    </mesh>
  );
}
