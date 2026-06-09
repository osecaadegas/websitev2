"use client";

import { useEffect, useRef } from "react";

/* ── Hero ────────────────────────────────────────── */
export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Programmatically play to bypass any browser autoplay policy
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.play().catch(() => {
      // Autoplay blocked — retry on first user interaction
      const resume = () => { vid.play().catch(() => {}); document.removeEventListener("click", resume); };
      document.addEventListener("click", resume);
    });
  }, []);

  return (
    <section className="relative w-full h-[100svh] overflow-hidden border-b border-white/[0.08]">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src="/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
    </section>
  );
}
