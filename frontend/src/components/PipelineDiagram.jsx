import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';

/**
 * Pipeline Diagram v3 — Professional architecture diagram
 *
 * Reference: Hunyuan3D-DiT style
 * - Rounded blocks with gradient fills + subtle shadows
 * - Group boxes with dashed/solid borders + title labels + repeat badges
 * - Orthogonal arrow routing with clean bezier curves
 * - Mouse pan (drag) + zoom (scroll wheel, pinch)
 * - Auto-fit on load
 * - Hover highlight
 */

const NODE_W = 120;
const NODE_H = 36;
const COL_GAP = 54;
const ROW_GAP = 22;
const PAD = 50;
const GROUP_PAD_X = 18;
const GROUP_PAD_Y = 28;
const GROUP_TITLE_H = 20;

/* ── Color palette by layer type ── */
const PALETTE = {
  input:                { fill: '#e3eef9', stroke: '#5b8fd4', text: '#2a5a9a', grad: '#c8ddf5' },
  conv2d:               { fill: '#fde0d8', stroke: '#e06040', text: '#8b2a1a', grad: '#f9c4b4' },
  conv1d:               { fill: '#fde0d8', stroke: '#e06040', text: '#8b2a1a', grad: '#f9c4b4' },
  pooling:              { fill: '#c892e0', stroke: '#8040b0', text: '#fff',    grad: '#b070d0' },
  dense:                { fill: '#b8d8f4', stroke: '#2e7abb', text: '#1a4a7a', grad: '#92c4ea' },
  batchnorm:            { fill: '#eaeaea', stroke: '#aaa',    text: '#555',    grad: '#ddd' },
  layernorm:            { fill: '#eaeaea', stroke: '#aaa',    text: '#555',    grad: '#ddd' },
  dropout:              { fill: '#f0f0f0', stroke: '#bbb',    text: '#777',    grad: '#e4e4e4' },
  activation:           { fill: '#d0f0d0', stroke: '#3d9e3d', text: '#1a6a1a', grad: '#aae0aa' },
  flatten:              { fill: '#ddd0f0', stroke: '#7c5cbf', text: '#4a2a8a', grad: '#cbb8e8' },
  embedding:            { fill: '#e8c8f4', stroke: '#9345b8', text: '#5a1a7a', grad: '#d8aae8' },
  positional_encoding:  { fill: '#f0d8f4', stroke: '#a05cc0', text: '#6a2a8a', grad: '#e0bce8' },
  multi_head_attention: { fill: '#fdd0e0', stroke: '#d44080', text: '#8a1a4a', grad: '#f4b0c8' },
  cross_attention:      { fill: '#f8e4c4', stroke: '#d48830', text: '#7a4a10', grad: '#f0d098' },
  feed_forward:         { fill: '#b8d8f4', stroke: '#2e7abb', text: '#1a4a7a', grad: '#92c4ea' },
  transformer_block:    { fill: '#ddd0ee', stroke: '#7040b0', text: '#4a2080', grad: '#cbb8e0' },
  residual_block:       { fill: '#fde0d8', stroke: '#e06040', text: '#8b2a1a', grad: '#f9c4b4' },
  unet_down_block:      { fill: '#b8e8e0', stroke: '#208878', text: '#0a5a4a', grad: '#90d8cc' },
  unet_up_block:        { fill: '#c4ecc4', stroke: '#389038', text: '#1a5a1a', grad: '#a0dca0' },
  unet_bottleneck:      { fill: '#f4b0b0', stroke: '#c03030', text: '#6a1010', grad: '#e89090' },
  vae_encoder:          { fill: '#ddd0ee', stroke: '#7040b0', text: '#4a2080', grad: '#cbb8e0' },
  vae_decoder:          { fill: '#ddd0ee', stroke: '#7040b0', text: '#4a2080', grad: '#cbb8e0' },
  latent_space:         { fill: '#f4b0b0', stroke: '#c03030', text: '#6a1010', grad: '#e89090' },
  output:               { fill: '#f8eeb0', stroke: '#c0a020', text: '#6a5a00', grad: '#f0e080' },
  custom:               { fill: '#eaeaea', stroke: '#999',    text: '#555',    grad: '#ddd' },
};
const DEF_PAL = { fill: '#eaeaea', stroke: '#999', text: '#555', grad: '#ddd' };

