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

    // ── HSL helper ────────────────────────────────────────────────────────────
    const hsl = (h, s, l) => {
      s /= 100; l /= 100;
      const k = n => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
      return [f(0), f(8), f(4)];
    };

    // ── Field stars (3 parallax layers) ──────────────────────────────────────
    const mkStars = (n, speedScale, minR, maxR, minA, maxA) =>
      Array.from({ length: n }, () => ({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00042 * speedScale,
        vy: (Math.random() - 0.5) * 0.00042 * speedScale,
        r:  Math.random() * (maxR - minR) + minR,
        a:  Math.random() * (maxA - minA) + minA,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed:  Math.random() * 0.022 + 0.005,
      }));

    const distantStars = mkStars(160, 0.5,  0.2, 0.8,  0.07, 0.24);
    const midStars     = mkStars(60,  1.2,  0.6, 1.4,  0.22, 0.55);
    const closeStars   = mkStars(18,  2.2,  1.2, 2.2,  0.50, 0.88);

    // ── Main galaxy DNA ───────────────────────────────────────────────────────
    const primaryHue = 90 + Math.random() * 70;
    const ARMS       = 3 + Math.floor(Math.random() * 3);
    const WIND       = 3.1 + Math.random() * 2.0;
    const TILT_Y     = 0.28 + Math.random() * 0.22;
    const G_SCALE    = 0.43 + Math.random() * 0.10;
    const SCATTER_K  = 0.7  + Math.random() * 0.7;

    const armPalettes = Array.from({ length: ARMS }, (_, i) => {
      const hue = (primaryHue + (360 / ARMS) * i + (Math.random() - 0.5) * 28) % 360;
      return [
        hsl(hue, 95, 52), hsl(hue, 88, 62), hsl(hue, 78, 72),
        hsl(hue, 65, 80), hsl(hue, 50, 88),
      ];
    });

    const hiiHue    = (primaryHue + 140 + Math.random() * 60) % 360;
    const hiiColA   = hsl(hiiHue, 100, 68);
    const hiiColB   = hsl(hiiHue, 100, 58);
    const diskColor = hsl(primaryHue, 70, 50);

    // ── Main galaxy particles ─────────────────────────────────────────────────
    const galaxyPts = [];

    for (let i = 0; i < 600; i++) {
      galaxyPts.push({ r: Math.sqrt(Math.random()) * 0.95, theta: Math.random() * Math.PI * 2,
        size: Math.random() * 0.8 + 0.1, a: Math.random() * 0.09 + 0.02,
        color: diskColor, twinkle: false, isDisk: true });
    }

    for (let arm = 0; arm < ARMS; arm++) {
      const armOffset = (arm / ARMS) * Math.PI * 2;
      const palette   = armPalettes[arm];
      for (let i = 0; i < 700; i++) {
        const frac  = i / 700;
        const theta = frac * WIND + armOffset;
        const r     = 0.055 + frac * 0.88;
        const angSc = (Math.random() - 0.5) * (0.025 + frac * 0.16) * SCATTER_K;
        const rSc   = (Math.random() - 0.5) * (0.02  + frac * 0.06) * SCATTER_K;
        const ci    = Math.min(palette.length - 1, Math.floor(Math.random() * (2 + frac * 3)));
        const isHII     = Math.random() < 0.012 && frac > 0.18 && frac < 0.72;
        const isCluster = Math.random() < 0.015 && frac > 0.08;
        galaxyPts.push({
          r: r + rSc, theta: theta + angSc,
          size: isCluster ? Math.random() * 1.6 + 1.2 : isHII ? Math.random() * 1.4 + 0.8 : Math.random() * (1.4 - frac * 0.7) + 0.2,
          a:    isCluster ? Math.random() * 0.55 + 0.35 : isHII ? Math.random() * 0.32 + 0.14 : Math.random() * (0.72 - frac * 0.42) + 0.08,
          color: isHII ? (Math.random() < 0.5 ? hiiColA : hiiColB) : palette[ci],
          twinkle: isCluster || Math.random() < 0.18,
          twinkleOff: Math.random() * Math.PI * 2, twinkleSpd: Math.random() * 0.025 + 0.006,
          isHII, isCluster,
        });
      }
      for (let i = 0; i < 300; i++) {
        const frac  = i / 300;
        const theta = frac * WIND + armOffset;
        const r     = 0.055 + frac * 0.88;
        galaxyPts.push({
          r: r + (Math.random() - 0.5) * 0.018 * SCATTER_K,
          theta: theta + (Math.random() - 0.5) * (0.012 + frac * 0.045) * SCATTER_K,
          size: Math.random() * 0.55 + 0.1, a: Math.random() * (0.55 - frac * 0.28) + 0.10,
          color: palette[Math.floor(Math.random() * 3)],
          twinkle: false,
        });
      }
    }

    for (let i = 0; i < 700; i++) {
      const r = Math.random() ** 2.2 * 0.22;
      const v = Math.random();
      const col = v < 0.25 ? [255,250,220] : v < 0.50 ? [220,255,235] : v < 0.72 ? [120,255,175] : v < 0.88 ? [74,222,128] : [57,200,255];
      galaxyPts.push({ r, theta: Math.random() * Math.PI * 2, size: Math.random() * 2.0 + 0.3,
        a: Math.random() * 0.75 + 0.20, color: col, twinkle: true,
        twinkleOff: Math.random() * Math.PI * 2, twinkleSpd: Math.random() * 0.028 + 0.008 });
    }

    for (let i = 0; i < 30; i++) {
      const r = Math.random() * 0.30 + 0.62;
      const theta = Math.random() * Math.PI * 2;
      const cc = [[74,222,128],[96,165,250],[167,139,250],[57,255,140],[0,220,200]][Math.floor(Math.random() * 5)];
      for (let j = 0; j < Math.floor(Math.random() * 7) + 6; j++) {
        galaxyPts.push({ r: r + (Math.random()-0.5)*0.025, theta: theta + (Math.random()-0.5)*0.035,
          size: Math.random()*1.1+0.3, a: Math.random()*0.45+0.15, color: cc,
          twinkle: true, twinkleOff: Math.random()*Math.PI*2, twinkleSpd: Math.random()*0.02+0.007 });
      }
    }

    for (let i = 0; i < 160; i++) {
      galaxyPts.push({ r: Math.random()*0.28+0.70, theta: Math.random()*Math.PI*2,
        size: Math.random()*0.6+0.1, a: Math.random()*0.12+0.02, color: [134,239,172], twinkle: false });
    }

    // ── Background galaxies — pre-rendered to offscreen canvases ─────────────
    const OC = 220; // offscreen canvas size (pixels)
    const OC_R = OC * 0.40; // radius in offscreen space
    const OC_CX = OC / 2;
    const OC_CY = OC / 2;

    const BG_COUNT = 3 + Math.floor(Math.random() * 5); // 3–7

    const bgGalaxies = Array.from({ length: BG_COUNT }, () => {
      const bgHue     = Math.random() * 360;
      const bgArms    = 2 + Math.floor(Math.random() * 3);
      const bgWind    = 2.2 + Math.random() * 3.0;
      const bgTilt    = 0.20 + Math.random() * 0.50;
      const bgAlpha   = 0.06 + Math.random() * 0.18;
      const bgScatter = 0.5 + Math.random() * 1.0;
      const cx        = Math.random();
      const cy        = Math.random();
      const scale     = 0.035 + Math.random() * 0.10;

      const [cr, cg, cb] = hsl(bgHue, 78, 58);
      const [cr2, cg2, cb2] = hsl((bgHue + 35) % 360, 62, 72);

      // ── Build offscreen canvas ──────────────────────────────────────────────
      const oc   = document.createElement('canvas');
      oc.width   = OC;
      oc.height  = OC;
      const octx = oc.getContext('2d');

      // Disk haze
      octx.save();
      octx.translate(OC_CX, OC_CY);
      octx.scale(1, bgTilt);
      const dg = octx.createRadialGradient(0, 0, 0, 0, 0, OC_R * 1.15);
      dg.addColorStop(0,   `rgba(${cr},${cg},${cb},${(0.12 * bgAlpha).toFixed(3)})`);
      dg.addColorStop(0.5, `rgba(${cr},${cg},${cb},${(0.05 * bgAlpha).toFixed(3)})`);
      dg.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
      octx.fillStyle = dg;
      octx.beginPath(); octx.arc(0, 0, OC_R * 1.15, 0, Math.PI * 2); octx.fill();
      octx.restore();

      // Arms
      for (let arm = 0; arm < bgArms; arm++) {
        const offset = (arm / bgArms) * Math.PI * 2;
        for (let i = 0; i < 130; i++) {
          const frac  = i / 130;
          const theta = frac * bgWind + offset + (Math.random() - 0.5) * (0.04 + frac * 0.18) * bgScatter;
          const r     = (0.06 + frac * 0.87 + (Math.random() - 0.5) * 0.05 * bgScatter) * OC_R;
          const px    = OC_CX + Math.cos(theta) * r;
          const py    = OC_CY + Math.sin(theta) * r * bgTilt;
          const [dr, dg2, db] = frac < 0.4 ? [cr2, cg2, cb2] : [cr, cg, cb];
          const a = (Math.random() * (0.65 - frac * 0.38) + 0.06) * bgAlpha;
          octx.beginPath();
          octx.arc(px, py, Math.random() * 0.55 + 0.08, 0, Math.PI * 2);
          octx.fillStyle = `rgba(${dr},${dg2},${db},${a.toFixed(3)})`;
          octx.fill();
        }
      }

      // Disk scatter
      for (let i = 0; i < 60; i++) {
        const r     = Math.sqrt(Math.random()) * OC_R * 0.9;
        const theta = Math.random() * Math.PI * 2;
        const px    = OC_CX + Math.cos(theta) * r;
        const py    = OC_CY + Math.sin(theta) * r * bgTilt;
        const a     = (Math.random() * 0.10 + 0.02) * bgAlpha;
        octx.beginPath();
        octx.arc(px, py, Math.random() * 0.5 + 0.1, 0, Math.PI * 2);
        octx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
        octx.fill();
      }

      // Bulge
      for (let i = 0; i < 55; i++) {
        const r     = (Math.random() ** 2.2) * OC_R * 0.18;
        const theta = Math.random() * Math.PI * 2;
        const px    = OC_CX + Math.cos(theta) * r;
        const py    = OC_CY + Math.sin(theta) * r * bgTilt * 1.2;
        const a     = (Math.random() * 0.55 + 0.20) * bgAlpha;
        octx.beginPath();
        octx.arc(px, py, Math.random() * 1.0 + 0.2, 0, Math.PI * 2);
        octx.fillStyle = `rgba(${cr2},${cg2},${cb2},${a.toFixed(3)})`;
        octx.fill();
      }

      // Bulge core glow
      octx.save();
      octx.translate(OC_CX, OC_CY);
      octx.scale(1, bgTilt * 1.3);
      const bg2 = octx.createRadialGradient(0, 0, 0, 0, 0, OC_R * 0.13);
      bg2.addColorStop(0, `rgba(${cr2},${cg2},${cb2},${(0.55 * bgAlpha).toFixed(3)})`);
      bg2.addColorStop(1, `rgba(${cr2},${cg2},${cb2},0)`);
      octx.fillStyle = bg2;
      octx.beginPath(); octx.arc(0, 0, OC_R * 0.13, 0, Math.PI * 2); octx.fill();
      octx.restore();

      return { cx, cy, scale, oc };
    });

    // ── Background nebulae ────────────────────────────────────────────────────
    const nebulae = [
      { cx: 0.10, cy: 0.15, rx: 0.26, ry: 0.15, color: '74,222,128',  baseA: 0.025, phase: 0.0 },
      { cx: 0.90, cy: 0.82, rx: 0.24, ry: 0.20, color: '96,165,250',  baseA: 0.018, phase: 1.8 },
      { cx: 0.85, cy: 0.10, rx: 0.18, ry: 0.14, color: '167,139,250', baseA: 0.016, phase: 3.2 },
      { cx: 0.06, cy: 0.85, rx: 0.16, ry: 0.14, color: '0,220,200',   baseA: 0.012, phase: 5.0 },
      { cx: 0.50, cy: 0.05, rx: 0.30, ry: 0.08, color: '74,222,128',  baseA: 0.010, phase: 2.5 },
    ];

    // ── Draw loop ─────────────────────────────────────────────────────────────
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      // Background
      const bg = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.9);
      bg.addColorStop(0,    '#081c10');
      bg.addColorStop(0.40, '#040f08');
      bg.addColorStop(0.75, '#020b05');
      bg.addColorStop(1,    '#010806');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebulae
      nebulae.forEach(nb => {
        const alpha = nb.baseA * (Math.sin(t * 0.007 + nb.phase) * 0.32 + 0.68);
        ctx.save();
        ctx.translate(nb.cx * W, nb.cy * H);
        ctx.scale(1, nb.ry / nb.rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, nb.rx * W);
        grad.addColorStop(0,   `rgba(${nb.color},${(alpha * 1.9).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${nb.color},${(alpha * 0.5).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${nb.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, nb.rx * W, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // Background galaxies — single drawImage per galaxy (pre-rendered)
      bgGalaxies.forEach(bg => {
        const drawR = Math.min(W, H) * bg.scale * 1.3;
        ctx.drawImage(bg.oc, bg.cx * W - drawR, bg.cy * H - drawR, drawR * 2, drawR * 2);
      });

      // Distant field stars
      distantStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const tw = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.28 + 0.72;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(134,239,172,${(s.a * tw).toFixed(3)})`; ctx.fill();
      });

      // Main galaxy
      const gCX  = W * 0.50;
      const gCY  = H * 0.50;
      const gR   = Math.min(W, H) * G_SCALE;
      const galRot = -t * 0.00042;

      // Outer disk haze
      ctx.save(); ctx.translate(gCX, gCY); ctx.scale(1, TILT_Y);
      const diskHaze = ctx.createRadialGradient(0, 0, 0, 0, 0, gR * 1.08);
      diskHaze.addColorStop(0,    'rgba(80,220,140,0.10)');
      diskHaze.addColorStop(0.30, 'rgba(74,222,128,0.055)');
      diskHaze.addColorStop(0.65, 'rgba(57,200,140,0.020)');
      diskHaze.addColorStop(1,    'rgba(74,222,128,0)');
      ctx.fillStyle = diskHaze;
      ctx.beginPath(); ctx.arc(0, 0, gR * 1.08, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Arm glow bands — reduced to 22 steps (was 60)
      for (let arm = 0; arm < ARMS; arm++) {
        const [pr, pg, pb] = armPalettes[arm][1];
        const armOffset = (arm / ARMS) * Math.PI * 2;
        ctx.save(); ctx.translate(gCX, gCY); ctx.scale(1, TILT_Y);
        for (let step = 0; step < 22; step++) {
          const frac  = step / 22;
          const theta = frac * WIND + armOffset + galRot;
          const r     = (0.07 + frac * 0.85) * gR;
          const px    = Math.cos(theta) * r;
          const py    = Math.sin(theta) * r;
          const glow  = ctx.createRadialGradient(px, py, 0, px, py, gR * (0.08 + frac * 0.05));
          glow.addColorStop(0, `rgba(${pr},${pg},${pb},0.028)`);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(px, py, gR * (0.08 + frac * 0.05), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // Galaxy particles
      galaxyPts.forEach(p => {
        const ang = p.theta + galRot;
        const px  = gCX + Math.cos(ang) * p.r * gR;
        const py  = gCY + Math.sin(ang) * p.r * gR * TILT_Y;
        let alpha = p.a;
        if (p.twinkle) alpha *= Math.sin(t * p.twinkleSpd + p.twinkleOff) * 0.32 + 0.68;
        const [r, g, b] = p.color;

        if (p.isHII || p.isCluster) {
          const gr = p.size * (p.isHII ? 4.5 : 3.5);
          const g2 = ctx.createRadialGradient(px, py, 0, px, py, gr);
          g2.addColorStop(0,   `rgba(${r},${g},${b},${(alpha*0.95).toFixed(3)})`);
          g2.addColorStop(0.4, `rgba(${r},${g},${b},${(alpha*0.35).toFixed(3)})`);
          g2.addColorStop(1,   `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(px, py, gr, 0, Math.PI * 2); ctx.fill();
        } else if (p.size > 1.0 && !p.isDisk) {
          const g2 = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.8);
          g2.addColorStop(0, `rgba(${r},${g},${b},${(alpha*0.6).toFixed(3)})`);
          g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(px, py, p.size * 2.8, 0, Math.PI * 2); ctx.fill();
        }

        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`; ctx.fill();
      });

      // Bulge glows
      [
        [gR*0.32,  'rgba(57,255,140,0.045)'],
        [gR*0.18,  'rgba(80,240,160,0.10)' ],
        [gR*0.09,  'rgba(160,255,200,0.20)'],
        [gR*0.045, 'rgba(220,255,235,0.42)'],
        [gR*0.016, 'rgba(255,255,250,0.85)'],
      ].forEach(([gr, c]) => {
        ctx.save(); ctx.translate(gCX, gCY); ctx.scale(1, TILT_Y * 1.35);
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
        cg.addColorStop(0, c); cg.addColorStop(1, 'rgba(74,222,128,0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(0, 0, gr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // Mid field stars
      midStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const tw    = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.35 + 0.65;
        const alpha = s.a * tw;
        if (s.r > 1.0) {
          const glow = ctx.createRadialGradient(s.x*W, s.y*H, 0, s.x*W, s.y*H, s.r*3.5);
          glow.addColorStop(0, `rgba(134,239,172,${(alpha*0.45).toFixed(3)})`);
          glow.addColorStop(1, 'rgba(134,239,172,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r*3.5, 0, Math.PI*2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(200,255,220,${alpha})`; ctx.fill();
      });

      // Close bright stars with cross flare
      closeStars.forEach(s => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        const tw    = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.4 + 0.6;
        const alpha = s.a * tw;
        const sx    = s.x * W;
        const sy    = s.y * H;
        const glow  = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r*6);
        glow.addColorStop(0,   `rgba(180,255,210,${(alpha*0.65).toFixed(3)})`);
        glow.addColorStop(0.4, `rgba(74,222,128,${(alpha*0.18).toFixed(3)})`);
        glow.addColorStop(1,   'rgba(74,222,128,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(sx, sy, s.r*6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(235,255,242,${alpha})`; ctx.fill();
        const fl = s.r * (7 + tw * 4);
        ctx.save(); ctx.globalAlpha = alpha * 0.34;
        [0, Math.PI / 2].forEach(rot => {
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
          const fl2 = ctx.createLinearGradient(-fl, 0, fl, 0);
          fl2.addColorStop(0,   'rgba(134,239,172,0)');
          fl2.addColorStop(0.5, 'rgba(200,255,225,1)');
          fl2.addColorStop(1,   'rgba(134,239,172,0)');
          ctx.fillStyle = fl2; ctx.fillRect(-fl, -0.6, fl*2, 1.2);
          ctx.restore();
        });
        ctx.restore();
      });

      // Star web
      const webStars = [...midStars, ...closeStars];
      const MAX_D = Math.min(W, H) * 0.10;
      for (let i = 0; i < webStars.length; i++) {
        for (let j = i + 1; j < webStars.length; j++) {
          const dx = (webStars[i].x - webStars[j].x) * W;
          const dy = (webStars[i].y - webStars[j].y) * H;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < MAX_D) {
            ctx.beginPath();
            ctx.moveTo(webStars[i].x*W, webStars[i].y*H);
            ctx.lineTo(webStars[j].x*W, webStars[j].y*H);
            ctx.strokeStyle = `rgba(74,222,128,${((1 - d/MAX_D) * 0.055).toFixed(3)})`;
            ctx.lineWidth = 0.3; ctx.stroke();
          }
        }
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
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: -1, display: 'block', pointerEvents: 'none',
      }}
    />
  );
}
