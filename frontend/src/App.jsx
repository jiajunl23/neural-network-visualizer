import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import NetworkScene from './components/NetworkScene';
import PipelineDiagram from './components/PipelineDiagram';

const LEGEND_MAP = {
  input:                { label: 'Input',       color: '#c8ddf5', edge: '#5b8fd4' },
  conv2d:               { label: 'Conv',        color: '#fde0d8', edge: '#e06040' },
  conv1d:               { label: 'Conv1d',      color: '#fde0d8', edge: '#e06040' },
  pooling:              { label: 'Pooling',     color: '#c892e0', edge: '#8040b0' },
  dense:                { label: 'FC / Dense',  color: '#b8d8f4', edge: '#2e7abb' },
  batchnorm:            { label: 'BatchNorm',   color: '#eaeaea', edge: '#aaa' },
  layernorm:            { label: 'LayerNorm',   color: '#eaeaea', edge: '#aaa' },
  activation:           { label: 'Activation',  color: '#d0f0d0', edge: '#3d9e3d' },
  flatten:              { label: 'Flatten',     color: '#ddd0f0', edge: '#7c5cbf' },
  dropout:              { label: 'Dropout',     color: '#f0f0f0', edge: '#bbb' },
  embedding:            { label: 'Embedding',   color: '#e8c8f4', edge: '#9345b8' },
  multi_head_attention: { label: 'Attention',   color: '#fdd0e0', edge: '#d44080' },
  cross_attention:      { label: 'Cross-Attn',  color: '#f8e4c4', edge: '#d48830' },
  feed_forward:         { label: 'FFN',         color: '#b8d8f4', edge: '#2e7abb' },
  transformer_block:    { label: 'Transformer', color: '#ddd0ee', edge: '#7040b0' },
  residual_block:       { label: 'Residual',    color: '#fde0d8', edge: '#e06040' },
  unet_down_block:      { label: 'Encoder ↓',   color: '#b8e8e0', edge: '#208878' },
  unet_up_block:        { label: 'Decoder ↑',   color: '#c4ecc4', edge: '#389038' },
  unet_bottleneck:      { label: 'Bottleneck',  color: '#f4b0b0', edge: '#c03030' },
  output:               { label: 'Output',      color: '#f8eeb0', edge: '#c0a020' },
};

const DEFAULT_CAM = [8, 5, 10];

/* ── Tiny tab button ── */
function ViewTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#1a1a2e' : 'transparent',
      color: active ? '#fff' : '#999',
      border: active ? 'none' : '1px solid #e0e0e4',
      borderRadius: 5, padding: '2px 10px', cursor: 'pointer',
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, fontWeight: 500,
      transition: 'all 0.15s', lineHeight: '18px',
    }}>
      {label}
    </button>
  );
}

