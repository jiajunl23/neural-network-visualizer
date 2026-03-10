import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * PipelineDiagram v8 — Auto-sizing iframe
 *
 * Injects a tiny script into the iframe that measures actual content bounds
 * (scrollWidth/scrollHeight) after render and reports back via postMessage.
 * Parent resizes iframe to fit, then auto-zooms to fill the viewer.
 */

// Script injected into iframe to measure and report content size
const MEASURE_SCRIPT = `
<script>
window.addEventListener('load', function() {
  var b = document.body;
  var w = Math.max(b.scrollWidth, b.offsetWidth);
  var h = Math.max(b.scrollHeight, b.offsetHeight);
  // Also check all absolutely positioned children
  var els = document.querySelectorAll('[style*="position"]');
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.right > w) w = Math.ceil(r.right);
    if (r.bottom > h) h = Math.ceil(r.bottom);
  }
  parent.postMessage({type:'pipeline-size', width: w + 40, height: h + 40}, '*');
});
</script>`;

export default function PipelineDiagram({ sceneData }) {
  const html = sceneData?.pipeline_html || '';
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [iframeSize, setIframeSize] = useState({ w: 1400, h: 900 });
  const dragRef = useRef({ active: false, sx: 0, sy: 0, tx: 0, ty: 0 });
  const [fitted, setFitted] = useState(false);

  // Listen for size reports from iframe
  useEffect(() => {
    function onMessage(e) {
      if (e.data?.type === 'pipeline-size') {
        setIframeSize({ w: e.data.width, h: e.data.height });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Auto-fit when iframe reports size or on first load
  useEffect(() => {
    if (!html || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const sx = rect.width / iframeSize.w;
    const sy = rect.height / iframeSize.h;
    const s = Math.min(sx, sy, 2) * 0.88;
    setTransform({
      x: (rect.width - iframeSize.w * s) / 2,
      y: (rect.height - iframeSize.h * s) / 2,
      scale: s,
    });
    setFitted(true);
  }, [html, iframeSize]);

  // Reset fit on new HTML
  useEffect(() => { setFitted(false); setIframeSize({ w: 1400, h: 900 }); }, [html]);

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

  // Inject measurement script into the HTML
  let srcDoc;
  const trimmed = html.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    // Full document — inject script before </body>
    const bodyClose = trimmed.lastIndexOf('</body>');
    if (bodyClose >= 0) {
      srcDoc = trimmed.slice(0, bodyClose) + MEASURE_SCRIPT + trimmed.slice(bodyClose);
    } else {
      srcDoc = trimmed + MEASURE_SCRIPT;
    }
  } else {
    // Fragment — wrap with full document
    srcDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f8f9fb;overflow:visible">${trimmed}${MEASURE_SCRIPT}</body></html>`;
  }

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
          width: iframeSize.w,
          height: iframeSize.h,
          transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          background: '#f8f9fb',
        }}
      />
    </div>
  );
}