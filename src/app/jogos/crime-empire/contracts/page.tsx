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

/* ── Config ── */
const DIFF_CONFIG = {
  easy:   { label: "Fácil",  icon: "🟢", color: "#22c55e", bg: "#052e16" },
  medium: { label: "Médio",  icon: "🟡", color: "#f59e0b", bg: "#1c1003" },
  hard:   { label: "Difícil",icon: "🔴", color: "#ef4444", bg: "#1a0505" },
};

export default function ContractsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [playerContracts, setPlayerContracts] = useState<PlayerContract[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean; details?: string } | null>(null);

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
      } else {
        const ok = data.success;
        let details = "";
        if (ok) {
          details = `+💵 $${data.cash_earned?.toLocaleString()} | +⭐ ${data.respect_earned} Respeito`;
        } else {
          details = data.arrested ? "🚔 Preso!" : "";
        }
        showToast(data.message, ok, details);
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
      <div className="flex-1 flex items-center justify-center min-h-[60vh] text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🎯</div>
          <p className="text-[#888]">A carregar contratos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} details={toast.details} />}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              🎯 Contratos
            </h1>
            <p className="text-[#888] mt-1">
              Elimina alvos e ganha respeito. Cuidado — falhar tem consequências graves.
            </p>
          </div>

          {/* Stats */}
          {player && (
            <div className="flex gap-3 flex-wrap">
              <div className="bg-[#121212] border border-[#222] rounded-xl px-4 py-2 text-center min-w-[110px]">
                <p className="text-xs text-[#666] uppercase tracking-wider mb-0.5">Stamina</p>
                <p className="font-black text-yellow-400">{player.stamina}/{player.max_stamina}</p>
              </div>
              <div className="bg-[#121212] border border-[#222] rounded-xl px-4 py-2 text-center min-w-[110px]">
                <p className="text-xs text-[#666] uppercase tracking-wider mb-0.5">Nível</p>
                <p className="font-black text-blue-400">{player.level}</p>
              </div>
              {isHitman && (
                <div className="bg-[#1a0505] border border-red-900 rounded-xl px-4 py-2 text-center min-w-[110px]">
                  <p className="text-xs text-red-400 uppercase tracking-wider mb-0.5">Classe</p>
                  <p className="font-black text-red-400">🔪 Hitman</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hitman bonus notice */}
        {isHitman && (
          <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-800 text-sm text-red-300">
            🔪 <strong>Bónus Hitman:</strong> Tens +15% taxa de sucesso e -50% de chance de ser preso em cada contrato.
          </div>
        )}

        {/* Jail warning */}
        {player?.in_jail && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-900/20 border border-yellow-700 text-yellow-400 font-semibold text-sm">
            🚔 Estás na prisão. Não podes aceitar contratos até seres libertado.
          </div>
        )}

        {/* Roadmap */}
        {levels.length === 0 ? (
          <div className="text-center py-20 text-[#555]">
            <p className="text-5xl mb-4">🎯</p>
            <p className="text-lg">Nenhum contrato disponível de momento.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {levels.map((lvl, lvlIdx) => {
              const lvlContracts = contracts.filter((c) => c.roadmap_level === lvl);
              const unlocked = levelUnlocked(lvl);
              const completed = levelCompleted(lvl);

              return (
                <div key={lvl} className="relative">
                  {/* Connector line */}
                  {lvlIdx > 0 && (
                    <div className={`absolute -top-5 left-6 w-0.5 h-5 ${completed ? "bg-green-500" : "bg-[#333]"}`} />
                  )}

                  {/* Level header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black border-2 flex-shrink-0 ${
                      completed
                        ? "bg-green-900/50 border-green-500 text-green-400"
                        : unlocked
                        ? "bg-[#1a1a1a] border-[#ff6a00] text-[#ff6a00]"
                        : "bg-[#111] border-[#333] text-[#444]"
                    }`}>
                      {completed ? "✓" : lvl}
                    </div>
                    <div>
                      <p className={`font-black text-sm uppercase tracking-widest ${completed ? "text-green-400" : unlocked ? "text-white" : "text-[#444]"}`}>
                        Nível {lvl}
                      </p>
                      <p className="text-xs text-[#555]">
                        {completed ? "Concluído" : unlocked ? "Disponível — escolhe 1 alvo" : "🔒 Bloqueado"}
                      </p>
                    </div>
                  </div>

                  {/* Contract cards */}
                  <div className={`ml-6 pl-6 border-l-2 ${completed ? "border-green-800" : unlocked ? "border-[#333]" : "border-[#222]"}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {lvlContracts.map((contract) => {
                        const diff = DIFF_CONFIG[contract.difficulty] ?? DIFF_CONFIG.medium;
                        const status = getStatus(contract.id);
                        const isCompleted = status === "completed";
                        const isFailed = status === "failed";
                        const isBusy = processing === contract.id;
                        const meetsLevel = (player?.level ?? 0) >= contract.required_level;
                        const hasStamina = (player?.stamina ?? 0) >= contract.stamina_cost;
                        const canAttempt = unlocked && !completed && !isCompleted && !player?.in_jail && meetsLevel && hasStamina;

                        const displayRate = isHitman
                          ? Math.min(95, Math.round((contract.base_success_rate + contract.hitman_bonus) * 100))
                          : Math.round(contract.base_success_rate * 100);

                        return (
                          <div
                            key={contract.id}
                            className={`rounded-xl p-4 border flex flex-col transition-all ${
                              isCompleted
                                ? "bg-green-900/20 border-green-700 opacity-80"
                                : isFailed
                                ? "bg-[#1a0505] border-red-900 opacity-70"
                                : !unlocked || completed
                                ? "bg-[#0e0e0e] border-[#1a1a1a] opacity-40"
                                : "bg-[#121212] border-[#222] hover:border-[#333]"
                            }`}
                          >
                            {/* Difficulty badge */}
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${diff.color}22`, color: diff.color }}
                              >
                                {diff.icon} {diff.label}
                              </span>
                              {isCompleted && <span className="text-xs text-green-400 font-bold">✓ Feito</span>}
                              {isFailed && <span className="text-xs text-red-400 font-bold">✗ Falhou</span>}
                            </div>

                            {/* Name + desc */}
                            <h3 className="font-black text-sm mb-1">{contract.name}</h3>
                            <p className="text-[#666] text-xs mb-3 flex-1">{contract.description}</p>

                            {/* Rewards */}
                            <div className="space-y-1 mb-3">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#666]">Recompensa</span>
                                <span className="text-green-400 font-bold">${contract.min_cash.toLocaleString()}–${contract.max_cash.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#666]">Respeito</span>
                                <span className="text-yellow-400 font-bold">+{contract.respect_reward} ⭐</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#666]">Sucesso</span>
                                <span className={`font-bold ${displayRate >= 60 ? "text-green-400" : displayRate >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                                  {displayRate}%{isHitman ? " 🔪" : ""}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#666]">Stamina</span>
                                <span className="text-[#aaa]">-{contract.stamina_cost}</span>
                              </div>
                            </div>

                            {/* Req level */}
                            {!meetsLevel && (
                              <p className="text-xs text-red-400 mb-2">Nível {contract.required_level} necessário</p>
                            )}

                            {/* Action button */}
                            {!isCompleted && (
                              <button
                                disabled={!canAttempt || isBusy}
                                onClick={() => attemptContract(contract.id)}
                                className={`w-full py-2 rounded-lg text-xs font-bold transition-all mt-auto ${
                                  isBusy
                                    ? "bg-[#333] text-[#666] cursor-wait"
                                    : canAttempt
                                    ? "bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-900/30"
                                    : "bg-[#1a1a1a] text-[#444] cursor-not-allowed"
                                }`}
                              >
                                {isBusy ? "A executar..." : canAttempt ? "🎯 Executar Contrato" : completed ? "Nível concluído" : !unlocked ? "🔒 Bloqueado" : !hasStamina ? "Sem Stamina" : !meetsLevel ? "Nível insuficiente" : "Indisponível"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer warning */}
        <div className="mt-10 p-4 rounded-xl bg-red-900/10 border border-red-900 text-xs text-red-400">
          ⚠️ <strong>Aviso:</strong> Falhar um contrato envia-te para o Hospital com 0 HP. Podes ser preso. Escolhe com cuidado.
        </div>
      </div>
    </div>
  );
}