export default function App({ sceneData }) {
  const controlsRef = useRef();
  const [view, setView] = useState('both');
  const [splitPct, setSplitPct] = useState(38);
  const wrapRef = useRef(null);
  const resizing = useRef(false);

  const resetView = useCallback(() => { controlsRef.current?.reset(); }, []);

  /* ── Resize drag ── */
  const onHandleDown = useCallback((e) => {
    e.preventDefault();
    resizing.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const move = (ev) => {
      if (!resizing.current || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const y = (ev.clientY || ev.touches?.[0]?.clientY) - rect.top;
      setSplitPct(Math.max(12, Math.min(80, (y / rect.height) * 100)));
    };
    const up = () => {
      resizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', up);
  }, []);

  /* ── Legend ── */
  const legendItems = useMemo(() => {
    if (!sceneData?.layers) return [];
    const seen = new Set();
    return sceneData.layers.reduce((acc, l) => {
      if (!seen.has(l.type) && LEGEND_MAP[l.type]) {
        seen.add(l.type);
        acc.push(LEGEND_MAP[l.type]);
      }
      return acc;
    }, []);
  }, [sceneData]);

  const modelName = sceneData?.model_name || '';
  const totalParams = sceneData?.total_params || '';
  const layerCount = sceneData?.layers?.length || 0;

  /* ── Empty state ── */
  if (!sceneData) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#bbb', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13,
        background: '#fff',
      }}>
        Describe a neural network to get started
      </div>
    );
  }

  const showPipeline = view === 'pipeline' || view === 'both';
  const show3D = view === '3d' || view === 'both';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ══ Header bar ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 12px', borderBottom: '1px solid #eaeaef', flexShrink: 0,
        background: '#fff', minHeight: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap' }}>{modelName}</span>
          {totalParams && <span style={{ fontSize: 10.5, color: '#999' }}>· {totalParams}</span>}
          <span style={{ fontSize: 10.5, color: '#bbb' }}>· {layerCount} layers</span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <ViewTab label="Pipeline" active={view === 'pipeline'} onClick={() => setView('pipeline')} />
          <ViewTab label="Features in 3D" active={view === '3d'} onClick={() => setView('3d')} />
          <ViewTab label="Both" active={view === 'both'} onClick={() => setView('both')} />
        </div>
      </div>

      {/* ══ Content area ══ */}
      <div ref={wrapRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>

        {/* ── Pipeline ── */}
        {showPipeline && (
          <div style={{
            height: view === 'both' ? `${splitPct}%` : '100%',
            flexShrink: 0, overflow: 'hidden',
            borderBottom: view === 'both' ? 'none' : undefined,
          }}>
            <PipelineDiagram sceneData={sceneData} />
          </div>
        )}

        {/* ── Resize handle ── */}
        {view === 'both' && (
          <div
            onMouseDown={onHandleDown}
            onTouchStart={onHandleDown}
            style={{
              height: 10, flexShrink: 0, cursor: 'row-resize',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f0f1f3',
              borderTop: '1px solid #e4e5ea',
              borderBottom: '1px solid #e4e5ea',
              zIndex: 5,
            }}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: '#ccc',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.target.style.background = '#999'}
            onMouseLeave={(e) => e.target.style.background = '#ccc'}
            />
          </div>
        )}

        {/* ── 3D Feature Map ── */}
        {show3D && (
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {/* Legend */}
            {legendItems.length > 0 && (
              <div style={{
                position: 'absolute', bottom: 8, right: 8, zIndex: 10,
                background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(10px)',
                border: '1px solid #e8e8ef', borderRadius: 8,
                padding: '6px 10px', pointerEvents: 'none',
              }}>
                {legendItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: i < legendItems.length - 1 ? 3 : 0 }}>
                    <div style={{
                      width: 14, height: 9, borderRadius: 2.5,
                      background: item.color, border: `1.5px solid ${item.edge}`,
                      marginRight: 6, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 9.5, color: '#666', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Explainer — what the blocks mean */}
            <div style={{
              position: 'absolute', top: 6, left: 10, zIndex: 10,
              pointerEvents: 'none', userSelect: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              <span style={{ fontSize: 10, color: '#aaa', letterSpacing: 0.2 }}>
                Each block = output feature tensor after that layer
              </span>
            </div>

            {/* Controls hint */}
            <div style={{
              position: 'absolute', bottom: 6, left: 10, fontSize: 9,
              color: '#c0c0c0', fontFamily: 'Inter, system-ui, sans-serif',
              pointerEvents: 'none', userSelect: 'none',
            }}>
              drag to pan · right-click to rotate · scroll to zoom
            </div>

            {/* Reset */}
            <button onClick={resetView} style={{
              position: 'absolute', top: 6, right: 8, zIndex: 10,
              background: 'rgba(255,255,255,0.9)', border: '1px solid #ddd',
              borderRadius: 5, padding: '3px 9px', cursor: 'pointer',
              fontSize: 10, color: '#777', fontFamily: 'Inter, system-ui, sans-serif',
            }}>↻ Reset</button>

            <Canvas
              camera={{ position: DEFAULT_CAM, fov: 40, near: 0.1, far: 200 }}
              gl={{ antialias: true, alpha: false, toneMapping: 0 }}
              style={{ background: '#fff' }}
            >
              <color attach="background" args={['#ffffff']} />
              <ambientLight intensity={0.9} />
              <directionalLight position={[10, 12, 8]} intensity={0.55} color="#fff" />
              <directionalLight position={[-6, 8, -6]} intensity={0.25} color="#f0f0ff" />
              <NetworkScene sceneData={sceneData} />
              <OrbitControls
                ref={controlsRef}
                enableDamping dampingFactor={0.08}
                minDistance={2} maxDistance={50}
                target={[0, 0, 0]} maxPolarAngle={Math.PI * 0.85}
                screenSpacePanning={true}
                mouseButtons={{ LEFT: 2, MIDDLE: 1, RIGHT: 0 }}
                touches={{ ONE: 1, TWO: 2 }}
              />
            </Canvas>
          </div>
        )}
      </div>
    </div>
  );
}
