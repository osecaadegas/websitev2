"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";

/* ─── Types ────────────────────────────────────────────────── */

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
  crypto_reward: number;
}

interface PlayerMission {
  id: string;
  mission_id: string;
  type: "daily" | "weekly" | "monthly";
  progress: number;
  bonus_progress: number;
  status: "active" | "completed" | "claimed";
  completed_at: string | null;
  claimed_at: string | null;
  xp_awarded: number;
  cash_awarded: number;
  crypto_awarded: number;
  definition: MissionDefinition;
}

interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  streak_shields: number;
  gained?: boolean;
}

type TabType = "daily" | "weekly" | "monthly";

/* ─── Constants ─────────────────────────────────────────────── */

const SYSTEM_ICON: Record<string, string> = {
  drugs: "🌿", businesses: "🏢", contracts: "🎯", pvp: "⚔️",
  casino: "🎰", stocks: "📈", mixed: "⚡",
};

const DIFF: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: "SEGURO",    color: "#4ade80", bg: "rgba(74,222,128,0.1)"  },
  medium: { label: "EXPOSTO",   color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  hard:   { label: "PROCURADO", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
};

const TAB: Record<TabType, { label: string; color: string; dim: string; accent: string; border: string }> = {
  daily:   { label: "DIÁRIAS",  color: "#ff6a00", dim: "rgba(255,106,0,0.5)",   accent: "rgba(255,106,0,0.1)",   border: "rgba(255,106,0,0.22)"   },
  weekly:  { label: "SEMANAIS", color: "#22c55e", dim: "rgba(34,197,94,0.5)",   accent: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.22)"   },
  monthly: { label: "MENSAIS",  color: "#fbbf24", dim: "rgba(251,191,36,0.5)",  accent: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"   },
};

function pct(progress: number, target: number) {
  return Math.min(100, Math.round((progress / Math.max(1, target)) * 100));
}

function nextMonthLabel(): string {
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const d = new Date();
  return `1 de ${months[(d.getMonth() + 1) % 12]}`;
}

/* ─── StreakMeter ───────────────────────────────────────────── */

function StreakMeter({ streak }: { streak: StreakInfo }) {
  const n = streak.current_streak;
  const fireColor = n >= 30 ? "#ff2200" : n >= 14 ? "#ff5500" : n >= 7 ? "#ff8c00" : n >= 3 ? "#ffa500" : "#ffc200";
  const filledSegments = Math.ceil(Math.min(n, 30) / 3);

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-2xl"
      style={{
        background: "linear-gradient(135deg, rgba(18,10,4,0.98), rgba(12,8,3,0.96))",
        border: `1px solid ${fireColor}28`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 24px ${fireColor}0a`,
      }}
    >
      <div className="relative flex-shrink-0">
        <span className="text-4xl" style={{ filter: `drop-shadow(0 0 10px ${fireColor}cc)` }}>🔥</span>
        {n >= 7 && (
          <span
            className="absolute -bottom-0.5 -right-1 text-[8px] font-black px-1 rounded-full leading-tight"
            style={{ background: fireColor, color: "#000" }}
          >
            {n}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[9px] font-black tracking-[0.25em]" style={{ color: `${fireColor}66` }}>
            STREAK DE LOGIN
          </span>
          <div className="flex items-center gap-2">
            {streak.streak_shields > 0 && (
              <span className="text-[9px] font-bold" style={{ color: "rgba(148,163,184,0.6)" }}>
                🛡️ ×{streak.streak_shields}
              </span>
            )}
            <span className="text-sm font-black tabular-nums" style={{ color: fireColor }}>
              {n} <span className="text-[9px] font-normal" style={{ color: `${fireColor}66` }}>dias</span>
            </span>
          </div>
        </div>

        <div className="flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full"
              style={{
                background: i < filledSegments
                  ? `linear-gradient(90deg, ${fireColor}88, ${fireColor})`
                  : "rgba(255,255,255,0.05)",
                boxShadow: i < filledSegments ? `0 0 4px ${fireColor}70` : "none",
                transition: "all 0.4s ease",
              }}
            />
          ))}
        </div>

        <div className="text-[9px] mt-1.5" style={{ color: "rgba(140,110,50,0.4)" }}>
          Recorde: {streak.longest_streak} dias consecutivos
        </div>
      </div>
    </div>
  );
}

/* ─── PriorityRail ──────────────────────────────────────────── */

function PriorityRail({
  missions,
  onClaim,
  claiming,
}: {
  missions: PlayerMission[];
  onClaim: (id: string) => void;
  claiming: string | null;
}) {
  const urgent = missions.filter(
    (m) => m.status === "completed" || (m.status === "active" && pct(m.progress, m.definition.base_target) >= 75)
  );

  if (urgent.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "#ef4444", boxShadow: "0 0 6px #ef4444" }}
        />
        <span className="text-[9px] font-black tracking-[0.3em]" style={{ color: "rgba(239,68,68,0.55)" }}>
          INTEL URGENTE
        </span>
        <span
          className="text-[9px] font-black px-1.5 rounded-full"
          style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          {urgent.length}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {urgent.map((m) => {
          const p = pct(m.progress, m.definition.base_target);
          const done = m.status === "completed";
          const t = TAB[m.type];

          return (
            <div
              key={m.id}
              className="flex-shrink-0 w-60 rounded-xl overflow-hidden"
              style={{
                background: "rgba(10,6,2,0.97)",
                border: done ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(239,68,68,0.3)",
                boxShadow: done ? "0 0 16px rgba(34,197,94,0.08)" : "0 0 14px rgba(239,68,68,0.07)",
              }}
            >
              <div
                className="px-3 py-1.5 flex items-center justify-between"
                style={{ background: done ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.05)" }}
              >
                <span className="text-[9px] font-black tracking-widest" style={{ color: done ? "#4ade80" : "#f87171" }}>
                  {done ? "✓ PRONTO PARA LEVANTAR" : `⚡ ${p}%`}
                </span>
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded"
                  style={{ color: t.color, background: t.accent }}
                >
                  {t.label}
                </span>
              </div>

              <div className="px-3 pt-2 pb-3">
                <div className="text-xs font-black mb-1.5" style={{ color: "#ddc870", fontFamily: "Georgia, serif" }}>
                  {SYSTEM_ICON[m.definition.system] ?? "💀"} {m.definition.name}
                </div>

                {!done && (
                  <div
                    className="relative h-1 rounded-full overflow-hidden mb-2.5"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{
                        width: `${p}%`,
                        background: "linear-gradient(90deg, #dc262670, #ef4444)",
                        boxShadow: "0 0 6px rgba(239,68,68,0.5)",
                      }}
                    />
                  </div>
                )}

                {done && (
                  <button
                    onClick={() => onClaim(m.id)}
                    disabled={claiming === m.id}
                    className="w-full py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all active:scale-95"
                    style={{
                      background: claiming === m.id
                        ? "rgba(34,197,94,0.2)"
                        : "linear-gradient(135deg, #15803d, #22c55e)",
                      color: "#fff",
                      border: "1px solid rgba(34,197,94,0.3)",
                      boxShadow: "0 0 10px rgba(34,197,94,0.2)",
                    }}
                  >
                    {claiming === m.id ? "..." : "LEVANTAR"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── TabBar ────────────────────────────────────────────────── */

function TabBar({
  active, onChange, counts,
}: {
  active: TabType;
  onChange: (t: TabType) => void;
  counts: Record<TabType, { done: number; total: number }>;
}) {
  const keys: TabType[] = ["daily", "weekly", "monthly"];

  return (
    <div
      className="flex gap-1 p-1 rounded-xl"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {keys.map((key) => {
        const t = TAB[key];
        const { done, total } = counts[key];
        const isActive = active === key;
        const allDone = total > 0 && done === total;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg transition-all duration-200"
            style={{
              background: isActive ? t.accent : "transparent",
              border: isActive ? `1px solid ${t.border}` : "1px solid transparent",
              color: isActive ? t.color : "rgba(140,110,50,0.35)",
            }}
          >
            <span className="text-[10px] font-black tracking-[0.12em]">{t.label}</span>
            {total > 0 && (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full leading-tight"
                style={{
                  background: allDone
                    ? "rgba(34,197,94,0.2)"
                    : isActive ? `${t.color}18` : "rgba(255,255,255,0.04)",
                  color: allDone ? "#4ade80" : isActive ? t.color : "rgba(140,110,50,0.35)",
                  border: allDone ? "1px solid rgba(34,197,94,0.25)" : "none",
                }}
              >
                {done}/{total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── MissionRow ────────────────────────────────────────────── */

function MissionRow({
  mission, tabType, onClaim, claiming,
}: {
  mission: PlayerMission;
  tabType: TabType;
  onClaim: (id: string) => void;
  claiming: string | null;
}) {
  const def       = mission.definition;
  const diff      = DIFF[def.difficulty] ?? DIFF.easy;
  const icon      = SYSTEM_ICON[def.system] ?? "💀";
  const p         = pct(mission.progress, def.base_target);
  const t         = TAB[tabType];
  const isClaimed   = mission.status === "claimed";
  const isCompleted = mission.status === "completed";
  const isNear      = !isClaimed && !isCompleted && p >= 75;
  const isMonthly   = tabType === "monthly";
  const isClaiming  = claiming === mission.id;

  const borderColor = isCompleted
    ? "rgba(34,197,94,0.4)"
    : isNear
    ? "rgba(239,68,68,0.35)"
    : isMonthly
    ? "rgba(251,191,36,0.15)"
    : "rgba(255,255,255,0.05)";

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: isClaimed
          ? "rgba(7,5,3,0.7)"
          : isMonthly
          ? "linear-gradient(150deg, rgba(15,10,3,0.97), rgba(10,8,3,0.96))"
          : "rgba(11,7,3,0.96)",
        border: `1px solid ${borderColor}`,
        opacity: isClaimed ? 0.4 : 1,
        boxShadow: isCompleted
          ? "0 0 20px rgba(34,197,94,0.07), inset 0 1px 0 rgba(34,197,94,0.05)"
          : isNear
          ? "0 0 20px rgba(239,68,68,0.06)"
          : "none",
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{
          background: isClaimed
            ? "#1a1a1a"
            : isCompleted
            ? "#22c55e"
            : isNear
            ? "#ef4444"
            : t.color,
          boxShadow: isCompleted
            ? "0 0 8px rgba(34,197,94,0.6)"
            : isNear
            ? "0 0 8px rgba(239,68,68,0.5)"
            : `0 0 6px ${t.color}50`,
        }}
      />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg mt-0.5"
            style={{
              background: isClaimed ? "rgba(30,25,20,0.4)" : `${t.color}10`,
              border: `1px solid ${isClaimed ? "rgba(50,40,30,0.2)" : `${t.color}1a`}`,
            }}
          >
            {icon}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-sm font-black leading-tight"
                  style={{
                    color: isClaimed ? "#1e1510" : isMonthly ? "#fbbf24" : "#ddc870",
                    fontFamily: "Georgia, serif",
                  }}
                >
                  {def.name}
                </span>
                {isMonthly && !isClaimed && (
                  <span
                    className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded"
                    style={{ color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}
                  >
                    ELITE
                  </span>
                )}
                {isNear && (
                  <span
                    className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded animate-pulse"
                    style={{ color: "#fca5a5", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                  >
                    ALVO PRÓXIMO
                  </span>
                )}
                {isCompleted && (
                  <span
                    className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded"
                    style={{ color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
                  >
                    CONCLUÍDO ✓
                  </span>
                )}
              </div>

              {/* Difficulty */}
              <span
                className="flex-shrink-0 text-[8px] font-black tracking-widest px-2 py-1 rounded"
                style={{
                  color: isClaimed ? "#1e1510" : diff.color,
                  background: isClaimed ? "transparent" : diff.bg,
                  border: isClaimed ? "none" : `1px solid ${diff.color}28`,
                }}
              >
                {diff.label}
              </span>
            </div>

            {/* Description */}
            <p
              className="text-[11px] mb-3 leading-relaxed"
              style={{ color: isClaimed ? "#1a1208" : "rgba(175,135,55,0.5)" }}
            >
              {def.description}
            </p>

            {/* Progress */}
            {!isClaimed && (
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[9px] font-black tracking-[0.2em]" style={{ color: "rgba(140,105,40,0.35)" }}>
                    PROGRESSO
                  </span>
                  <span
                    className="text-[11px] font-black tabular-nums"
                    style={{ color: isCompleted ? "#4ade80" : isNear ? "#f87171" : "rgba(200,155,60,0.65)" }}
                  >
                    {mission.progress}
                    <span style={{ color: "rgba(120,90,35,0.3)" }}> / </span>
                    {def.base_target}
                  </span>
                </div>
                <div
                  className="relative h-[5px] rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${p}%`,
                      background: isCompleted
                        ? "linear-gradient(90deg, #16a34a, #4ade80)"
                        : isNear
                        ? "linear-gradient(90deg, #b91c1c80, #ef4444)"
                        : `linear-gradient(90deg, ${t.color}55, ${t.color})`,
                      boxShadow: isCompleted
                        ? "0 0 8px rgba(34,197,94,0.55)"
                        : isNear
                        ? "0 0 8px rgba(239,68,68,0.45)"
                        : `0 0 5px ${t.color}55`,
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Rewards + claim */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px]" style={{ color: isClaimed ? "#1a1208" : "rgba(175,135,55,0.45)" }}>
                  🟡{" "}
                  <span style={{ color: isClaimed ? "#1a1208" : "#fbbf24", fontWeight: 700 }}>
                    +{def.xp_reward} XP
                  </span>
                </span>
                <span className="text-[10px]" style={{ color: isClaimed ? "#1a1208" : "rgba(175,135,55,0.45)" }}>
                  💵{" "}
                  <span style={{ color: isClaimed ? "#1a1208" : "#4ade80", fontWeight: 700 }}>
                    ${def.cash_reward.toLocaleString()}
                  </span>
                </span>
                {def.crypto_reward > 0 && (
                  <span className="text-[10px]">
                    💎{" "}
                    <span style={{ color: isClaimed ? "#1a1208" : "#22d3ee", fontWeight: 700 }}>
                      +{def.crypto_reward}
                    </span>
                  </span>
                )}
              </div>

              {isClaimed && (
                <span className="text-[9px] font-black tracking-widest" style={{ color: "#1a1208" }}>
                  ENCERRADO
                </span>
              )}

              {isCompleted && (
                <button
                  onClick={() => onClaim(mission.id)}
                  disabled={isClaiming}
                  className="px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all duration-150 active:scale-95"
                  style={{
                    background: isClaiming
                      ? "rgba(34,197,94,0.18)"
                      : "linear-gradient(135deg, #15803d, #22c55e)",
                    color: "#fff",
                    border: "1px solid rgba(34,197,94,0.35)",
                    boxShadow: isClaiming ? "none" : "0 0 12px rgba(34,197,94,0.25)",
                    cursor: isClaiming ? "not-allowed" : "pointer",
                  }}
                >
                  {isClaiming ? "..." : "LEVANTAR"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Claimed watermark */}
      {isClaimed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="text-[9px] font-black tracking-[0.45em] px-4 py-1 rounded border"
            style={{
              color: "rgba(40,28,10,0.55)",
              borderColor: "rgba(40,28,10,0.18)",
              transform: "rotate(-18deg)",
            }}
          >
            ENCERRADO
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */

export default function MissoesPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [daily,     setDaily]    = useState<PlayerMission[]>([]);
  const [weekly,    setWeekly]   = useState<PlayerMission[]>([]);
  const [monthly,   setMonthly]  = useState<PlayerMission[]>([]);
  const [streak,    setStreak]   = useState<StreakInfo | null>(null);
  const [loading,   setLoading]  = useState(true);
  const [toast,     setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [claiming,  setClaiming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("daily");

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
      setDaily(data.daily    ?? []);
      setWeekly(data.weekly  ?? []);
      setMonthly(data.monthly ?? []);
      setStreak(data.streak  ?? null);
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
        showToast(data.error ?? "Erro ao reclamar", false);
        return;
      }
      const parts = [`+${data.xp_earned} XP`, `$${data.cash_earned?.toLocaleString()}`];
      if (data.crypto_earned > 0) parts.push(`💎 +${data.crypto_earned} crypto`);
      showToast(parts.join("  •  "), true);
      await fetchMissions();
    } catch {
      showToast("Erro de ligação", false);
    } finally {
      setClaiming(null);
    }
  };

  const allMissions = [...daily, ...weekly, ...monthly];
  const tabMissions: Record<TabType, PlayerMission[]> = { daily, weekly, monthly };
  const counts: Record<TabType, { done: number; total: number }> = {
    daily:   { done: daily.filter((m)   => m.status !== "active").length, total: daily.length },
    weekly:  { done: weekly.filter((m)  => m.status !== "active").length, total: weekly.length },
    monthly: { done: monthly.filter((m) => m.status !== "active").length, total: monthly.length },
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0804" }}>
      <div className="ce-noise" />
      {/* Header */}
      <div className="relative z-10 border-b" style={{ borderColor: "rgba(180,130,40,0.08)", background: "linear-gradient(180deg, rgba(14,8,4,0.99), rgba(9,5,2,0.97))" }}>
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="ce-page-header mb-0">
            <p className="ce-page-eyebrow">Crime Empire</p>
            <h1 className="ce-page-title">CENTRO DE <span className="ce-page-title-accent">OPERAÇÕES</span></h1>
            <div className="ce-page-divider" style={{ background: "linear-gradient(90deg, rgba(255,106,0,0.4), rgba(255,106,0,0.1), transparent)" }} />
          </div>
        </div>
      </div>

      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-5 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(249,115,22,0.3)", borderTopColor: "#ff6a00" }} />
            <span className="ce-page-eyebrow">A CARREGAR INTEL...</span>
          </div>
        ) : (
          <>
            {/* Streak */}
            {streak && <StreakMeter streak={streak} />}

            {/* Priority rail — near-complete and completed missions float here */}
            <PriorityRail missions={allMissions} onClaim={handleClaim} claiming={claiming} />

            {/* Tabs */}
            <TabBar active={activeTab} onChange={setActiveTab} counts={counts} />

            {/* Monthly reset info */}
            {activeTab === "monthly" && monthly.length > 0 && (
              <div className="ce-card ce-card--metal-gold flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ borderColor: "rgba(251,191,36,0.15)" }}>
                <span className="text-base flex-shrink-0">👑</span>
                <span className="text-[10px] leading-relaxed ce-text-muted">
                  Missões de elite. Repõem a{" "}
                  <strong className="ce-text-gold">{nextMonthLabel()}</strong>.{" "}
                  Recompensas incluem{" "}
                  <strong style={{ color: "rgba(34,211,238,0.85)" }}>💎 crypto</strong>.
                </span>
              </div>
            )}

            {/* Mission list */}
            {tabMissions[activeTab].length === 0 ? (
              <div className="ce-card flex flex-col items-center justify-center py-20 rounded-xl">
                <span className="text-4xl mb-3" style={{ opacity: 0.12 }}>📭</span>
                <p className="ce-page-eyebrow mb-4">SEM MISSÕES ATRIBUÍDAS</p>
                <button onClick={fetchMissions} className="ce-btn ce-btn-ghost text-[9px] tracking-[0.2em] px-4 py-2">
                  ACTUALIZAR
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tabMissions[activeTab].map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    tabType={activeTab}
                    onClaim={handleClaim}
                    claiming={claiming}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
