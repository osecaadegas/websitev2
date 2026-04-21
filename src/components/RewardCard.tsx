"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Reward {
  id: string;
  title: string;
  description: string;
  image: string | null;
  cost: number;
  type: string;
  tier: "common" | "elite" | "legendary";
  stock: number | null;
  cooldown: number | null;
  vip_only: boolean;
  vip_level_required: number | null;
  active: boolean;
  sort_order: number;
}

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  userVipLevel: number;
  onRedeem: (rewardId: string) => Promise<boolean>;
  onHover?: () => void;
  onClick?: () => void;
}

/* Tier-specific accents overlaid on top of the papyrus base */
const tierAccents = {
  common: {
    label: "COMMON",
    badgeBg: "rgba(90,72,40,0.25)",
    badgeText: "var(--ink-mid)",
    badgeBorder: "var(--parchment-edge)",
    glowColor: "transparent",
    ribbonColor: "var(--stone-mid)",
  },
  elite: {
    label: "ELITE",
    badgeBg: "rgba(180,134,11,0.2)",
    badgeText: "var(--gold-dark)",
    badgeBorder: "var(--gold-mid)",
    glowColor: "rgba(212,168,67,0.06)",
    ribbonColor: "var(--gold-dark)",
  },
  legendary: {
    label: "LEGENDARY",
    badgeBg: "rgba(139,26,26,0.2)",
    badgeText: "var(--deep-red)",
    badgeBorder: "var(--deep-red)",
    glowColor: "rgba(139,0,0,0.08)",
    ribbonColor: "var(--deep-red)",
  },
};

const typeIcons: Record<string, string> = {
  deposit: "💰",
  ticket: "🎟️",
  gift: "🎁",
  cash: "💵",
  custom: "⚡",
};

