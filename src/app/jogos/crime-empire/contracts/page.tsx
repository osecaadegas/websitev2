"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";

/* ── Types ── */
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

/* ── Difficulty Config ── */
const DIFF_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: "FACIL",   color: "#22c55e", bg: "#22c55e14" },
  medium: { label: "MEDIO",   color: "#f59e0b", bg: "#f59e0b14" },
  hard:   { label: "DIFICIL", color: "#ef4444", bg: "#ef444414" },
};

/* ── PlayerHUD ── */
function PlayerHUD({ player, isHitman }: { player: Player; isHitman: boolean }) {
  const staminaPct = Math.max(0, Math.min(100, (player.stamina / player.max_stamina) * 100));
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100));
  return (
    <div className="flex items-center gap-4 flex-wrap bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl px-5 py-3 shadow-xl">
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-[0.2em] text-[#444]">NIV</span>
        <span className="text-sm font-black text-white bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2.5 py-1 min-w-[2rem] text-center tabular-nums">
          {player.level}
        </span>
      </div>
      <div className="w-px h-8 bg-[#1e1e1e] hidden sm:block" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#444]">STAMINA</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: staminaPct > 40 ? "#f59e0b" : "#ef4444" }}>
            {player.stamina}/{player.max_stamina}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden w-[110px]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${staminaPct}%`,
              background: staminaPct > 50 ? "#f59e0b" : staminaPct > 20 ? "#f97316" : "#ef4444",
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#444]">HP</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: hpPct > 40 ? "#22c55e" : "#ef4444" }}>
            {player.hp}/{player.max_hp}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden w-[90px]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${hpPct}%`,
              background: hpPct > 50 ? "#22c55e" : hpPct > 20 ? "#f97316" : "#ef4444",
            }}
          />
        </div>
      </div>
      {isHitman && (
        <>
          <div className="w-px h-8 bg-[#1e1e1e] hidden sm:block" />
          <span className="text-[9px] font-black tracking-[0.2em] text-red-400 bg-red-900/20 border border-red-800/50 rounded-md px-3 py-1.5 uppercase">
            🔪 HITMAN
          </span>
        </>
      )}
    </div>
  );
}

/* ── ContractCard ── */
interface ContractCardProps {
  contract: Contract;
  status: "completed" | "failed" | "pending" | null;
  canAttempt: boolean;
  isBusy: boolean;
  isHitman: boolean;
  player: Player | null;
  levelDone: boolean;
  unlocked: boolean;
  flash: "success" | "failure" | null;
  onAttempt: (id: string) => void;
}

