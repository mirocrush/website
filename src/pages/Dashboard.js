import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Briefcase, MessageCircle, Users, UserCog, Rocket } from 'lucide-react';

// Per-planet colour & ring config
const NODES = [
  { id: 'blogs',      label: 'Blogs',      sub: 'Articles & writing',  Icon: BookOpen,      path: '/blogs',      angleDeg: -90,  hue: 28,  glow: '251,146,60',  hasRing: false },
  { id: 'revelo',     label: 'Revelo',     sub: 'Discover talent',      Icon: Rocket,        path: '/revelo',     angleDeg: -30,  hue: 142, glow: '74,222,128',  hasRing: true  },
  { id: 'portfolios', label: 'Portfolios', sub: 'Showcase your work',   Icon: Briefcase,     path: '/portfolios', angleDeg: 30,   hue: 210, glow: '96,165,250',  hasRing: false },
  { id: 'messenger',  label: 'Messenger',  sub: 'Chat & servers',       Icon: MessageCircle, path: '/messenger',  angleDeg: 90,   hue: 270, glow: '167,139,250', hasRing: true  },
  { id: 'friends',    label: 'Friends',    sub: 'Your network',         Icon: Users,         path: '/friends',    angleDeg: 150,  hue: 355, glow: '248,113,113', hasRing: false },
  { id: 'account',    label: 'My Account', sub: 'Settings & profile',   Icon: UserCog,       path: '/profile',    angleDeg: 210,  hue: 48,  glow: '251,191,36',  hasRing: true  },
];

