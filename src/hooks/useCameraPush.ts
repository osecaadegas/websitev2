"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * GSAP-powered slow camera push-in effect for hero backgrounds.
 * Applies a subtle scale transform over time for cinematic depth.
 */
export function useCameraPush(
  ref: React.RefObject<HTMLElement | null>,
  options: { duration?: number; scale?: number } = {}
) {
  const { duration = 20, scale = 1.08 } = options;
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    tlRef.current = gsap.timeline({ repeat: -1, yoyo: true });
    tlRef.current.to(el, {
      scale,
      duration,
      ease: "sine.inOut",
    });

    return () => {
      tlRef.current?.kill();
    };
  }, [ref, duration, scale]);
}
