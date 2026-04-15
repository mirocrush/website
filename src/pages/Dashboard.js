import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Briefcase, MessageCircle, Users, UserCog, Rocket } from 'lucide-react';

const NODES = [
  { id: 'blogs',      label: 'Blogs',      Icon: BookOpen,      path: '/blogs',      angleDeg: -90  },
  { id: 'revelo',     label: 'Revelo',     Icon: Rocket,        path: '/revelo',     angleDeg: -30  },
  { id: 'portfolios', label: 'Portfolios', Icon: Briefcase,     path: '/portfolios', angleDeg: 30   },
  { id: 'messenger',  label: 'Messenger',  Icon: MessageCircle, path: '/messenger',  angleDeg: 90   },
  { id: 'friends',    label: 'Friends',    Icon: Users,         path: '/friends',    angleDeg: 150  },
  { id: 'account',    label: 'My Account', Icon: UserCog,       path: '/profile',    angleDeg: 210  },
];

function useLineCanvas(canvasRef, positionsRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf, t = 0;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const positions = positionsRef.current;
      if (!positions || positions.length < 2) { t++; raf = requestAnimationFrame(draw); return; }
      const cx = W / 2, cy = H / 2 - 32;
      const pulse = (Math.sin(t * 0.018) + 1) / 2;

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const p1 = positions[i], p2 = positions[j];
          const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          const a = 0.08 + pulse * 0.12;
          grad.addColorStop(0,   `rgba(74,222,128,${a})`);
          grad.addColorStop(0.5, `rgba(187,247,208,${a * 1.4})`);
          grad.addColorStop(1,   `rgba(74,222,128,${a})`);
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = grad; ctx.lineWidth = 0.8;
          ctx.setLineDash([4, 14]); ctx.lineDashOffset = -(t * 0.5); ctx.stroke();
        }
      }
      positions.forEach(({ x, y }) => {
        const grad = ctx.createLinearGradient(cx, cy, x, y);
        const a = 0.14 + pulse * 0.18;
        grad.addColorStop(0, `rgba(134,239,172,${a * 1.3})`);
        grad.addColorStop(1, `rgba(74,222,128,${a})`);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
        ctx.strokeStyle = grad; ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 16]); ctx.lineDashOffset = -(t * 0.38); ctx.stroke();
      });
      ctx.setLineDash([]);
      t++; raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [canvasRef, positionsRef]);
}

