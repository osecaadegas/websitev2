"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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

        {/* Crime Result Modal */}
        {crimeResult && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`p-8 rounded-2xl max-w-md w-full mx-4 ${
                crimeResult.success
                  ? "bg-gradient-to-br from-green-900/40 to-green-800/40 border-2 border-green-500"
                  : "bg-gradient-to-br from-red-900/40 to-red-800/40 border-2 border-red-500"
              }`}
            >
              <h2 className="text-3xl font-black mb-4">
                {crimeResult.success ? "✅ SUCESSO!" : "❌ FALHOU!"}
              </h2>

              {crimeResult.success && (
                <div className="space-y-2 text-lg">
                  <p className="text-green-400">+${crimeResult.dirty_cash_earned.toLocaleString()} Dinheiro Sujo</p>
                  <p className="text-blue-400">+{crimeResult.xp_earned} XP</p>
                  <p className="text-purple-400">+{crimeResult.respect_earned} Respeito</p>
                  {crimeResult.leveled_up && (
                    <p className="text-yellow-400 font-bold">🎉 SUBISTE PARA NÍVEL {crimeResult.new_level}!</p>
                  )}
                </div>
              )}

              {crimeResult.went_to_jail && (
                <div className="mt-4 p-4 bg-red-900/40 rounded-lg">
                  <p className="text-red-400 font-bold">🚔 Foste apanhado!</p>
                  <p className="text-sm text-red-300">Prisão por {crimeResult.jail_time_minutes} minutos</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