// ── Planet texture generator (offscreen canvas → data URL) ────────────────────
function makePlanetTexture(hue, seed) {
  const S = 220;
  const oc = document.createElement('canvas');
  oc.width = oc.height = S;
  const c = oc.getContext('2d');
  const cx = S / 2, cy = S / 2, r = S / 2 - 1;

  // deterministic pseudo-random based on seed
  const rng = (n) => (Math.abs(Math.sin(seed * 127.1 + n * 311.7)) % 1);

  c.save();
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.clip();

  // — Base sphere gradient —
  const base = c.createRadialGradient(cx * 0.72, cy * 0.68, 0, cx, cy, r);
  base.addColorStop(0,   `hsl(${hue}, 80%, 62%)`);
  base.addColorStop(0.45,`hsl(${hue}, 72%, 40%)`);
  base.addColorStop(0.80,`hsl(${hue}, 62%, 24%)`);
  base.addColorStop(1,   `hsl(${hue}, 55%, 12%)`);
  c.fillStyle = base;
  c.fillRect(0, 0, S, S);

  // — Atmospheric band stripes —
  const bandCount = 5 + Math.floor(rng(1) * 5);
  for (let i = 0; i < bandCount; i++) {
    const y    = rng(i + 2) * S;
    const bw   = 14 + rng(i + 10) * 28;
    const alpha = 0.10 + rng(i + 20) * 0.24;
    const lighter = (i % 2 === 0);
    const bHue  = hue + (lighter ? 22 : -18);
    const bLight = lighter ? 75 : 18;
    const g = c.createLinearGradient(0, y - bw, 0, y + bw);
    g.addColorStop(0,   'rgba(0,0,0,0)');
    g.addColorStop(0.5, `hsla(${bHue},82%,${bLight}%,${alpha})`);
    g.addColorStop(1,   'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, y - bw, S, bw * 2);
  }

  // — Swirling cloud wisps —
  for (let i = 0; i < 6; i++) {
    const wx = rng(i + 30) * S;
    const wy = rng(i + 36) * S;
    const wr = 18 + rng(i + 42) * 30;
    const wAlpha = 0.06 + rng(i + 48) * 0.10;
    const wg = c.createRadialGradient(wx, wy, 0, wx, wy, wr);
    wg.addColorStop(0, `hsla(${hue + 15}, 90%, 88%, ${wAlpha})`);
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = wg;
    c.beginPath();
    c.ellipse(wx, wy, wr, wr * (0.3 + rng(i + 54) * 0.5), rng(i + 60) * Math.PI, 0, Math.PI * 2);
    c.fill();
  }

  // — Storm spot (like Great Red Spot) — 55% chance —
  if (rng(70) > 0.45) {
    const ex = cx + (rng(71) * 0.6 - 0.3) * r;
    const ey = cy + (rng(72) * 0.4 - 0.2) * r;
    const ew = 14 + rng(73) * 18;
    const eh = 8  + rng(74) * 10;
    c.save();
    c.translate(ex, ey);
    c.scale(1, eh / ew);
    const sg = c.createRadialGradient(0, 0, 0, 0, 0, ew);
    sg.addColorStop(0, `hsla(${(hue + 35) % 360}, 95%, 70%, 0.55)`);
    sg.addColorStop(0.6,`hsla(${(hue + 20) % 360}, 80%, 50%, 0.25)`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg;
    c.beginPath();
    c.arc(0, 0, ew, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // — 3D highlight (top-left specular) —
  const hl = c.createRadialGradient(cx - r * 0.34, cy - r * 0.32, 0, cx - r * 0.12, cy - r * 0.10, r * 0.82);
  hl.addColorStop(0,   'rgba(255,255,255,0.42)');
  hl.addColorStop(0.28,'rgba(255,255,255,0.12)');
  hl.addColorStop(0.65,'rgba(255,255,255,0.02)');
  hl.addColorStop(1,   'rgba(0,0,0,0)');
  c.fillStyle = hl;
  c.fillRect(0, 0, S, S);

  // — Limb darkening (edge shadow) —
  const limb = c.createRadialGradient(cx, cy, r * 0.52, cx, cy, r);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(1, 'rgba(0,0,0,0.58)');
  c.fillStyle = limb;
  c.fillRect(0, 0, S, S);

  // — Transparency overlay — makes it glass-like —
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.fillRect(0, 0, S, S);

  c.restore();
  return oc.toDataURL();
}

// ── Connection line canvas ─────────────────────────────────────────────────────
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

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const canvasRef     = useRef(null);
  const posRef        = useRef([]);
  const containerRef  = useRef(null);
  const nodeRefs      = useRef([]);
  const [ready, setReady]         = useState(false);
  const [hovered, setHovered]     = useState(null);
  const [textures, setTextures]   = useState([]);

  useLineCanvas(canvasRef, posRef);

  // Generate planet textures once on mount
  useEffect(() => {
    setTextures(NODES.map((n, i) => makePlanetTexture(n.hue, i + 1.5)));
  }, []);

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

      {/* Center pulse orb */}
      <div className="absolute z-10 pointer-events-none select-none"
        style={{ left: '50%', top: 'calc(50% - 32px)', transform: 'translate(-50%, -50%)' }}>
        <div style={{
          width: '100px', height: '100px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,222,128,0.22) 0%, transparent 70%)',
          animation: 'hub-pulse 3.2s ease-in-out infinite',
        }} />
      </div>

      {/* Planet nodes */}
      {NODES.map(({ id, label, sub, Icon, path, glow, hasRing }, i) => {
        const isHovered = hovered === id;
        const tex = textures[i];
        const glowRgb = glow;

        return (
          <div key={id}
            ref={(el) => { nodeRefs.current[i] = el; }}
            onClick={() => navigate(path)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            className="absolute z-20 flex flex-col items-center cursor-pointer select-none"
            style={{
              transform: 'translate(-50%, -50%)',
              opacity: ready ? 1 : 0,
              transition: 'opacity 0.5s ease',
              animation: `float-node-${i} ${4.5 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.65}s`,
              gap: '10px',
            }}>

            {/* Planet + optional ring wrapper */}
            <div style={{ position: 'relative', width: '108px', height: '108px' }}>

              {/* Ring — behind planet visually (rendered first, lower z) */}
              {hasRing && (
                <div style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  width: '158px', height: '32px',
                  transform: 'translate(-50%, -50%) rotate(-22deg)',
                  border: `3px solid rgba(${glowRgb},${isHovered ? 0.65 : 0.35})`,
                  borderRadius: '50%',
                  boxShadow: isHovered ? `0 0 12px rgba(${glowRgb},0.5)` : 'none',
                  transition: 'all 0.3s ease',
                  zIndex: 0,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Planet sphere */}
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
                overflow: 'hidden',
                zIndex: 1,
                boxShadow: isHovered
                  ? `0 0 0 2px rgba(${glowRgb},0.7), 0 0 35px rgba(${glowRgb},0.55), 0 0 70px rgba(${glowRgb},0.2)`
                  : `0 0 0 1px rgba(${glowRgb},0.30), 0 0 18px rgba(${glowRgb},0.25), 0 0 40px rgba(${glowRgb},0.08)`,
                transform: isHovered ? 'scale(1.12)' : 'scale(1)',
                transition: 'all 0.28s ease',
              }}>
                {/* Texture */}
                {tex && (
                  <img src={tex} alt="" style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }} />
                )}

                {/* Glass transparency overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  background: isHovered
                    ? 'rgba(3,12,6,0.18)'
                    : 'rgba(3,12,6,0.32)',
                  backdropFilter: 'blur(1px)',
                  transition: 'background 0.28s ease',
                }} />

                {/* Icon centered */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={26} style={{
                    color: '#fff',
                    filter: isHovered
                      ? `drop-shadow(0 0 10px rgba(${glowRgb},1)) drop-shadow(0 0 4px #fff)`
                      : `drop-shadow(0 0 5px rgba(${glowRgb},0.7))`,
                    transition: 'filter 0.28s ease',
                  }} />
                </div>

                {/* Atmosphere rim glow (inner ring at edge) */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  boxShadow: `inset 0 0 18px rgba(${glowRgb},${isHovered ? 0.35 : 0.18})`,
                  transition: 'box-shadow 0.28s ease',
                  pointerEvents: 'none',
                }} />
              </div>

              {/* Atmospheric halo (outer glow behind planet) */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: isHovered ? '145px' : '128px',
                height: isHovered ? '145px' : '128px',
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(${glowRgb},${isHovered ? 0.18 : 0.08}) 0%, transparent 70%)`,
                transition: 'all 0.3s ease',
                zIndex: 0,
                pointerEvents: 'none',
              }} />
            </div>

            {/* Label */}
            <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
              <p style={{
                fontSize: '12px', fontWeight: 700,
                color: isHovered ? `rgb(${glowRgb})` : '#e2faea',
                transition: 'color 0.25s ease',
                textShadow: isHovered ? `0 0 12px rgba(${glowRgb},0.8)` : 'none',
              }}>{label}</p>
              <p style={{ fontSize: '9px', color: 'rgba(134,239,172,0.42)', marginTop: '2px' }}>{sub}</p>
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
