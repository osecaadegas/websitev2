"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Rain + ember particle system drawn on a <canvas>.
 * Uses GSAP ticker for frame-synced rendering.
 * Purely GPU-composited — does not cause layout shifts.
 */
export function useParticles(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: {
    rainCount?: number;
    emberCount?: number;
    enabled?: boolean;
  } = {}
) {
  const { rainCount = 120, emberCount = 25, enabled = true } = options;
  const particlesRef = useRef<{ rain: Rain[]; embers: Ember[] }>({
    rain: [],
    embers: [],
  });

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize rain particles
    particlesRef.current.rain = Array.from({ length: rainCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 4 + Math.random() * 6,
      length: 10 + Math.random() * 20,
      opacity: 0.1 + Math.random() * 0.3,
    }));

    // Initialize ember particles
    particlesRef.current.embers = Array.from({ length: emberCount }, () =>
      createEmber(canvas.width, canvas.height)
    );

    const tickerId = gsap.ticker.add(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRain(ctx, particlesRef.current.rain, canvas.width, canvas.height);
      drawEmbers(ctx, particlesRef.current.embers, canvas.width, canvas.height);
    });

    return () => {
      gsap.ticker.remove(tickerId);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, rainCount, emberCount, enabled]);
}

interface Rain {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

function createEmber(w: number, h: number): Ember {
  return {
    x: Math.random() * w,
    y: h + 10,
    vx: (Math.random() - 0.5) * 0.8,
    vy: -(1 + Math.random() * 2),
    size: 1 + Math.random() * 3,
    opacity: 0.6 + Math.random() * 0.4,
    life: 0,
    maxLife: 100 + Math.random() * 150,
  };
}

function drawRain(ctx: CanvasRenderingContext2D, drops: Rain[], w: number, h: number) {
  for (const drop of drops) {
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + 0.5, drop.y + drop.length);
    ctx.strokeStyle = `rgba(180, 200, 220, ${drop.opacity})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    drop.y += drop.speed;
    if (drop.y > h) {
      drop.y = -drop.length;
      drop.x = Math.random() * w;
    }
  }
}

function drawEmbers(ctx: CanvasRenderingContext2D, embers: Ember[], w: number, h: number) {
  for (const ember of embers) {
    const progress = ember.life / ember.maxLife;
    const alpha = ember.opacity * (1 - progress);
    const size = ember.size * (1 - progress * 0.5);

    // Glow
    const gradient = ctx.createRadialGradient(
      ember.x, ember.y, 0,
      ember.x, ember.y, size * 3
    );
    gradient.addColorStop(0, `rgba(255, 120, 0, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(255, 60, 0, ${alpha * 0.4})`);
    gradient.addColorStop(1, "transparent");

    ctx.beginPath();
    ctx.arc(ember.x, ember.y, size * 3, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(ember.x, ember.y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
    ctx.fill();

    ember.x += ember.vx;
    ember.y += ember.vy;
    ember.life++;

    if (ember.life >= ember.maxLife) {
      Object.assign(ember, createEmber(w, h));
    }
  }
}
