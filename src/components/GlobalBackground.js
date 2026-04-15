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

    // ── Field stars (3 parallax layers) ──────────────────────────────────────
    const mkStars = (n, speedScale, minR, maxR, minA, maxA) =>
      Array.from({ length: n }, () => ({
        x:  Math.random(),
        y:  Math.random(),
        vx: (Math.random() - 0.5) * 0.00042 * speedScale,
        vy: (Math.random() - 0.5) * 0.00042 * speedScale,
        r:  Math.random() * (maxR - minR) + minR,
        a:  Math.random() * (maxA - minA) + minA,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed:  Math.random() * 0.022 + 0.005,
      }));

    const distantStars = mkStars(160, 0.5,  0.2, 0.8,  0.06, 0.22);
    const midStars     = mkStars(70,  1.2,  0.6, 1.4,  0.18, 0.50);
    const closeStars   = mkStars(22,  2.2,  1.2, 2.2,  0.45, 0.85);

    // ── Galaxy particles ──────────────────────────────────────────────────────
    // Logarithmic spiral arms: r grows as theta increases
    // Color palette: white core → green → blue/purple tips, with pink HII blobs
    const ARMS         = 3;
    const WIND         = 3.8;   // radians per arm (how tightly wound)
    const galaxyPts    = [];

    // Colour table per arm
    const armColors = [
      [[74,222,128],[120,240,160],[180,255,210]],   // green arm
      [[96,165,250],[130,190,255],[170,215,255]],   // blue arm
      [[167,139,250],[200,170,255],[220,200,255]],  // purple arm
    ];

    // — Disk haze particles (very faint, spread widely) —
    for (let i = 0; i < 500; i++) {
      const r     = Math.sqrt(Math.random()) * 0.90;   // sqrt = uniform disk
      const theta = Math.random() * Math.PI * 2;
      galaxyPts.push({
        r, theta,
        size: Math.random() * 0.7 + 0.1,
        a: Math.random() * 0.06 + 0.01,
        color: [74, 200, 120],
        twinkle: false,
      });
    }

    // — Spiral arm stars —
    for (let arm = 0; arm < ARMS; arm++) {
      const armOffset = (arm / ARMS) * Math.PI * 2;
      const cols = armColors[arm];

      for (let i = 0; i < 700; i++) {
        const frac    = i / 700;
        // logarithmic spiral: theta ∝ frac, r grows with theta
        const theta   = frac * WIND + armOffset;
        const r       = 0.06 + frac * 0.86;
        // scatter: wider toward tips
        const scatter = (Math.random() - 0.5) * (0.03 + frac * 0.14);
        const rScatter = r + (Math.random() - 0.5) * 0.04;

        // pick color: inner = col[0], outer = col[2], random mix
        const ci   = Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2;
        const col  = cols[ci];

        // occasionally add a pinkish HII / star-forming cloud
        const isHII = Math.random() < 0.04 && frac > 0.15 && frac < 0.75;
        const finalColor = isHII ? [255, 160, 190] : col;

        galaxyPts.push({
          r:     rScatter,
          theta: theta + scatter,
          size:  isHII
            ? Math.random() * 2.5 + 1.2
            : Math.random() * (1.2 - frac * 0.6) + 0.2,
          a: isHII
            ? Math.random() * 0.28 + 0.10
            : Math.random() * (0.55 - frac * 0.35) + 0.05,
          color: finalColor,
          twinkle: Math.random() < 0.15,
          twinkleOff: Math.random() * Math.PI * 2,
          twinkleSpd: Math.random() * 0.02 + 0.006,
          isHII,
        });
      }
    }

    // — Bulge/core stars (dense concentrated center) —
    for (let i = 0; i < 600; i++) {
      const r     = Math.random() ** 2.5 * 0.20;   // very concentrated
      const theta = Math.random() * Math.PI * 2;
      const warm  = Math.random();   // warm → cool gradient in bulge
      const color = warm < 0.4
        ? [255, 245, 220]   // warm white-yellow
        : warm < 0.72
        ? [200, 255, 225]   // white-green
        : [74, 222, 128];   // green
      galaxyPts.push({
        r, theta,
        size: Math.random() * 1.6 + 0.3,
        a: Math.random() * 0.65 + 0.15,
        color,
        twinkle: true,
        twinkleOff: Math.random() * Math.PI * 2,
        twinkleSpd: Math.random() * 0.025 + 0.008,
      });
    }

    // — Outer halo globular-cluster specks —
    for (let i = 0; i < 150; i++) {
      const r     = Math.random() * 0.35 + 0.65;
      const theta = Math.random() * Math.PI * 2;
      galaxyPts.push({
        r, theta,
        size: Math.random() * 0.5 + 0.1,
        a: Math.random() * 0.10 + 0.02,
        color: [134, 239, 172],
        twinkle: false,
      });
    }

    // ── Nebula clouds (background, off-galaxy) ────────────────────────────────
    const nebulae = [
      { cx: 0.12, cy: 0.18, rx: 0.28, ry: 0.16, color: '74,222,128',  baseA: 0.022, phase: 0.0  },
      { cx: 0.88, cy: 0.80, rx: 0.26, ry: 0.22, color: '96,165,250',  baseA: 0.016, phase: 1.8  },
      { cx: 0.82, cy: 0.12, rx: 0.20, ry: 0.15, color: '167,139,250', baseA: 0.014, phase: 3.2  },
      { cx: 0.08, cy: 0.82, rx: 0.18, ry: 0.16, color: '74,222,128',  baseA: 0.010, phase: 5.0  },
    ];

    // ── Shooting stars ────────────────────────────────────────────────────────
    const MAX_SHOOTS = 4;
    const shoots = [];
    const spawnShoot = () => {
      const angle = (Math.random() * 40 + 8) * (Math.PI / 180);
      const speed = Math.random() * 13 + 7;
      shoots.push({
        x: Math.random() * 1.2 - 0.1,
        y: Math.random() * 0.45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: Math.random() * 200 + 80,
        life: 1,
        fade: Math.random() * 0.013 + 0.007,
        width: Math.random() * 1.4 + 0.4,
      });
    };
    setTimeout(spawnShoot, 600);
    setTimeout(spawnShoot, 2400);

    // ── Draw loop ─────────────────────────────────────────────────────────────
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      // — Background —
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
      bg.addColorStop(0,    '#081c10');
      bg.addColorStop(0.4,  '#040f08');
      bg.addColorStop(0.75, '#020b05');
      bg.addColorStop(1,    '#010806');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // — Background nebula clouds —
      nebulae.forEach(nb => {
        const pulse = Math.sin(t * 0.007 + nb.phase) * 0.35 + 0.65;
        const alpha = nb.baseA * pulse;
        ctx.save();
        ctx.translate(nb.cx * W, nb.cy * H);
        ctx.scale(1, nb.ry / nb.rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, nb.rx * W);
        grad.addColorStop(0,   `rgba(${nb.color},${(alpha * 1.8).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${nb.color},${(alpha * 0.5).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${nb.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, nb.rx * W, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // — Field stars (distant) —
      distantStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const tw = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.28 + 0.72;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(134,239,172,${s.a * tw})`;
        ctx.fill();
      });

      // — Galaxy —
      const gCX = W * 0.50;
      const gCY = H * 0.50;
      // size: fill more of the screen
      const gR  = Math.min(W, H) * 0.46;
      const tiltY = 0.38;    // perspective squish (< 1 = more edge-on)
      const galRot = t * 0.00045;

      // galaxy outer disk haze
      ctx.save();
      ctx.translate(gCX, gCY);
      ctx.scale(1, tiltY);
      const diskHaze = ctx.createRadialGradient(0, 0, 0, 0, 0, gR * 1.05);
      diskHaze.addColorStop(0,    'rgba(74,222,128,0.06)');
      diskHaze.addColorStop(0.35, 'rgba(74,222,128,0.03)');
      diskHaze.addColorStop(0.70, 'rgba(74,180,110,0.012)');
      diskHaze.addColorStop(1,    'rgba(74,222,128,0)');
      ctx.fillStyle = diskHaze;
      ctx.beginPath();
      ctx.arc(0, 0, gR * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // galaxy particles
      galaxyPts.forEach(p => {
        const ang = p.theta + galRot;
        const px  = gCX + Math.cos(ang) * p.r * gR;
        const py  = gCY + Math.sin(ang) * p.r * gR * tiltY;
        let alpha = p.a;
        if (p.twinkle) {
          alpha *= Math.sin(t * p.twinkleSpd + p.twinkleOff) * 0.3 + 0.7;
        }
        const [r, g, b] = p.color;

        if (p.isHII) {
          // HII region: soft glow blob
          const g2 = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
          g2.addColorStop(0,   `rgba(${r},${g},${b},${(alpha * 0.9).toFixed(3)})`);
          g2.addColorStop(0.5, `rgba(${r},${g},${b},${(alpha * 0.3).toFixed(3)})`);
          g2.addColorStop(1,   `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.size > 1.1) {
          // brighter star: soft halo
          const g2 = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.5);
          g2.addColorStop(0,   `rgba(${r},${g},${b},${(alpha * 0.7).toFixed(3)})`);
          g2.addColorStop(1,   `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.fill();
      });

      // galaxy bulge glow (multi-layer)
      [
        { r: gR * 0.28, c: 'rgba(74,222,128,0.055)' },
        { r: gR * 0.14, c: 'rgba(140,255,190,0.13)' },
        { r: gR * 0.065,c: 'rgba(220,255,235,0.28)' },
        { r: gR * 0.022,c: 'rgba(255,255,245,0.72)' },
      ].forEach(({ r: gr, c }) => {
        ctx.save();
        ctx.translate(gCX, gCY);
        ctx.scale(1, tiltY * 1.3);   // bulge is rounder than disk
        const coreG = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
        coreG.addColorStop(0, c);
        coreG.addColorStop(1, 'rgba(74,222,128,0)');
        ctx.fillStyle = coreG;
        ctx.beginPath();
        ctx.arc(0, 0, gr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // — Mid field stars —
      midStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const tw = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.35 + 0.65;
        const alpha = s.a * tw;
        if (s.r > 1.0) {
          const glow = ctx.createRadialGradient(s.x * W, s.y * H, 0, s.x * W, s.y * H, s.r * 3.5);
          glow.addColorStop(0,  `rgba(134,239,172,${(alpha * 0.45).toFixed(3)})`);
          glow.addColorStop(1,  'rgba(134,239,172,0)');
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

      // — Close bright stars with cross flare —
      closeStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const tw    = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.4 + 0.6;
        const alpha = s.a * tw;
        const sx    = s.x * W;
        const sy    = s.y * H;
        const glow  = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 6);
        glow.addColorStop(0,   `rgba(180,255,210,${(alpha * 0.6).toFixed(3)})`);
        glow.addColorStop(0.4, `rgba(74,222,128,${(alpha * 0.15).toFixed(3)})`);
        glow.addColorStop(1,   'rgba(74,222,128,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,255,240,${alpha})`;
        ctx.fill();
        const flareLen = s.r * (7 + tw * 4);
        ctx.save();
        ctx.globalAlpha = alpha * 0.32;
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

      // — Star web —
      const webStars = [...midStars, ...closeStars];
      const MAX_D = Math.min(W, H) * 0.10;
      for (let i = 0; i < webStars.length; i++) {
        for (let j = i + 1; j < webStars.length; j++) {
          const dx = (webStars[i].x - webStars[j].x) * W;
          const dy = (webStars[i].y - webStars[j].y) * H;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_D) {
            ctx.beginPath();
            ctx.moveTo(webStars[i].x * W, webStars[i].y * H);
            ctx.lineTo(webStars[j].x * W, webStars[j].y * H);
            ctx.strokeStyle = `rgba(74,222,128,${(1 - d / MAX_D) * 0.055})`;
            ctx.lineWidth = 0.3;
            ctx.stroke();
          }
        }
      }

      // — Shooting stars —
      if (shoots.length < MAX_SHOOTS && Math.random() < 0.004) spawnShoot();
      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i];
        s.x   += s.vx / W * 60;
        s.y   += s.vy / H * 60;
        s.life -= s.fade;
        if (s.life <= 0 || s.x > 1.3 || s.y > 1.2) { shoots.splice(i, 1); continue; }
        const sx = s.x * W;
        const sy = s.y * H;
        const hyp = Math.hypot(s.vx, s.vy);
        const ex  = sx - (s.vx / W * 60) * (s.len / hyp);
        const ey  = sy - (s.vy / H * 60) * (s.len / hyp);
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
