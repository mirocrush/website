import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Briefcase, MessageCircle, Users, UserCog, Rocket } from 'lucide-react';

// 6 nodes → perfect hexagon: -90, -30, 30, 90, 150, 210
const NODES = [
  { id: 'blogs',      label: 'Blogs',      sub: 'Articles & writing',  Icon: BookOpen,      path: '/blogs',      angleDeg: -90  },
  { id: 'revelo',     label: 'Revelo',     sub: 'Discover talent',      Icon: Rocket,        path: '/revelo',     angleDeg: -30  },
  { id: 'portfolios', label: 'Portfolios', sub: 'Showcase your work',   Icon: Briefcase,     path: '/portfolios', angleDeg: 30   },
  { id: 'messenger',  label: 'Messenger',  sub: 'Chat & servers',       Icon: MessageCircle, path: '/messenger',  angleDeg: 90   },
  { id: 'friends',    label: 'Friends',    sub: 'Your network',         Icon: Users,         path: '/friends',    angleDeg: 150  },
  { id: 'account',    label: 'My Account', sub: 'Settings & profile',   Icon: UserCog,       path: '/profile',    angleDeg: 210  },
];

/* Draws animated dashed connection lines on a canvas */
function useLineCanvas(canvasRef, positionsRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const positions = positionsRef.current;
      if (!positions || positions.length < 2) { t++; raf = requestAnimationFrame(draw); return; }

      const cx = W / 2, cy = H / 2;
      const pulse = (Math.sin(t * 0.018) + 1) / 2;

      /* Node ↔ node lines */
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const p1 = positions[i], p2 = positions[j];
          const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          const a = 0.12 + pulse * 0.16;
          grad.addColorStop(0,   `rgba(74,222,128,${a})`);
          grad.addColorStop(0.5, `rgba(187,247,208,${a * 1.5})`);
          grad.addColorStop(1,   `rgba(74,222,128,${a})`);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.0;
          ctx.setLineDash([5, 12]);
          ctx.lineDashOffset = -(t * 0.5);
          ctx.stroke();
        }
      }

      /* Center → node lines */
      positions.forEach(({ x, y }) => {
        const grad = ctx.createLinearGradient(cx, cy, x, y);
        const a = 0.18 + pulse * 0.2;
        grad.addColorStop(0,   `rgba(134,239,172,${a * 1.4})`);
        grad.addColorStop(1,   `rgba(74,222,128,${a})`);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 16]);
        ctx.lineDashOffset = -(t * 0.38);
        ctx.stroke();
      });

      ctx.setLineDash([]);
      t++;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [canvasRef, positionsRef]);
}

export default function Dashboard() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const canvasRef  = useRef(null);
  const posRef     = useRef([]);
  const containerRef = useRef(null);
  const nodeRefs   = useRef([]);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState(null);

  useLineCanvas(canvasRef, posRef);

  const layout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const W = el.offsetWidth;
    const H = el.offsetHeight;
    if (!W || !H) return;
    const R = Math.min(W, H) * 0.31;

    const positions = NODES.map(({ angleDeg }) => {
      const rad = (angleDeg * Math.PI) / 180;
      return { x: W / 2 + Math.cos(rad) * R, y: H / 2 + Math.sin(rad) * R };
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

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ height: 'calc(100vh - 64px)', background: 'transparent' }}
    >
      {/* Line canvas (transparent bg, only draws connections) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ background: 'transparent' }}
      />

      {/* ── Center hub ── */}
      <div
        className="absolute z-10 flex flex-col items-center gap-3 select-none"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        {/* Pulse ring */}
        <div className="relative flex items-center justify-center">
          <div style={{
            position: 'absolute',
            width: '120px', height: '120px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(74,222,128,0.18) 0%, transparent 70%)',
            animation: 'hub-pulse 3.2s ease-in-out infinite',
          }} />
          {/* Avatar */}
          <div style={{
            width: '76px', height: '76px',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 0 0 2px rgba(74,222,128,0.5), 0 0 28px rgba(74,222,128,0.35)',
            position: 'relative', zIndex: 1,
          }}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#15803d,#4ade80)', fontSize: '26px', fontWeight: 900, color: '#fff' }}>
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* Greeting */}
        <div className="text-center">
          <p className="font-extrabold text-base leading-tight" style={{ color: '#bbf7d0' }}>
            {user?.displayName || 'Welcome'}
          </p>
          {user?.username && (
            <p className="text-xs" style={{ color: 'rgba(134,239,172,0.5)' }}>@{user.username}</p>
          )}
        </div>
      </div>

      {/* ── Node cards ── */}
      {NODES.map(({ id, label, sub, Icon, path }, i) => (
        <div
          key={id}
          ref={(el) => { nodeRefs.current[i] = el; }}
          onClick={() => navigate(path)}
          onMouseEnter={() => setHovered(id)}
          onMouseLeave={() => setHovered(null)}
          className="absolute z-20 flex flex-col items-center gap-2 cursor-pointer"
          style={{
            transform: 'translate(-50%, -50%)',
            opacity: ready ? 1 : 0,
            transition: 'opacity 0.5s ease',
            animation: `float-node-${i} ${4.5 + i * 0.4}s ease-in-out infinite`,
            animationDelay: `${i * 0.65}s`,
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            padding: '16px 20px',
            borderRadius: '18px',
            minWidth: '118px',
            background: hovered === id ? 'rgba(5, 25, 12, 0.88)' : 'rgba(3, 18, 9, 0.72)',
            border: hovered === id ? '1px solid rgba(74,222,128,0.7)' : '1px solid rgba(74,222,128,0.28)',
            boxShadow: hovered === id
              ? '0 0 28px rgba(74,222,128,0.4), inset 0 0 16px rgba(74,222,128,0.06)'
              : '0 0 14px rgba(74,222,128,0.1), inset 0 0 10px rgba(74,222,128,0.03)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            transform: hovered === id ? 'scale(1.08)' : 'scale(1)',
            transition: 'all 0.25s ease',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovered === id ? 'rgba(74,222,128,0.25)' : 'rgba(74,222,128,0.12)',
              color: hovered === id ? '#86efac' : '#4ade80',
              transition: 'all 0.25s ease',
            }}>
              <Icon size={20} />
            </div>
            <div className="text-center">
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#f0fdf4', lineHeight: 1.3 }}>{label}</p>
              <p style={{ fontSize: '10px', color: 'rgba(134,239,172,0.5)', marginTop: '2px' }}>{sub}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Keyframe animations */}
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
