"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function CrimeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchPlayer();
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
        {/* Header */}
        <div>
          <h1 className="text-5xl md:text-6xl font-black mb-2 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
            CRIME EMPIRE
          </h1>
          <p className="text-lg text-[#888888] mb-1">
            Bem-vindo, {player.display_name} - {player.class.toUpperCase()} Nível {player.level}
          </p>
          {player.boost_active && (
            <p className="text-sm text-green-400">⚡ Bónus de Novo Jogador Ativo (+30% sucesso, +20% XP)</p>
          )}
        </div>

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

        {/* Quick Actions */}
        <h2 className="text-2xl font-bold mt-12 mb-6">Acções Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/jogos/crime-empire/crimes"
            className="p-6 rounded-xl bg-gradient-to-br from-[#ff6a00]/20 to-[#ff8533]/20 border-2 border-[#ff6a00] hover:scale-105 transition-all group"
          >
            <div className="text-4xl mb-3">💰</div>
            <h3 className="text-xl font-bold mb-2">Cometer Crimes</h3>
            <p className="text-sm text-[#888888]">Ganha dinheiro, XP e respeito</p>
            <div className="mt-4 text-[#ff6a00] group-hover:text-[#ff8533] font-medium text-sm">
              Ver Crimes →
            </div>
          </Link>

          <Link
            href="/jogos/crime-empire/businesses"
            className="p-6 rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-700/20 border-2 border-blue-600 hover:scale-105 transition-all group opacity-50 cursor-not-allowed"
          >
            <div className="text-4xl mb-3">🏢</div>
            <h3 className="text-xl font-bold mb-2">Negócios</h3>
            <p className="text-sm text-[#888888]">Gere os teus negócios ilegais</p>
            <div className="mt-4 text-blue-600 group-hover:text-blue-500 font-medium text-sm">
              Em Breve
            </div>
          </Link>

          <Link
            href="/jogos/crime-empire/pvp"
            className="p-6 rounded-xl bg-gradient-to-br from-red-600/20 to-red-700/20 border-2 border-red-600 hover:scale-105 transition-all group opacity-50 cursor-not-allowed"
          >
            <div className="text-4xl mb-3">⚔️</div>
            <h3 className="text-xl font-bold mb-2">PvP Arena</h3>
            <p className="text-sm text-[#888888]">Desafia outros jogadores</p>
            <div className="mt-4 text-red-600 group-hover:text-red-500 font-medium text-sm">
              Em Breve
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}