export default function Dashboard() {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const canvasRef    = useRef(null);
  const posRef       = useRef([]);
  const containerRef = useRef(null);
  const nodeRefs     = useRef([]);
  const [ready, setReady]     = useState(false);
  const [hovered, setHovered] = useState(null);

  useLineCanvas(canvasRef, posRef);

  const layout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const W = el.offsetWidth, H = el.offsetHeight;
    if (!W || !H) return;
    const R = Math.min(W, H) * 0.31;
    const positions = NODES.map(({ angleDeg }) => {
      const rad = (angleDeg * Math.PI) / 180;
      return { x: W / 2 + Math.cos(rad) * R, y: H / 2 - 32 + Math.sin(rad) * R };
    });
    posRef.current = positions;
    positions.forEach(({ x, y }, i) => {
      const el = nodeRefs.current[i];
      if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
    });
    setReady(true);
  }, []);

  useEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [layout]);

  return (
    <div ref={containerRef} className="relative overflow-hidden"
      style={{ height: 'calc(100vh - 64px)', background: 'transparent' }}>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ background: 'transparent' }} />

      {/* Center pulse */}
      <div className="absolute z-10 pointer-events-none select-none"
        style={{ left: '50%', top: 'calc(50% - 32px)', transform: 'translate(-50%, -50%)' }}>
        <div style={{
          width: '100px', height: '100px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,222,128,0.22) 0%, transparent 70%)',
          animation: 'hub-pulse 3.2s ease-in-out infinite',
        }} />
      </div>

      {/* Planet nodes */}
      {NODES.map(({ id, label, Icon, path }, i) => {
        const isHov = hovered === id;
        return (
          <div key={id}
            ref={el => { nodeRefs.current[i] = el; }}
            onClick={() => navigate(path)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            className="absolute z-20 cursor-pointer select-none"
            style={{
              transform: 'translate(-50%, -50%)',
              opacity: ready ? 1 : 0,
              transition: 'opacity 0.5s ease',
              animation: `float-node-${i} ${4.5 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.65}s`,
            }}>

            {/* Circle planet */}
            <div style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              // no fill — transparent
              background: 'transparent',
              // planet-like border: bright top-left, dimmer bottom-right
              border: 'none',
              outline: 'none',
              position: 'relative',
              transform: isHov ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.25s ease',
            }}>
              {/* SVG border — gradient around the circle for planet rim-light feel */}
              <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible' }}>
                <defs>
                  <linearGradient id={`rim-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor={isHov ? '#86efac' : '#4ade80'} stopOpacity={isHov ? 1 : 0.9} />
                    <stop offset="45%"  stopColor={isHov ? '#4ade80' : '#22c55e'} stopOpacity={isHov ? 0.85 : 0.6} />
                    <stop offset="100%" stopColor={isHov ? '#166534' : '#14532d'} stopOpacity={isHov ? 0.5 : 0.25} />
                  </linearGradient>
                  <filter id={`glow-${i}`}>
                    <feGaussianBlur stdDeviation={isHov ? '3' : '1.5'} result="blur" />
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <circle
                  cx="55" cy="55" r="52"
                  fill="none"
                  stroke={`url(#rim-${i})`}
                  strokeWidth={isHov ? '2' : '1.5'}
                  filter={`url(#glow-${i})`}
                />
              </svg>

              {/* Outer atmosphere halo */}
              <div style={{
                position: 'absolute',
                inset: '-12px',
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(74,222,128,${isHov ? 0.10 : 0.04}) 60%, transparent 100%)`,
                transition: 'background 0.25s ease',
                pointerEvents: 'none',
              }} />

              {/* Icon + label centered inside */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '6px',
              }}>
                <Icon size={22} style={{
                  color: isHov ? '#86efac' : 'rgba(74,222,128,0.75)',
                  filter: isHov ? 'drop-shadow(0 0 6px rgba(74,222,128,0.9))' : 'none',
                  transition: 'all 0.25s ease',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isHov ? '#bbf7d0' : 'rgba(187,247,208,0.7)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: '80px',
                  transition: 'color 0.25s ease',
                  textShadow: isHov ? '0 0 10px rgba(74,222,128,0.6)' : 'none',
                }}>
                  {label}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes hub-pulse {
          0%,100% { transform: scale(1);    opacity: 0.7; }
          50%      { transform: scale(1.38); opacity: 0.25; }
        }
        @keyframes float-node-0 {
          0%,100% { transform: translate(-50%,-50%) translate(0px,0px); }
          33%     { transform: translate(-50%,-50%) translate(5px,-13px); }
          66%     { transform: translate(-50%,-50%) translate(-4px,6px); }
        }
        @keyframes float-node-1 {
          0%,100% { transform: translate(-50%,-50%) translate(0px,0px); }
          33%     { transform: translate(-50%,-50%) translate(-6px,10px); }
          66%     { transform: translate(-50%,-50%) translate(4px,-8px); }
        }
        @keyframes float-node-2 {
          0%,100% { transform: translate(-50%,-50%) translate(0px,0px); }
          33%     { transform: translate(-50%,-50%) translate(-5px,-9px); }
          66%     { transform: translate(-50%,-50%) translate(6px,11px); }
        }
        @keyframes float-node-3 {
          0%,100% { transform: translate(-50%,-50%) translate(0px,0px); }
          33%     { transform: translate(-50%,-50%) translate(7px,9px); }
          66%     { transform: translate(-50%,-50%) translate(-3px,-11px); }
        }
        @keyframes float-node-4 {
          0%,100% { transform: translate(-50%,-50%) translate(0px,0px); }
          33%     { transform: translate(-50%,-50%) translate(-7px,-10px); }
          66%     { transform: translate(-50%,-50%) translate(5px,7px); }
        }
        @keyframes float-node-5 {
          0%,100% { transform: translate(-50%,-50%) translate(0px,0px); }
          33%     { transform: translate(-50%,-50%) translate(6px,-8px); }
          66%     { transform: translate(-50%,-50%) translate(-5px,10px); }
        }
      `}</style>
    </div>
  );
}
