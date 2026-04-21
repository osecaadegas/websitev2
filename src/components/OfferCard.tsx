"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CasinoOfferRow } from "@/lib/supabase";
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
  license: string;
  established: string;
  notes: string[];
  affiliate_url: string;
  rating: number;
  is_exclusive?: boolean;
}

/* ── Star Rating Component ──────────────────────────────── */
function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className="rating-row">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} className="star-icon" viewBox="0 0 24 24">
          {i < fullStars ? (
            <path
              className="star-filled"
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          ) : i === fullStars && hasHalf ? (
            <>
              <defs>
                <linearGradient id={`halfGrad-${i}`}>
                  <stop offset="50%" stopColor="#d4a017" />
                  <stop offset="50%" stopColor="rgba(139,105,20,0.2)" />
                </linearGradient>
              </defs>
              <path
                fill={`url(#halfGrad-${i})`}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </>
          ) : (
            <path
              className="star-empty"
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          )}
        </svg>
      ))}
      <span className="rating-number">{rating.toFixed(1)}</span>
    </div>
  );
}

/* ── Corner Ornament SVG ────────────────────────────────── */
function CornerOrnament({ className }: { className: string }) {
  return <div className={`card-corner ${className}`} />;
}

/* ═══════════════════════════════════════════════════════════════════
   PAPYRUS SCROLL CARD COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export function OfferCard({ offer }: { offer: CasinoOffer }) {
  const [copied, setCopied] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const handleCopyCode = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(offer.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [offer.code]);

  // Build perks from tags
  const perks = offer.tags.length > 0 ? offer.tags : ["🎰 Slots", "⚡ Instant Play", "🛡 SSL"];

  const externalUrl = offer.affiliate_url.startsWith("http") ? offer.affiliate_url : `https://${offer.affiliate_url}`;

  const handleOfferClick = useCallback(() => {
    trackOfferClick(offer.id, offer.name);
    window.open(externalUrl, '_blank', 'noopener,noreferrer');
  }, [offer.id, offer.name, externalUrl]);

  return (
    <div className="papyrus-flip-container" onClick={handleOfferClick}>
      <div className={`papyrus-flip-inner ${flipped ? "papyrus-flipped" : ""}`}>

        {/* ═══ FRONT ═══ */}
        <div className="papyrus-flip-face papyrus-flip-front relative">
          <div className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom">
            <CornerOrnament className="top-left" />
            <CornerOrnament className="top-right" />
            <CornerOrnament className="bottom-left" />
            <CornerOrnament className="bottom-right" />
            <div className="scroll-content">

              {/* Banner */}
              <div className="casino-banner">
                <div className="casino-banner-inner">
                  {offer.banner_url ? (
                    <img
                      src={offer.banner_url}
                      alt={offer.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                    />
                  ) : null}
                  
                  {/* Modern Badge Overlay */}
                  {offer.badge && offer.badge !== "ELITE" && (
                    <div style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      zIndex: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      background: "rgba(0, 0, 0, 0.7)",
                      color: "#fff",
                    }}>
                      <span style={{ fontSize: "0.9rem" }}>
                        {offer.badge === "HOT" ? "🔥" : "⭐"}
                      </span>
                      <span>{offer.badge}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Promo Section */}
              <div className="promo-section">
                <p className="promo-label">✦ Oferta{offer.is_exclusive !== false ? " Exclusiva" : ""} ✦</p>
                <p className="promo-bonus">
                  {offer.headline}
                  <span className="promo-bonus-accent">{offer.bonus_value}</span>
                </p>
                <p className="promo-detail">
                  {offer.free_spins !== "—" ? `+ ${offer.free_spins} Free Spins` : ""}
                  {offer.cashback ? ` · ${offer.cashback} Cashback` : ""}
                </p>

                {offer.code && offer.code !== "—" ? (
                  <div className="promo-code-wrapper" onClick={handleCopyCode} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleCopyCode(e)}>
                    <span className="promo-code-label">Código:</span>
                    <span className="promo-code-value">{offer.code}</span>
                  </div>
                ) : (
                  <div className="promo-code-wrapper" style={{ visibility: 'hidden' }}>
                    <span className="promo-code-label">Código:</span>
                    <span className="promo-code-value">&nbsp;</span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="cta-section">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); trackOfferClick(offer.id, offer.name); }}>
                  <button className="cta-button">⚔ Resgatar Bónus ⚔</button>
                </a>
                <p className="cta-subtext">18+ · T&Cs Aplicáveis · Joga com responsabilidade</p>
              </div>

              {/* Flip hint */}
              <p className="flip-hint" onClick={(e) => { e.stopPropagation(); setFlipped(true); }}>Toca para ver detalhes ↻</p>
            </div>
          </div>
        </div>

        {/* ═══ BACK ═══ */}
        <div className="papyrus-flip-face papyrus-flip-back">
          <div className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom">
            <CornerOrnament className="top-left" />
            <CornerOrnament className="top-right" />
            <CornerOrnament className="bottom-left" />
            <CornerOrnament className="bottom-right" />
            <div className="scroll-content">
              {/* Rating */}
              <StarRating rating={offer.rating ?? 4.5} />

              {/* Stat Rows — stacked label/value */}
              <div className="stat-rows">
                <div className="stat-row-stacked">
                  <span className="stat-label">Licença</span>
                  <span className="stat-value">{offer.license}</span>
                </div>
                <div className="stat-row-stacked">
                  <span className="stat-label">Levantamento</span>
                  <span className="stat-value">{offer.withdraw_time}</span>
                </div>
                <div className="stat-row-stacked">
                  <span className="stat-label">Depósito Mín.</span>
                  <span className="stat-value">{offer.min_deposit}</span>
                </div>
              </div>

              {/* Engraved Divider */}
              <div className="engraved-divider" />

              {/* Perks */}
              <div className="perks-list">
                {perks.map((perk) => (
                  <span key={perk} className="perk-tag">{perk}</span>
                ))}
              </div>

              {/* Wax Seal */}
              <div style={{ margin: "8px 0" }}>
                <div className="wax-seal" />
              </div>

              {/* CTA */}
              <div className="cta-section">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); trackOfferClick(offer.id, offer.name); }}>
                  <button className="cta-button">⚔ Resgatar Bónus ⚔</button>
                </a>
              </div>

              {/* Flip hint */}
              <p className="flip-hint" onClick={(e) => { e.stopPropagation(); setFlipped(false); }}>Toca para voltar ↻</p>
            </div>
          </div>
        </div>

      </div>

      {/* Copy Toast */}
      <div className={`copy-toast ${copied ? "visible" : ""}`}>
        ✦ Código promocional copiado ✦
      </div>
    </div>
  );
}

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
            id: r.id,
            slug: r.slug,
            name: r.name,
            logo_url: r.logo_url ?? undefined,
            logo_bg: r.logo_bg,
            banner_url: r.banner_url ?? undefined,
            badge: r.badge ?? undefined,
            tags: r.tags,
            headline: r.headline,
            bonus_value: r.bonus_value,
            free_spins: r.free_spins,
            min_deposit: r.min_deposit,
            code: r.code,
            cashback: r.cashback ?? undefined,
            withdraw_time: r.withdraw_time,
            license: r.license,
            established: r.established,
            notes: r.notes,
            affiliate_url: r.affiliate_url,
            rating: r.rating ?? 4.5,
            is_exclusive: r.is_exclusive ?? true,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="text-center text-arena-ash py-12">A carregar ofertas...</div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className={`text-center text-arena-ash py-12 ${emptyClassName}`}>
        <p className="text-lg">Nenhuma oferta disponível de momento.</p>
        <p className="text-sm mt-2">Volta em breve para novas promoções!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
      {offers.map((offer) => (
        <OfferCard key={offer.slug} offer={offer} />
      ))}
    </div>
  );
}
