"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Types ─────────────────────────────────────────────── */
interface LeaderboardYear {
  id: string;
  year: number;
  is_active: boolean;
  is_locked: boolean;
}

interface LeaderboardEntry {
  id: string;
  year_id: string;
  month: number;
  winner_name: string;
  winner_avatar: string | null;
}

const MONTH_NAMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL",
  "MAIO", "JUNHO", "JULHO", "AGOSTO",
  "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

/* ── Corner Ornament ───────────────────────────────────── */
function CornerOrnament({ className }: { className: string }) {
  return (
    <svg className={`scroll-ornament ${className}`} viewBox="0 0 24 24" fill="none">
      <path d="M2 2 L2 10 M2 2 L10 2 M2 6 L6 2" stroke="#8b6914" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="4" cy="4" r="1.5" fill="#8b6914" />
    </svg>
  );
}

/* ── Dust Particle ─────────────────────────────────────── */
function DustParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="liga-dust"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────── */
export default function LigaDosSecasContent() {
  const [years, setYears] = useState<LeaderboardYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<LeaderboardYear | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = new Date().getMonth() + 1;

  const fetchYears = useCallback(async () => {
    const res = await fetch("/api/leaderboard?list=true");
    const data = await res.json();
    if (data.years) setYears(data.years);
  }, []);

  const fetchEntries = useCallback(async (year: number) => {
    const res = await fetch(`/api/leaderboard?year=${year}`);
    const data = await res.json();
    if (data.year) setSelectedYear(data.year);
    if (data.entries) setEntries(data.entries);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fetch years list
      const res = await fetch("/api/leaderboard?list=true");
      const data = await res.json();
      const yearsList: LeaderboardYear[] = data.years ?? [];
      setYears(yearsList);

      // Load active year or first available
      const active = yearsList.find((y) => y.is_active) ?? yearsList[0];
      if (active) {
        await fetchEntries(active.year);
      }
      setLoading(false);
    })();
  }, [fetchEntries]);

  const handleYearChange = async (year: number) => {
    setLoading(true);
    await fetchEntries(year);
    setLoading(false);
  };

  // Find top player of the year (most months won)
  const topPlayer = (() => {
    const counts: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.winner_name) {
        counts[e.winner_name] = (counts[e.winner_name] ?? 0) + 1;
      }
    });
    let best = "";
    let max = 0;
    for (const [name, count] of Object.entries(counts)) {
      if (count > max) { max = count; best = name; }
    }
    return best && max > 1 ? best : null;
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Content */}
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── Header ──────────────────────────── */}
          {years.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-10"
            >
              <div className="flex gap-2 flex-wrap justify-center">
                {years.map((y) => (
                  <button
                    key={y.id}
                    onClick={() => handleYearChange(y.year)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-[family-name:var(--font-display)] tracking-wider border transition-all duration-300 ${
                      selectedYear?.year === y.year
                        ? "bg-arena-gold/20 border-arena-gold/50 text-arena-gold shadow-[0_0_12px_rgba(212,168,67,0.2)]"
                        : "bg-white/[0.03] border-white/10 text-arena-smoke hover:border-arena-gold/30 hover:text-arena-gold"
                    }`}
                  >
                    {y.year}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Parchment Scroll ────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedYear?.year ?? "empty"}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative max-w-xl w-full liga-scroll-perspective"
            >
              <div className="liga-scroll">
                <CornerOrnament className="top-left" />
                <CornerOrnament className="top-right" />
                <CornerOrnament className="bottom-left" />
                <CornerOrnament className="bottom-right" />
                <DustParticles />

                {/* Scroll Header */}
                {selectedYear && (
                  <h2 className="liga-scroll-subtitle">Vencedores {selectedYear.year}</h2>
                )}

                <div className="liga-divider" />

                {/* Top Player Badge */}
                {topPlayer && (
                  <div className="liga-top-player">
                    <span className="liga-top-player-icon">👑</span>
                    <span className="liga-top-player-text">
                      Gladiador do Ano: <strong>{topPlayer}</strong>
                    </span>
                  </div>
                )}

                {/* Month Entries */}
                <div className="liga-entries">
                  {entries.length > 0 ? entries.map((entry) => {
                    const isCurrentMonth = selectedYear?.is_active && entry.month === currentMonth;
                    return (
                      <motion.div
                        key={entry.id}
                        className={`liga-entry ${isCurrentMonth ? "liga-entry-current" : ""}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: entry.month * 0.04 }}
                      >
                        <span className="liga-month">{MONTH_NAMES[entry.month - 1]}</span>
                        <span className="liga-dots" />
                        <span className={`liga-winner ${entry.winner_name ? "" : "liga-winner-empty"}`}>
                          {entry.winner_avatar && (
                            <img
                              src={entry.winner_avatar}
                              alt=""
                              className="liga-winner-avatar"
                            />
                          )}
                          {entry.winner_name || "—"}
                        </span>
                      </motion.div>
                    );
                  }) : (
                    <div className="liga-empty">
                      <p>Nenhum dado disponível</p>
                    </div>
                  )}
                </div>

                <div className="liga-divider" />

                {/* Footer */}
                <div className="liga-scroll-footer">
                  <div className="liga-wax-seal" />
                  <p className="liga-footer-text">Arena Gladiator · SECAADEGAS</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
