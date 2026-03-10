import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * PipelineDiagram v7 — Renders Claude's complete HTML document
 *
 * Claude generates a full HTML page with its own styles.
 * We render it in an iframe and add pan/zoom on the wrapper.
 */

export default function PipelineDiagram({ sceneData }) {
  const html = sceneData?.pipeline_html || '';
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ active: false, sx: 0, sy: 0, tx: 0, ty: 0 });
  const [fitted, setFitted] = useState(false);

  // Auto-fit on load
  useEffect(() => {
    if (!html || !containerRef.current || fitted) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // Parse diagram dimensions from the HTML
    const wMatch = html.match(/width:\s*(\d+)px/);
    const hMatch = html.match(/height:\s*(\d+)px/);
    const dw = wMatch ? parseInt(wMatch[1]) : 900;
    const dh = hMatch ? parseInt(hMatch[1]) : 500;

    const sx = rect.width / dw;
    const sy = rect.height / dh;
    const s = Math.min(sx, sy, 2) * 0.88;
    setTransform({
      x: (rect.width - dw * s) / 2,
      y: (rect.height - dh * s) / 2,
      scale: s,
    });
    setFitted(true);
  }, [html, fitted]);

  useEffect(() => { setFitted(false); }, [html]);

  // Pan
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

  // Zoom
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform(t => {
      const ns = Math.max(0.1, Math.min(t.scale * factor, 5));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: ns };
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const r = ns / t.scale;
      return { x: mx - (mx - t.x) * r, y: my - (my - t.y) * r, scale: ns };
    });
  }, []);

  if (!html) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#ccc', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>No pipeline diagram</span>
      </div>
    );
  }

  // Determine iframe size from content
  const wMatch = html.match(/width:\s*(\d+)px/);
  const hMatch = html.match(/height:\s*(\d+)px/);
  const iframeW = wMatch ? parseInt(wMatch[1]) + 60 : 1000;
  const iframeH = hMatch ? parseInt(hMatch[1]) + 60 : 600;

  // Use the HTML as-is if it's a full document, otherwise wrap it
  const srcDoc = html.trim().startsWith('<!DOCTYPE') || html.trim().startsWith('<html')
    ? html
    : `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f8f9fb">${html}</body></html>`;

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
      <div style={{
        position: 'absolute', bottom: 6, left: 10, fontSize: 9,
        color: '#c0c0c0', fontFamily: 'Inter, system-ui, sans-serif',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        {Math.round(transform.scale * 100)}% · scroll to zoom · drag to pan
      </div>

      <iframe
        srcDoc={srcDoc}
        title="Pipeline Diagram"
        style={{
          border: 'none',
          width: iframeW,
          height: iframeH,
          transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          background: '#f8f9fb',
        }}
      />
    </div>
  );
}