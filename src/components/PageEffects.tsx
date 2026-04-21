"use client";

import { useEffect, useRef, memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

type EffectType = "none" | "snow" | "rain" | "thunder" | "fireflies" | "embers";

interface PageEffectsProps {
  effect: EffectType;
  intensity?: number;
}

/* ── Snow ──────────────────────────────────────────────────── */
function SnowEffect({ intensity = 1 }: { intensity: number }) {
  const count = Math.round(50 * intensity);
  const flakes = Array.from({ length: count }, (_, i) => ({
    left: (i * 7.3 + (i % 8) * 3.1) % 100,
    delay: (i % 11) * 0.4,
    duration: 6 + (i % 7) * 2,
    size: 2 + (i % 4) * 1.5,
    drift: -20 + (i % 5) * 10,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]">
      {flakes.map((f, i) => (
        <motion.span
          key={i}
          className="absolute top-[-3%] block rounded-full bg-white/80"
          style={{ left: `${f.left}%`, width: f.size, height: f.size }}
          animate={{
            y: [0, "110vh"],
            x: [0, f.drift],
            opacity: [0, 0.9, 0.9, 0],
          }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

/* ── Rain ──────────────────────────────────────────────────── */
function RainEffect({ intensity = 1 }: { intensity: number }) {
  const count = Math.round(60 * intensity);
  const drops = Array.from({ length: count }, (_, i) => ({
    left: (i * 11.7 + (i % 5) * 4.2) % 100,
    delay: (i % 7) * 0.12,
    duration: 0.8 + (i % 6) * 0.15,
    height: 14 + (i % 4) * 14,
    offset: -8 + (i % 4) * 4,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]">
      {drops.map((d, i) => (
        <motion.span
          key={i}
          className="absolute top-[-15%] block w-px rounded-full bg-gradient-to-b from-white/0 via-white/40 to-white/0"
          style={{ left: `${d.left}%`, height: `${d.height}vh` }}
          animate={{
            y: [0, "130vh"],
            x: [d.offset, d.offset + 12],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ── Thunder ──────────────────────────────────────────────── */
function ThunderEffect({ intensity = 1 }: { intensity: number }) {
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const flash = () => {
      if (!mounted || !flashRef.current) return;
      const el = flashRef.current;

      // Random double flash
      el.style.opacity = "0.7";
      setTimeout(() => {
        if (!mounted) return;
        el.style.opacity = "0";
        setTimeout(() => {
          if (!mounted) return;
          el.style.opacity = "0.4";
          setTimeout(() => {
            if (!mounted) return;
            el.style.opacity = "0";
          }, 80);
        }, 100);
      }, 60);

      // Next flash in 3-10s depending on intensity
      const nextDelay = (3000 + Math.random() * 7000) / intensity;
      setTimeout(flash, nextDelay);
    };

    const initial = setTimeout(flash, 2000 + Math.random() * 4000);
    return () => {
      mounted = false;
      clearTimeout(initial);
    };
  }, [intensity]);

  return (
    <>
      <RainEffect intensity={intensity * 1.2} />
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 z-[2] bg-white/20 transition-opacity duration-75"
        style={{ opacity: 0 }}
      />
    </>
  );
}

/* ── Fireflies ────────────────────────────────────────────── */
function FirefliesEffect({ intensity = 1 }: { intensity: number }) {
  const count = Math.round(20 * intensity);
  const flies = Array.from({ length: count }, (_, i) => ({
    left: 5 + ((i * 17.3) % 90),
    top: 5 + ((i * 13.7 + i * 7) % 85),
    duration: 4 + (i % 5) * 2,
    delay: (i % 8) * 0.6,
    size: 3 + (i % 3) * 2,
    driftX: -30 + (i % 7) * 10,
    driftY: -20 + (i % 6) * 8,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]">
      {flies.map((f, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.size,
            height: f.size,
            background: "radial-gradient(circle, rgba(255,220,100,0.9) 0%, rgba(255,180,50,0.4) 60%, transparent 100%)",
            boxShadow: `0 0 ${f.size * 3}px ${f.size}px rgba(255,200,60,0.4)`,
          }}
          animate={{
            x: [0, f.driftX, -f.driftX * 0.5, 0],
            y: [0, f.driftY, -f.driftY * 0.7, 0],
            opacity: [0.1, 0.9, 0.3, 0.8, 0.1],
            scale: [0.8, 1.2, 0.9, 1.1, 0.8],
          }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ── Embers — floating ember particles ─────────────────────── */
function EmbersEffect({ intensity = 1 }: { intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    interface Particle { x: number; y: number; r: number; vx: number; vy: number; alpha: number; decay: number; hue: number }
    const particles: Particle[] = [];
    const spawnRate = 0.15 * intensity;

    function spawnParticle() {
      if (!canvas) return;
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: canvas.offsetHeight + 10,
        r: 1 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(0.3 + Math.random() * 0.8),
        alpha: 0.5 + Math.random() * 0.5,
        decay: 0.002 + Math.random() * 0.003,
        hue: 15 + Math.random() * 25,
      });
    }

    function loop() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      if (Math.random() < spawnRate) spawnParticle();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx + Math.sin(Date.now() * 0.001 + i) * 0.15;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
        grad.addColorStop(0, `hsla(${p.hue}, 100%, 60%, ${p.alpha})`);
        grad.addColorStop(1, `hsla(${p.hue}, 100%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = requestAnimationFrame(loop);
    }
    loop();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [intensity]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" style={{ opacity: 0.6 }} />;
}

/* ── Main export ──────────────────────────────────────────── */
function PageEffectsInner({ effect, intensity = 1 }: PageEffectsProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || effect === "none") return null;

  switch (effect) {
    case "snow":
      return <SnowEffect intensity={intensity} />;
    case "rain":
      return <RainEffect intensity={intensity} />;
    case "thunder":
      return <ThunderEffect intensity={intensity} />;
    case "fireflies":
      return <FirefliesEffect intensity={intensity} />;
    case "embers":
      return <EmbersEffect intensity={intensity} />;
    default:
      return null;
  }
}

export const PageEffects = memo(PageEffectsInner);

/* ── Effect labels (for admin UI) ─────────────────────────── */
export const EFFECT_OPTIONS: { value: EffectType; label: string; icon: string }[] = [
  { value: "none", label: "Sem efeito", icon: "🚫" },
  { value: "snow", label: "Neve", icon: "❄️" },
  { value: "rain", label: "Chuva", icon: "🌧️" },
  { value: "thunder", label: "Trovoada", icon: "⛈️" },
  { value: "fireflies", label: "Pirilampos", icon: "✨" },
  { value: "embers", label: "Brasas", icon: "🔥" },
];
