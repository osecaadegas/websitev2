"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface ArenaButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

/**
 * Gladiator-styled button with impact press animation.
 * Uses transform + opacity only for GPU-accelerated rendering.
 */
export const ArenaButton = forwardRef<HTMLButtonElement, ArenaButtonProps>(
  function ArenaButton({ variant = "primary", size = "md", className = "", children, ...props }, ref) {
    const base =
      "relative inline-flex items-center justify-center gladiator-label font-bold arena-btn-press arena-shine cursor-pointer";

    const variants = {
      primary:
        "bg-gradient-to-b from-arena-crimson to-arena-blood text-arena-white border border-arena-red/40 hover:from-arena-red hover:to-arena-crimson shadow-lg shadow-arena-crimson/20",
      secondary:
        "bg-gradient-to-b from-arena-iron to-arena-charcoal text-arena-gold border border-arena-gold/20 hover:border-arena-gold/40",
      ghost:
        "bg-transparent text-arena-gold border border-arena-gold/15 hover:bg-arena-gold/5 hover:border-arena-gold/30",
    };

    const sizes = {
      sm: "px-4 py-2 text-xs",
      md: "px-6 py-3 text-sm",
      lg: "px-8 py-4 text-base",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
