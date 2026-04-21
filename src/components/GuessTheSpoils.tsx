"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase, type BonusHuntSession, type BonusHuntSlot } from "@/lib/supabase";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

/* ── Helpers ────────────────────────────────────────────────────────── */

function toRoman(n: number): string {
  const lookup: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  let remaining = n;
  for (const [value, symbol] of lookup) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

function CornerOrnament({ className }: { className: string }) {
  return (
    <svg className={`scroll-ornament ${className}`} viewBox="0 0 24 24" fill="none">
      <path d="M2 2 L2 10 M2 2 L10 2 M2 6 L6 2" stroke="#8b6914" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="4" cy="4" r="1.5" fill="#8b6914" />
    </svg>
  );
}

type StatsTab = "war-stats" | "treasury" | "favor" | "records";

/* ── Component ──────────────────────────────────────────────────────── */

export function GuessTheSpoils({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const [campaigns, setCampaigns] = useState<BonusHuntSession[]>([]);
  const [idx, setIdx] = useState(0);
  const [slots, setSlots] = useState<BonusHuntSlot[]>([]);
  const [tab, setTab] = useState<StatsTab>("war-stats");
  const [loading, setLoading] = useState(true);

  /* Fetch all campaigns */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bonus_hunt_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (data?.length) setCampaigns(data as BonusHuntSession[]);
      setLoading(false);
    })();
  }, []);

  /* Fetch slots for active campaign */
  const campaign = campaigns[idx];
  useEffect(() => {
    if (!campaign) return;
    (async () => {
      const { data } = await supabase
        .from("bonus_hunt_slots")
        .select("*")
        .eq("session_id", campaign.id)
        .order("order_index", { ascending: true });
      if (data) setSlots(data as BonusHuntSlot[]);
    })();
  }, [campaign]);

  /* Real-time subscription — update slots live during active sessions */
  useEffect(() => {
    if (!campaign) return;
    const channel = supabase
      .channel(`gts-slots-${campaign.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bonus_hunt_slots", filter: `session_id=eq.${campaign.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setSlots((prev) =>
              prev.map((s) => (s.id === (payload.new as BonusHuntSlot).id ? (payload.new as BonusHuntSlot) : s))
            );
          } else if (payload.eventType === "INSERT") {
            setSlots((prev) =>
              [...prev, payload.new as BonusHuntSlot].sort((a, b) => a.order_index - b.order_index)
            );
          } else if (payload.eventType === "DELETE") {
            setSlots((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaign?.id]);

  /* Derived stats */
  const victories = slots.filter((s) => s.result != null && (s.result ?? 0) >= s.buy_value).length;
  const opened = slots.filter((s) => s.opened).length;
  const total = slots.length;
  const totalWin = slots.reduce((s, r) => s + (r.result ?? 0), 0);
  const totalBuy = slots.reduce((s, r) => s + r.buy_value, 0);
  const currentBE = totalBuy > 0 ? totalWin / totalBuy : 0;
  const progress = total > 0 ? (opened / total) * 100 : 0;

  const openedSlots = slots.filter((s) => s.result != null && s.buy_value > 0);
  const bestSlot = openedSlots.reduce<BonusHuntSlot | null>((best, s) =>
    !best || (s.result! / s.buy_value) > (best.result! / best.buy_value) ? s : best, null);
  const worstSlot = openedSlots.reduce<BonusHuntSlot | null>((worst, s) =>
    !worst || (s.result! / s.buy_value) < (worst.result! / worst.buy_value) ? s : worst, null);

  const phaseLabel =
    campaign?.phase === "hunting" ? "🎯 HUNTING" :
    campaign?.phase === "opening" ? "🎰 OPENING" : "✅ COMPLETED";

  const statusLabel =
    campaign?.status === "active" ? "EM BATALHA" :
    campaign?.status === "completed" ? "COMPLETA" : "PRÓXIMA";

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 min-h-screen relative">

      <div className="relative max-w-[1400px] mx-auto">

        {/* ── Heading ──────────────────────────────────────────────── */}
        {!hideTitle && (
          <ScrollReveal>
            <SectionHeading
              title="Guess the Spoils"
              subtitle="Survive the Arena and Claim Your Glory!"
            />
          </ScrollReveal>
        )}

        {/* ── Loading / Empty ──────────────────────────────────────── */}
        {loading ? (
          <div className="papyrus-scroll greek-key-border" style={{ maxWidth: "100%", padding: "32px", textAlign: "center" }}>
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded" style={{ background: "rgba(139,105,20,0.08)" }} />
              ))}
            </div>
          </div>
        ) : !campaign ? (
          <div className="papyrus-scroll greek-key-border" style={{ maxWidth: "100%", padding: "32px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", color: "var(--ink-light)", fontSize: "0.9rem" }}>
              Nenhuma campanha ativa. As campanhas aparecem aqui durante os Bonus Hunts.
            </p>
          </div>
        ) : (

        /* ── Main Grid ─────────────────────────────────────────────── */
        <ScrollReveal delay={0.1}>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

            {/* ▸ LEFT — Campaign Table (Papyrus) ──────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom gts-scroll" style={{ maxWidth: "100%" }}>
                <CornerOrnament className="absolute top-2 left-2 w-5 h-5" />
                <CornerOrnament className="absolute top-2 right-2 w-5 h-5 -scale-x-100" />
                <CornerOrnament className="absolute bottom-2 left-2 w-5 h-5 -scale-y-100" />
                <CornerOrnament className="absolute bottom-2 right-2 w-5 h-5 -scale-x-100 -scale-y-100" />

                {/* Campaign header bar */}
                <div className="scroll-content" style={{ padding: "10px 20px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "1.3rem" }}>🛡️</span>
                      <span style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "var(--ink-dark)",
                        letterSpacing: "0.08em",
                      }}>
                        Campaign {toRoman(idx + 1)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {campaigns.length > 1 && (
                        <>
                          <button
                            onClick={() => setIdx((p) => Math.max(0, p - 1))}
                            disabled={idx === 0}
                            className="bh-nav-btn"
                            aria-label="Campanha anterior"
                          >‹</button>
                          <button
                            onClick={() => setIdx((p) => Math.min(campaigns.length - 1, p + 1))}
                            disabled={idx === campaigns.length - 1}
                            className="bh-nav-btn"
                            aria-label="Próxima campanha"
                          >›</button>
                        </>
                      )}
                      <span style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        background: campaign.phase === "completed"
                          ? "rgba(139,105,20,0.12)"
                          : campaign.phase === "opening"
                          ? "rgba(212,168,67,0.15)"
                          : "rgba(34,197,94,0.15)",
                        color: campaign.phase === "completed"
                          ? "var(--gold-dark)"
                          : campaign.phase === "opening"
                          ? "#d4a843"
                          : "#22c55e",
                        border: `1px solid ${campaign.phase === "completed" ? "rgba(139,105,20,0.2)" : campaign.phase === "opening" ? "rgba(212,168,67,0.3)" : "rgba(34,197,94,0.3)"}`,
                      }}>
                        {phaseLabel}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: "0.75rem",
                        color: "var(--ink-light)",
                      }}>
                        {opened} / {total} Bónus
                      </span>
                    </div>
                  </div>

                  {/* Column headers */}
                  <div className="bh-table-header" style={{ gridTemplateColumns: "40px 1fr 90px 120px 110px" }}>
                    <span>#</span>
                    <span>SLOT</span>
                    <span>BET / PAYOUT</span>
                    <span>SPECIAL</span>
                    <span style={{ textAlign: "right" }}>RESULTADO</span>
                  </div>
                </div>

                {/* Slot rows */}
                <div className="scroll-content" style={{ padding: "0 20px 8px" }}>
                  {slots.map((slot, i) => (
                    <motion.div
                      key={slot.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`bh-table-row${slot.status === "active" ? " bh-row-active" : ""}`}
                      style={{ gridTemplateColumns: "40px 1fr 90px 120px 110px" }}
                    >
                      {/* # */}
                      <span style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "var(--ink-light)",
                        textAlign: "center",
                      }}>
                        #{i + 1}
                      </span>

                      {/* Slot info */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        {slot.thumbnail_url ? (
                          <img
                            src={slot.thumbnail_url}
                            alt={slot.name}
                            loading="lazy"
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "6px",
                              objectFit: "cover",
                              border: "1px solid rgba(139,105,20,0.2)",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            background: "rgba(139,105,20,0.08)",
                            border: "1px solid rgba(139,105,20,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.9rem",
                            flexShrink: 0,
                          }}>
                            ⚔
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            color: "var(--ink-dark)",
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {slot.name}
                          </p>
                          <p style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.5rem",
                            color: "var(--ink-light)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            lineHeight: 1.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {[slot.provider, slot.rtp != null && `RTP ${slot.rtp}%`, slot.volatility, slot.potential_multiplier ? `Max ${slot.potential_multiplier}x` : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>

                      {/* Bet / Payout */}
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontFamily: "var(--font-ui)", fontSize: "0.8rem", fontWeight: 700, color: "var(--ink-dark)", lineHeight: 1.3 }}>
                          {slot.buy_value.toFixed(2)}€
                        </p>
                        {slot.bet_size != null && (
                          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.45rem", color: "var(--ink-light)", letterSpacing: "0.08em", lineHeight: 1.3 }}>
                            bet {slot.bet_size.toFixed(2)}€
                          </p>
                        )}
                        {slot.payout != null && slot.payout !== slot.result && (
                          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.45rem", color: "var(--gold-dark)", letterSpacing: "0.08em", lineHeight: 1.3 }}>
                            pay {slot.payout.toFixed(2)}€
                          </p>
                        )}
                      </div>

                      {/* Special */}
                      <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                        {slot.is_super_bonus && (
                          <span className="bh-badge bh-badge-super">SUPER BÓNUS</span>
                        )}
                        {slot.is_extreme_bonus && (
                          <span className="bh-badge bh-badge-extreme">EXTREME</span>
                        )}
                        {slot.special && !slot.is_super_bonus && !slot.is_extreme_bonus && (
                          <span className="bh-badge bh-badge-super">{slot.special}</span>
                        )}
                      </div>

                      {/* Winnings */}
                      <div style={{ textAlign: "right" }}>
                        {slot.result != null ? (
                          <>
                            <p style={{
                              fontFamily: "var(--font-ui)",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: slot.result >= slot.buy_value ? "#2e7d32" : "#8b1a1a",
                              lineHeight: 1.3,
                            }}>
                              {slot.result.toFixed(2)}€
                            </p>
                            {slot.buy_value > 0 && (
                              <p style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "0.55rem",
                                fontWeight: 700,
                                color: slot.result >= slot.buy_value ? "rgba(46,125,50,0.7)" : "rgba(139,26,26,0.7)",
                                letterSpacing: "0.06em",
                                lineHeight: 1.3,
                              }}>
                                {(slot.result / slot.buy_value).toFixed(2)}x
                              </p>
                            )}
                          </>
                        ) : (
                          <span style={{ fontFamily: "var(--font-display)", letterSpacing: "0.1em", color: "var(--ink-light)" }}>—</span>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {slots.length === 0 && (
                    <div style={{ padding: "32px 0", textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-display)", color: "var(--ink-light)", fontSize: "0.85rem" }}>
                        Nenhum slot nesta campanha.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ▸ RIGHT — War Stats (Papyrus) ──────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
              className="self-start"
            >
                <div className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom gts-stats-scroll" style={{ maxWidth: "100%" }}>
                <CornerOrnament className="absolute top-2 left-2 w-5 h-5" />
                <CornerOrnament className="absolute top-2 right-2 w-5 h-5 -scale-x-100" />
                <CornerOrnament className="absolute bottom-2 left-2 w-5 h-5 -scale-y-100" />
                <CornerOrnament className="absolute bottom-2 right-2 w-5 h-5 -scale-x-100 -scale-y-100" />

                {/* Tabs */}
                <div className="scroll-content" style={{
                  display: "flex",
                  borderBottom: "2px solid rgba(139,105,20,0.15)",
                }}>
                  {([
                    { id: "war-stats", label: "War Stats", icon: "📊" },
                    { id: "treasury", label: "Treasury", icon: "💰" },
                    { id: "favor", label: "Favor", icon: "⭐" },
                    { id: "records", label: "Records", icon: "🕐" },
                  ] as { id: StatsTab; label: string; icon: string }[]).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "2px",
                        padding: "10px 4px",
                        fontFamily: "var(--font-display)",
                        fontSize: "0.5rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: tab === t.id ? "var(--ink-dark)" : "var(--ink-light)",
                        background: tab === t.id ? "rgba(139,105,20,0.06)" : "transparent",
                        border: "none",
                        borderBottom: tab === t.id ? "2px solid var(--gold-dark)" : "2px solid transparent",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem" }}>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="scroll-content" style={{ padding: "12px 16px 16px" }}>

                  {/* WAR STATS */}
                  {tab === "war-stats" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {/* Start / Stop / Target */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                        <StatBox icon="⚔" label="Start" value={`${campaign.start_money.toFixed(2)}€`} />
                        <StatBox icon="⭕" label="Stop" value={`${campaign.stop_loss.toFixed(2)}€`} />
                        <StatBox icon="🎯" label="Buy-In" value={`${(campaign.total_buy ?? 0).toFixed(2)}€`} highlight />
                      </div>

                      {/* Campaign progress */}
                      <div style={{
                        border: "1px solid rgba(139,105,20,0.15)",
                        borderRadius: "6px",
                        padding: "10px",
                        background: "rgba(139,105,20,0.04)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.5rem", color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                            Campaign Progress
                          </span>
                          <span style={{
                            fontSize: "0.55rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "3px",
                            background: "rgba(34,197,94,0.12)",
                            color: "#22c55e",
                          }}>
                            {victories}/{total}
                          </span>
                        </div>
                        <div style={{
                          height: "6px",
                          borderRadius: "3px",
                          background: "rgba(139,105,20,0.1)",
                          overflow: "hidden",
                        }}>
                          <motion.div
                            style={{
                              height: "100%",
                              borderRadius: "3px",
                              background: "linear-gradient(90deg, var(--gold-dark), #b89230)",
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                          />
                        </div>
                      </div>

                      {/* Current BE */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 4px",
                      }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.55rem", color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                          ⚡ Current BE
                        </span>
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: "1.2rem", fontWeight: 700, color: "var(--ink-dark)" }}>
                          {currentBE.toFixed(2)}x
                        </span>
                      </div>

                      {/* Initial BE */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 4px",
                        borderTop: "1px solid rgba(139,105,20,0.12)",
                      }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.55rem", color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                          ○ Initial BE
                        </span>
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink-dark)" }}>
                          1.00x
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TREASURY */}
                  {tab === "treasury" && (
                    <div style={{ padding: "24px 0", textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.55rem", color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
                        💰 Total Winnings
                      </p>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: "1.8rem", fontWeight: 700, color: "var(--gold-dark)", marginBottom: "6px" }}>
                        {totalWin.toFixed(2)}€
                      </p>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.55rem", color: "var(--ink-light)", letterSpacing: "0.1em", marginBottom: "4px" }}>
                        Total Buy: {totalBuy.toFixed(2)}€
                      </p>
                      <p style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        color: totalWin >= totalBuy ? "#2e7d32" : "#8b1a1a",
                      }}>
                        {totalWin >= totalBuy ? "+" : ""}{(totalWin - totalBuy).toFixed(2)}€
                      </p>
                    </div>
                  )}

                  {/* FAVOR */}
                  {tab === "favor" && (
                    <div style={{ padding: "24px 0", textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "var(--ink-light)" }}>
                        Votação em breve.
                      </p>
                    </div>
                  )}

                  {/* RECORDS */}
                  {tab === "records" && (
                    <div style={{ padding: "24px 0", textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "var(--ink-light)" }}>
                        Histórico em breve.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Best & Worst Slot Showcase Cards */}
              {(bestSlot || worstSlot) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
              {/* Best Slot Card */}
              {bestSlot && (
                <motion.div
                  className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  <CornerOrnament className="absolute top-2 left-2 w-4 h-4" />
                  <CornerOrnament className="absolute top-2 right-2 w-4 h-4 -scale-x-100" />
                  <CornerOrnament className="absolute bottom-2 left-2 w-4 h-4 -scale-y-100" />
                  <CornerOrnament className="absolute bottom-2 right-2 w-4 h-4 -scale-x-100 -scale-y-100" />

                  <div className="scroll-content" style={{ display: "flex", gap: "12px" }}>
                    {/* Image on left */}
                    <div style={{ flexShrink: 0, width: "140px", position: "relative" }}>
                      <div style={{ position: "absolute", top: -4, left: -4, zIndex: 2 }}>
                        <div style={{
                          background: "linear-gradient(135deg, #2e7d32, #1b5e20)",
                          color: "#fff",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontFamily: "var(--font-display)",
                          fontSize: "0.45rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          boxShadow: "0 2px 8px rgba(46,125,50,0.3)",
                        }}>
                          🏆 Melhor
                        </div>
                      </div>
                      <div style={{ aspectRatio: "3/4", background: "#000", borderRadius: "6px", overflow: "hidden", border: "2px solid rgba(46,125,50,0.3)" }}>
                        {bestSlot.thumbnail_url ? (
                          <img
                            src={bestSlot.thumbnail_url}
                            alt={bestSlot.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
                            fontSize: "3rem",
                          }}>
                            🎰
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content on right */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
                      <div>
                        <h3 style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: "var(--ink-dark)",
                          marginBottom: "2px",
                          lineHeight: 1.2,
                        }}>
                          {bestSlot.name}
                        </h3>
                        {bestSlot.provider && (
                          <p style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "0.6rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}>
                            {bestSlot.provider}
                          </p>
                        )}
                      </div>

                      {/* Stats stacked vertically */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "4px", borderBottom: "1px solid rgba(139,105,20,0.12)" }}>
                          <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.5rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}>
                            Payout
                          </span>
                          <span style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: "#2e7d32",
                          }}>
                            {bestSlot.result?.toFixed(2) ?? "0.00"}€
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "4px", borderBottom: "1px solid rgba(139,105,20,0.12)" }}>
                          <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.5rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}>
                            Bet Size
                          </span>
                          <span style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: "var(--ink-dark)",
                          }}>
                            {bestSlot.buy_value.toFixed(2)}€
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.5rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}>
                            Multi
                          </span>
                          <span style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "1.3rem",
                            fontWeight: 700,
                            color: "#2e7d32",
                          }}>
                            {(bestSlot.result! / bestSlot.buy_value).toFixed(1)}x
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Worst Slot Card */}
              {worstSlot && (
                <motion.div
                  className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  <CornerOrnament className="absolute top-2 left-2 w-4 h-4" />
                  <CornerOrnament className="absolute top-2 right-2 w-4 h-4 -scale-x-100" />
                  <CornerOrnament className="absolute bottom-2 left-2 w-4 h-4 -scale-y-100" />
                  <CornerOrnament className="absolute bottom-2 right-2 w-4 h-4 -scale-x-100 -scale-y-100" />

                  <div className="scroll-content" style={{ display: "flex", gap: "12px" }}>
                    {/* Image on left */}
                    <div style={{ flexShrink: 0, width: "140px", position: "relative" }}>
                      <div style={{ position: "absolute", top: -4, left: -4, zIndex: 2 }}>
                        <div style={{
                          background: "linear-gradient(135deg, #8b1a1a, #5d1111)",
                          color: "#fff",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontFamily: "var(--font-display)",
                          fontSize: "0.45rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          boxShadow: "0 2px 8px rgba(139,26,26,0.3)",
                        }}>
                          💀 Pior
                        </div>
                      </div>
                      <div style={{ aspectRatio: "3/4", background: "#000", borderRadius: "6px", overflow: "hidden", border: "2px solid rgba(139,26,26,0.3)" }}>
                        {worstSlot.thumbnail_url ? (
                          <img
                            src={worstSlot.thumbnail_url}
                            alt={worstSlot.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "linear-gradient(135deg, #8b1a1a 0%, #5d1111 100%)",
                            fontSize: "3rem",
                          }}>
                            🎰
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content on right */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
                      <div>
                        <h3 style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: "var(--ink-dark)",
                          marginBottom: "2px",
                          lineHeight: 1.2,
                        }}>
                          {worstSlot.name}
                        </h3>
                        {worstSlot.provider && (
                          <p style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "0.6rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}>
                            {worstSlot.provider}
                          </p>
                        )}
                      </div>

                      {/* Stats stacked vertically */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "4px", borderBottom: "1px solid rgba(139,105,20,0.12)" }}>
                          <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.5rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}>
                            Payout
                          </span>
                          <span style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: "#8b1a1a",
                          }}>
                            {worstSlot.result?.toFixed(2) ?? "0.00"}€
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "4px", borderBottom: "1px solid rgba(139,105,20,0.12)" }}>
                          <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.5rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}>
                            Bet Size
                          </span>
                          <span style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: "var(--ink-dark)",
                          }}>
                            {worstSlot.buy_value.toFixed(2)}€
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.5rem",
                            color: "var(--ink-light)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}>
                            Multi
                          </span>
                          <span style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: "1.3rem",
                            fontWeight: 700,
                            color: "#8b1a1a",
                          }}>
                            {(worstSlot.result! / worstSlot.buy_value).toFixed(1)}x
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
            </motion.div>
          </div>
        </ScrollReveal>
        )}
      </div>
    </section>
  );
}

/* ── Small stat box (papyrus style) ────────────────────────────────── */

function StatBox({
  icon, label, value, highlight = false,
}: {
  icon: string; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div style={{
      border: "1px solid rgba(139,105,20,0.15)",
      borderRadius: "6px",
      padding: "8px 6px",
      textAlign: "center",
      background: "rgba(139,105,20,0.04)",
    }}>
      <div style={{ fontSize: "0.75rem", marginBottom: "2px" }}>{icon}</div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.45rem", color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: "2px" }}>
        {label}
      </p>
      <p style={{
        fontFamily: "var(--font-ui)",
        fontSize: "0.8rem",
        fontWeight: 700,
        color: highlight ? "var(--gold-dark)" : "var(--ink-dark)",
      }}>
        {value}
      </p>
    </div>
  );
}
