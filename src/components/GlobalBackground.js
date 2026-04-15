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

    const distantStars = mkStars(180, 0.5,  0.2, 0.8,  0.07, 0.24);
    const midStars     = mkStars(80,  1.2,  0.6, 1.4,  0.22, 0.55);
    const closeStars   = mkStars(24,  2.2,  1.2, 2.2,  0.50, 0.88);

    // ── Galaxy particles ──────────────────────────────────────────────────────
    const ARMS = 4;
    const WIND = 4.2;   // radians per arm — tightly wound
    const galaxyPts = [];

    // Rich colour palette per arm — green-dominant but vivid
    const armPalettes = [
      // Arm 0 — emerald / cyan-green
      [[57,255,140],[74,222,128],[120,255,180],[180,255,220],[200,255,230]],
      // Arm 1 — cobalt blue / ice
      [[60,150,255],[96,165,250],[140,200,255],[180,220,255],[210,235,255]],
      // Arm 2 — violet / magenta
      [[180,100,255],[167,139,250],[210,160,255],[235,195,255],[245,215,255]],
      // Arm 3 — teal / aqua
      [[0,220,200],[30,200,180],[80,230,210],[140,245,230],[200,255,248]],
    ];

    // — Wide galactic disk haze —
    for (let i = 0; i < 700; i++) {
      const r     = Math.sqrt(Math.random()) * 0.95;
      const theta = Math.random() * Math.PI * 2;
      galaxyPts.push({
        r, theta,
        size: Math.random() * 0.8 + 0.1,
        a:    Math.random() * 0.09 + 0.02,
        color: [80, 210, 140],
        twinkle: false,
        isDisk: true,
      });
    }

    // — Spiral arm stars + nebulae —
    for (let arm = 0; arm < ARMS; arm++) {
      const armOffset = (arm / ARMS) * Math.PI * 2;
      const palette   = armPalettes[arm];

      for (let i = 0; i < 900; i++) {
        const frac   = i / 900;
        const theta  = frac * WIND + armOffset;
        const r      = 0.055 + frac * 0.88;

        // scatter widens from core to tips
        const angScatter = (Math.random() - 0.5) * (0.025 + frac * 0.16);
        const rScatter   = (Math.random() - 0.5) * (0.02  + frac * 0.06);

        // pick palette entry — inner stars are brighter/whiter
        const ci    = Math.min(palette.length - 1, Math.floor(Math.random() * (2 + frac * 3)));
        const col   = palette[ci];

        // HII region (pink/magenta star-forming blob)
        const isHII = Math.random() < 0.055 && frac > 0.12 && frac < 0.78;
        // bright star cluster node
        const isCluster = Math.random() < 0.015 && frac > 0.08;

        const finalColor = isHII
          ? (Math.random() < 0.5 ? [255, 120, 180] : [255, 80, 140])
          : col;

        galaxyPts.push({
          r:     r + rScatter,
          theta: theta + angScatter,
          size:  isCluster ? Math.random() * 2.2 + 1.8
               : isHII     ? Math.random() * 3.0 + 1.4
               :              Math.random() * (1.4 - frac * 0.7) + 0.2,
          a: isCluster ? Math.random() * 0.55 + 0.35
           : isHII     ? Math.random() * 0.40 + 0.18
           :              Math.random() * (0.72 - frac * 0.42) + 0.08,
          color: finalColor,
          twinkle: isCluster || Math.random() < 0.18,
          twinkleOff: Math.random() * Math.PI * 2,
          twinkleSpd: Math.random() * 0.025 + 0.006,
          isHII,
          isCluster,
        });
      }

      // Extra inter-arm nebula wisps (faint colored gas between arms)
      for (let i = 0; i < 120; i++) {
        const frac   = Math.random();
        const theta  = frac * WIND + armOffset + (Math.PI * 2 / ARMS) * 0.5;
        const r      = 0.10 + frac * 0.75;
        galaxyPts.push({
          r:     r + (Math.random() - 0.5) * 0.12,
          theta: theta + (Math.random() - 0.5) * 0.30,
          size:  Math.random() * 1.0 + 0.2,
          a:     Math.random() * 0.10 + 0.02,
          color: palette[2],
          twinkle: false,
          isWisp: true,
        });
      }
    }

    // — Dense glowing bulge —
    for (let i = 0; i < 900; i++) {
      const r     = Math.random() ** 2.2 * 0.22;
      const theta = Math.random() * Math.PI * 2;
      const v     = Math.random();
      const color = v < 0.25  ? [255, 250, 220]    // warm white-gold
                  : v < 0.50  ? [220, 255, 235]     // white-green
                  : v < 0.72  ? [120, 255, 175]     // bright green
                  : v < 0.88  ? [74, 222, 128]      // green
                  :             [57, 200, 255];      // electric teal accent
      galaxyPts.push({
        r, theta,
        size: Math.random() * 2.0 + 0.3,
        a:    Math.random() * 0.75 + 0.20,
        color,
        twinkle: true,
        twinkleOff: Math.random() * Math.PI * 2,
        twinkleSpd: Math.random() * 0.028 + 0.008,
      });
    }

    // — Halo globular clusters (scattered bright knots) —
    for (let i = 0; i < 40; i++) {
      const r     = Math.random() * 0.30 + 0.62;
      const theta = Math.random() * Math.PI * 2;
      const clusterColor = [
        [74,222,128],[96,165,250],[167,139,250],[57,255,140],[0,220,200],
      ][Math.floor(Math.random() * 5)];
      // cluster = 8-14 close stars
      const count = Math.floor(Math.random() * 7) + 8;
      for (let j = 0; j < count; j++) {
        galaxyPts.push({
          r:     r + (Math.random() - 0.5) * 0.025,
          theta: theta + (Math.random() - 0.5) * 0.035,
          size:  Math.random() * 1.1 + 0.3,
          a:     Math.random() * 0.45 + 0.15,
          color: clusterColor,
          twinkle: true,
          twinkleOff: Math.random() * Math.PI * 2,
          twinkleSpd: Math.random() * 0.02 + 0.007,
        });
      }
    }

    // — Faint outer halo specks —
    for (let i = 0; i < 200; i++) {
      const r     = Math.random() * 0.28 + 0.70;
      const theta = Math.random() * Math.PI * 2;
      galaxyPts.push({
        r, theta,
        size: Math.random() * 0.6 + 0.1,
        a:    Math.random() * 0.12 + 0.02,
        color: [134, 239, 172],
        twinkle: false,
      });
    }

    // ── Background nebulae (off-galaxy atmospheric glow) ─────────────────────
    const nebulae = [
      { cx: 0.10, cy: 0.15, rx: 0.26, ry: 0.15, color: '74,222,128',  baseA: 0.025, phase: 0.0  },
      { cx: 0.90, cy: 0.82, rx: 0.24, ry: 0.20, color: '96,165,250',  baseA: 0.018, phase: 1.8  },
      { cx: 0.85, cy: 0.10, rx: 0.18, ry: 0.14, color: '167,139,250', baseA: 0.016, phase: 3.2  },
      { cx: 0.06, cy: 0.85, rx: 0.16, ry: 0.14, color: '0,220,200',   baseA: 0.012, phase: 5.0  },
      { cx: 0.50, cy: 0.05, rx: 0.30, ry: 0.08, color: '74,222,128',  baseA: 0.010, phase: 2.5  },
    ];

    // ── Shooting stars ────────────────────────────────────────────────────────
    const MAX_SHOOTS = 5;
    const shoots = [];
    const spawnShoot = () => {
      const angle = (Math.random() * 40 + 8) * (Math.PI / 180);
      const speed = Math.random() * 13 + 7;
      shoots.push({
        x: Math.random() * 1.2 - 0.1,
        y: Math.random() * 0.40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: Math.random() * 220 + 90,
        life: 1,
        fade: Math.random() * 0.013 + 0.007,
        width: Math.random() * 1.5 + 0.4,
        // random color: mostly white-green, occasional blue or purple
        color: Math.random() < 0.6
          ? [200, 255, 225]
          : Math.random() < 0.5 ? [180, 210, 255] : [220, 190, 255],
      });
    };
    setTimeout(spawnShoot, 500);
    setTimeout(spawnShoot, 2200);
    setTimeout(spawnShoot, 4000);

    // ── Draw loop ─────────────────────────────────────────────────────────────
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      // — Background —
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
      bg.addColorStop(0,    '#081c10');
      bg.addColorStop(0.40, '#040f08');
      bg.addColorStop(0.75, '#020b05');
      bg.addColorStop(1,    '#010806');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // — Background nebulae —
      nebulae.forEach(nb => {
        const pulse = Math.sin(t * 0.007 + nb.phase) * 0.32 + 0.68;
        const alpha = nb.baseA * pulse;
        ctx.save();
        ctx.translate(nb.cx * W, nb.cy * H);
        ctx.scale(1, nb.ry / nb.rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, nb.rx * W);
        grad.addColorStop(0,   `rgba(${nb.color},${(alpha * 1.9).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${nb.color},${(alpha * 0.5).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${nb.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, nb.rx * W, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // — Field stars distant —
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
      const gR  = Math.min(W, H) * 0.48;
      const tiltY = 0.36;
      // COUNTER-CLOCKWISE: negative increment
      const galRot = -t * 0.00042;

      // Outer disk glow
      ctx.save();
      ctx.translate(gCX, gCY);
      ctx.scale(1, tiltY);
      const diskHaze = ctx.createRadialGradient(0, 0, 0, 0, 0, gR * 1.08);
      diskHaze.addColorStop(0,    'rgba(80,220,140,0.10)');
      diskHaze.addColorStop(0.30, 'rgba(74,222,128,0.055)');
      diskHaze.addColorStop(0.65, 'rgba(57,200,140,0.020)');
      diskHaze.addColorStop(1,    'rgba(74,222,128,0)');
      ctx.fillStyle = diskHaze;
      ctx.beginPath();
      ctx.arc(0, 0, gR * 1.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Colorful arm glow bands (painted before particles for depth)
      const armGlowColors = [
        'rgba(57,255,140,0.028)',
        'rgba(60,150,255,0.022)',
        'rgba(180,100,255,0.020)',
        'rgba(0,220,200,0.022)',
      ];
      for (let arm = 0; arm < ARMS; arm++) {
        const armOffset = (arm / ARMS) * Math.PI * 2;
        ctx.save();
        ctx.translate(gCX, gCY);
        ctx.scale(1, tiltY);
        for (let step = 0; step < 60; step++) {
          const frac  = step / 60;
          const theta = frac * WIND + armOffset + galRot;
          const r     = (0.07 + frac * 0.85) * gR;
          const px    = Math.cos(theta) * r;
          const py    = Math.sin(theta) * r;
          const glow  = ctx.createRadialGradient(px, py, 0, px, py, gR * (0.06 + frac * 0.04));
          glow.addColorStop(0, armGlowColors[arm]);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, gR * (0.06 + frac * 0.04), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Galaxy particles
      galaxyPts.forEach(p => {
        const ang = p.theta + galRot;
        const px  = gCX + Math.cos(ang) * p.r * gR;
        const py  = gCY + Math.sin(ang) * p.r * gR * tiltY;
        let alpha = p.a;
        if (p.twinkle) alpha *= Math.sin(t * p.twinkleSpd + p.twinkleOff) * 0.32 + 0.68;
        const [r, g, b] = p.color;

        if (p.isHII || p.isCluster) {
          const glowR = p.size * (p.isHII ? 4.5 : 3.5);
          const g2 = ctx.createRadialGradient(px, py, 0, px, py, glowR);
          g2.addColorStop(0,   `rgba(${r},${g},${b},${(alpha * 0.95).toFixed(3)})`);
          g2.addColorStop(0.4, `rgba(${r},${g},${b},${(alpha * 0.35).toFixed(3)})`);
          g2.addColorStop(1,   `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(px, py, glowR, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.size > 1.0 && !p.isDisk) {
          const g2 = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.8);
          g2.addColorStop(0,  `rgba(${r},${g},${b},${(alpha * 0.6).toFixed(3)})`);
          g2.addColorStop(1,  `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.fill();
      });

      // Bulge glow — multi-layered, vivid
      const bulgeGlows = [
        { r: gR * 0.32, c: 'rgba(57,255,140,0.045)' },
        { r: gR * 0.18, c: 'rgba(80,240,160,0.10)'  },
        { r: gR * 0.09, c: 'rgba(160,255,200,0.20)'  },
        { r: gR * 0.045,c: 'rgba(220,255,235,0.42)'  },
        { r: gR * 0.016,c: 'rgba(255,255,250,0.85)'  },
      ];
      bulgeGlows.forEach(({ r: gr, c }) => {
        ctx.save();
        ctx.translate(gCX, gCY);
        ctx.scale(1, tiltY * 1.35);
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
        const tw    = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.35 + 0.65;
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
        glow.addColorStop(0,   `rgba(180,255,210,${(alpha * 0.65).toFixed(3)})`);
        glow.addColorStop(0.4, `rgba(74,222,128,${(alpha * 0.18).toFixed(3)})`);
        glow.addColorStop(1,   'rgba(74,222,128,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235,255,242,${alpha})`;
        ctx.fill();
        const flareLen = s.r * (7 + tw * 4);
        ctx.save();
        ctx.globalAlpha = alpha * 0.34;
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
      if (shoots.length < MAX_SHOOTS && Math.random() < 0.0045) spawnShoot();
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
        const [sr, sg, sb] = s.color;
        const grad = ctx.createLinearGradient(ex, ey, sx, sy);
        grad.addColorStop(0,   `rgba(${sr},${sg},${sb},0)`);
        grad.addColorStop(0.6, `rgba(${sr},${sg},${sb},${(s.life * 0.55).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${sr},${sg},${sb},${s.life.toFixed(3)})`);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width * s.life;
        ctx.lineCap = 'round';
        ctx.stroke();
        const hglow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6 * s.life);
        hglow.addColorStop(0,  `rgba(${sr},${sg},${sb},${(s.life * 0.9).toFixed(3)})`);
        hglow.addColorStop(1,  `rgba(${sr},${sg},${sb},0)`);
        ctx.fillStyle = hglow;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 * s.life, 0, Math.PI * 2);
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