/* ── Group border styles ── */
const GROUP_COLORS = [
  { stroke: '#3a7cc6', bg: 'rgba(58,124,198,0.05)', title: '#3a7cc6' },
  { stroke: '#c45e3a', bg: 'rgba(196,94,58,0.05)',  title: '#c45e3a' },
  { stroke: '#2a9960', bg: 'rgba(42,153,96,0.05)',  title: '#2a9960' },
  { stroke: '#9040a0', bg: 'rgba(144,64,160,0.05)', title: '#9040a0' },
  { stroke: '#b89020', bg: 'rgba(184,144,32,0.05)', title: '#b89020' },
  { stroke: '#d04080', bg: 'rgba(208,64,128,0.05)', title: '#d04080' },
];

export default function PipelineDiagram({ sceneData }) {
  const layers = sceneData?.layers || [];
  const connections = sceneData?.connections || [];
  const groups = sceneData?.groups || [];

  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ active: false, sx: 0, sy: 0, tx: 0, ty: 0 });
  const [hoveredId, setHoveredId] = useState(null);
  const [fitted, setFitted] = useState(false);

  /* ── Layout computation ── */
  const layout = useMemo(() => {
    if (!layers.length) return null;

    // Adjacency
    const inMap = {}, outMap = {};
    layers.forEach(l => { inMap[l.id] = []; outMap[l.id] = []; });
    connections.forEach(c => {
      if (outMap[c.from_id]) outMap[c.from_id].push(c.to_id);
      if (inMap[c.to_id]) inMap[c.to_id].push(c.from_id);
    });

    // Topological column (longest path from roots)
    const col = {};
    const visited = {};
    function assignCol(id) {
      if (visited[id] !== undefined) return visited[id];
      visited[id] = -1; // cycle guard
      const parents = inMap[id] || [];
      const c = parents.length === 0 ? 0 : Math.max(...parents.map(assignCol)) + 1;
      visited[id] = c;
      col[id] = c;
      return c;
    }
    layers.forEach(l => assignCol(l.id));

    // Group by column
    const columns = {};
    layers.forEach(l => {
      const c = col[l.id] || 0;
      if (!columns[c]) columns[c] = [];
      columns[c].push(l);
    });

    const maxCol = Math.max(...Object.keys(columns).map(Number), 0);
    const maxRows = Math.max(...Object.values(columns).map(g => g.length), 1);
    const totalH = maxRows * (NODE_H + ROW_GAP) - ROW_GAP + PAD * 2;

    // Position nodes — center each column vertically
    const nodePos = {};
    for (let c = 0; c <= maxCol; c++) {
      const grp = columns[c] || [];
      const grpH = grp.length * (NODE_H + ROW_GAP) - ROW_GAP;
      const yOff = (totalH - PAD * 2 - grpH) / 2;
      grp.forEach((layer, idx) => {
        nodePos[layer.id] = {
          x: PAD + c * (NODE_W + COL_GAP),
          y: PAD + yOff + idx * (NODE_H + ROW_GAP),
          layer,
        };
      });
    }

    // Group boxes
    const groupBoxes = groups.map((g, gi) => {
      const members = (g.layer_ids || []).filter(id => nodePos[id]).map(id => nodePos[id]);
      if (!members.length) return null;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      members.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + NODE_W);
        maxY = Math.max(maxY, n.y + NODE_H);
      });

      const gStyle = GROUP_COLORS[gi % GROUP_COLORS.length];
      return {
        x: minX - GROUP_PAD_X,
        y: minY - GROUP_PAD_Y - GROUP_TITLE_H,
        w: maxX - minX + GROUP_PAD_X * 2,
        h: maxY - minY + GROUP_PAD_Y * 2 + GROUP_TITLE_H,
        label: g.label || '',
        repeat: g.repeat || null,
        style: g.style || 'dashed',
        stroke: g.color || gStyle.stroke,
        bg: gStyle.bg,
        titleColor: g.color || gStyle.title,
      };
    }).filter(Boolean);

    // Edges
    const edges = connections
      .filter(c => nodePos[c.from_id] && nodePos[c.to_id])
      .map(c => ({
        from: nodePos[c.from_id],
        to: nodePos[c.to_id],
        type: c.type || 'sequential',
        color: c.color || null,
      }));

    const totalW = (maxCol + 1) * (NODE_W + COL_GAP) - COL_GAP + PAD * 2;
    return { nodes: Object.values(nodePos), edges, groupBoxes, width: totalW, height: totalH };
  }, [layers, connections, groups]);

  /* ── Auto-fit on first render ── */
  useEffect(() => {
    if (!layout || !containerRef.current || fitted) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const sx = rect.width / layout.width;
    const sy = rect.height / layout.height;
    const s = Math.min(sx, sy, 2.5) * 0.9;
    setTransform({
      x: (rect.width - layout.width * s) / 2,
      y: (rect.height - layout.height * s) / 2,
      scale: s,
    });
    setFitted(true);
  }, [layout, fitted]);

  useEffect(() => { setFitted(false); }, [sceneData]);

  /* ── Pan ── */
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    setTransform(t => ({
      ...t,
      x: dragRef.current.tx + (e.clientX - dragRef.current.sx),
      y: dragRef.current.ty + (e.clientY - dragRef.current.sy),
    }));
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current.active = false; }, []);

  /* ── Zoom ── */
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform(t => {
      const ns = Math.max(0.15, Math.min(t.scale * factor, 5));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: ns };
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const r = ns / t.scale;
      return { x: mx - (mx - t.x) * r, y: my - (my - t.y) * r, scale: ns };
    });
  }, []);

  if (!layout || !layout.nodes.length) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#ccc', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>No pipeline data</span>
      </div>
    );
  }

  const { nodes, edges, groupBoxes, width, height } = layout;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{
        width: '100%', height: '100%', overflow: 'hidden',
        cursor: dragRef.current.active ? 'grabbing' : 'grab',
        background: '#f8f9fb', position: 'relative', touchAction: 'none',
      }}
    >
      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 6, left: 10, fontSize: 9,
        color: '#c0c0c0', fontFamily: 'Inter, system-ui, sans-serif',
        pointerEvents: 'none', userSelect: 'none', letterSpacing: 0.2,
      }}>
        {Math.round(transform.scale * 100)}% · scroll to zoom · drag to pan
      </div>

      <svg
        width={width} height={height}
        style={{
          transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0', userSelect: 'none',
        }}
      >
        <defs>
          {/* Gradient definitions for each node */}
          {nodes.map(n => {
            const p = PALETTE[n.layer.type] || DEF_PAL;
            return (
              <linearGradient key={`g-${n.layer.id}`} id={`grad-${n.layer.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={p.fill} />
                <stop offset="100%" stopColor={p.grad} />
              </linearGradient>
            );
          })}

          {/* Arrow markers */}
          <marker id="arr" viewBox="0 0 12 8" refX="11" refY="4" markerWidth="9" markerHeight="7" orient="auto">
            <path d="M0 0.5L11 4L0 7.5z" fill="#b0b4c0" />
          </marker>
          <marker id="arr-special" viewBox="0 0 12 8" refX="11" refY="4" markerWidth="9" markerHeight="7" orient="auto">
            <path d="M0 0.5L11 4L0 7.5z" fill="#6366f1" />
          </marker>

          {/* Node shadow */}
          <filter id="nodeShadow" x="-8%" y="-8%" width="116%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.07" />
          </filter>

          {/* Group shadow */}
          <filter id="groupShadow" x="-2%" y="-2%" width="104%" height="106%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.04" />
          </filter>
        </defs>

        {/* ── Group boxes (behind everything) ── */}
        {groupBoxes.map((g, i) => (
          <g key={`grp-${i}`} filter="url(#groupShadow)">
            <rect
              x={g.x} y={g.y} width={g.w} height={g.h}
              rx={12} ry={12}
              fill={g.bg}
              stroke={g.stroke}
              strokeWidth={1.8}
              strokeDasharray={g.style === 'solid' ? 'none' : '8,5'}
            />
            {/* Title */}
            <text
              x={g.x + 14} y={g.y + 15}
              fontSize={11} fontWeight={700}
              fill={g.titleColor}
              fontFamily="Inter, system-ui, sans-serif"
              letterSpacing={0.3}
            >
              {g.label}
            </text>
            {/* Repeat badge on group */}
            {g.repeat && (
              <g>
                <rect
                  x={g.x + g.w - 40} y={g.y - 10}
                  width={36} height={20} rx={10}
                  fill={g.stroke}
                />
                <text
                  x={g.x + g.w - 22} y={g.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#fff" fontSize={10} fontWeight={700}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  ×{g.repeat}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* ── Edges ── */}
        {edges.map((e, i) => {
          const x1 = e.from.x + NODE_W;
          const y1 = e.from.y + NODE_H / 2;
          const x2 = e.to.x;
          const y2 = e.to.y + NODE_H / 2;
          const isSpecial = e.type !== 'sequential';
          const edgeColor = e.color || (isSpecial ? '#6366f1' : '#c0c4d0');

          // Smooth bezier with proportional control points
          const dx = Math.abs(x2 - x1);
          const cp = Math.max(dx * 0.38, 24);
          const d = `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`;

          return (
            <path key={`e-${i}`} d={d} fill="none"
              stroke={edgeColor}
              strokeWidth={isSpecial ? 2 : 1.4}
              strokeDasharray={isSpecial ? '6,4' : 'none'}
              markerEnd={isSpecial ? 'url(#arr-special)' : 'url(#arr)'}
              opacity={0.85}
            />
          );
        })}

        {/* ── Nodes ── */}
        {nodes.map(n => {
          const p = PALETTE[n.layer.type] || DEF_PAL;
          const label = n.layer.label || n.layer.type || '';
          const repeat = n.layer.repeat || 1;
          const displayLabel = label.length > 15 ? label.slice(0, 14) + '…' : label;
          const isHovered = hoveredId === n.layer.id;

          return (
            <g
              key={n.layer.id}
              filter="url(#nodeShadow)"
              onPointerEnter={() => setHoveredId(n.layer.id)}
              onPointerLeave={() => setHoveredId(null)}
              style={{ cursor: 'default' }}
            >
              {/* Hover glow */}
              {isHovered && (
                <rect
                  x={n.x - 3} y={n.y - 3}
                  width={NODE_W + 6} height={NODE_H + 6}
                  rx={10} ry={10}
                  fill="none" stroke={p.stroke} strokeWidth={2}
                  opacity={0.3}
                />
              )}

              {/* Block body */}
              <rect
                x={n.x} y={n.y} width={NODE_W} height={NODE_H}
                rx={8} ry={8}
                fill={`url(#grad-${n.layer.id})`}
                stroke={p.stroke}
                strokeWidth={isHovered ? 2 : 1.5}
              />

              {/* Label */}
              <text
                x={n.x + NODE_W / 2} y={n.y + NODE_H / 2 + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill={p.text}
                fontSize={11.5} fontWeight={600}
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing={0.2}
              >
                {displayLabel}
              </text>

              {/* Individual repeat badge */}
              {repeat > 1 && (
                <g>
                  <rect
                    x={n.x + NODE_W - 10} y={n.y - 9}
                    width={30} height={18} rx={9}
                    fill="#ff9800"
                    stroke="#fff" strokeWidth={1.5}
                  />
                  <text
                    x={n.x + NODE_W + 5} y={n.y}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#fff" fontSize={9.5} fontWeight={700}
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    ×{repeat}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}