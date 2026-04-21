"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, Clock, X,
  Tv, Target, Trophy, Gift, Gamepad2, Zap, Play,
  Inbox, Shield, Award,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ScheduledStreamRow } from "@/lib/supabase";

/* ── Category icons (Lucide) ───────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_LUCIDE: Record<string, React.ComponentType<any>> = {
  "Slots":                   Gamepad2,
  "Bonus Hunt":              Target,
  "Torneio":                 Trophy,
  "Slot Request":            Inbox,
  "Liga dos Secas":         Shield,
  "Torneio Liga dos Secas": Award,
  "Giveaway":                Gift,
  "Outro":                   Tv,
};

/* ── Month names (PT) ─────────────────────────────────────── */
const MONTH_NAMES_PT = [
  "JAN","FEV","MAR","ABR","MAI","JUN",
  "JUL","AGO","SET","OUT","NOV","DEZ",
];
const WEEKDAY_NAMES_PT = [
  "Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado",
];

/* ── Day abbreviations ─────────────────────────────────────── */
const DAY_NAMES_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/* ── Helpers ───────────────────────────────────────────────── */
const formatDay = (dateStr: string) => new Date(dateStr + "T00:00:00").getDate();

const formatMonth = (dateStr: string) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("pt-PT", { month: "short" }).toUpperCase();

/** "Quarta, 19 ABR" */
const formatDatePT = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return `${WEEKDAY_NAMES_PT[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES_PT[d.getMonth()]}`;
};

const isToday = (dateStr: string) => dateStr === new Date().toISOString().split("T")[0];
const isPast  = (dateStr: string) => dateStr < new Date().toISOString().split("T")[0];

/* ── 7 days centered on today (3 past + today + 3 future) ── */
function getCenteredDates(): string[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() + (i - 3));
    return d.toISOString().split("T")[0];
  });
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function StreamCalendar() {
  const [streams, setStreams] = useState<ScheduledStreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState<ScheduledStreamRow | null>(null);

  const fetchStreams = useCallback(async () => {
    try {
      const r = await fetch("/api/scheduled-streams");
      const d = await r.json();
      if (d.streams) setStreams(d.streams);
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStreams();

    const channel = supabase
      .channel("scheduled_streams_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_streams" }, () => {
        fetchStreams();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStreams]);

  const dates = getCenteredDates();
  const streamsForDate = (date: string) => streams.filter((s) => s.stream_date === date && !s.is_cancelled);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="gladiator-schedule">
      <div className="gladiator-schedule__poster">
        <div className="gladiator-schedule__overlay">
          <div className="gladiator-week">
            {dates.map((date) => {
              const dow = new Date(date + "T00:00:00").getDay();
              const dayStreams = streamsForDate(date);
              const active = isToday(date);
              const past = isPast(date);
              const dayNum = formatDay(date);
              const month = formatMonth(date);

              return (
                <div key={date} className={`forge-card ${active ? "forge-card--today" : ""} ${past ? "forge-card--past" : ""}`}>
                  <div className="forge-card__header">
                    <span className="forge-card__day">{DAY_NAMES_PT[dow]}</span>
                    <div className="forge-card__date">
                      <span className="forge-card__num">{dayNum}</span>
                      <span className="forge-card__month">{month}</span>
                    </div>
                  </div>

                  <div className="forge-card__divider" />

                  <div className="forge-card__body">
                    {dayStreams.length > 0 ? (
                      dayStreams.map((stream) => {
                        const cats = stream.categories || ["Outro"];
                        return (
                          <div
                            key={stream.id}
                            className={`forge-slot ${stream.is_special ? "forge-slot--special" : ""}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => setSelectedStream(stream)}
                          >
                            <div className="forge-slot__time">
                              {stream.start_time.slice(0, 5)}
                              {stream.end_time ? ` – ${stream.end_time.slice(0, 5)}` : ""}
                            </div>
                            <div className="forge-slot__title">{stream.title}</div>
                            <div className="forge-slot__meta">
                              {cats.map((c) => {
                                const CatIcon = CATEGORY_LUCIDE[c] || Tv;
                                return (
                                  <span key={c} className="forge-slot__icon" title={c}>
                                    <CatIcon size={12} />
                                  </span>
                                );
                              })}
                              {stream.casino && <span className="forge-slot__casino">{stream.casino}</span>}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="forge-slot forge-slot--empty">
                        <span className="forge-slot__dash">—</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Premium Stream Event Modal ─────────────────────── */}
      {selectedStream && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelectedStream(null)}
        >
          <div
            className="schedule-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Close ─────────────────────────────────────── */}
            <button
              className="schedule-modal-close"
              onClick={() => setSelectedStream(null)}
              aria-label="Fechar"
            >
              <X size={14} strokeWidth={2.5} />
            </button>

            {/* ── Hero ──────────────────────────────────────── */}
            <div className="schedule-modal-hero">
              {/* Ember particles */}
              {[0,1,2,3,4,5].map((i) => (
                <span
                  key={i}
                  className="schedule-modal-ember"
                  style={{
                    left:       `${12 + i * 15}%`,
                    bottom:     `${6 + (i % 3) * 10}px`,
                    "--dur":    `${2.8 + i * 0.5}s`,
                    "--delay":  `${i * 0.38}s`,
                    "--drift":  `${(i % 2 === 0 ? 1 : -1) * (10 + i * 4)}px`,
                  } as React.CSSProperties}
                />
              ))}

              <div className="schedule-modal-hero-content">
                <span className="schedule-modal-badge">
                  {selectedStream.is_special ? "⚡ Evento Especial" : "Calendário Seca"}
                </span>
                <div className="schedule-modal-title">{selectedStream.title}</div>
                <div className="schedule-modal-meta">
                  <span className="schedule-modal-meta-chip">
                    <Calendar size={11} />
                    {formatDatePT(selectedStream.stream_date)}
                  </span>
                  <span className="schedule-modal-meta-chip">
                    <Clock size={11} />
                    {selectedStream.start_time.slice(0, 5)}
                    {selectedStream.end_time ? ` – ${selectedStream.end_time.slice(0, 5)}` : ""}
                  </span>
                  {selectedStream.casino && (
                    <span className="schedule-modal-meta-chip">
                      <Zap size={11} />
                      {selectedStream.casino}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Gold divider ───────────────────────────────── */}
            <div className="schedule-modal-divider" />

            {/* ── Body ──────────────────────────────────────── */}
            <div className="schedule-modal-body">

              {/* Activities — vertical list */}
              <div>
                <div className="schedule-modal-section-label">Actividades</div>
                <div className="schedule-modal-activity-list">
                  {(selectedStream.categories || ["Outro"]).map((c) => {
                    const CatIcon = CATEGORY_LUCIDE[c] || Tv;
                    return (
                      <div key={c} className="schedule-modal-activity-row">
                        <span className="schedule-modal-activity-dot" />
                        <span className="schedule-modal-activity-icon">
                          <CatIcon size={12} strokeWidth={1.8} />
                        </span>
                        <span className="schedule-modal-activity-name">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              {selectedStream.description && (
                <div>
                  <div className="schedule-modal-section-label">Sobre o Stream</div>
                  <p className="schedule-modal-description">{selectedStream.description}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="schedule-modal-actions">
                <a
                  href="https://www.twitch.tv/secaadegas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="schedule-modal-btn-primary"
                >
                  <Play size={14} fill="currentColor" />
                  Ver ao Vivo
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
