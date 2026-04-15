import { useEffect, useRef } from 'react';

export default function GlobalBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Stars (3 layers: distant / mid / close) ──────────────────────────────
    const mkStars = (n, speedScale, minR, maxR, minA, maxA) =>
      Array.from({ length: n }, () => ({
        x:  Math.random(),
        y:  Math.random(),
        vx: (Math.random() - 0.5) * 0.00042 * speedScale,
        vy: (Math.random() - 0.5) * 0.00042 * speedScale,
        r:  Math.random() * (maxR - minR) + minR,
        a:  Math.random() * (maxA - minA) + minA,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed:  Math.random() * 0.02 + 0.005,
      }));

    const distantStars = mkStars(180, 0.5,  0.2, 0.9,  0.08, 0.25);
    const midStars     = mkStars(90,  1.2,  0.6, 1.4,  0.20, 0.55);
    const closeStars   = mkStars(30,  2.2,  1.2, 2.2,  0.45, 0.85);

    // ── Shooting stars ────────────────────────────────────────────────────────
    const MAX_SHOOTS = 4;
    const shoots = [];

    const spawnShoot = () => {
      const angle = (Math.random() * 40 + 10) * (Math.PI / 180); // 10–50 deg downward
      const speed = Math.random() * 12 + 8;
      shoots.push({
        x:    Math.random() * 1.4 - 0.2,   // allow start slightly off-screen
        y:    Math.random() * 0.5,
        vx:   Math.cos(angle)  * speed,
        vy:   Math.sin(angle)  * speed,
        len:  Math.random() * 180 + 80,
        life: 1,
        fade: Math.random() * 0.012 + 0.008,
        width: Math.random() * 1.2 + 0.4,
      });
    };

    // stagger initial spawn
    setTimeout(spawnShoot, 800);
    setTimeout(spawnShoot, 2200);

    // ── Nebula clouds (static positions, animated opacity) ───────────────────
    const nebulae = [
      { cx: 0.25, cy: 0.30, rx: 0.38, ry: 0.22, color: '74,222,128',  baseA: 0.028, phase: 0.0  },
      { cx: 0.75, cy: 0.65, rx: 0.32, ry: 0.28, color: '96,165,250',  baseA: 0.018, phase: 1.5  },
      { cx: 0.55, cy: 0.18, rx: 0.28, ry: 0.16, color: '167,139,250', baseA: 0.016, phase: 3.0  },
      { cx: 0.15, cy: 0.75, rx: 0.22, ry: 0.20, color: '74,222,128',  baseA: 0.012, phase: 4.5  },
      { cx: 0.85, cy: 0.25, rx: 0.20, ry: 0.18, color: '96,165,250',  baseA: 0.014, phase: 2.2  },
    ];

    // ── Galaxy spiral arms (faint dust lanes) ────────────────────────────────
    const galaxyDust = Array.from({ length: 260 }, (_, i) => {
      const arm   = i % 3;
      const theta = (i / 260) * Math.PI * 6 + (arm * Math.PI * 2) / 3;
      const r     = (i / 260) * 0.42 + 0.04;
      const spread = (Math.random() - 0.5) * 0.06;
      return {
        angle: theta + spread,
        radius: r + (Math.random() - 0.5) * 0.03,
        size: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.12 + 0.03,
        color: arm === 0 ? '74,222,128' : arm === 1 ? '96,165,250' : '167,139,250',
      };
    });

    // ── Draw loop ─────────────────────────────────────────────────────────────
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      // ── Background ──
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.85);
      bg.addColorStop(0,    '#081c10');
      bg.addColorStop(0.35, '#040f08');
      bg.addColorStop(0.7,  '#020a05');
      bg.addColorStop(1,    '#010806');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Nebula clouds ──
      nebulae.forEach(nb => {
        const pulse = Math.sin(t * 0.008 + nb.phase) * 0.4 + 0.6; // 0.2 – 1.0
        const alpha = nb.baseA * pulse;
        // elliptical radial gradient
        ctx.save();
        ctx.translate(nb.cx * W, nb.cy * H);
        ctx.scale(1, nb.ry / nb.rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, nb.rx * W);
        grad.addColorStop(0,   `rgba(${nb.color},${(alpha * 1.6).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${nb.color},${(alpha * 0.6).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${nb.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, nb.rx * W, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── Galaxy spiral dust ──
      const gCX = W * 0.72;
      const gCY = H * 0.28;
      const gR  = Math.min(W, H) * 0.22;
      const galRot = t * 0.0008; // slow rotation
      galaxyDust.forEach(p => {
        const ang = p.angle + galRot;
        const px = gCX + Math.cos(ang) * p.radius * gR;
        const py = gCY + Math.sin(ang) * p.radius * gR * 0.45; // squish = elliptical
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.a})`;
        ctx.fill();
      });
      // galaxy core glow
      const core = ctx.createRadialGradient(gCX, gCY, 0, gCX, gCY, gR * 0.18);
      core.addColorStop(0,   'rgba(220,255,235,0.22)');
      core.addColorStop(0.4, 'rgba(74,222,128,0.07)');
      core.addColorStop(1,   'rgba(74,222,128,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(gCX, gCY, gR * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // ── Distant stars ──
      distantStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(134,239,172,${s.a * twinkle})`;
        ctx.fill();
      });

      // ── Mid stars ──
      midStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.35 + 0.65;
        const alpha = s.a * twinkle;
        // soft glow halo for brighter mid stars
        if (s.r > 1.0) {
          const glow = ctx.createRadialGradient(s.x * W, s.y * H, 0, s.x * W, s.y * H, s.r * 3.5);
          glow.addColorStop(0,   `rgba(134,239,172,${(alpha * 0.5).toFixed(3)})`);
          glow.addColorStop(1,   'rgba(134,239,172,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(s.x * W, s.y * H, s.r * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,255,220,${alpha})`;
        ctx.fill();
      });

      // ── Close (bright) stars with cross-flare ──
      closeStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.4 + 0.6;
        const alpha = s.a * twinkle;
        const sx = s.x * W;
        const sy = s.y * H;
        // outer glow
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 6);
        glow.addColorStop(0,   `rgba(180,255,210,${(alpha * 0.6).toFixed(3)})`);
        glow.addColorStop(0.4, `rgba(74,222,128,${(alpha * 0.15).toFixed(3)})`);
        glow.addColorStop(1,   'rgba(74,222,128,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r * 6, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,255,240,${alpha})`;
        ctx.fill();
        // cross flare
        const flareLen = s.r * (6 + twinkle * 4);
        const flareA = alpha * 0.35;
        ctx.save();
        ctx.globalAlpha = flareA;
        [0, Math.PI / 2].forEach(rot => {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(rot);
          const fl = ctx.createLinearGradient(-flareLen, 0, flareLen, 0);
          fl.addColorStop(0,   'rgba(134,239,172,0)');
          fl.addColorStop(0.5, 'rgba(200,255,225,1)');
          fl.addColorStop(1,   'rgba(134,239,172,0)');
          ctx.fillStyle = fl;
          ctx.fillRect(-flareLen, -0.6, flareLen * 2, 1.2);
          ctx.restore();
        });
        ctx.restore();
      });

      // ── Star connection web (only mid + close) ──
      const webStars = [...midStars, ...closeStars];
      const MAX_D = Math.min(W, H) * 0.11;
      for (let i = 0; i < webStars.length; i++) {
        for (let j = i + 1; j < webStars.length; j++) {
          const dx = (webStars[i].x - webStars[j].x) * W;
          const dy = (webStars[i].y - webStars[j].y) * H;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_D) {
            ctx.beginPath();
            ctx.moveTo(webStars[i].x * W, webStars[i].y * H);
            ctx.lineTo(webStars[j].x * W, webStars[j].y * H);
            ctx.strokeStyle = `rgba(74,222,128,${(1 - d / MAX_D) * 0.06})`;
            ctx.lineWidth = 0.3;
            ctx.stroke();
          }
        }
      }

      // ── Shooting stars ──
      // spawn new ones
      if (shoots.length < MAX_SHOOTS && Math.random() < 0.004) spawnShoot();

      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i];
        s.x  += s.vx / W * 60;
        s.y  += s.vy / H * 60;
        s.life -= s.fade;
        if (s.life <= 0 || s.x > 1.3 || s.y > 1.2) { shoots.splice(i, 1); continue; }

        const sx = s.x * W;
        const sy = s.y * H;
        const ex = sx - (s.vx / W * 60) * (s.len / Math.hypot(s.vx, s.vy));
        const ey = sy - (s.vy / H * 60) * (s.len / Math.hypot(s.vx, s.vy));

        const grad = ctx.createLinearGradient(ex, ey, sx, sy);
        grad.addColorStop(0,   'rgba(134,239,172,0)');
        grad.addColorStop(0.6, `rgba(180,255,220,${(s.life * 0.5).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(230,255,240,${s.life.toFixed(3)})`);

        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width * s.life;
        ctx.lineCap = 'round';
        ctx.stroke();

        // head glow
        const hglow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5 * s.life);
        hglow.addColorStop(0,  `rgba(220,255,235,${(s.life * 0.9).toFixed(3)})`);
        hglow.addColorStop(1,  'rgba(134,239,172,0)');
        ctx.fillStyle = hglow;
        ctx.beginPath();
        ctx.arc(sx, sy, 5 * s.life, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
