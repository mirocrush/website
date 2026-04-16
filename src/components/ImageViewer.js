import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

export default function ImageViewer({ images, startIndex = 0, onClose }) {
  const [idx, setIdx]       = useState(startIndex);
  const [zoom, setZoom]     = useState(1);
  const [pan, setPan]       = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const current = Array.isArray(images) ? images[idx] : images;
  const total   = Array.isArray(images) ? images.length : 1;

  const reset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const goNext = useCallback(() => {
    setIdx(i => (i + 1) % total);
    reset();
  }, [total, reset]);

  const goPrev = useCallback(() => {
    setIdx(i => (i - 1 + total) % total);
    reset();
  }, [total, reset]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')      { onClose(); }
      else if (e.key === '+'  || e.key === '=') setZoom(z => Math.min(8, +(z + 0.3).toFixed(2)));
      else if (e.key === '-')      setZoom(z => Math.max(0.2, +(z - 0.3).toFixed(2)));
      else if (e.key === '0')      reset();
      else if (e.key === 'ArrowRight' && total > 1) goNext();
      else if (e.key === 'ArrowLeft'  && total > 1) goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, reset, goNext, goPrev, total]);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(z => Math.max(0.2, Math.min(8, +(z + delta).toFixed(2))));
  }, []);

  // Drag pan
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const handleMouseMove = (e) => {
    if (!dragging) return;
    const { mx, my, px, py } = dragOrigin.current;
    setPan({ x: px + (e.clientX - mx), y: py + (e.clientY - my) });
  };
  const handleMouseUp = () => setDragging(false);

  // Touch support
  const lastTouch = useRef(null);
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y };
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;
      setPan({ x: lastTouch.current.px + dx, y: lastTouch.current.py + dy });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center select-none"
      style={{ background: 'rgba(0,0,0,0.94)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
        <div className="text-sm truncate max-w-xs" style={{ color: 'rgba(200,255,220,0.7)' }}>
          {current?.name || ''}
          {total > 1 && <span className="ml-2 text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>{idx + 1} / {total}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Zoom out */}
          <button onClick={() => setZoom(z => Math.max(0.2, +(z - 0.25).toFixed(2)))}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
            title="Zoom out (-)">
            <ZoomOut size={14} />
          </button>
          {/* Zoom level */}
          <span className="text-xs px-2 py-1 rounded-lg min-w-[48px] text-center"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(134,239,172,0.7)' }}>
            {Math.round(zoom * 100)}%
          </span>
          {/* Zoom in */}
          <button onClick={() => setZoom(z => Math.min(8, +(z + 0.25).toFixed(2)))}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
            title="Zoom in (+)">
            <ZoomIn size={14} />
          </button>
          {/* Fit */}
          <button onClick={reset}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
            title="Reset (0)">
            <RotateCcw size={14} />
          </button>
          {/* Close */}
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all ml-2"
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            title="Close (Esc)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Prev / Next arrows */}
      {total > 1 && (
        <>
          <button onClick={goPrev}
            className="absolute left-3 z-10 w-10 h-10 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', top: '50%', transform: 'translateY(-50%)' }}
            title="Previous (←)">
            <ChevronLeft size={20} />
          </button>
          <button onClick={goNext}
            className="absolute right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', top: '50%', transform: 'translateY(-50%)' }}
            title="Next (→)">
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Image */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: dragging ? 'none' : 'transform 0.08s ease',
          cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { lastTouch.current = null; }}
      >
        <img
          src={current?.url || current}
          alt={current?.name || ''}
          draggable={false}
          style={{
            maxWidth: '88vw',
            maxHeight: '88vh',
            display: 'block',
            borderRadius: '8px',
            boxShadow: '0 0 60px rgba(0,0,0,0.8)',
            border: '1px solid rgba(74,222,128,0.15)',
          }}
        />
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
        <div className="text-xs px-3 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(134,239,172,0.35)' }}>
          Scroll to zoom · Drag to pan{total > 1 ? ' · ← → to navigate' : ''} · Esc to close
        </div>
      </div>

      {/* Dot nav for multiple images */}
      {total > 1 && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1.5 z-10">
          {Array.from({ length: total }, (_, i) => (
            <button key={i} onClick={() => { setIdx(i); reset(); }}
              style={{
                width: i === idx ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === idx ? '#4ade80' : 'rgba(134,239,172,0.25)',
                transition: 'all 0.2s',
                border: 'none',
                padding: 0,
              }} />
          ))}
        </div>
      )}
    </div>
  );
}