export function RewardCard({ reward, userPoints, userVipLevel, onRedeem, onHover, onClick }: RewardCardProps) {
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const tier = tierAccents[reward.tier];
  const canAfford = userPoints >= reward.cost;
  const vipLocked = reward.vip_only && reward.vip_level_required !== null && userVipLevel < reward.vip_level_required;
  const outOfStock = reward.stock !== null && reward.stock <= 0;
  const isLocked = vipLocked || outOfStock;

  /* 3D tilt on mouse move */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (y - 0.5) * -6;
    const rotateY = (x - 0.5) * 6;
    cardRef.current.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = "perspective(800px) rotateX(0) rotateY(0) translateY(0)";
  }, []);

  async function handleRedeem() {
    if (isLocked || !canAfford || redeeming || redeemed) return;
    onClick?.();
    setRedeeming(true);
    setError("");

    const success = await onRedeem(reward.id);
    if (success) {
      setRedeemed(true);
      setTimeout(() => setRedeemed(false), 3000);
    } else {
      setError("Falha ao resgatar");
      setTimeout(() => setError(""), 3000);
    }
    setRedeeming(false);
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={onHover}
      className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom group relative"
      style={{
        maxWidth: "100%",
        padding: 0,
        transformStyle: "preserve-3d",
        willChange: "transform",
        transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease",
        boxShadow: reward.tier !== "common" ? `0 0 24px ${tier.glowColor}` : undefined,
      }}
    >
      {/* VIP Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2"
          style={{
            background: "rgba(60, 45, 25, 0.85)",
            backdropFilter: "blur(2px)",
            borderRadius: "var(--scroll-radius)",
          }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--ink-light)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V 6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.7rem", color: "var(--ink-mid)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            {outOfStock ? "Esgotado" : `Requer VIP ${reward.vip_level_required}`}
          </span>
        </div>
      )}

      {/* ── Image Banner ── */}
      {reward.image && (
        <div className="relative w-full overflow-hidden" style={{ borderRadius: "var(--scroll-radius) var(--scroll-radius) 0 0" }}>
          <div className="aspect-[16/9] w-full">
            <img
              src={reward.image}
              alt={reward.title}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
          </div>
          {/* Bottom parchment fade */}
          <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
            style={{ background: "linear-gradient(to top, var(--parchment-mid), transparent)" }}
          />
          {/* Tier badge on image */}
          <div className="absolute top-2 left-2 z-[4]">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: tier.badgeText,
                backgroundColor: tier.badgeBg,
                border: `1px solid ${tier.badgeBorder}`,
                textShadow: "0 1px 1px rgba(0,0,0,0.2)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              {typeIcons[reward.type] || "⚡"} {tier.label}
            </span>
          </div>
        </div>
      )}

      {/* ── Scroll Content ── */}
      <div className="scroll-content" style={{ padding: reward.image ? "10px 16px 14px" : "16px" }}>
        {/* If no image, show badge inline */}
        {!reward.image && (
          <div className="mb-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: tier.badgeText,
                backgroundColor: tier.badgeBg,
                border: `1px solid ${tier.badgeBorder}`,
              }}
            >
              {typeIcons[reward.type] || "⚡"} {tier.label}
            </span>
          </div>
        )}

        {/* Title — carved ink on parchment */}
        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: "0.85rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-dark)",
            lineHeight: 1.2,
            marginBottom: "2px",
          }}
        >
          {reward.title}
        </h3>

        {reward.description && (
          <p
            className="line-clamp-2"
            style={{
              fontSize: "0.68rem",
              color: "var(--ink-light)",
              lineHeight: 1.4,
              marginBottom: "8px",
            }}
          >
            {reward.description}
          </p>
        )}

        {/* Engraved divider */}
        <div className="engraved-divider" style={{ margin: "6px 0" }} />

        {/* Cost + Stock row */}
        <div className="flex items-center justify-between" style={{ marginBottom: "6px" }}>
          {/* Gold plaque cost */}
          <div
            className="inline-flex items-center gap-1 rounded"
            style={{
              padding: "3px 8px",
              background: canAfford && !isLocked
                ? "linear-gradient(135deg, rgba(212,168,67,0.15), rgba(180,134,11,0.1))"
                : "rgba(100,80,40,0.1)",
              border: `1px solid ${canAfford && !isLocked ? "var(--gold-mid)" : "var(--parchment-edge)"}`,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            <span style={{ fontSize: "0.75rem" }}>⭐</span>
            <span
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.72rem",
                fontWeight: 800,
                color: canAfford && !isLocked ? "var(--gold-dark)" : "var(--ink-light)",
                letterSpacing: "0.04em",
              }}
            >
              {reward.cost.toLocaleString()}
            </span>
            <span style={{ fontSize: "0.55rem", color: "var(--ink-light)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              pts
            </span>
          </div>

          {reward.stock !== null && (
            <span
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.55rem",
                color: "var(--ink-light)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {reward.stock} restantes
            </span>
          )}
        </div>

        {/* Cooldown */}
        {reward.cooldown && (
          <p style={{ fontSize: "0.6rem", color: "var(--ink-light)", marginBottom: "6px" }}>
            ⏱ Cooldown: {reward.cooldown}h
          </p>
        )}

        {/* ── CTA Button ── */}
        <AnimatePresence mode="wait">
          {redeemed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="cta-button w-full text-center"
              style={{
                background: "linear-gradient(135deg, #2d5016, #1a3a0a)",
                color: "#8fbc6a",
                border: "1px solid rgba(100,180,60,0.3)",
                padding: "6px 12px",
                fontSize: "0.65rem",
              }}
            >
              ✓ RESGATADO
            </motion.div>
          ) : (
            <motion.button
              key="redeem"
              onClick={handleRedeem}
              disabled={isLocked || !canAfford || redeeming}
              className="cta-button arena-btn-press w-full"
              style={{
                background: isLocked || !canAfford
                  ? "linear-gradient(135deg, var(--stone-mid), var(--stone-dark))"
                  : "linear-gradient(135deg, var(--deep-red-light), var(--deep-red))",
                color: isLocked || !canAfford ? "var(--stone-light)" : "var(--parchment-light)",
                border: `1px solid ${isLocked || !canAfford ? "var(--stone-mid)" : "var(--deep-red)"}`,
                cursor: isLocked || !canAfford ? "not-allowed" : "pointer",
                opacity: isLocked || !canAfford ? 0.6 : 1,
                padding: "7px 12px",
                fontSize: "0.68rem",
                width: "100%",
              }}
              whileHover={!isLocked && canAfford ? { scale: 1.02 } : undefined}
              whileTap={!isLocked && canAfford ? { scale: 0.96 } : undefined}
            >
              {redeeming ? "A forjar..." : !canAfford ? "Pontos insuficientes" : "⚔ Resgatar ⚔"}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginTop: "4px", fontSize: "0.6rem", color: "var(--deep-red)", textAlign: "center" }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
