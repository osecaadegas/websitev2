"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";

/* ────────────────────────────── TYPES ─────────────────────────────── */
interface Contract {
  id: string;
  name: string;
  description: string;
  roadmap_level: number;
  difficulty: "easy" | "medium" | "hard";
  required_level: number;
  stamina_cost: number;
  base_success_rate: number;
  hitman_bonus: number;
  arrest_chance: number;
  hitman_arrest_reduction: number;
  min_cash: number;
  max_cash: number;
  respect_reward: number;
  enabled: boolean;
}

interface PlayerContract {
  id: string;
  contract_id: string;
  status: "completed" | "failed" | "pending";
  cash_reward: number;
  respect_reward: number;
}

interface Player {
  id: string;
  level: number;
  cash: number;
  dirty_cash: number;
  hp: number;
  max_hp: number;
  stamina: number;
  max_stamina: number;
  class: string;
  addiction: number;
  in_jail: boolean;
}

/* ────────────────────────────── CONFIG ─────────────────────────────── */
const DIFF: Record<string, { label: string; color: string; bg: string; riskMod: number }> = {
  easy:   { label: "FACIL",   color: "#22c55e", bg: "#22c55e18", riskMod: 0.7  },
  medium: { label: "MEDIO",   color: "#f59e0b", bg: "#f59e0b18", riskMod: 1.0  },
  hard:   { label: "DIFICIL", color: "#ef4444", bg: "#ef444418", riskMod: 1.35 },
};

/* ────────────────────────────── STAT BAR ────────────────────────────── */
function StatBar({ pct, color }: { pct: number; color: string }) {
  const blocks = 10;
  const filled = Math.round((pct / 100) * blocks);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: blocks }).map((_, i) => (
        <div
          key={i}
          className="h-2 w-4 rounded-sm flex-shrink-0 transition-all duration-500"
          style={{ background: i < filled ? color : "#1e1e1e" }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────── PLAYER HUD ─────────────────────────── */
function PlayerHUD({ player, isHitman }: { player: Player; isHitman: boolean }) {
  const stPct = Math.max(0, Math.min(100, (player.stamina / player.max_stamina) * 100));
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100));
  return (
    <div className="flex items-center gap-5 flex-wrap border-b border-[#161616] pb-4 mb-5">
      <div className="flex items-center gap-2">
        <span className="text-[8px] uppercase tracking-[0.3em] text-[#3a3a3a]">NIV</span>
        <span className="text-sm font-black text-white bg-[#181818] border border-[#222] rounded px-3 py-1 tabular-nums">
          {player.level}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#3a3a3a]">STAMINA</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: stPct > 40 ? "#f59e0b" : "#ef4444" }}>
            {player.stamina}/{player.max_stamina}
          </span>
        </div>
        <div className="h-1 rounded-full bg-[#181818] overflow-hidden w-28">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${stPct}%`, background: stPct > 50 ? "#f59e0b" : stPct > 20 ? "#f97316" : "#ef4444" }} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#3a3a3a]">HP</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: hpPct > 40 ? "#22c55e" : "#ef4444" }}>
            {player.hp}/{player.max_hp}
          </span>
        </div>
        <div className="h-1 rounded-full bg-[#181818] overflow-hidden w-24">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${hpPct}%`, background: hpPct > 50 ? "#22c55e" : hpPct > 20 ? "#f97316" : "#ef4444" }} />
        </div>
      </div>
      {isHitman && (
        <span className="text-[8px] font-black tracking-[0.2em] text-red-400 bg-red-900/20 border border-red-800/40 rounded px-2.5 py-1 uppercase">
          HITMAN +
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────── CONTRACT LIST ITEM ─────────────────── */
interface ListItemProps {
  contract: Contract;
  status: "completed" | "failed" | "pending" | null;
  selected: boolean;
  levelUnlocked: boolean;
  isHitman: boolean;
  onClick: () => void;
}

function ContractListItem({ contract, status, selected, levelUnlocked, isHitman, onClick }: ListItemProps) {
  const diff = DIFF[contract.difficulty] ?? DIFF.medium;
  const isCompleted = status === "completed";
  const isFailed    = status === "failed";
  const locked      = !levelUnlocked;
  const displayRate = isHitman
    ? Math.min(95, Math.round((contract.base_success_rate + contract.hitman_bonus) * 100))
    : Math.round(contract.base_success_rate * 100);

  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={[
        "w-full text-left px-3 py-2.5 rounded-lg border flex items-center gap-3 transition-all duration-150",
        selected
          ? "bg-[#1a1200] border-orange-700/60 shadow-md shadow-orange-950/40"
          : isCompleted
          ? "bg-[#060f06] border-green-900/30 opacity-70 hover:opacity-90"
          : isFailed
          ? "bg-[#0f0505] border-red-900/20 opacity-60 hover:opacity-80"
          : locked
          ? "bg-[#0c0c0c] border-[#141414] opacity-25 cursor-not-allowed"
          : "bg-[#0e0e0e] border-[#1a1a1a] hover:border-[#252525] hover:bg-[#111]",
      ].join(" ")}
    >
      {/* Status dot */}
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: isCompleted ? "#22c55e" : isFailed ? "#ef4444" : selected ? "#f97316" : "#2a2a2a" }} />

      {/* Name */}
      <span className={`text-[11px] font-bold flex-1 truncate ${
        isCompleted ? "text-green-500/70" : isFailed ? "text-red-500/60" : locked ? "text-[#2a2a2a]" : "text-[#ccc]"
      }`}>
        {locked ? "🔒 " : ""}{contract.name}
      </span>

      {/* Difficulty tag */}
      <span
        className="text-[7px] font-black tracking-[0.2em] px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ background: locked ? "#111" : diff.bg, color: locked ? "#333" : diff.color }}
      >
        {diff.label}
      </span>

      {/* Success % */}
      {!locked && (
        <span
          className="text-[9px] font-black tabular-nums flex-shrink-0 w-8 text-right"
          style={{ color: displayRate >= 60 ? "#22c55e" : displayRate >= 40 ? "#f59e0b" : "#ef4444" }}
        >
          {displayRate}%
        </span>
      )}
    </button>
  );
}

