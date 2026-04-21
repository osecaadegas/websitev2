"use client";

import { ReactNode } from "react";

interface ArenaCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "crimson" | "gold";
}

/**
 * Engraved-style card with metallic border glow.
 * Sharp edges, game-UI aesthetic.
 */
export function ArenaCard({ children, className = "", variant = "default" }: ArenaCardProps) {
  const borders = {
    default: "arena-border",
    crimson: "arena-border-crimson",
    gold: "border border-arena-gold/25 shadow-[inset_0_0_20px_rgba(0,0,0,0.5),0_0_15px_rgba(212,168,67,0.1)]",
  };

  return (
    <div
      className={`bg-gradient-to-b from-arena-charcoal to-arena-dark ${borders[variant]} arena-shine ${className}`}
    >
      {children}
    </div>
  );
}
