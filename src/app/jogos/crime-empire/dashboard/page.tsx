"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { CrimeEmpireNav } from "@/components/CrimeEmpireNav";

interface Player {
  id: string;
  username: string;
  display_name: string;
  class: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  prestige_level: number;
  total_levels_earned: number;
  hp: number;
  max_hp: number;
  respect: number;
  power: number;
  intelligence: number;
  charisma: number;
  dirty_cash: number;
  cash: number;
  vcash: number;
  crypto?: number;
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
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [prestiging, setPrestiging] = useState(false);

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

  const handlePrestige = async () => {
    if (!player || player.level < 120) return;

    setPrestiging(true);
    try {
      const res = await fetch("/api/crime-empire/prestige", {
        method: "POST",
      });

      const data = await res.json();

      if (data.success) {
        alert(
          `🌟 ${data.message}\n\n` +
          `Bónus de Prestige ${player.prestige_level + 1}:\n` +
          `• Taxa de Sucesso: ${data.bonuses.successRateBonus}\n` +
          `• HP Máximo: ${data.bonuses.maxHp}\n` +
          `• Stamina Máxima: ${data.bonuses.maxStamina}\n\n` +
          `Mantiveste:\n` +
          `• Respeito: ${data.keptResources.respect.toLocaleString()}\n` +
          `• Dinheiro Sujo: $${data.keptResources.dirtyCash.toLocaleString()}\n` +
          `• Dinheiro Limpo: $${data.keptResources.cash.toLocaleString()}`
        );
        setShowPrestigeModal(false);
        fetchPlayer(); // Refresh player data
      } else {
        alert(data.error || "Erro ao fazer prestige");
      }
    } catch (error) {
      console.error("Error prestiging:", error);
      alert("Erro ao fazer prestige");
    } finally {
      setPrestiging(false);
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
        <div className="flex justify-between items-start">
          <div>
            {player.prestige_level > 0 && (
              <p className="text-sm text-yellow-400">
                🌟 Prestige {player.prestige_level} | Total de Níveis: {player.total_levels_earned}
              </p>
            )}
            {player.boost_active && (
              <p className="text-sm text-green-400">⚡ Bónus de Novo Jogador Ativo (+30% sucesso, +20% XP)</p>
            )}
          </div>

          {/* Prestige Button */}
          {player.level >= 120 && (
            <button
              onClick={() => setShowPrestigeModal(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 border-2 border-yellow-400 font-bold text-black hover:scale-105 transition-all shadow-lg shadow-yellow-500/50"
            >
              <span className="text-xl">⭐</span> PRESTIGE
            </button>
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

        {/* Full Player Stats */}
        <h2 className="text-2xl font-bold mt-12 mb-6">Estatísticas</h2>

        {/* Combat attributes */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: "Poder", value: player.power, icon: "⚔️", color: "text-red-400", bg: "from-red-600/10 to-red-700/5", border: "border-red-600/30" },
            { label: "Inteligência", value: player.intelligence, icon: "🧠", color: "text-blue-400", bg: "from-blue-600/10 to-blue-700/5", border: "border-blue-600/30" },
            { label: "Carisma", value: player.charisma, icon: "✨", color: "text-yellow-400", bg: "from-yellow-600/10 to-yellow-700/5", border: "border-yellow-600/30" },
          ].map((s) => (
            <div key={s.label} className={`p-4 rounded-xl bg-gradient-to-br ${s.bg} border ${s.border}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-xs text-[#666] mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* HP & Stamina bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl bg-[#121212] border border-[#222222]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-red-400">❤️ HP</span>
              <span className="text-sm text-[#888]">{player.hp} / {player.max_hp}</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-3">
              <div className="bg-gradient-to-r from-red-600 to-red-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.min((player.hp / player.max_hp) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#121212] border border-[#222222]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-yellow-400">⚡ Stamina</span>
              <span className="text-sm text-[#888]">{player.stamina} / {player.max_stamina}</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-3">
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-3 rounded-full transition-all"
                style={{ width: `${Math.min((player.stamina / player.max_stamina) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Money & currency */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Dinheiro Sujo", value: `$${player.dirty_cash.toLocaleString()}`, icon: "💵", color: "text-green-400", bg: "from-green-600/10 to-green-700/5", border: "border-green-600/30" },
            { label: "Dinheiro Limpo", value: `$${player.cash.toLocaleString()}`, icon: "💰", color: "text-emerald-400", bg: "from-emerald-600/10 to-emerald-700/5", border: "border-emerald-600/30" },
            { label: "Crypto", value: `₿${(player.crypto || 0).toLocaleString()}`, icon: "💎", color: "text-purple-400", bg: "from-purple-600/10 to-purple-700/5", border: "border-purple-600/30" },
            { label: "Respeito", value: player.respect.toLocaleString(), icon: "👑", color: "text-orange-400", bg: "from-orange-600/10 to-orange-700/5", border: "border-orange-600/30" },
            { label: "Nível", value: `${player.level}`, icon: "📈", color: "text-cyan-400", bg: "from-cyan-600/10 to-cyan-700/5", border: "border-cyan-600/30" },
            { label: "XP", value: `${player.xp.toLocaleString()} / ${player.xp_to_next_level.toLocaleString()}`, icon: "⭐", color: "text-[#ff6a00]", bg: "from-[#ff6a00]/10 to-[#ff6a00]/5", border: "border-[#ff6a00]/30" },
          ].map((s) => (
            <div key={s.label} className={`p-4 rounded-xl bg-gradient-to-br ${s.bg} border ${s.border}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-xs text-[#666] mb-1">{s.label}</p>
              <p className={`text-lg font-black ${s.color} truncate`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Prestige Modal */}
        {showPrestigeModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] border-2 border-yellow-500 rounded-2xl p-8 max-w-lg w-full">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⭐</div>
                <h2 className="text-3xl font-bold text-yellow-400 mb-2">
                  PRESTIGE {player.prestige_level + 1}
                </h2>
                <p className="text-sm text-[#888888]">Ascende a um novo nível de poder</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl bg-green-900/20 border border-green-600">
                  <p className="font-bold text-green-400 mb-2">✅ Vais Manter:</p>
                  <ul className="text-sm text-green-300 space-y-1">
                    <li>• Todo o Respeito ({player.respect.toLocaleString()})</li>
                    <li>• Todo o Dinheiro (${(player.dirty_cash + player.cash).toLocaleString()})</li>
                    <li>• Todos os Itens e Negócios</li>
                    <li>• Histórico de Estatísticas</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-yellow-900/20 border border-yellow-600">
                  <p className="font-bold text-yellow-400 mb-2">🌟 Vais Ganhar:</p>
                  <ul className="text-sm text-yellow-300 space-y-1">
                    <li>• +2% Taxa de Sucesso em Crimes</li>
                    <li>• +5 HP Máximo ({player.max_hp} → {player.max_hp + 5})</li>
                    <li>• +5 Stamina Máxima ({player.max_stamina} → {player.max_stamina + 5})</li>
                    <li>• Heal completo + Libertação da Prisão</li>
                    <li>• Estrela de Prestige ⭐</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-red-900/20 border border-red-600">
                  <p className="font-bold text-red-400 mb-2">❌ Vais Perder:</p>
                  <ul className="text-sm text-red-300 space-y-1">
                    <li>• Nível resetado para 1</li>
                    <li>• XP resetado para 0</li>
                    <li>• Bónus de experiência em crimes</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPrestigeModal(false)}
                  disabled={prestiging}
                  className="flex-1 px-6 py-3 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePrestige}
                  disabled={prestiging}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 border-2 border-yellow-400 font-bold text-black hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {prestiging ? "A processar..." : "✨ Confirmar Prestige"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}