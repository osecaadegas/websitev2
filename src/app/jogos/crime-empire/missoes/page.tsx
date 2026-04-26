"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";

/* ─── Types ───────────────────────────────────────────────── */

interface MissionDefinition {
  id: string;
  name: string;
  description: string | null;
  category: string;
  system: string;
  difficulty: "easy" | "medium" | "hard";
  base_target: number;
  event_trigger: string;
  xp_reward: number;
  cash_reward: number;
}

interface PlayerMission {
  id: string;
  mission_id: string;
  type: "daily" | "weekly";
  progress: number;
  bonus_progress: number;
  status: "active" | "completed" | "claimed";
  completed_at: string | null;
  claimed_at: string | null;
  xp_awarded: number;
  cash_awarded: number;
  definition: MissionDefinition;
}

interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  streak_shields: number;
  gained?: boolean;
}

/* ─── Helpers ─────────────────────────────────────────────── */

const DIFF_STYLE: Record<string, { label: string; color: string; border: string }> = {
  easy:   { label: "FÁCIL",  color: "#22c55e", border: "rgba(34,197,94,0.3)" },
  medium: { label: "MÉDIO",  color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  hard:   { label: "DIFÍCIL",color: "#ef4444", border: "rgba(239,68,68,0.3)" },
};

const SYSTEM_ICON: Record<string, string> = {
  drugs: "🌿", businesses: "🏢", contracts: "🎯", pvp: "⚔️",
  casino: "🎰", stocks: "📈", mixed: "⚡",
};

function progressPct(progress: number, target: number): number {
  return Math.min(100, Math.round((progress / Math.max(1, target)) * 100));
}

function progressColor(pct: number): string {
  if (pct >= 100) return "#22c55e";
  if (pct >= 80)  return "#f59e0b";
  return "#3b82f6";
}

/* ─── MissionCard ─────────────────────────────────────────── */

function MissionCard({
  mission,
  onClaim,
  claiming,
}: {
  mission: PlayerMission;
  onClaim: (id: string) => void;
  claiming: string | null;
}) {
  const def   = mission.definition;
  const diff  = DIFF_STYLE[def.difficulty] ?? DIFF_STYLE.easy;
  const icon  = SYSTEM_ICON[def.system] ?? "🎮";
  const pct   = progressPct(mission.progress, def.base_target);
  const barColor = progressColor(pct);
  const isClaimed   = mission.status === "claimed";
  const isCompleted = mission.status === "completed";
  const isActive    = mission.status === "active";
  const isClaiming  = claiming === mission.id;

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: isClaimed
          ? "rgba(15,20,10,0.85)"
          : "rgba(12,10,6,0.92)",
        border: isCompleted
          ? "1px solid rgba(34,197,94,0.5)"
          : isClaimed
          ? "1px solid rgba(80,80,80,0.3)"
          : `1px solid ${diff.border}`,
        opacity: isClaimed ? 0.6 : 1,
        boxShadow: isCompleted ? "0 0 16px rgba(34,197,94,0.15)" : "none",
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span
            className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded"
            style={{ color: diff.color, background: `${diff.color}18` }}
          >
            {diff.label}
          </span>
        </div>
        {isClaimed && (
          <span className="text-[10px] font-bold tracking-widest text-emerald-500/60">RECLAMADO</span>
        )}
        {isCompleted && (
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 animate-pulse">CONCLUÍDO ✓</span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <h3
          className="text-sm font-bold mb-0.5"
          style={{ color: isClaimed ? "#666" : "#e8c97a", fontFamily: "Georgia, serif" }}
        >
          {def.name}
        </h3>
        <p className="text-[11px] mb-3" style={{ color: "rgba(200,160,80,0.6)" }}>
          {def.description}
        </p>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px]" style={{ color: "rgba(200,160,80,0.5)" }}>PROGRESSO</span>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: isClaimed ? "#555" : barColor }}
            >
              {mission.progress} / {def.base_target}
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: isClaimed
                  ? "rgba(80,80,80,0.4)"
                  : `linear-gradient(90deg, ${barColor}88, ${barColor})`,
              }}
            />
          </div>
        </div>

        {/* Rewards */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <span className="text-[10px]" style={{ color: "rgba(200,160,80,0.6)" }}>
              🟡 <span className="text-amber-400/90 font-semibold">+{def.xp_reward} XP</span>
            </span>
            <span className="text-[10px]" style={{ color: "rgba(200,160,80,0.6)" }}>
              💵 <span className="text-green-400/90 font-semibold">${def.cash_reward.toLocaleString()}</span>
            </span>
          </div>

          {/* Claim button */}
          {isCompleted && (
            <button
              onClick={() => onClaim(mission.id)}
              disabled={isClaiming}
              className="px-3 py-1 rounded-lg text-[11px] font-bold tracking-wider transition-all"
              style={{
                background: isClaiming
                  ? "rgba(34,197,94,0.3)"
                  : "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "#fff",
                border: "1px solid rgba(34,197,94,0.5)",
                cursor: isClaiming ? "not-allowed" : "pointer",
              }}
            >
              {isClaiming ? "..." : "RECLAMAR"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── StreakBadge ─────────────────────────────────────────── */

function StreakBadge({ streak }: { streak: StreakInfo }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "rgba(12,10,6,0.92)",
        border: "1px solid rgba(255,106,0,0.25)",
      }}
    >
      <div className="text-3xl">🔥</div>
      <div>
        <div className="text-xs font-bold tracking-widest" style={{ color: "rgba(200,120,40,0.7)" }}>
          STREAK DE LOGIN
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-2xl font-black" style={{ color: "#ff9500" }}>
            {streak.current_streak}
          </span>
          <span className="text-xs" style={{ color: "rgba(200,160,80,0.5)" }}>dias consecutivos</span>
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: "rgba(200,160,80,0.4)" }}>
          Máximo: {streak.longest_streak} dias
          {streak.streak_shields > 0 && (
            <span className="ml-2">🛡️ {streak.streak_shields} escudo{streak.streak_shields !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */

export default function MissoesPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [daily,   setDaily]   = useState<PlayerMission[]>([]);
  const [weekly,  setWeekly]  = useState<PlayerMission[]>([]);
  const [streak,  setStreak]  = useState<StreakInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/crime-empire/missions");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) { router.push("/jogos/crime-empire"); return; }
        showToast(data.error ?? "Erro ao carregar missões", false);
        return;
      }
      setDaily(data.daily  ?? []);
      setWeekly(data.weekly ?? []);
      setStreak(data.streak ?? null);
    } catch {
      showToast("Erro de ligação", false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!user) { router.push("/jogos/crime-empire"); return; }
    fetchMissions();
  }, [user, fetchMissions, router]);

  const handleClaim = async (missionId: string) => {
    setClaiming(missionId);
    try {
      const res  = await fetch("/api/crime-empire/missions/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Erro ao reclamar recompensa", false);
        return;
      }
      showToast(`+${data.xp_earned} XP e $${data.cash_earned?.toLocaleString()} ganhos!`, true);
      // Refresh missions list
      await fetchMissions();
    } catch {
      showToast("Erro de ligação", false);
    } finally {
      setClaiming(null);
    }
  };

  const noiseSvg = "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E";

  const dailyCompleted  = daily.filter((m) => m.status !== "active").length;
  const weeklyCompleted = weekly.filter((m) => m.status !== "active").length;

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "linear-gradient(180deg, #0a0805 0%, #06040a 100%)" }}
    >
      {/* Noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{ backgroundImage: `url("${noiseSvg}")`, backgroundSize: "256px" }}
      />

      {/* Header */}
      <div
        className="relative z-10 border-b"
        style={{
          background: "linear-gradient(135deg, rgba(20,12,4,0.98), rgba(10,6,2,0.98))",
          borderColor: "rgba(255,106,0,0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">📋</span>
            <h1
              className="text-2xl font-black tracking-widest uppercase"
              style={{ color: "#e8c97a", fontFamily: "Georgia, serif" }}
            >
              Missões
            </h1>
          </div>
          <p className="text-xs tracking-wider" style={{ color: "rgba(200,160,80,0.5)" }}>
            Completa missões diárias e semanais para ganhar XP e dinheiro
          </p>
        </div>
      </div>

      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "rgba(255,106,0,0.4)", borderTopColor: "transparent" }}
            />
          </div>
        ) : (
          <>
            {/* Streak */}
            {streak && <StreakBadge streak={streak} />}

            {/* Daily Missions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-1 h-6 rounded-full"
                    style={{ background: "linear-gradient(180deg, #ff6a00, #ff9500)" }}
                  />
                  <h2
                    className="text-base font-black tracking-widest uppercase"
                    style={{ color: "#e8c97a", fontFamily: "Georgia, serif" }}
                  >
                    Missões Diárias
                  </h2>
                </div>
                <span
                  className="text-xs font-bold px-2 py-1 rounded"
                  style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
                >
                  {dailyCompleted}/{daily.length}
                </span>
              </div>

              {daily.length === 0 ? (
                <div
                  className="text-center py-10 rounded-xl"
                  style={{ background: "rgba(12,10,6,0.6)", border: "1px solid rgba(255,106,0,0.1)" }}
                >
                  <p className="text-sm" style={{ color: "rgba(200,160,80,0.4)" }}>
                    Sem missões diárias atribuídas. Actualiza a página.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {daily.map((m) => (
                    <MissionCard
                      key={m.id}
                      mission={m}
                      onClaim={handleClaim}
                      claiming={claiming}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Weekly Missions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-1 h-6 rounded-full"
                    style={{ background: "linear-gradient(180deg, #7c3aed, #a855f7)" }}
                  />
                  <h2
                    className="text-base font-black tracking-widest uppercase"
                    style={{ color: "#e8c97a", fontFamily: "Georgia, serif" }}
                  >
                    Missões Semanais
                  </h2>
                </div>
                <span
                  className="text-xs font-bold px-2 py-1 rounded"
                  style={{ color: "#a855f7", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
                >
                  {weeklyCompleted}/{weekly.length}
                </span>
              </div>

              {weekly.length === 0 ? (
                <div
                  className="text-center py-10 rounded-xl"
                  style={{ background: "rgba(12,10,6,0.6)", border: "1px solid rgba(168,85,247,0.1)" }}
                >
                  <p className="text-sm" style={{ color: "rgba(200,160,80,0.4)" }}>
                    Sem missões semanais atribuídas. Actualiza a página.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {weekly.map((m) => (
                    <MissionCard
                      key={m.id}
                      mission={m}
                      onClaim={handleClaim}
                      claiming={claiming}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
