"use client";

import { motion, useInView } from "framer-motion";
import { ReactNode, useRef } from "react";
import { FADE_UP } from "@/lib/animations";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Wraps content in a scroll-triggered reveal animation.
 * Uses IntersectionObserver via Framer Motion — no layout shifts.
 */
export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={FADE_UP.initial}
      animate={inView ? FADE_UP.animate : FADE_UP.initial}
      transition={{ ...FADE_UP.transition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
