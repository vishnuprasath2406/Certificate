import React, { useEffect, useRef } from 'react';

export const PhoenixHeroGraphic: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      alpha: number;
      decay: number;
    }

    const particles: Particle[] = [];
    const colors = ['#FF6A00', '#E51B23', '#FFC21A', '#E0008A', '#6A00FF'];

    const createParticle = (): Particle => {
      const centerX = width / 2;
      const centerY = height * 0.5;
      const spreadX = (Math.random() - 0.5) * (width * 0.7);
      const spreadY = (Math.random() - 0.5) * (height * 0.6);
      return {
        x: centerX + spreadX,
        y: centerY + spreadY,
        size: Math.random() * 3.5 + 0.8,
        speedX: (Math.random() - 0.5) * 1.2,
        speedY: -(Math.random() * 2.2 + 0.6),
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.8 + 0.2,
        decay: Math.random() * 0.005 + 0.002,
      };
    };

    for (let i = 0; i < 90; i++) {
      particles.push(createParticle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p, index) => {
        p.x += p.speedX + Math.sin(Date.now() * 0.001 + index) * 0.4;
        p.y += p.speedY;
        p.alpha -= p.decay;
        if (p.alpha <= 0 || p.y < -10) {
          particles[index] = createParticle();
          return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* ── LAYER 1: Dark gradient base ── */}
      <div className="absolute inset-0 bg-[#070709]" />

      {/* ── LAYER 2: Phoenix Flying Bird Video — full coverage ── */}
      <video
        src="/phoenix.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-85"
      />

      {/* ── LAYER 3: Dark Vignette / Contrast Overlay for readability ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/85 pointer-events-none" />

      {/* ── LAYER 4: Phoenix fire atmospheric glow (centre) ── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-25 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,106,0,0.6) 0%, rgba(229,27,35,0.4) 40%, rgba(224,0,138,0.2) 70%, rgba(106,0,255,0) 100%)',
        }}
      />

      {/* ── LAYER 5: Ember Particle Canvas (floating fire sparks) ── */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
};
