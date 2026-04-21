"use client";

/**
 * WaxSealBadge — A realistic wax seal stamp overlay for papyrus-style cards.
 *
 * Variants:
 *  - "red"  → Deep crimson wax (default)
 *  - "gold" → Dark gold / bronze wax
 *
 * Text options: "NOVUS" (NEW), "HOT", "ELITE", or any short string.
 *
 * Place with position:absolute in a relative container.
 * The seal has an imperfect circle shape via CSS clip-path + pseudo-elements
 * that simulate melted wax drips and organic edges.
 */

type SealVariant = "red" | "gold";

interface WaxSealBadgeProps {
  text: string;
  variant?: SealVariant;
  /** Rotation in degrees for realism (-15 to 15 recommended) */
  rotation?: number;
  /** Size in px (default 56) */
  size?: number;
  className?: string;
}

export function WaxSealBadge({
  text,
  variant = "red",
  rotation = -6,
  size = 56,
  className = "",
}: WaxSealBadgeProps) {
  const isGold = variant === "gold";
  const fontSize = size * 0.2;
  const subFontSize = size * 0.1;

  return (
    <div
      className={`wax-seal-badge wax-seal-badge--${variant} ${className}`}
      style={{
        width: size,
        height: size,
        transform: `rotate(${rotation}deg)`,
        fontSize: `${fontSize}px`,
      }}
      aria-label={text}
    >
      {/* Drip blobs — organic wax overflow */}
      <div className="wax-seal-badge__drip wax-seal-badge__drip--1" />
      <div className="wax-seal-badge__drip wax-seal-badge__drip--2" />
      <div className="wax-seal-badge__drip wax-seal-badge__drip--3" />

      {/* Inner ring (pressed border) */}
      <div className="wax-seal-badge__ring" />

      {/* Center engraving */}
      <div className="wax-seal-badge__text">
        <span className="wax-seal-badge__label">{text}</span>
        <span
          className="wax-seal-badge__sub"
          style={{ fontSize: `${subFontSize}px` }}
        >
          {isGold ? "·AVRVS·" : "·S·P·Q·R·"}
        </span>
      </div>
    </div>
  );
}
