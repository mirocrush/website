import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoSrc from '../assets/claude.png';
import { BookOpen, Briefcase, MessageCircle, Users, UserCog } from 'lucide-react';

/* ── Node definitions (no PR Writer) ───────────────────────────────────────── */
const NODES = [
  { id: 'blogs',      label: 'Blogs',      sub: 'Articles & writing',  Icon: BookOpen,      path: '/blogs',      angleDeg: -90  },
  { id: 'portfolios', label: 'Portfolios', sub: 'Showcase your work',   Icon: Briefcase,     path: '/portfolios', angleDeg: -18  },
  { id: 'messenger',  label: 'Messenger',  sub: 'Chat & servers',       Icon: MessageCircle, path: '/messenger',  angleDeg: 54   },
  { id: 'friends',    label: 'Friends',    sub: 'Your network',         Icon: Users,         path: '/friends',    angleDeg: 126  },
  { id: 'account',    label: 'My Account', sub: 'Settings & profile',   Icon: UserCog,       path: '/profile',    angleDeg: 198  },
];

/* ── Canvas renderer ────────────────────────────────────────────────────────── */
function useUniverseCanvas(canvasRef, nodePositionsRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    /* Resize */
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* Background star particles */
    const makeParticles = () =>
      Array.from({ length: 180 }, () => ({
        x:  Math.random(),
        y:  Math.random(),
        vx: (Math.random() - 0.5) * 0.00012,
        vy: (Math.random() - 0.5) * 0.00012,
        r:  Math.random() * 1.4 + 0.3,
        a:  Math.random() * 0.55 + 0.15,
      }));
    const stars = makeParticles();

    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }

      /* ── Background ── */
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      bg.addColorStop(0,   '#071a0e');
      bg.addColorStop(0.5, '#030f07');
      bg.addColorStop(1,   '#010806');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* ── Star field ── */
      stars.forEach((s) => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(134,239,172,${s.a})`;
        ctx.fill();
      });

      /* ── Star connections (dim web) ── */
      const MAX_STAR_DIST = Math.min(W, H) * 0.13;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = (stars[i].x - stars[j].x) * W;
          const dy = (stars[i].y - stars[j].y) * H;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_STAR_DIST) {
            ctx.beginPath();
            ctx.moveTo(stars[i].x * W, stars[i].y * H);
            ctx.lineTo(stars[j].x * W, stars[j].y * H);
            ctx.strokeStyle = `rgba(74,222,128,${(1 - d / MAX_STAR_DIST) * 0.09})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }

      /* ── Node glow halos ── */
      const positions = nodePositionsRef.current;
      if (positions && positions.length) {
        positions.forEach(({ x, y }) => {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 90);
          glow.addColorStop(0,   'rgba(74,222,128,0.10)');
          glow.addColorStop(0.5, 'rgba(74,222,128,0.04)');
          glow.addColorStop(1,   'rgba(74,222,128,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, 90, 0, Math.PI * 2);
          ctx.fill();
        });

        /* ── Animated lines between nodes ── */
        ctx.save();
        const pulse = (Math.sin(t * 0.018) + 1) / 2; // 0→1 pulsing
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const p1 = positions[i];
            const p2 = positions[j];
            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            const alpha = 0.18 + pulse * 0.22;
            grad.addColorStop(0,   `rgba(74,222,128,${alpha})`);
            grad.addColorStop(0.5, `rgba(187,247,208,${alpha * 1.6})`);
            grad.addColorStop(1,   `rgba(74,222,128,${alpha})`);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 10]);
            ctx.lineDashOffset = -(t * 0.55);
            ctx.stroke();
          }
        }
        /* Center ↔ nodes */
        const cx = W / 2, cy = H / 2;
        positions.forEach(({ x, y }) => {
          const grad = ctx.createLinearGradient(cx, cy, x, y);
          const alpha = 0.22 + pulse * 0.18;
          grad.addColorStop(0,   `rgba(134,239,172,${alpha * 1.4})`);
          grad.addColorStop(1,   `rgba(74,222,128,${alpha})`);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x, y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 14]);
          ctx.lineDashOffset = -(t * 0.4);
          ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();
      }

      t++;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [canvasRef, nodePositionsRef]);
}