/* ────────────────────────────── CONTRACT BRIEFING ──────────────────── */
interface BriefingProps {
  contract: Contract;
  status: "completed" | "failed" | "pending" | null;
  player: Player | null;
  levelDone: boolean;
  levelUnlocked: boolean;
  isHitman: boolean;
  processing: boolean;
  onExecute: () => void;
}

function ContractBriefing({
  contract, status, player, levelDone, levelUnlocked, isHitman, processing, onExecute,
}: BriefingProps) {
  const diff = DIFF[contract.difficulty] ?? DIFF.medium;
  const isCompleted = status === "completed";
  const isFailed    = status === "failed";
  const locked      = !levelUnlocked;

  const displayRate = isHitman
    ? Math.min(95, Math.round((contract.base_success_rate + contract.hitman_bonus) * 100))
    : Math.round(contract.base_success_rate * 100);

  const baseArrest = contract.arrest_chance ?? 0.3;
  const arrestDisplay = isHitman
    ? Math.round(baseArrest * (1 - (contract.hitman_arrest_reduction ?? 0.5)) * 100)
    : Math.round(baseArrest * 100);

  const riskDisplay = Math.min(99, Math.round((1 - contract.base_success_rate) * (DIFF[contract.difficulty]?.riskMod ?? 1) * 100));

  const meetsLevel  = (player?.level  ?? 0) >= contract.required_level;
  const hasStamina  = (player?.stamina ?? 0) >= contract.stamina_cost;
  const inJail      = player?.in_jail ?? false;

  let disabledReason = "";
  if (locked)          disabledReason = "BLOQUEADO";
  else if (inJail)     disabledReason = "DETIDO";
  else if (isCompleted) disabledReason = "JA CONCLUIDO";
  else if (levelDone)  disabledReason = "NIVEL JA CONCLUIDO";
  else if (!meetsLevel) disabledReason = `NIVEL ${contract.required_level} NECESSARIO`;
  else if (!hasStamina) disabledReason = "STAMINA INSUFICIENTE";

  const canExecute = !disabledReason && !isCompleted && !isFailed;

  return (
    <div className="h-full flex flex-col">
      {/* ── TOP: classification bar ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-px w-6 bg-[#2a2a2a]" />
          <span className="text-[7px] uppercase tracking-[0.4em] text-[#2e2e2e]">DOSSIE CONFIDENCIAL</span>
          <div className="h-px w-6 bg-[#2a2a2a]" />
        </div>
        <span
          className="text-[8px] font-black tracking-[0.25em] px-2.5 py-1 rounded"
          style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.color}30` }}
        >
          {diff.label}
        </span>
      </div>

      {/* ── TARGET HEADER ── */}
      <div className="mb-5">
        <p className="text-[8px] uppercase tracking-[0.35em] text-[#2e2e2e] mb-1">ALVO DESIGNADO</p>
        <h2 className="text-3xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
          {contract.name}
        </h2>
        {(isCompleted || isFailed) && (
          <span className={`inline-block text-[8px] font-black tracking-[0.3em] px-3 py-1 rounded-full uppercase ${
            isCompleted ? "bg-green-900/30 text-green-400 border border-green-800/40" : "bg-red-900/30 text-red-400 border border-red-800/40"
          }`}>
            {isCompleted ? "MISSAO CUMPRIDA" : "MISSAO FALHADA"}
          </span>
        )}
      </div>

      {/* ── INTEL ── */}
      <div className="mb-5 border-l-2 border-[#1e1e1e] pl-4">
        <p className="text-[8px] uppercase tracking-[0.3em] text-[#333] mb-2">INTEL</p>
        <p className="text-[12px] text-[#555] leading-relaxed italic">
          {contract.description}
        </p>
      </div>

      <div className="border-t border-[#141414] mb-5" />

      {/* ── VISUAL STATS ── */}
      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-[80px] flex-shrink-0">
            <p className="text-[7px] uppercase tracking-[0.3em] text-[#2e2e2e] mb-1">SUCESSO</p>
            <p className="text-sm font-black tabular-nums" style={{ color: displayRate >= 60 ? "#22c55e" : displayRate >= 40 ? "#f59e0b" : "#ef4444" }}>
              {displayRate}%{isHitman ? " ✦" : ""}
            </p>
          </div>
          <div className="flex-1">
            <StatBar pct={displayRate} color={displayRate >= 60 ? "#22c55e" : displayRate >= 40 ? "#f59e0b" : "#ef4444"} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-[80px] flex-shrink-0">
            <p className="text-[7px] uppercase tracking-[0.3em] text-[#2e2e2e] mb-1">RISCO</p>
            <p className="text-sm font-black tabular-nums text-red-500">{riskDisplay}%</p>
          </div>
          <div className="flex-1">
            <StatBar pct={riskDisplay} color="#ef4444" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-[80px] flex-shrink-0">
            <p className="text-[7px] uppercase tracking-[0.3em] text-[#2e2e2e] mb-1">STAMINA</p>
            <p className="text-sm font-black tabular-nums text-[#888]">-{contract.stamina_cost}</p>
          </div>
          <div className="text-[10px] text-[#333]">
            {hasStamina ? (
              <span className="text-[#2e2e2e]">Disponivel</span>
            ) : (
              <span className="text-red-700">Stamina insuficiente</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#141414] mb-5" />

      {/* ── REWARDS ── */}
      <div className="mb-5">
        <p className="text-[8px] uppercase tracking-[0.3em] text-[#2e2e2e] mb-3">RECOMPENSA ESTIMADA</p>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-[8px] uppercase tracking-[0.2em] text-[#2a2a2a] mb-0.5">CASH</p>
            <p className="text-2xl font-black text-green-400 tabular-nums leading-none">
              ${contract.min_cash.toLocaleString("pt-PT")}
              <span className="text-sm text-[#333] font-normal"> - </span>
              ${contract.max_cash.toLocaleString("pt-PT")}
            </p>
          </div>
          <div className="pb-0.5">
            <p className="text-[8px] uppercase tracking-[0.2em] text-[#2a2a2a] mb-0.5">RESPEITO</p>
            <p className="text-xl font-black text-yellow-500 leading-none">+{contract.respect_reward}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-[#141414] mb-5" />

      {/* ── CONSEQUENCES ── */}
      <div className="mb-6">
        <p className="text-[8px] uppercase tracking-[0.3em] text-[#2e2e2e] mb-3">POSSIVEIS CONSEQUENCIAS</p>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-1 h-1 rounded-full bg-red-700 mt-1.5 flex-shrink-0" />
            <p className="text-[11px] text-[#444]">
              Em caso de falha, HP cai para 0 — serás enviado ao hospital.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-1 h-1 rounded-full bg-red-700 mt-1.5 flex-shrink-0" />
            <p className="text-[11px] text-[#444]">
              <span className="text-red-700 font-bold">{arrestDisplay}% de chance</span> de ser preso (30–90 min).
            </p>
          </div>
          {!meetsLevel && (
            <div className="flex items-start gap-3">
              <div className="w-1 h-1 rounded-full bg-red-700 mt-1.5 flex-shrink-0" />
              <p className="text-[11px] text-red-800">
                Requer nivel {contract.required_level} — o teu atual e insuficiente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── EXECUTE BUTTON ── */}
      <div className="mt-auto">
        {disabledReason ? (
          <div className="w-full py-3 rounded-xl text-center text-[9px] font-black tracking-[0.3em] uppercase text-[#2a2a2a] bg-[#0d0d0d] border border-[#161616]">
            {disabledReason}
          </div>
        ) : (
          <button
            onClick={onExecute}
            disabled={processing}
            className={[
              "w-full py-3.5 rounded-xl text-[10px] font-black tracking-[0.35em] uppercase transition-all duration-200",
              processing
                ? "bg-[#1a1a1a] text-[#444] cursor-wait"
                : "bg-gradient-to-r from-red-950 to-red-800 hover:from-red-900 hover:to-red-700 text-white active:scale-95 shadow-xl shadow-red-950/50",
            ].join(" ")}
          >
            {processing ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="w-3 h-3 border border-[#555] border-t-transparent rounded-full animate-spin" />
                EXECUTANDO
              </span>
            ) : (
              "EXECUTAR CONTRATO"
            )}
          </button>
        )}
        {!disabledReason && (
          <p className="text-center text-[8px] text-[#252525] mt-2 uppercase tracking-wider">
            Esta acao nao pode ser revertida
          </p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────── ROADMAP NODE ────────────────────────── */
function RoadmapNode({ level, completed, unlocked, active }: {
  level: number; completed: boolean; unlocked: boolean; active: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={[
        "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black border flex-shrink-0 transition-all duration-300",
        completed ? "bg-green-950 border-green-700 text-green-400" :
        active    ? "bg-[#1a0d00] border-orange-700 text-orange-400 ce-pulse-orange" :
        unlocked  ? "bg-[#111] border-[#222] text-[#444]" :
                    "bg-[#0c0c0c] border-[#161616] text-[#252525]",
      ].join(" ")}>
        {completed ? "✓" : unlocked || active ? level : "—"}
      </div>
      <span className={`text-[8px] uppercase tracking-[0.2em] font-bold ${
        completed ? "text-green-600" : active ? "text-orange-600" : "text-[#222]"
      }`}>
        CAP {level}
      </span>
    </div>
  );
}

/* ─────────────────────────── MAIN PAGE ───────────────────────────── */
export default function ContractsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [loading, setLoading]               = useState(true);
  const [contracts, setContracts]           = useState<Contract[]>([]);
  const [playerContracts, setPlayerContracts] = useState<PlayerContract[]>([]);
  const [player, setPlayer]                 = useState<Player | null>(null);
  const [processing, setProcessing]         = useState<string | null>(null);
  const [toast, setToast]                   = useState<{ msg: string; ok: boolean; details?: string } | null>(null);
  const [selected, setSelected]             = useState<string | null>(null);
  const [briefingKey, setBriefingKey]       = useState(0);

  const showToast = (msg: string, ok: boolean, details?: string) => {
    setToast({ msg, ok, details });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchData = useCallback(async () => {
    const res  = await fetch("/api/crime-empire/contracts");
    const data = await res.json();
    setContracts(data.contracts || []);
    setPlayerContracts(data.playerContracts || []);
    setPlayer(data.player || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  /* Auto-select first available contract */
  useEffect(() => {
    if (contracts.length && !selected) {
      const first = contracts.find((c) => {
        const st = playerContracts.find((pc) => pc.contract_id === c.id)?.status ?? null;
        return st !== "completed";
      });
      if (first) setSelected(first.id);
    }
  }, [contracts, playerContracts, selected]);

  const attemptContract = async (contractId: string) => {
    if (!player) return;
    setProcessing(contractId);
    try {
      const res  = await fetch("/api/crime-empire/contracts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
      } else {
        const ok      = data.success;
        const details = ok
          ? `+💵 $${data.cash_earned?.toLocaleString()} | +⭐ ${data.respect_earned} Respeito`
          : data.arrested ? "🚔 Preso!" : "";
        showToast(data.message, ok, details);
        await fetchData();
      }
    } finally {
      setProcessing(null);
    }
  };

  /* ── Derived helpers ── */
  const levels = Array.from(new Set(contracts.map((c) => c.roadmap_level))).sort((a, b) => a - b);

  const getStatus = (contractId: string) =>
    playerContracts.find((pc) => pc.contract_id === contractId)?.status ?? null;

  const levelCompleted = (level: number) =>
    contracts.filter((c) => c.roadmap_level === level).some((c) => getStatus(c.id) === "completed");

  const levelUnlocked = (level: number) => {
    if (level === levels[0]) return true;
    const prev = levels[levels.indexOf(level) - 1];
    return levelCompleted(prev);
  };

  const isHitman = player?.class === "hitman";

  const selectedContract = contracts.find((c) => c.id === selected) ?? null;
  const selectedLevel    = selectedContract?.roadmap_level ?? null;
  const selectedStatus   = selected ? getStatus(selected) : null;
  const selLevelDone     = selectedLevel !== null ? levelCompleted(selectedLevel) : false;
  const selLevelUnlocked = selectedLevel !== null ? levelUnlocked(selectedLevel) : false;

  /* ─ Loading ─ */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ background: "#0B0B0B" }}>
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border border-red-900/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-red-800/30 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center text-xl">🎯</div>
          </div>
          <p className="text-[8px] uppercase tracking-[0.4em] text-[#333]">A CARREGAR BRIEFING</p>
        </div>
      </div>
    );
  }

  /* ─ Main render ─ */
  return (
    <div className="flex-1 text-white min-h-screen" style={{ background: "#0B0B0B" }}>
      <style>{`
        @keyframes ceShake {
          0%,100% { transform:translateX(0); }
          20% { transform:translateX(-5px); }
          40% { transform:translateX(5px); }
          60% { transform:translateX(-3px); }
          80% { transform:translateX(3px); }
        }
        @keyframes cePulseOrange {
          0%,100% { box-shadow:0 0 0 0 rgba(234,88,12,0.55); }
          50%      { box-shadow:0 0 0 7px rgba(234,88,12,0); }
        }
        @keyframes ceFadeSlide {
          from { opacity:0; transform:translateX(10px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .ce-pulse-orange { animation: cePulseOrange 2.2s ease-in-out infinite; }
        .ce-fade-slide   { animation: ceFadeSlide 200ms ease-out forwards; }
      `}</style>

      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.65) 100%)" }} />

      {toast && <CEToast msg={toast.msg} ok={toast.ok} details={toast.details} />}

      <div className="relative z-10 max-w-6xl mx-auto py-8 px-4 md:px-8 flex flex-col gap-6">

        {/* ── Page title + HUD ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[7px] uppercase tracking-[0.5em] text-[#292929] mb-1">CRIME EMPIRE / CONTRATOS</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-none">CONTRATOS</h1>
          </div>
          {player && <PlayerHUD player={player} isHitman={isHitman} />}
        </div>

        {/* ── Banners ── */}
        {isHitman && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0e0404] border border-red-900/30 text-[10px] text-red-800">
            <span className="flex-shrink-0">🔪</span>
            <span><strong className="text-red-600">BONUS HITMAN:</strong> +15% taxa de sucesso · -50% chance de ser preso</span>
          </div>
        )}
        {player?.in_jail && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0d0b00] border border-yellow-900/30 text-[10px] text-yellow-900">
            <span className="flex-shrink-0">🚔</span>
            <span><strong className="text-yellow-700">DETIDO:</strong> Nao podes aceitar contratos enquanto estiveres preso.</span>
          </div>
        )}

        {/* ── MAIN SPLIT LAYOUT ── */}
        {contracts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl opacity-10 mb-3">🎯</p>
            <p className="text-[9px] uppercase tracking-[0.4em] text-[#2e2e2e]">Sem contratos disponiveis</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* ── LEFT: Roadmap + List ── */}
            <div className="w-full lg:w-[260px] flex-shrink-0 space-y-6">
              {levels.map((lvl) => {
                const lvlContracts = contracts.filter((c) => c.roadmap_level === lvl);
                const unlocked     = levelUnlocked(lvl);
                const completed    = levelCompleted(lvl);
                const isActive     = lvlContracts.some((c) => c.id === selected);

                return (
                  <div key={lvl} className="relative">
                    {/* Spine line */}
                    <div className="absolute left-3 top-7 bottom-0 w-px bg-[#141414] -z-10" />

                    <RoadmapNode
                      level={lvl}
                      completed={completed}
                      unlocked={unlocked}
                      active={isActive}
                    />

                    <div className="mt-2 ml-4 space-y-1">
                      {lvlContracts.map((c) => (
                        <ContractListItem
                          key={c.id}
                          contract={c}
                          status={getStatus(c.id)}
                          selected={selected === c.id}
                          levelUnlocked={unlocked}
                          isHitman={isHitman}
                          onClick={() => {
                            if (selected !== c.id) {
                              setSelected(c.id);
                              setBriefingKey((k) => k + 1);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Footer note */}
              <div className="px-2 pt-2 border-t border-[#121212]">
                <p className="text-[7px] uppercase tracking-[0.25em] text-[#1e1e1e] leading-relaxed">
                  Falhar envia-te ao hospital com 0 HP. Possivel prisao de 30-90 min.
                </p>
              </div>
            </div>

            {/* ── RIGHT: Briefing Panel ── */}
            <div className="flex-1 min-h-[560px] bg-[#0f0f0f] border border-[#181818] rounded-2xl p-6 shadow-2xl">
              {selectedContract ? (
                <div key={briefingKey} className="ce-fade-slide h-full">
                  <ContractBriefing
                    contract={selectedContract}
                    status={selectedStatus}
                    player={player}
                    levelDone={selLevelDone}
                    levelUnlocked={selLevelUnlocked}
                    isHitman={isHitman}
                    processing={processing === selected}
                    onExecute={() => selected && attemptContract(selected)}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[8px] uppercase tracking-[0.4em] text-[#1e1e1e]">
                    Seleciona um contrato
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}