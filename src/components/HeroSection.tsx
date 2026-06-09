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
      const resume = () => { vid.play().catch(() => {}); document.removeEventListener("click", resume); };
      document.addEventListener("click", resume);
    });
  }, []);

  return (
    /*
     * Fill the content area exactly — no overflow into navbar, sidebar or footer.
     * pt-0 because <main> already applies pt-16 (navbar height).
     * Width is naturally correct because <main> applies lg:pl-56 (sidebar width).
     */
    <section className="relative w-full h-[calc(100vh-4rem)] overflow-hidden border-b border-white/[0.08]">
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
