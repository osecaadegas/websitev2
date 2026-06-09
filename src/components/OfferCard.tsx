"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CasinoOfferRow, WelcomeBonusStage } from "@/lib/supabase";
import { trackOfferClick } from "@/lib/analytics/tracker";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

export interface CasinoOffer {
  id: string;
  slug: string;
  name: string;
  logo_url?: string;
  logo_bg: string;
  banner_url?: string;
  badge?: "NEW" | "HOT" | "ELITE";
  tags: string[];
  headline: string;
  bonus_value: string;
  free_spins: string;
  min_deposit: string;
  code: string;
  cashback?: string;
  withdraw_time: string;
  max_withdrawal?: string;
  license: string;
  established: string;
  live_support?: string;
  total_games?: string;
  languages?: string;
  game_providers?: string[];
  notes: string[];
  welcome_bonus_stages?: WelcomeBonusStage[];
  vip_program?: string;
  details?: string;
  affiliate_url: string;
  rating: number;
  is_exclusive?: boolean;
  payment_methods: string[];
  kyc_required?: boolean;
  vpn_friendly?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

/** Returns true only if the field has a real, displayable value. */
function hv(s: string | undefined | null): boolean {
  return !!s && s.trim() !== "" && s.trim() !== "—";
}

/* ═══════════════════════════════════════════════════════════════════
   BADGE CONFIG
   ═══════════════════════════════════════════════════════════════════ */

const BADGE_CFG = {
  HOT:   { bg: "#ef4444",  text: "#fff" },
  NEW:   { bg: "#22c55e",  text: "#fff" },
  ELITE: { bg: "#FF5500",  text: "#fff" },
} as const;

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/** Only renders if value is present. */
function StatCell({ icon, label, value }: { icon: string; label: string; value: string | undefined | null }) {
  if (!hv(value)) return null;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "10px 10px 9px",
      background: "rgba(16,16,18,0.9)",
      borderRadius: 8,
      border: "1px solid rgba(255,85,0,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: "0.6rem", opacity: 0.45 }}>{icon}</span>
        <span style={{ fontSize: "0.55rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#fff", paddingLeft: 1, lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

/** Payment chip — fallback for unknown methods. */
function PaymentChip({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "3px 8px", borderRadius: 5,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      fontSize: "0.62rem", fontWeight: 700, color: "#888",
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAYMENT METHOD LOGOS
   ═══════════════════════════════════════════════════════════════════ */

function PaymentLogo({ method }: { method: string }) {
  const key = method.toLowerCase().replace(/[\s\-_.]/g, "");
  const w: React.CSSProperties = { display: "inline-flex", borderRadius: 4, overflow: "hidden", lineHeight: 0, flexShrink: 0 };
  switch (key) {
    case "visa":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#1A1F71"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800" fontStyle="italic" fontFamily="Arial,sans-serif" letterSpacing="1">VISA</text></svg></span>;
    case "mastercard":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#1c1c1e"/><circle cx="15" cy="12" r="8" fill="#EB001B" opacity="0.92"/><circle cx="25" cy="12" r="8" fill="#F79E1B" opacity="0.92"/><ellipse cx="20" cy="12" rx="3.2" ry="8" fill="#FF5F00" opacity="0.88"/></svg></span>;
    case "mbway":
    case "mbway2":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#007B40"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="900" fontFamily="Arial,sans-serif" letterSpacing="0.5">MB WAY</text></svg></span>;
    case "mb":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#005EA3"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="900" fontFamily="Arial,sans-serif">MB</text></svg></span>;
    case "mbnet":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#005EA3"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900" fontFamily="Arial,sans-serif">MBNET</text></svg></span>;
    case "bitcoin":
    case "btc":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#F7931A"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900" fontFamily="Arial,sans-serif">₿</text></svg></span>;
    case "ethereum":
    case "eth":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#627EEA"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Arial,sans-serif">Ξ</text></svg></span>;
    case "usdt":
    case "tether":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#26A17B"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900" fontFamily="Arial,sans-serif" letterSpacing="0.5">USDT</text></svg></span>;
    case "skrill":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#862165"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900" fontFamily="Arial,sans-serif" letterSpacing="0.5">SKRILL</text></svg></span>;
    case "neteller":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#0F2A5A"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="900" fontFamily="Arial,sans-serif" letterSpacing="0.3">NETELLER</text></svg></span>;
    case "paysafe":
    case "paysafecard":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#003082"/><text x="20" y="17" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="900" fontFamily="Arial,sans-serif" letterSpacing="0.3">PAYSAFE</text></svg></span>;
    case "applepay":
    case "applepay2":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#000"/><text x="20" y="16.5" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="600" fontFamily="-apple-system,Arial,sans-serif" letterSpacing="0.2">Apple Pay</text></svg></span>;
    case "googlepay":
    case "gpay":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#fff" stroke="#e0e0e0" strokeWidth="0.5"/><text x="20" y="16.5" textAnchor="middle" fill="#333" fontSize="8" fontWeight="700" fontFamily="Arial,sans-serif" letterSpacing="0.2">G Pay</text></svg></span>;
    case "bank":
    case "banktransfer":
    case "transferência":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#2d3748"/><text x="20" y="16.5" textAnchor="middle" fill="#a0aec0" fontSize="7.5" fontWeight="700" fontFamily="Arial,sans-serif" letterSpacing="0.3">BANK</text></svg></span>;
    case "crypto":
      return <span title={method} style={w}><svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="3" fill="#1a1a2e"/><text x="20" y="16.5" textAnchor="middle" fill="#F7931A" fontSize="8" fontWeight="900" fontFamily="Arial,sans-serif" letterSpacing="0.3">CRYPTO</text></svg></span>;
    default:
      return <PaymentChip label={method} />;
  }
}

/** 5-star rating using arena-neon colour. */
function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={i < Math.round(rating) ? "#FF5500" : "rgba(255,255,255,0.1)"}
          />
        </svg>
      ))}
      <span style={{ fontSize: "0.65rem", color: "#FF5500", marginLeft: 3, fontWeight: 700 }}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ANIMATED BORDER
   Lives OUTSIDE and BEHIND the card surface via z-index layering.
   The card itself sits at z-index:1 on top of the border ring.
   No overflow clipping on the card is needed.
   ═══════════════════════════════════════════════════════════════════ */

function AnimatedBorder({ badge }: { badge: "NEW" | "HOT" | "ELITE" }) {
  const isNew = badge === "NEW";
  const isHot = badge === "HOT";

  const electricGradient = `conic-gradient(
    from 0deg,
    transparent 0%,   transparent 22%,
    #007aff 34%,      #00cfff 42%,
    #ffffff 46%,      #00cfff 50%,
    #007aff 57%,      transparent 65%,
    transparent 78%,  #0055cc 87%,
    #00cfff 93%,      transparent 100%
  )`;

  const fireGradient = `conic-gradient(
    from 0deg,
    transparent 0%,   #7f1d1d 12%,
    #dc2626 20%,      #f97316 28%,
    #fbbf24 33%,      #f97316 38%,
    #dc2626 46%,      transparent 55%,
    transparent 70%,  #b91c1c 80%,
    #f97316 88%,      #fbbf24 93%,
    #dc2626 97%,      transparent 100%
  )`;

  const gradient  = isNew ? electricGradient : isHot ? fireGradient : electricGradient;
  const spinClass = isNew ? "offer-spin-electric" : "offer-spin-fire";
  const glowClass = isNew ? "offer-glow-electric" : "offer-glow-fire";

  const glowShadow = isNew
    ? "0 0 18px rgba(0,180,255,0.55), 0 0 42px rgba(0,100,255,0.25)"
    : "0 0 20px rgba(239,68,68,0.55), 0 0 44px rgba(251,146,60,0.28)";

  return (
    /* Outer glow ring — absolutely positioned, lives BEHIND the card */
    <div
      aria-hidden="true"
      className={glowClass}
      style={{
        position:      "absolute",
        inset:         "-3px",
        borderRadius:  "15px",
        overflow:      "hidden",
        zIndex:        0,          /* behind everything */
        pointerEvents: "none",
        boxShadow:     glowShadow,
      }}
    >
      {/* Spinning gradient */}
      <div
        className={spinClass}
        style={{
          position: "absolute",
          width:    "200%",
          height:   "200%",
          top:      "-50%",
          left:     "-50%",
          background: gradient,
        }}
      />
      {/* Dark centre cutout — reveals only the 3px ring */}
      <div style={{
        position:     "absolute",
        inset:        "3px",
        borderRadius: "13px",
        background:   "#101012",
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN CARD
   ═══════════════════════════════════════════════════════════════════ */

export function OfferCard({ offer }: { offer: CasinoOffer }) {
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backPage, setBackPage] = useState(0);

  /* Build the dynamic slide list — only include slides that have data */
  const hasBonus   = (offer.welcome_bonus_stages?.filter(s => hv(s.pct)).length ?? 0) > 0;
  const hasCasino  = hv(offer.max_withdrawal) || hv(offer.live_support) || hv(offer.total_games) || hv(offer.languages) || (offer.game_providers?.length ?? 0) > 0;
  const hasTerms   = (offer.notes?.length ?? 0) > 0 || hv(offer.vip_program) || hv(offer.details);

  const slides: { key: string; label: string }[] = [
    { key: "info",   label: "INFO" },
    ...(hasBonus  ? [{ key: "bonus",  label: "BÓNUS"  }] : []),
    ...(hasCasino ? [{ key: "casino", label: "CASINO" }] : []),
    ...(hasTerms  ? [{ key: "terms",  label: "TERMOS" }] : []),
  ];
  const totalBackPages = slides.length;
  const currentSlideKey = slides[Math.min(backPage, totalBackPages - 1)]?.key ?? "info";

  const externalUrl = offer.affiliate_url?.startsWith("http")
    ? offer.affiliate_url
    : `https://${offer.affiliate_url || "#"}`;

  const handleClaim = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    trackOfferClick(offer.id, offer.name);
    window.open(externalUrl, "_blank", "noopener,noreferrer");
  }, [offer.id, offer.name, externalUrl]);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hv(offer.code)) {
      navigator.clipboard?.writeText(offer.code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [offer.code]);

  const badge      = offer.badge;
  const badgeCfg   = badge ? BADGE_CFG[badge] : null;
  const hasAnim    = badge === "NEW" || badge === "HOT";

  /* Only the fields that have real values */
  const frontStats = [
    { icon: "◎", label: "Min. Dep.",     value: offer.min_deposit   },
    { icon: "🎁", label: "Bónus",        value: offer.bonus_value   },
    { icon: "✦", label: "Free Spins",    value: offer.free_spins    },
    { icon: "⏱", label: "Levantamento", value: offer.withdraw_time },
    { icon: "⊘", label: "Licença",       value: offer.license       },
    { icon: "⊡", label: "Código",        value: offer.code          },
  ].filter((s) => hv(s.value));

  const backStats = [
    { icon: "◎", label: "Min. Dep.",     value: offer.min_deposit   },
    { icon: "🎁", label: "Bónus",        value: offer.bonus_value   },
    { icon: "✦", label: "Free Spins",    value: offer.free_spins    },
    { icon: "⏱", label: "Levantamento", value: offer.withdraw_time },
    { icon: "⊘", label: "Licença",       value: offer.license       },
    { icon: "📅", label: "Fundado",      value: offer.established   },
    { icon: "💸", label: "Cashback",     value: offer.cashback ?? undefined },
  ].filter((s) => hv(s.value));

  /* Shared card surface style — z-index:1 ensures it sits above the AnimatedBorder ring */
  const surface: React.CSSProperties = {
    backfaceVisibility:        "hidden",
    WebkitBackfaceVisibility:  "hidden",
    borderRadius:              12,
    overflow:                  "hidden",
    background:                "#101012",
    border:                    "1px solid rgba(255,85,0,0.1)",
    boxShadow:                 "0 8px 40px rgba(0,0,0,0.6)",
    position:                  "relative",
    zIndex:                    1,
  };

  /* ── CLAIM button ─────────────────────────────────────────────── */
  const claimBtn: React.CSSProperties = {
    flex: 1,
    padding: "11px 14px",
    borderRadius: 7,
    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: "0.74rem",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 14px rgba(34,197,94,0.3)",
    transition: "box-shadow 0.2s, opacity 0.2s",
  };

  /* ── MORE INFO button ─────────────────────────────────────────── */
  const infoBtn: React.CSSProperties = {
    padding: "11px 14px",
    borderRadius: 7,
    background: "rgba(255,85,0,0.07)",
    border: "1px solid rgba(255,85,0,0.2)",
    color: "#FF5500",
    fontWeight: 700,
    fontSize: "0.74rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.2s, border-color 0.2s",
  };

  /* ── BACK button ──────────────────────────────────────────────── */
  const backBtn: React.CSSProperties = {
    padding: "11px 14px",
    borderRadius: 7,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#666",
    fontWeight: 700,
    fontSize: "0.74rem",
    cursor: "pointer",
    transition: "background 0.2s",
  };

  return (
    <div style={{ perspective: "1200px", width: "100%", maxWidth: "480px", position: "relative" }}>
      <div
        style={{
          position:         "relative",
          transition:       "transform 0.58s cubic-bezier(0.4,0.2,0.2,1)",
          transformStyle:   "preserve-3d",
          transform:        flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          borderRadius:     12,
        }}
      >

        {/* ══════════════════════════════
            FRONT FACE
            ══════════════════════════════ */}
        {/* Animated border sits at z:0 behind the surface (z:1) */}
        {hasAnim && badge && <AnimatedBorder badge={badge} />}

        <div style={{ ...surface, minHeight: 480 }}>

          {/* ── Banner ───────────────────────────────────────────── */}
          <div style={{
            position: "relative", width: "100%",
            aspectRatio: "16/7", overflow: "hidden",
            background: offer.logo_bg || "#1a1a2e",
          }}>
            {hv(offer.banner_url) && (
              <img
                src={offer.banner_url!}
                alt={offer.name}
                loading="lazy"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}

            {/* Gradient overlay */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(100deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.1) 100%)",
            }} />

            {/* Badge — top-left */}
            {badge && badgeCfg && (
              <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5 }}>
                <span style={{
                  display: "inline-block",
                  background: badgeCfg.bg, color: badgeCfg.text,
                  fontSize: "0.6rem", fontWeight: 800,
                  padding: "3px 8px", borderRadius: 4,
                  letterSpacing: "0.09em", textTransform: "uppercase",
                  boxShadow: `0 2px 8px ${badgeCfg.bg}88`,
                }}>
                  {badge}
                </span>
              </div>
            )}

            {/* Tags — below badge if present */}
            {offer.tags.length > 0 && (
              <div style={{
                position: "absolute", top: badge ? 36 : 10, left: 10, zIndex: 5,
                display: "flex", gap: 4, flexWrap: "wrap", maxWidth: "60%",
              }}>
                {offer.tags.map((tag) => (
                  <span key={tag} style={{
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "#bbb", fontSize: "0.56rem", fontWeight: 600,
                    padding: "2px 7px", borderRadius: 3,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Logo — top-right */}
            {hv(offer.logo_url) && (
              <div style={{
                position: "absolute", top: 10, right: 10, zIndex: 5,
                background: "rgba(0,0,0,0.52)",
                borderRadius: 8, padding: "5px 9px",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <img
                  src={offer.logo_url!}
                  alt={offer.name}
                  style={{ height: 28, maxWidth: 90, objectFit: "contain" }}
                />
              </div>
            )}

            {/* Bottom overlay text */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 14px 12px", zIndex: 4 }}>
              <p style={{ margin: 0, fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.13em", lineHeight: 1, marginBottom: 2 }}>
                CLAIM THE
              </p>
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1.1, marginBottom: hv(offer.bonus_value) ? 4 : 0 }}>
                {offer.name.toUpperCase()} BOOST
              </p>
              {hv(offer.bonus_value) && (
                <p style={{ margin: 0, fontSize: "clamp(1.5rem,5vw,2.1rem)", fontWeight: 900, color: "#fff", lineHeight: 1, textShadow: "0 2px 16px rgba(0,0,0,0.7)" }}>
                  {offer.bonus_value}
                </p>
              )}
              {hv(offer.free_spins) && (
                <p style={{ margin: "3px 0 0", fontSize: "0.74rem", fontWeight: 700, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  + {offer.free_spins} FREE SPINS
                </p>
              )}
            </div>

            {/* 18+ notice */}
            <div style={{ position: "absolute", bottom: 8, right: 10, zIndex: 5, fontSize: "0.5rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
              +18 T&C
            </div>
          </div>

          {/* ── KYC / VPN indicators ─────────────────────────────────────── */}
          {(offer.kyc_required != null || offer.vpn_friendly != null) && (
            <div style={{ display: "flex", gap: 10, padding: "6px 13px 2px", alignItems: "center" }}>
              {offer.kyc_required != null && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: "0.56rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>KYC</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: offer.kyc_required ? "#ef4444" : "#22c55e" }}>
                    {offer.kyc_required ? "✗" : "✓"}
                  </span>
                </span>
              )}
              {offer.vpn_friendly != null && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: "0.56rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>VPN</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: offer.vpn_friendly ? "#22c55e" : "#ef4444" }}>
                    {offer.vpn_friendly ? "✓" : "✗"}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* ── Action buttons ──────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, padding: "12px 12px 8px" }}>
            <button onClick={handleClaim} style={claimBtn}>CLAIM OFFER</button>
            <button onClick={(e) => { e.stopPropagation(); setFlipped(true); }} style={infoBtn}>
              MORE INFO ›
            </button>
          </div>

          {/* ── Payment methods ───────────────────────────────────── */}
          {offer.payment_methods?.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: "0 12px 10px", alignItems: "center" }}>
              {offer.payment_methods.map((pm) => <PaymentLogo key={pm} method={pm} />)}
            </div>
          )}

          {/* ── Stats grid (only cells with values) ───────────────── */}
          {frontStats.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
              gap: 5,
              padding: `${offer.payment_methods?.length > 0 ? 0 : 4}px 12px 14px`,
            }}>
              {frontStats.map((s) => (
                <StatCell key={s.label} icon={s.icon} label={s.label} value={s.value} />
              ))}
            </div>
          )}
        </div>

        {/* ══════════════════════════════
            BACK FACE
            ══════════════════════════════ */}
        {/* Border ring for back — same z:0 behind surface */}
        <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", zIndex: 0, borderRadius: 12, pointerEvents: "none" }}>
          {hasAnim && badge && <AnimatedBorder badge={badge} />}
        </div>

        <div style={{
          ...surface,
          position:       "absolute",
          inset:          0,
          transform:      "rotateY(180deg)",
          display:        "flex",
          flexDirection:  "column",
          minHeight:      480,
        }}>

          {/* Back header */}
          <div style={{
            padding: "14px 16px 12px",
            borderBottom: "1px solid rgba(255,85,0,0.08)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {hv(offer.logo_url) ? (
                <img src={offer.logo_url!} alt={offer.name} style={{ height: 32, maxWidth: 80, objectFit: "contain" }} />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: offer.logo_bg || "#1c1c1e",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, color: "#fff", fontSize: "1rem",
                  border: "1px solid rgba(255,85,0,0.2)",
                }}>
                  {offer.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p style={{ margin: 0, fontWeight: 800, color: "#fff", fontSize: "0.9rem", letterSpacing: "-0.01em" }}>
                  {offer.name}
                </p>
                <Stars rating={offer.rating ?? 4.5} />
                {(offer.kyc_required != null || offer.vpn_friendly != null) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    {offer.kyc_required != null && (
                      <span style={{ fontSize: "0.55rem", fontWeight: 700, color: offer.kyc_required ? "#ef4444" : "#22c55e", letterSpacing: "0.05em" }}>
                        KYC {offer.kyc_required ? "✗" : "✓"}
                      </span>
                    )}
                    {offer.vpn_friendly != null && (
                      <span style={{ fontSize: "0.55rem", fontWeight: 700, color: offer.vpn_friendly ? "#22c55e" : "#ef4444", letterSpacing: "0.05em" }}>
                        VPN {offer.vpn_friendly ? "✓" : "✗"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {badge && badgeCfg && (
              <span style={{
                background: badgeCfg.bg, color: badgeCfg.text,
                fontSize: "0.58rem", fontWeight: 800,
                padding: "3px 8px", borderRadius: 4,
                letterSpacing: "0.09em", textTransform: "uppercase",
                boxShadow: `0 2px 8px ${badgeCfg.bg}88`,
              }}>
                {badge}
              </span>
            )}
          </div>

          {/* ── Tab nav (only when >1 slide) ──────────────────────── */}
          {totalBackPages > 1 && (
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,85,0,0.08)", padding: "0 12px" }}>
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  onClick={(e) => { e.stopPropagation(); setBackPage(i); }}
                  style={{
                    flex: 1, padding: "9px 4px 8px", border: "none", cursor: "pointer",
                    background: "transparent", outline: "none",
                    fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: i === backPage ? "#FF5500" : "rgba(255,255,255,0.3)",
                    borderBottom: `2px solid ${i === backPage ? "#FF5500" : "transparent"}`,
                    transition: "color 0.2s, border-color 0.2s",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Slide content ─────────────────────────────────────── */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>

            {/* INFO slide */}
            <div style={{
              position: "absolute", inset: 0, padding: "14px 16px", overflowY: "auto",
              opacity: currentSlideKey === "info" ? 1 : 0,
              pointerEvents: currentSlideKey === "info" ? "auto" : "none",
              transition: "opacity 0.22s ease",
            }}>
              <p style={{ margin: "0 0 3px", fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,85,0,0.6)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {offer.is_exclusive !== false ? "✦ OFERTA EXCLUSIVA ✦" : "WELCOME BONUS"}
              </p>
              {hv(offer.headline) && (
                <p style={{ margin: "0 0 14px", fontSize: "clamp(0.9rem,3vw,1.2rem)", fontWeight: 900, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
                  {offer.headline}
                </p>
              )}
              {backStats.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 5, marginBottom: 12 }}>
                  {backStats.map((s) => <StatCell key={s.label} icon={s.icon} label={s.label} value={s.value} />)}
                </div>
              )}
              {hv(offer.code) && (
                <div onClick={handleCopy} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,85,0,0.05)", border: "1px dashed rgba(255,85,0,0.25)", borderRadius: 7, padding: "9px 13px", cursor: "pointer", marginBottom: 12, transition: "background 0.15s" }}>
                  <span style={{ fontSize: "0.58rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700 }}>CÓDIGO:</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", letterSpacing: "0.04em" }}>{offer.code}</span>
                  <span style={{ marginLeft: "auto", fontSize: "0.62rem", color: copied ? "#22c55e" : "#555", fontWeight: 700, transition: "color 0.2s" }}>
                    {copied ? "✓ COPIADO" : "COPIAR"}
                  </span>
                </div>
              )}
              {offer.payment_methods?.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {offer.payment_methods.map((pm) => <PaymentLogo key={pm} method={pm} />)}
                </div>
              )}
            </div>

            {/* BÓNUS slide — welcome bonus stages */}
            {hasBonus && (
              <div style={{
                position: "absolute", inset: 0, padding: "14px 16px", overflowY: "auto",
                opacity: currentSlideKey === "bonus" ? 1 : 0,
                pointerEvents: currentSlideKey === "bonus" ? "auto" : "none",
                transition: "opacity 0.22s ease",
              }}>
                <p style={{ margin: "0 0 12px", fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,85,0,0.6)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  BREAKDOWN DO WELCOME BONUS
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 7 }}>
                  {offer.welcome_bonus_stages!.filter(s => hv(s.pct)).map((stage) => (
                    <div key={stage.label} style={{
                      background: "rgba(255,85,0,0.05)",
                      border: "1px solid rgba(255,85,0,0.15)",
                      borderRadius: 8, padding: "10px 11px",
                    }}>
                      <p style={{ margin: "0 0 4px", fontSize: "0.55rem", fontWeight: 800, color: "rgba(255,85,0,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        {stage.label} DEPÓSITO
                      </p>
                      <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{stage.pct}</p>
                      {hv(stage.fs) && (
                        <p style={{ margin: "3px 0 0", fontSize: "0.7rem", fontWeight: 700, color: "#FF5500" }}>+ {stage.fs}</p>
                      )}
                      <p style={{ margin: "5px 0 0", fontSize: "0.6rem", color: "#555", fontWeight: 600 }}>
                        MIN: {stage.min}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CASINO slide — detailed stats */}
            {hasCasino && (
              <div style={{
                position: "absolute", inset: 0, padding: "14px 16px", overflowY: "auto",
                opacity: currentSlideKey === "casino" ? 1 : 0,
                pointerEvents: currentSlideKey === "casino" ? "auto" : "none",
                transition: "opacity 0.22s ease",
              }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,85,0,0.6)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  DETALHES DO CASINO
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 5, marginBottom: 12 }}>
                  {[
                    { icon: "↑", label: "Max Levant.",   value: offer.max_withdrawal },
                    { icon: "🎧", label: "Suporte 24/7",  value: offer.live_support },
                    { icon: "🎮", label: "Total Jogos",   value: offer.total_games },
                    { icon: "🌐", label: "Idiomas",       value: offer.languages },
                  ].filter(s => hv(s.value)).map((s) => (
                    <StatCell key={s.label} icon={s.icon} label={s.label} value={s.value} />
                  ))}
                </div>
                {(offer.game_providers?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ margin: "0 0 7px", fontSize: "0.56rem", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>PROVIDERS</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {offer.game_providers!.slice(0, 10).map((p) => (
                        <span key={p} style={{ padding: "3px 7px", borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", fontSize: "0.62rem", color: "#888", fontWeight: 600 }}>
                          {p}
                        </span>
                      ))}
                      {offer.game_providers!.length > 10 && (
                        <span style={{ padding: "3px 7px", borderRadius: 4, fontSize: "0.62rem", color: "#555", fontWeight: 600 }}>
                          +{offer.game_providers!.length - 10} mais
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TERMOS slide — VIP + notes + terms */}
            {hasTerms && (
              <div style={{
                position: "absolute", inset: 0, padding: "14px 16px", overflowY: "auto",
                opacity: currentSlideKey === "terms" ? 1 : 0,
                pointerEvents: currentSlideKey === "terms" ? "auto" : "none",
                transition: "opacity 0.22s ease",
              }}>
                {hv(offer.vip_program) && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: "0 0 7px", fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,85,0,0.6)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      ★ PROGRAMA VIP
                    </p>
                    {offer.vip_program!.split("\n").map((line, i) => (
                      <p key={i} style={{ margin: "4px 0", fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.55, display: "flex", gap: 6 }}>
                        <span style={{ color: "#FF5500", flexShrink: 0 }}>•</span>
                        <span>{line}</span>
                      </p>
                    ))}
                  </div>
                )}
                {(offer.notes?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: "0 0 7px", fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,85,0,0.6)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      NOTAS
                    </p>
                    {offer.notes.map((note, i) => (
                      <p key={i} style={{ margin: "4px 0", fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.55, display: "flex", gap: 6 }}>
                        <span style={{ color: "#FF5500", flexShrink: 0 }}>•</span>
                        <span>{note}</span>
                      </p>
                    ))}
                  </div>
                )}
                {hv(offer.details) && (
                  <div>
                    <p style={{ margin: "0 0 7px", fontSize: "0.58rem", fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      TERMOS & CONDIÇÕES
                    </p>
                    <p style={{ margin: 0, fontSize: "0.67rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                      {offer.details}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Back footer */}
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,85,0,0.08)",
            display: "flex", gap: 8,
          }}>
            <button onClick={handleClaim} style={{ ...claimBtn, fontSize: "0.76rem" }}>
              CLAIM OFFER →
            </button>
            <button onClick={(e) => { e.stopPropagation(); setFlipped(false); setBackPage(0); }} style={backBtn}>
              ← BACK
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: "0.5rem", color: "rgba(255,255,255,0.18)", padding: "4px 0 8px" }}>
            18+ · T&Cs Aplicáveis · Joga com responsabilidade
          </p>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OFFER LIST — fetches from Supabase and renders a grid of cards
   ═══════════════════════════════════════════════════════════════════ */

export function OfferCards({ emptyClassName = "" }: { emptyClassName?: string }) {
  const [offers, setOffers] = useState<CasinoOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("casino_offers")
        .select("*")
        .eq("visible", true)
        .order("sort_order", { ascending: true });
      if (!error && data) {
        setOffers(
          (data as CasinoOfferRow[]).map((r) => ({
            id:              r.id,
            slug:            r.slug,
            name:            r.name,
            logo_url:        r.logo_url        ?? undefined,
            logo_bg:         r.logo_bg,
            banner_url:      r.banner_url      ?? undefined,
            badge:           r.badge           ?? undefined,
            tags:            r.tags            ?? [],
            headline:        r.headline,
            bonus_value:     r.bonus_value,
            free_spins:      r.free_spins,
            min_deposit:     r.min_deposit,
            code:            r.code,
            cashback:        r.cashback        ?? undefined,
            withdraw_time:          r.withdraw_time,
            max_withdrawal:         r.max_withdrawal       ?? undefined,
            license:                r.license,
            established:            r.established,
            live_support:           r.live_support         ?? undefined,
            total_games:            r.total_games          ?? undefined,
            languages:              r.languages            ?? undefined,
            game_providers:         r.game_providers       ?? undefined,
            notes:                  r.notes                ?? [],
            welcome_bonus_stages:   r.welcome_bonus_stages ?? undefined,
            vip_program:            r.vip_program          ?? undefined,
            details:                r.details              ?? undefined,
            affiliate_url:          r.affiliate_url,
            rating:                 r.rating               ?? 4.5,
            is_exclusive:           r.is_exclusive         ?? true,
            payment_methods:        r.payment_methods      ?? [],
            kyc_required:           r.kyc_required         != null ? r.kyc_required : undefined,
            vpn_friendly:           r.vpn_friendly         != null ? r.vpn_friendly : undefined,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-arena-gold/20 border-t-arena-gold animate-spin" />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <p className={`text-center text-arena-ash py-12 ${emptyClassName}`}>
        Nenhuma oferta disponível de momento.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}


