import { useEffect, useRef } from 'react';

export default function GlobalBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    /* Star particles */
    const stars = Array.from({ length: 220 }, () => ({
      x:  Math.random(),
      y:  Math.random(),
      vx: (Math.random() - 0.5) * 0.00011,
      vy: (Math.random() - 0.5) * 0.00011,
      r:  Math.random() * 1.5 + 0.3,
      a:  Math.random() * 0.5 + 0.12,
    }));

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;

      /* Deep space gradient */
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.8);
      bg.addColorStop(0,   '#071a0e');
      bg.addColorStop(0.45,'#030f07');
      bg.addColorStop(1,   '#010806');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* Subtle nebula glow in center */
      const nebula = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.min(W, H) * 0.45);
      nebula.addColorStop(0,   'rgba(74,222,128,0.04)');
      nebula.addColorStop(0.6, 'rgba(74,222,128,0.01)');
      nebula.addColorStop(1,   'rgba(74,222,128,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, W, H);

      /* Move + draw stars */
      stars.forEach((s) => {
        s.x += s.vx; if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        s.y += s.vy; if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(134,239,172,${s.a})`;
        ctx.fill();
      });

      /* Star connection web */
      const MAX_D = Math.min(W, H) * 0.14;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = (stars[i].x - stars[j].x) * W;
          const dy = (stars[i].y - stars[j].y) * H;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_D) {
            ctx.beginPath();
            ctx.moveTo(stars[i].x * W, stars[i].y * H);
            ctx.lineTo(stars[j].x * W, stars[j].y * H);
            ctx.strokeStyle = `rgba(74,222,128,${(1 - d / MAX_D) * 0.08})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
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
