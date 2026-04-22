"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

interface Player {
  id: string;
  level: number;
  stamina: number;
  max_stamina: number;
  in_jail: boolean;
}

interface Crime {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  base_success_rate: number;
  jail_risk: number;
  stamina_cost: number;
  min_dirty_cash: number;
  max_dirty_cash: number;
  xp_reward: number;
  required_level: number;
}

export default function CrimesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrime, setSelectedCrime] = useState<string | null>(null);
  const [crimeResult, setCrimeResult] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchPlayer();
    fetchCrimes();
  }, [user]);

  const fetchPlayer = async () => {
    try {
      const res = await fetch("/api/crime-empire/player");
      const data = await res.json();
      if (data.player) {
        setPlayer(data.player);
      }
    } catch (error) {
      console.error("Error fetching player:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCrimes = async () => {
    try {
      const res = await fetch("/api/crime-empire/crimes");
      const data = await res.json();
      setCrimes(data.crimes || []);
    } catch (error) {
      console.error("Error fetching crimes:", error);
    }
  };

  const commitCrime = async (crimeId: string) => {
    if (!player || selectedCrime) return;
    
    setSelectedCrime(crimeId);
    setCrimeResult(null);

    try {
      const res = await fetch("/api/crime-empire/crimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crimeId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        setSelectedCrime(null);
        return;
      }

      setCrimeResult(data);
      
      // Refresh player data
      setTimeout(() => {
        fetchPlayer();
        setSelectedCrime(null);
        setCrimeResult(null);
      }, 3000);
    } catch (error) {
      console.error("Error committing crime:", error);
      setSelectedCrime(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">A carregar...</div>
      </div>
    );
  }

  if (!player) return null;

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
          💰 Crimes
        </h1>
        <p className="text-[#888888] mb-8">
          Escolhe um crime para cometer e ganhar dinheiro, XP e respeito.
        </p>

        {/* Player Quick Stats */}
        <div className="mb-8 p-4 rounded-xl bg-[#121212] border border-[#222222] flex justify-between items-center">
          <div>
            <p className="text-sm text-[#888888]">Nível {player.level}</p>
            <p className="text-lg font-bold">Stamina: <span className="text-blue-400">{player.stamina}/{player.max_stamina}</span></p>
          </div>
          {player.in_jail && (
            <div className="px-4 py-2 rounded-lg bg-red-900/20 border border-red-600">
              <p className="text-red-400 font-bold text-sm">🚔 Na Prisão</p>
            </div>
          )}
        </div>

        {/* Crimes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crimes.map((crime) => {
            const isLocked = crime.required_level > player.level;
            const canAfford = player.stamina >= crime.stamina_cost;
            const isProcessing = selectedCrime === crime.id;
            const canCommit = !isLocked && canAfford && !player.in_jail && !isProcessing;

            return (
              <motion.div
                key={crime.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isLocked
                    ? "bg-[#0a0a0a] border-[#333333] opacity-60"
                    : canCommit
                    ? "bg-[#121212] border-[#ff6a00] hover:bg-[#161616] cursor-pointer hover:scale-105"
                    : "bg-[#0a0a0a] border-[#222222] opacity-50"
                }`}
                onClick={() => canCommit && commitCrime(crime.id)}
              >
                {/* Header with Lock Icon */}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white">{crime.name}</h3>
                  {isLocked && (
                    <div className="text-2xl">🔒</div>
                  )}
                </div>

                <p className="text-sm text-[#888888] mb-3">{crime.description}</p>

                {/* Locked Message */}
                {isLocked && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#444444]">
                    <p className="text-xs text-yellow-400 font-bold">
                      🔒 Nível {crime.required_level} necessário
                    </p>
                  </div>
                )}

                {/* Crime Stats */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#888888]">Sucesso Base:</span>
                    <span className="text-green-400">{(crime.base_success_rate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888888]">Risco Prisão:</span>
                    <span className="text-red-400">{(crime.jail_risk * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888888]">Stamina:</span>
                    <span className={canAfford || isLocked ? "text-blue-400" : "text-red-400"}>
                      {crime.stamina_cost}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888888]">Recompensa:</span>
                    <span className="text-yellow-400">${crime.min_dirty_cash} - ${crime.max_dirty_cash}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888888]">XP:</span>
                    <span className="text-purple-400">+{crime.xp_reward}</span>
                  </div>
                </div>

                {/* Processing Indicator */}
                {isProcessing && (
                  <div className="mt-3 text-center">
                    <span className="text-[#ff6a00] text-sm animate-pulse">⏳ A processar...</span>
                  </div>
                )}

                {/* Can't Afford Warning */}
                {!isLocked && !canAfford && !player.in_jail && (
                  <div className="mt-3 text-center">
                    <span className="text-red-400 text-xs">Stamina insuficiente</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Crime Result Notification */}
        <AnimatePresence>
          {crimeResult && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm pointer-events-auto"
            >
              <div
                className="relative rounded-2xl overflow-hidden border shadow-2xl"
                style={{
                  background: crimeResult.success
                    ? "linear-gradient(135deg, #0a1f0a 0%, #0d1a0d 100%)"
                    : "linear-gradient(135deg, #1a0808 0%, #150808 100%)",
                  borderColor: crimeResult.success ? "#16a34a60" : "#dc262660",
                  boxShadow: crimeResult.success
                    ? "0 0 40px #16a34a22, 0 8px 32px rgba(0,0,0,0.6)"
                    : "0 0 40px #dc262622, 0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                {/* Glow bar at top */}
                <div
                  className="h-[2px] w-full"
                  style={{
                    background: crimeResult.success
                      ? "linear-gradient(90deg, transparent, #22c55e, transparent)"
                      : "linear-gradient(90deg, transparent, #ef4444, transparent)",
                  }}
                />

                {/* Progress bar (auto-dismiss) */}
                <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#111]">
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 3, ease: "linear" }}
                    className="h-full"
                    style={{ background: crimeResult.success ? "#22c55e" : "#ef4444" }}
                  />
                </div>

                <div className="px-5 py-4">
                  {/* Crime name */}
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#555] mb-1">
                    {crimes.find((c) => c.id === selectedCrime || crimeResult.crime_id)?.name ?? "Crime"}
                  </p>

                  {/* Result badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{
                        background: crimeResult.success ? "#16a34a25" : "#dc262625",
                        border: `1px solid ${crimeResult.success ? "#16a34a50" : "#dc262650"}`,
                      }}
                    >
                      {crimeResult.success ? "✅" : "❌"}
                    </div>
                    <h2
                      className="text-2xl font-black tracking-tight"
                      style={{ color: crimeResult.success ? "#4ade80" : "#f87171" }}
                    >
                      {crimeResult.success ? "SUCESSO!" : "FALHOU!"}
                    </h2>
                  </div>

                  {/* Rewards */}
                  {crimeResult.success && (
                    <div className="space-y-2 mb-3">
                      {[
                        { icon: "💵", label: "Dinheiro Sujo", value: `+$${crimeResult.dirty_cash_earned?.toLocaleString()}`, color: "#4ade80", delay: 0.05 },
                        { icon: "⭐", label: "XP",            value: `+${crimeResult.xp_earned}`,                             color: "#60a5fa", delay: 0.1  },
                        { icon: "👑", label: "Respeito",      value: `+${crimeResult.respect_earned}`,                        color: "#c084fc", delay: 0.15 },
                      ].map((r) => (
                        <motion.div
                          key={r.label}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: r.delay, duration: 0.25 }}
                          className="flex items-center justify-between px-3 py-2 rounded-lg"
                          style={{ background: `${r.color}0d`, border: `1px solid ${r.color}18` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{r.icon}</span>
                            <span className="text-[11px] text-[#666]">{r.label}</span>
                          </div>
                          <span className="text-sm font-black" style={{ color: r.color }}>{r.value}</span>
                        </motion.div>
                      ))}

                      {/* Level up */}
                      {crimeResult.leveled_up && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
                        >
                          <span className="text-sm">🎉</span>
                          <span className="text-xs font-black text-yellow-400 uppercase tracking-wide">
                            Nível {crimeResult.new_level} desbloqueado!
                          </span>
                        </motion.div>
                      )}

                      {/* Item drops */}
                      {crimeResult.dropped_items?.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.25 }}
                          className="px-3 py-2 rounded-lg border border-[#ff6a00]/20 bg-[#ff6a00]/5"
                        >
                          <p className="text-[9px] uppercase tracking-widest text-[#555] mb-1.5">Itens encontrados</p>
                          {crimeResult.dropped_items.map((drop: { name: string; quantity: number }, i: number) => (
                            <p key={i} className="text-xs text-[#ff6a00] font-semibold">🎒 {drop.name} ×{drop.quantity}</p>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Jail */}
                  {crimeResult.went_to_jail && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-red-600/30 bg-red-900/15 mt-2"
                    >
                      <span className="text-lg">🚔</span>
                      <div>
                        <p className="text-xs font-bold text-red-400">Foste apanhado!</p>
                        <p className="text-[10px] text-red-500/70">Prisão por {crimeResult.jail_time_minutes} min</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