/* ── Dashboard ──────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const canvasRef  = useRef(null);
  const nodePositionsRef = useRef([]);
  const containerRef = useRef(null);
  const nodeRefs   = useRef([]);
  const [ready, setReady] = useState(false);

  useUniverseCanvas(canvasRef, nodePositionsRef);

  /* Position nodes on layout using orbital math */
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const W = el.offsetWidth;
      const H = el.offsetHeight;
      if (!W || !H) return;

      const cx = W / 2;
      const cy = H / 2;
      const R  = Math.min(W, H) * 0.32;

      const positions = NODES.map((node, i) => {
        const rad = (node.angleDeg * Math.PI) / 180;
        return { x: cx + Math.cos(rad) * R, y: cy + Math.sin(rad) * R };
      });

      nodePositionsRef.current = positions;

      positions.forEach(({ x, y }, i) => {
        const el = nodeRefs.current[i];
        if (el) {
          el.style.left = `${x}px`;
          el.style.top  = `${y}px`;
        }
      });

      setReady(true);
    };

    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />

      {/* ── Center hub ── */}
      <div
        className="absolute z-10 flex flex-col items-center gap-3 select-none"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        {/* Outer pulse ring */}
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(74,222,128,0.25) 0%, transparent 70%)',
              animation: 'hub-pulse 3s ease-in-out infinite',
              width: '120px', height: '120px',
              left: '-16px', top: '-16px',
            }}
          />
          {/* Avatar or Logo */}
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden ring-2 shadow-2xl relative z-10"
            style={{ boxShadow: '0 0 32px rgba(74,222,128,0.5)', ringColor: 'rgba(74,222,128,0.6)' }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={initials} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg, #16a34a, #4ade80)' }}
              >
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* Greeting */}
        <div className="text-center">
          <p className="font-extrabold text-lg leading-tight" style={{ color: '#bbf7d0' }}>
            {user?.displayName || 'Welcome'}
          </p>
          {user?.username && (
            <p className="text-xs" style={{ color: 'rgba(134,239,172,0.55)' }}>@{user.username}</p>
          )}
        </div>

        {/* Logo watermark */}
        <img
          src={logoSrc}
          alt="Talent Code Hub"
          className="w-7 h-7 object-contain opacity-40"
          style={{ filter: 'brightness(1.8) saturate(0.4)' }}
        />
      </div>

      {/* ── Floating node cards ── */}
      {NODES.map((node, i) => {
        const Icon = node.Icon;
        return (
          <div
            key={node.id}
            ref={(el) => { nodeRefs.current[i] = el; }}
            onClick={() => navigate(node.path)}
            className="absolute z-20 flex flex-col items-center gap-2 cursor-pointer group"
            style={{
              transform: 'translate(-50%, -50%)',
              opacity: ready ? 1 : 0,
              transition: 'opacity 0.6s ease',
              animation: `float-node-${i} ${4.5 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.7}s`,
            }}
          >
            {/* Card */}
            <div
              className="flex flex-col items-center gap-2 px-5 py-4 rounded-2xl transition-all duration-300"
              style={{
                background: 'rgba(3, 22, 11, 0.82)',
                border: '1px solid rgba(74,222,128,0.35)',
                boxShadow: '0 0 18px rgba(74,222,128,0.12), inset 0 0 12px rgba(74,222,128,0.04)',
                backdropFilter: 'blur(12px)',
                minWidth: '120px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid rgba(74,222,128,0.75)';
                e.currentTarget.style.boxShadow = '0 0 32px rgba(74,222,128,0.35), inset 0 0 16px rgba(74,222,128,0.08)';
                e.currentTarget.style.transform = 'scale(1.07)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(74,222,128,0.35)';
                e.currentTarget.style.boxShadow = '0 0 18px rgba(74,222,128,0.12), inset 0 0 12px rgba(74,222,128,0.04)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* Icon circle */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
              >
                <Icon size={20} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold leading-tight" style={{ color: '#f0fdf4' }}>
                  {node.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.55)', fontSize: '10px' }}>
                  {node.sub}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Keyframe animations injected via style tag ── */}
      <style>{`
        @keyframes hub-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.7; }
          50%       { transform: scale(1.35); opacity: 0.3; }
        }
        @keyframes float-node-0 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px)   translateX(0px); }
          33%      { transform: translate(-50%, -50%) translateY(-12px) translateX(5px); }
          66%      { transform: translate(-50%, -50%) translateY(6px)   translateX(-4px); }
        }
        @keyframes float-node-1 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px)   translateX(0px); }
          33%      { transform: translate(-50%, -50%) translateY(10px)  translateX(-6px); }
          66%      { transform: translate(-50%, -50%) translateY(-8px)  translateX(4px); }
        }
        @keyframes float-node-2 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px)   translateX(0px); }
          33%      { transform: translate(-50%, -50%) translateY(-8px)  translateX(-5px); }
          66%      { transform: translate(-50%, -50%) translateY(12px)  translateX(6px); }
        }
        @keyframes float-node-3 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px)   translateX(0px); }
          33%      { transform: translate(-50%, -50%) translateY(9px)   translateX(7px); }
          66%      { transform: translate(-50%, -50%) translateY(-11px) translateX(-3px); }
        }
        @keyframes float-node-4 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px)  translateX(0px); }
          33%      { transform: translate(-50%, -50%) translateY(-10px) translateX(-7px); }
          66%      { transform: translate(-50%, -50%) translateY(7px)   translateX(5px); }
        }
      `}</style>
    </div>
  );
}
