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
     * Break out of <main>'s pt-16 (navbar) and lg:pl-56 (sidebar) offsets
     * so the video fills the full viewport edge-to-edge.
     */
    <section
      className="
        relative overflow-hidden
        -mt-16 lg:-ml-56
        w-screen h-screen
        border-b border-white/[0.08]
      "
    >
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
