"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { supabase } from "@/lib/supabase";
import type { BonusHuntSession, BonusHuntSlot } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════
   CORNER ORNAMENT — reused from the papyrus design system
   ═══════════════════════════════════════════════════════════════════ */
function CornerOrnament({ className }: { className: string }) {
  return (
    <svg className={`scroll-ornament ${className}`} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 2 L2 10 M2 2 L10 2 M2 6 L6 2"
        stroke="#8b6914"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="4" cy="4" r="1.5" fill="#8b6914" />
    </svg>
  );
}

export function BonusHuntTracker({ compact = false, hideTitle = false }: { compact?: boolean; hideTitle?: boolean } = {}) {
  const [sessions, setSessions] = useState<BonusHuntSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<BonusHuntSession | null>(null);
  const [slots, setSlots] = useState<BonusHuntSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [slotPage, setSlotPage] = useState(0);
  const SLOTS_PER_PAGE = 15;

  /* Fetch all completed sessions on mount */
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("bonus_hunt_sessions")
        .select("*")
        .order("hunt_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        setSessions(data);
        setSelectedSession(data[0]);
        setSessionIdx(0);
      }
      setLoading(false);
    }
    load();
  }, []);

  /* Load slots when session changes */
  useEffect(() => {
    if (!selectedSession) return;
    setSlotPage(0);

    async function loadSlots() {
      const { data } = await supabase
        .from("bonus_hunt_slots")
        .select("*")
        .eq("session_id", selectedSession!.id)
        .order("order_index", { ascending: true });

      setSlots(data ?? []);
    }
    loadSlots();
  }, [selectedSession]);

  const currency = selectedSession?.currency || "€";
  const openedCount = slots.filter((s) => s.opened).length;
  const totalSlots = selectedSession?.bonus_count || slots.length;
  const totalPages = Math.max(1, Math.ceil(slots.length / SLOTS_PER_PAGE));
  const paginatedSlots = slots.slice(slotPage * SLOTS_PER_PAGE, (slotPage + 1) * SLOTS_PER_PAGE);

  function prevSession() {
    if (sessionIdx < sessions.length - 1) {
      const next = sessionIdx + 1;
      setSessionIdx(next);
      setSelectedSession(sessions[next]);
    }
  }
  function nextSession() {
    if (sessionIdx > 0) {
      const next = sessionIdx - 1;
      setSessionIdx(next);
      setSelectedSession(sessions[next]);
    }
  }

  if (loading) {
    if (compact) {
      return (
        <div className="papyrus-scroll greek-key-border" style={{ maxWidth: "100%", padding: "32px" }}>
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded" style={{ background: "rgba(139,105,20,0.08)" }} />
            ))}
          </div>
        </div>
      );
    }
    return (
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-arena-dark/50">
        <div className="max-w-4xl mx-auto text-center">
          {!hideTitle && <SectionHeading title="Bonus Hunt" subtitle="A carregar..." />}
          <div className="papyrus-scroll greek-key-border" style={{ maxWidth: "100%", padding: "32px" }}>
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded" style={{ background: "rgba(139,105,20,0.08)" }} />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (sessions.length === 0) {
    if (compact) {
      return (
        <div className="papyrus-scroll greek-key-border" style={{ maxWidth: "100%", padding: "32px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-display)", color: "var(--ink-light)", fontSize: "0.9rem" }}>
            Sem bonus hunts registados.
          </p>
        </div>
      );
    }
    return (
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-arena-dark/50">
        <div className="max-w-4xl mx-auto text-center">
          {!hideTitle && <SectionHeading title="Bonus Hunt" subtitle="Sem bonus hunts registados" />}
          <div className="papyrus-scroll greek-key-border" style={{ maxWidth: "100%", padding: "32px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", color: "var(--ink-light)", fontSize: "0.9rem" }}>
              Os bonus hunts importados aparecerão aqui.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* ── Inner content (header + papyrus table) ──────────── */
  const tableContent = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
            {/* ── Header bar (outside card) ──────────── */}
            {!compact && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
              padding: "0 4px",
            }}>
              {/* Left: hunt title + session nav */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>⚔️</span>
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--arena-smoke, #e0ddd4)",
                    letterSpacing: "0.08em",
                  }}>
                    {selectedSession?.title}
                  </span>
              </div>

              {/* Right: navigation + status */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {sessions.length > 1 && (
                  <>
                    <button
                      onClick={prevSession}
                      disabled={sessionIdx >= sessions.length - 1}
                      className="bh-nav-btn"
                      style={{ borderColor: "rgba(255,255,255,0.15)", color: "var(--arena-smoke, #e0ddd4)" }}
                      aria-label="Sessão anterior"
                    >
                      ‹
                    </button>
                    <button
                      onClick={nextSession}
                      disabled={sessionIdx <= 0}
                      className="bh-nav-btn"
                      style={{ borderColor: "rgba(255,255,255,0.15)", color: "var(--arena-smoke, #e0ddd4)" }}
                      aria-label="Próxima sessão"
                    >
                      ›
                    </button>
                  </>
                )}
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  background: selectedSession?.status === "active"
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(139,105,20,0.12)",
                  color: selectedSession?.status === "active"
                    ? "#22c55e"
                    : "var(--gold-dark)",
                  border: `1px solid ${selectedSession?.status === "active" ? "rgba(34,197,94,0.3)" : "rgba(139,105,20,0.2)"}`,
                }}>
                  {selectedSession?.status === "active" ? "ACTIVE" : selectedSession?.status === "completed" ? "COMPLETA" : "UPCOMING"}
                </span>
                <span style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.5)",
                }}>
                  {openedCount} / {totalSlots} Bónus
                </span>
              </div>
            </div>
            )}

            <div className="papyrus-scroll greek-key-border papyrus-scroll-top papyrus-scroll-bottom bonus-hunt-scroll">
              <CornerOrnament className="absolute top-2 left-2 w-5 h-5" />
              <CornerOrnament className="absolute top-2 right-2 w-5 h-5 -scale-x-100" />
              <CornerOrnament className="absolute bottom-2 left-2 w-5 h-5 -scale-y-100" />
              <CornerOrnament className="absolute bottom-2 right-2 w-5 h-5 -scale-x-100 -scale-y-100" />

              {/* ── Stats bar (top) ────────────────────── */}
              <div className="scroll-content" style={{ padding: "18px 20px 0" }}>
                <div style={{
                  borderBottom: "2px solid rgba(139,105,20,0.2)",
                  padding: "6px 0 8px",
                  display: "flex",
                  justifyContent: "space-around",
                  textAlign: "center",
                }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.5rem", color: "var(--ink-light)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "2px" }}>Start Money</p>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: "1rem", fontWeight: 700, color: "var(--ink-dark)" }}>
                      {(selectedSession?.start_money ?? 0).toFixed(2)}{currency}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.5rem", color: "var(--ink-light)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "2px" }}>Total Win</p>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: "1rem", fontWeight: 700, color: "#2e7d32" }}>
                      {(selectedSession?.total_result ?? 0).toFixed(2)}{currency}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.5rem", color: "var(--ink-light)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "2px" }}>Profit</p>
                    <p style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: (selectedSession?.profit ?? 0) >= 0 ? "#2e7d32" : "#8b1a1a",
                    }}>
                      {(selectedSession?.profit ?? 0) >= 0 ? "+" : ""}{(selectedSession?.profit ?? 0).toFixed(2)}{currency}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.5rem", color: "var(--ink-light)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "2px" }}>Best Multi</p>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: "1rem", fontWeight: 700, color: "var(--gold-dark)" }}>
                      {(selectedSession?.best_multi ?? 0).toFixed(1)}x
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.5rem", color: "var(--ink-light)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "2px" }}>Avg Multi</p>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: "1rem", fontWeight: 700, color: "var(--ink-dark)" }}>
                      {(selectedSession?.avg_multi ?? 0).toFixed(1)}x
                    </p>
                  </div>
                </div>

                {/* Best slot callout (full page only) */}
                {!compact && selectedSession?.best_slot_name && (
                  <div style={{ textAlign: "center", padding: "4px 0" }}>
                    <span style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.6rem",
                      color: "var(--gold-dark)",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                    }}>
                      🏆 Melhor Slot: {selectedSession.best_slot_name} ({selectedSession.best_multi.toFixed(1)}x)
                    </span>
                  </div>
                )}

                {/* ── Column headers ──────────────────── */}
                <div className="bh-table-header">
                  <span className="bh-col-num">#</span>
                  <span className="bh-col-slot">SLOT</span>
                  <span className="bh-col-bet">BET SIZE</span>
                  <span className="bh-col-special">SPECIAL</span>
                  <span className="bh-col-win">WINNINGS</span>
                </div>
              </div>

              {/* ── Slot rows ────────────────────────── */}
              <div className="scroll-content" style={{ padding: "0 20px 8px" }}>
                {(compact ? paginatedSlots : slots).map((slot, i) => {
                  const globalIndex = compact ? slotPage * SLOTS_PER_PAGE + i : i;
                  const multi = slot.bet_size && slot.bet_size > 0 && slot.payout
                    ? (slot.payout / slot.bet_size)
                    : null;
                  const isWin = slot.payout !== undefined && slot.payout !== null && slot.payout >= (slot.bet_size ?? slot.buy_value);

                  return (
                    <div
                      key={slot.id}
                      className={`bh-table-row ${slot.status === "active" ? "bh-row-active" : ""}`}
                    >
                      {/* # */}
                      <span className="bh-col-num" style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "var(--ink-light)",
                      }}>
                        #{globalIndex + 1}
                      </span>

                      {/* Slot: thumbnail + name + provider */}
                      <div className="bh-col-slot" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                            🎰
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
                          {slot.provider && (
                            <p style={{
                              fontFamily: "var(--font-display)",
                              fontSize: "0.55rem",
                              color: "var(--ink-light)",
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              lineHeight: 1.4,
                            }}>
                              {slot.provider}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bet size */}
                      <span className="bh-col-bet" style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "var(--ink-dark)",
                      }}>
                        {(slot.bet_size ?? slot.buy_value).toFixed(2)}{currency}
                      </span>

                      {/* Special badges */}
                      <div className="bh-col-special" style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {slot.is_super_bonus && (
                          <span className="bh-badge bh-badge-super">SUPER BÓNUS</span>
                        )}
                        {slot.is_extreme_bonus && (
                          <span className="bh-badge bh-badge-extreme">EXTREME</span>
                        )}
                      </div>

                      {/* Winnings */}
                      <span className="bh-col-win" style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: !slot.opened
                          ? "var(--ink-light)"
                          : isWin ? "#2e7d32" : "#8b1a1a",
                      }}>
                        {slot.opened && slot.payout !== undefined && slot.payout !== null
                          ? <>
                              {slot.payout.toFixed(2)}{currency}
                              {multi !== null && (
                                <span style={{ fontSize: "0.65rem", fontWeight: 400, color: "var(--ink-light)", marginLeft: "4px" }}>
                                  ({multi.toFixed(1)}x)
                                </span>
                              )}
                            </>
                          : <span style={{ fontFamily: "var(--font-display)", letterSpacing: "0.1em" }}>???</span>
                        }
                      </span>
                    </div>
                  );
                })}

                {/* ── Pagination controls ──────────── */}
                {compact && totalPages > 1 && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "12px 0 4px",
                    borderTop: "1px solid rgba(139,105,20,0.15)",
                    marginTop: "8px",
                  }}>
                    <button
                      onClick={() => setSlotPage((p) => Math.max(0, p - 1))}
                      disabled={slotPage === 0}
                      className="bh-nav-btn"
                      style={{ borderColor: "rgba(139,105,20,0.25)", color: "var(--ink-dark)", opacity: slotPage === 0 ? 0.3 : 1 }}
                      aria-label="Página anterior"
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, p) => (
                      <button
                        key={p}
                        onClick={() => setSlotPage(p)}
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "0.7rem",
                          fontWeight: slotPage === p ? 700 : 500,
                          width: "28px",
                          height: "28px",
                          borderRadius: "4px",
                          border: slotPage === p ? "1px solid rgba(139,105,20,0.5)" : "1px solid rgba(139,105,20,0.15)",
                          background: slotPage === p ? "rgba(139,105,20,0.15)" : "transparent",
                          color: slotPage === p ? "var(--gold-dark)" : "var(--ink-light)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {p + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setSlotPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={slotPage === totalPages - 1}
                      className="bh-nav-btn"
                      style={{ borderColor: "rgba(139,105,20,0.25)", color: "var(--ink-dark)", opacity: slotPage === totalPages - 1 ? 0.3 : 1 }}
                      aria-label="Próxima página"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
  );

  /* ── Compact mode: skip section wrapper ──────────────── */
  if (compact) {
    return tableContent;
  }

  /* ── Full page mode ─────────────────────────────────── */
  return (
    <section id="bonus-hunt" className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">

      <div className="relative max-w-4xl mx-auto">
        {!hideTitle && (
        <ScrollReveal>
          <SectionHeading
            title="Bonus Hunt"
            subtitle={selectedSession?.title || "Acompanha cada bónus em tempo real"}
          />
        </ScrollReveal>
        )}
        <ScrollReveal delay={0.1}>
          {tableContent}
        </ScrollReveal>
      </div>
    </section>
  );
}