function ContractCard({
  contract, status, canAttempt, isBusy, isHitman,
  player, levelDone, unlocked, flash, onAttempt,
}: ContractCardProps) {
  const diff = DIFF_CONFIG[contract.difficulty] ?? DIFF_CONFIG.medium;
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const meetsLevel = (player?.level ?? 0) >= contract.required_level;
  const hasStamina = (player?.stamina ?? 0) >= contract.stamina_cost;
  const isDimmed = (!unlocked || (levelDone && !isCompleted)) && !isCompleted;

  const displayRate = isHitman
    ? Math.min(95, Math.round((contract.base_success_rate + contract.hitman_bonus) * 100))
    : Math.round(contract.base_success_rate * 100);

  let cardClass = "rounded-xl flex flex-col overflow-hidden border relative ce-card ";
  if (flash === "success") cardClass += "ce-flash-success ";
  else if (flash === "failure") cardClass += "ce-flash-failure ce-shake ";

  if (isCompleted) cardClass += "bg-[#0a150a] border-green-800/50 opacity-80";
  else if (isFailed) cardClass += "bg-[#130606] border-red-900/50 opacity-70";
  else if (isDimmed) cardClass += "bg-[#0b0b0b] border-[#161616] opacity-30 pointer-events-none";
  else cardClass += "bg-[#111] border-[#1e1e1e] hover:border-[#2e2e2e] hover:shadow-2xl hover:shadow-black/70";

  let btnLabel = "INDISPONIVEL";
  let btnClass = "w-full py-2.5 rounded-lg text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-150 ";
  if (isBusy) {
    btnLabel = "EXECUTANDO";
    btnClass += "bg-[#1e1e1e] text-[#555] cursor-wait";
  } else if (canAttempt) {
    btnLabel = "EXECUTAR CONTRATO";
    btnClass += "bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white shadow-lg shadow-red-950/60 active:scale-95";
  } else if (levelDone && !isCompleted) {
    btnLabel = "NIVEL CONCLUIDO";
    btnClass += "bg-[#0f0f0f] text-[#2a2a2a] cursor-not-allowed border border-[#1a1a1a]";
  } else if (!unlocked) {
    btnLabel = "BLOQUEADO";
    btnClass += "bg-[#0f0f0f] text-[#2a2a2a] cursor-not-allowed border border-[#1a1a1a]";
  } else if (!hasStamina) {
    btnLabel = "SEM STAMINA";
    btnClass += "bg-[#0f0f0f] text-[#444] cursor-not-allowed";
  } else if (!meetsLevel) {
    btnLabel = `NIV ${contract.required_level} NECESSARIO`;
    btnClass += "bg-[#0f0f0f] text-[#444] cursor-not-allowed";
  } else {
    btnClass += "bg-[#0f0f0f] text-[#333] cursor-not-allowed";
  }

  return (
    <div className={cardClass}>
      {/* Difficulty bar */}
      <div className="h-[2px] w-full flex-shrink-0" style={{ background: diff.color, opacity: isDimmed ? 0.15 : 0.65 }} />

      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Header: difficulty + status tag */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[8px] font-black tracking-[0.25em] uppercase px-2 py-0.5 rounded border"
            style={{ background: diff.bg, color: diff.color, borderColor: `${diff.color}30` }}
          >
            {diff.label}
          </span>
          {isCompleted && (
            <span className="text-[8px] font-black tracking-[0.2em] text-green-400 bg-green-900/25 border border-green-800/30 px-2 py-0.5 rounded uppercase">
              CONCLUIDO
            </span>
          )}
          {isFailed && (
            <span className="text-[8px] font-black tracking-[0.2em] text-red-400 bg-red-900/25 border border-red-800/30 px-2 py-0.5 rounded uppercase">
              FALHOU
            </span>
          )}
          {!isCompleted && !isFailed && canAttempt && (
            <span className="text-[8px] font-black tracking-[0.2em] text-orange-400 bg-orange-900/20 border border-orange-800/25 px-2 py-0.5 rounded uppercase">
              ATIVO
            </span>
          )}
        </div>

        {/* Target dossier */}
        <div>
          <p className="text-[8px] uppercase tracking-[0.25em] text-[#3a3a3a] mb-0.5">ALVO</p>
          <h3 className="font-black text-[14px] leading-tight text-white">{contract.name}</h3>
        </div>

        {/* Intel description */}
        <p className="text-[11px] text-[#4a4a4a] italic leading-relaxed flex-1 border-l border-[#1e1e1e] pl-3">
          {contract.description}
        </p>

        {/* Divider */}
        <div className="border-t border-[#181818]" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <p className="text-[8px] uppercase tracking-[0.2em] text-[#3a3a3a] mb-0.5">RECOMPENSA</p>
            <p className="text-[11px] font-black text-green-400 tabular-nums">
              ${contract.min_cash.toLocaleString("pt-PT")}–${contract.max_cash.toLocaleString("pt-PT")}
            </p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-[0.2em] text-[#3a3a3a] mb-0.5">RESPEITO</p>
            <p className="text-[11px] font-black text-yellow-400">+{contract.respect_reward} ⭐</p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-[0.2em] text-[#3a3a3a] mb-0.5">SUCESSO</p>
            <p
              className="text-[11px] font-black tabular-nums"
              style={{ color: displayRate >= 60 ? "#22c55e" : displayRate >= 40 ? "#f59e0b" : "#ef4444" }}
            >
              {displayRate}%{isHitman ? " ✦" : ""}
            </p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-[0.2em] text-[#3a3a3a] mb-0.5">STAMINA</p>
            <p className="text-[11px] font-black text-[#888]">-{contract.stamina_cost}</p>
          </div>
        </div>

        {/* Level requirement */}
        {!meetsLevel && !isDimmed && (
          <p className="text-[10px] text-red-400/80 bg-red-900/10 border border-red-900/20 rounded px-2 py-1">
            Nivel {contract.required_level} necessario
          </p>
        )}

        {/* Action button */}
        {!isCompleted && (
          <button disabled={!canAttempt || isBusy} onClick={() => onAttempt(contract.id)} className={btnClass}>
            {isBusy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="inline-block w-2.5 h-2.5 border border-[#555] border-t-transparent rounded-full animate-spin" />
                EXECUTANDO
              </span>
            ) : btnLabel}
          </button>
        )}
        {isCompleted && (
          <div className="w-full py-2.5 rounded-lg text-[10px] font-black tracking-[0.2em] text-center text-green-500 bg-green-900/10 border border-green-800/25 uppercase">
            ✓ MISSAO CUMPRIDA
          </div>
        )}
      </div>
    </div>
  );
}

/* ── LevelNode ── */
function LevelNode({
  level, completed, unlocked,
}: {
  level: number; completed: boolean; unlocked: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-black border-2 z-10 relative transition-all duration-300 ${
          completed
            ? "bg-green-950 border-green-600 text-green-400 ce-pulse-green"
            : unlocked
            ? "bg-[#1a0d00] border-orange-600 text-orange-400 ce-pulse-orange"
            : "bg-[#0c0c0c] border-[#1e1e1e] text-[#2e2e2e]"
        }`}
      >
        {completed ? "✓" : unlocked ? level : "🔒"}
      </div>
      <div>
        <p className={`font-black text-[10px] uppercase tracking-[0.25em] ${
          completed ? "text-green-400" : unlocked ? "text-white" : "text-[#2e2e2e]"
        }`}>
          {completed
            ? `CAPITULO ${level} — ELIMINADO`
            : unlocked
            ? `CAPITULO ${level} — ESCOLHE 1 ALVO`
            : `CAPITULO ${level} — BLOQUEADO`}
        </p>
        <p className="text-[9px] text-[#333] mt-0.5 uppercase tracking-wider">
          {completed
            ? "Contrato executado com sucesso."
            : unlocked
            ? "Seleciona um alvo. Apenas 1 por capitulo."
            : "Completa o capitulo anterior para desbloquear."}
        </p>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ContractsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [playerContracts, setPlayerContracts] = useState<PlayerContract[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean; details?: string } | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, "success" | "failure">>({});

  const showToast = (msg: string, ok: boolean, details?: string) => {
    setToast({ msg, ok, details });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/contracts");
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

  const attemptContract = async (contractId: string) => {
    if (!player) return;
    setProcessing(contractId);
    try {
      const res = await fetch("/api/crime-empire/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
        setFlashMap((prev) => ({ ...prev, [contractId]: "failure" }));
        setTimeout(() => setFlashMap((prev) => { const n = { ...prev }; delete n[contractId]; return n; }), 1300);
      } else {
        const ok = data.success;
        let details = "";
        if (ok) {
          details = `+💵 $${data.cash_earned?.toLocaleString()} | +⭐ ${data.respect_earned} Respeito`;
        } else {
          details = data.arrested ? "🚔 Preso!" : "";
        }
        showToast(data.message, ok, details);
        setFlashMap((prev) => ({ ...prev, [contractId]: ok ? "success" : "failure" }));
        setTimeout(() => setFlashMap((prev) => { const n = { ...prev }; delete n[contractId]; return n; }), 1300);
        await fetchData();
      }
    } finally {
      setProcessing(null);
    }
  };

  /* ── Group contracts by roadmap level ── */
  const levels = Array.from(new Set(contracts.map((c) => c.roadmap_level))).sort((a, b) => a - b);

  const getStatus = (contractId: string) =>
    playerContracts.find((pc) => pc.contract_id === contractId)?.status ?? null;

  const levelCompleted = (level: number) =>
    contracts
      .filter((c) => c.roadmap_level === level)
      .some((c) => getStatus(c.id) === "completed");

  const levelUnlocked = (level: number) => {
    if (level === levels[0]) return true;
    const prevLevel = levels[levels.indexOf(level) - 1];
    return levelCompleted(prevLevel);
  };

  const isHitman = player?.class === "hitman";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ background: "#0B0B0B" }}>
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border border-red-900/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-red-800/40 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl select-none">🎯</div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#444]">A CARREGAR BRIEFING</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white min-h-screen relative" style={{ background: "#0B0B0B" }}>
      {/* Keyframe animations */}
      <style>{`
        @keyframes ceShake {
          0%,100% { transform:translateX(0); }
          20% { transform:translateX(-5px); }
          40% { transform:translateX(5px); }
          60% { transform:translateX(-3px); }
          80% { transform:translateX(3px); }
        }
        @keyframes cePulseOrange {
          0%,100% { box-shadow: 0 0 0 0 rgba(234,88,12,0.55); }
          50% { box-shadow: 0 0 0 8px rgba(234,88,12,0); }
        }
        @keyframes cePulseGreen {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45); }
          50% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
        }
        @keyframes ceFlashSuccess {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          40% { box-shadow: 0 0 28px 6px rgba(34,197,94,0.4); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes ceFlashFailure {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          40% { box-shadow: 0 0 28px 6px rgba(239,68,68,0.4); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        .ce-shake { animation: ceShake 0.45s ease-in-out; }
        .ce-pulse-orange { animation: cePulseOrange 2.2s ease-in-out infinite; }
        .ce-pulse-green { animation: cePulseGreen 2.2s ease-in-out infinite; }
        .ce-flash-success { animation: ceFlashSuccess 1.1s ease-out; }
        .ce-flash-failure { animation: ceFlashFailure 1.1s ease-out; }
        .ce-card { transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
        .ce-card:not(.pointer-events-none):hover { transform: translateY(-2px) scale(1.015); }
      `}</style>

      {/* Radial vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.7) 100%)" }}
      />

      {toast && <CEToast msg={toast.msg} ok={toast.ok} details={toast.details} />}

      <div className="relative z-10 max-w-4xl mx-auto py-10 px-4 md:px-8">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.4em] text-[#3a3a3a] mb-2">CRIME EMPIRE / CONTRATOS</p>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none text-white">
              CONTRATOS
            </h1>
            <p className="text-[11px] text-[#3e3e3e] mt-2 max-w-xs uppercase tracking-wider">
              Elimina alvos. Ganha respeito. Falhar tem consequencias.
            </p>
          </div>
          {player && <PlayerHUD player={player} isHitman={isHitman} />}
        </div>

        {/* ── Status banners ── */}
        {isHitman && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0f0505] border border-red-900/40">
            <span className="text-base flex-shrink-0">🔪</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-red-400 mb-0.5">BONUS HITMAN ATIVO</p>
              <p className="text-[10px] text-red-800">
                +15% taxa de sucesso em todos os contratos · -50% chance de ser preso
              </p>
            </div>
          </div>
        )}

        {player?.in_jail && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0d0b00] border border-yellow-900/50">
            <span className="text-base flex-shrink-0">🚔</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-500 mb-0.5">DETIDO</p>
              <p className="text-[10px] text-yellow-900">
                Estas na prisao. Aguarda a libertacao para aceitar contratos.
              </p>
            </div>
          </div>
        )}

        {/* ── Roadmap ── */}
        {levels.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-3xl mb-4 opacity-20 select-none">🎯</p>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#333]">Nenhum contrato disponivel</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical spine */}
            <div className="absolute left-[21px] top-8 bottom-8 w-px pointer-events-none"
              style={{ background: "linear-gradient(to bottom, #1e1e1e, #141414 80%, transparent)" }} />

            <div className="space-y-10">
              {levels.map((lvl) => {
                const lvlContracts = contracts.filter((c) => c.roadmap_level === lvl);
                const unlocked = levelUnlocked(lvl);
                const completed = levelCompleted(lvl);

                return (
                  <div key={lvl}>
                    <LevelNode level={lvl} completed={completed} unlocked={unlocked} />

                    <div className="mt-5 ml-14">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lvlContracts.map((contract) => {
                          const status = getStatus(contract.id);
                          const isContractCompleted = status === "completed";
                          const isBusy = processing === contract.id;
                          const meetsLevel = (player?.level ?? 0) >= contract.required_level;
                          const hasStamina = (player?.stamina ?? 0) >= contract.stamina_cost;
                          const canAttempt =
                            unlocked && !completed && !isContractCompleted && !player?.in_jail && meetsLevel && hasStamina;

                          return (
                            <ContractCard
                              key={contract.id}
                              contract={contract}
                              status={status}
                              canAttempt={canAttempt}
                              isBusy={isBusy}
                              isHitman={isHitman}
                              player={player}
                              levelDone={completed}
                              unlocked={unlocked}
                              flash={flashMap[contract.id] ?? null}
                              onAttempt={attemptContract}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-12 flex items-start gap-3 px-4 py-3 rounded-xl border border-[#181818] bg-[#0d0d0d]">
          <span className="text-red-900 text-sm flex-shrink-0 mt-0.5">⚠</span>
          <p className="text-[10px] text-[#3a3a3a] uppercase tracking-wider leading-relaxed">
            <span className="text-red-900 font-black">ATENCAO:</span>{" "}
            Falhar um contrato envia-te para o Hospital com 0 HP. Podes ser preso por 30 a 90 minutos.
            Escolhe o teu alvo com cuidado.
          </p>
        </div>

      </div>
    </div>
  );
}
