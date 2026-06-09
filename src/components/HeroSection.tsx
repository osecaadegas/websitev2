"use client";

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * HERO SECTION — Full-screen cinematic entry point.
 *
 * Left-aligned content at the bottom, full-bleed image
 * with GSAP slow-zoom and ambient glow.
 * Hero image and effects come from admin settings (Definições).
 * Uses Supabase Realtime so admin changes appear instantly.
 */

/* ── Hero ────────────────────────────────────────── */
export function HeroSection() {
  const heroRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <section ref={heroRef} className="relative min-h-[100svh] overflow-hidden border-b border-white/[0.08]">
      {/* Video background */}
      <div className="absolute inset-0">
        <video
          className="h-full w-full object-cover"
          src="/hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>
    </section>
  );
}
