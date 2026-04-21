"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface Player {
  id: string;
  username: string;
  display_name: string;
  class: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  hp: number;
  max_hp: number;
  respect: number;
  power: number;
  intelligence: number;
  charisma: number;
  dirty_cash: number;
  cash: number;
  vcash: number;
  stamina: number;
  max_stamina: number;
  in_jail: boolean;
  jail_release_at: string | null;
  boost_active: boolean;
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

export default function CrimeDashboard() {
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
      
      if (data.player === null) {
        // No player exists - redirect to character creation
        router.push("/jogos/crime-empire/create-character");
        return;
      }
      
      setPlayer(data.player);
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-xl">A carregar...</div>
      </div>
    );
  }

  if (!player) return null;

  const availableCrimes = crimes.filter(c => c.required_level <= player.level);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/jogos" className="inline-flex items-center gap-2 text-[#ff6a00] hover:text-[#ff8533] transition-colors text-sm mb-6">
          ← Voltar aos Jogos
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-5xl md:text-6xl font-black mb-2 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
            CRIME EMPIRE
          </h1>
          <p className="text-lg text-[#888888] mb-1">
            Bem-vindo, {player.display_name} - {player.class.toUpperCase()} Nível {player.level}
          </p>
          {player.boost_active && (
            <p className="text-sm text-green-400">⚡ Bónus de Novo Jogador Ativo (+30% sucesso, +20% XP)</p>
          )}
        </motion.div>

        {/* Jail Status */}
        {player.in_jail && (
          <div className="mt-6 p-4 rounded-xl bg-red-900/20 border-2 border-red-600">
            <p className="text-red-400 font-bold">🚔 Estás na prisão!</p>
            <p className="text-sm text-red-300">
              Libertação: {new Date(player.jail_release_at!).toLocaleString()}
            </p>
          </div>
        )}

        {/* Player Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Dinheiro Sujo", value: `$${player.dirty_cash.toLocaleString()}`, icon: "💵", color: "text-green-400" },
            { label: "Dinheiro Limpo", value: `$${player.cash.toLocaleString()}`, icon: "💰", color: "text-yellow-400" },
            { label: "Stamina", value: `${player.stamina}/${player.max_stamina}`, icon: "⚡", color: "text-blue-400" },
            { label: "Respeito", value: player.respect.toLocaleString(), icon: "👑", color: "text-purple-400" },
          ].map((stat, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-[#121212] border border-[#222222]">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <p className="text-xs text-[#888888] mb-1">{stat.label}</p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* XP Progress */}
        <div className="mt-6 p-4 rounded-xl bg-[#121212] border border-[#222222]">
          <div className="flex justify-between text-sm mb-2">
            <span>XP: {player.xp} / {player.xp_to_next_level}</span>
            <span>Próximo Nível: {player.level + 1}</span>
          </div>
          <div className="w-full bg-[#1a1a1a] rounded-full h-3">
            <div
              className="bg-gradient-to-r from-[#ff6a00] to-[#ff8533] h-3 rounded-full transition-all"
              style={{ width: `${(player.xp / player.xp_to_next_level) * 100}%` }}
            />
          </div>
        </div>

        {/* Crimes Section */}
        <h2 className="text-2xl font-bold mt-12 mb-6">💰 Crimes Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableCrimes.map((crime) => {
            const canAfford = player.stamina >= crime.stamina_cost;
            const isProcessing = selectedCrime === crime.id;

            return (
              <div
                key={crime.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  canAfford && !player.in_jail
                    ? "bg-[#121212] border-[#ff6a00] hover:bg-[#161616] cursor-pointer"
                    : "bg-[#0a0a0a] border-[#222222] opacity-50"
                }`}
                onClick={() => canAfford && !player.in_jail && !isProcessing && commitCrime(crime.id)}
              >
                <h3 className="text-lg font-bold text-white mb-2">{crime.name}</h3>
                <p className="text-sm text-[#888888] mb-3">{crime.description}</p>
                
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
                    <span className="text-blue-400">{crime.stamina_cost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888888]">Recompensa:</span>
                    <span className="text-yellow-400">${crime.min_dirty_cash} - ${crime.max_dirty_cash}</span>
                  </div>
                </div>

                {isProcessing && (
                  <div className="mt-3 text-center">
                    <span className="text-[#ff6a00] text-sm">⏳ A processar...</span>
                  </div>
                )}
              </div>
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
