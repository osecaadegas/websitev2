"use client";

import { motion } from "framer-motion";
import { ArenaCard } from "@/components/ui/ArenaCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { STAGGER_CONTAINER, STAGGER_ITEM } from "@/lib/animations";
import { getRankForPoints, getRankProgress, getNextRank, RANKS } from "@/lib/ranks";
import type { LeaderboardEntry } from "@/lib/supabase";

/**
 * LEADERBOARD — Gladiator rank progression with animated gold fill bars.
 *
 * Rank tiers: Recruit → Warrior → Champion → Legend
 * Each viewer earns points and progresses through ranks.
 * Progress bars animate with shimmer gold fill effect.
 */

// Demo data
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { id: "1", user_name: "maximus_99", display_name: "Maximus99", total_points: 7200, biggest_win: 15000, rank: "legend", created_at: "" },
  { id: "2", user_name: "arena_queen", display_name: "ArenaQueen", total_points: 4800, biggest_win: 8500, rank: "champion", created_at: "" },
  { id: "3", user_name: "slot_centurion", display_name: "SlotCenturion", total_points: 3100, biggest_win: 6200, rank: "champion", created_at: "" },
  { id: "4", user_name: "bonusbeast", display_name: "BonusBeast", total_points: 1800, biggest_win: 4000, rank: "warrior", created_at: "" },
  { id: "5", user_name: "spin_soldier", display_name: "SpinSoldier", total_points: 900, biggest_win: 2100, rank: "warrior", created_at: "" },
  { id: "6", user_name: "lucky_legionnaire", display_name: "LuckyLegionnaire", total_points: 350, biggest_win: 800, rank: "recruit", created_at: "" },
  { id: "7", user_name: "gladiator_newb", display_name: "GladiatorNewb", total_points: 120, biggest_win: 300, rank: "recruit", created_at: "" },
  { id: "8", user_name: "coliseum_kid", display_name: "ColiseumKid", total_points: 80, biggest_win: 150, rank: "recruit", created_at: "" },
];

export function Leaderboard({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  return (
    <section id="leaderboard" className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        {!hideTitle && (
          <ScrollReveal>
            <SectionHeading
              title="Gladiator Ranks"
              subtitle="Rise through the ranks. Prove your worth in the arena."
            />
          </ScrollReveal>
        )}

        {/* Rank legend */}
        <ScrollReveal delay={0.1}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {RANKS.map((rank) => (
              <ArenaCard key={rank.key} className="p-3 text-center">
                <span className="text-2xl">{rank.icon}</span>
                <p
                  className="gladiator-label text-sm font-bold mt-1"
                  style={{ color: rank.color }}
                >
                  {rank.label}
                </p>
                <p className="text-xs text-arena-ash mt-0.5">{rank.min}+ pts</p>
              </ArenaCard>
            ))}
          </div>
        </ScrollReveal>

        {/* Leaderboard table */}
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="space-y-3"
        >
          {MOCK_LEADERBOARD.map((entry, i) => {
            const rank = getRankForPoints(entry.total_points);
            const progress = getRankProgress(entry.total_points);
            const next = getNextRank(entry.total_points);

            return (
              <motion.div key={entry.id} variants={STAGGER_ITEM}>
                <ArenaCard
                  variant={i < 3 ? "gold" : "default"}
                  className="p-4 arena-shine"
                >
                  <div className="flex items-center gap-4">
                    {/* Position */}
                    <div className="w-10 text-center">
                      <span
                        className={`gladiator-title text-xl ${
                          i === 0
                            ? "text-gold-gradient"
                            : i === 1
                            ? "text-arena-smoke"
                            : i === 2
                            ? "text-arena-bronze"
                            : "text-arena-ash"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </div>

                    {/* Rank icon + name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{rank.icon}</span>
                        <span className="font-bold text-arena-white truncate">
                          {entry.display_name}
                        </span>
                        <span
                          className="gladiator-label text-xs px-2 py-0.5"
                          style={{
                            color: rank.color,
                            backgroundColor: `${rank.color}15`,
                            border: `1px solid ${rank.color}30`,
                          }}
                        >
                          {rank.label}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-arena-iron overflow-hidden">
                          <motion.div
                            className="h-full progress-gold-fill"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${progress}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, delay: i * 0.1, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-xs text-arena-ash whitespace-nowrap">
                          {next ? `${Math.round(progress)}% → ${next.label}` : "MAX"}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-arena-ash">Points</p>
                        <p className="font-bold text-arena-white">
                          {entry.total_points.toLocaleString("en-US")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-arena-ash">Biggest Win</p>
                        <p className="font-bold text-arena-gold">
                          €{entry.biggest_win.toLocaleString("en-US")}
                        </p>
                      </div>
                    </div>
                  </div>
                </ArenaCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
