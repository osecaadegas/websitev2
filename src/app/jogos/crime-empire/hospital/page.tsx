"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

interface Player {
  id: string;
  username: string;
  level: number;
  hp: number;
  max_hp: number;
  cash: number;
  dirty_cash: number;
}

export default function HospitalPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [healAmount, setHealAmount] = useState(0);
  const [healCost, setHealCost] = useState(0);
  const [healing, setHealing] = useState(false);

  const HP_COST_PER_POINT = 10; // $10 per HP point

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchPlayer();
  }, [user]);

  useEffect(() => {
    if (player) {
      const maxHeal = player.max_hp - player.hp;
      setHealAmount(maxHeal);
      setHealCost(maxHeal * HP_COST_PER_POINT);
    }
  }, [player]);

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

  const handleHealAmountChange = (value: number) => {
    const maxHeal = player ? player.max_hp - player.hp : 0;
    const amount = Math.min(Math.max(0, value), maxHeal);
    setHealAmount(amount);
    setHealCost(amount * HP_COST_PER_POINT);
  };

  const heal = async (fullHeal: boolean = false) => {
    if (!player || healing) return;

    const amountToHeal = fullHeal ? player.max_hp - player.hp : healAmount;
    const cost = amountToHeal * HP_COST_PER_POINT;

    if (player.cash < cost) {
      alert("Não tens dinheiro suficiente para o tratamento!");
      return;
    }

    if (amountToHeal <= 0) {
      alert("Já estás com HP máximo!");
      return;
    }

    setHealing(true);

    try {
      const res = await fetch("/api/crime-empire/hospital/heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ healAmount: amountToHeal }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao curar");
        setHealing(false);
        return;
      }

      alert(`✅ Curado! +${amountToHeal} HP`);
      fetchPlayer();
    } catch (error) {
      console.error("Error healing:", error);
      alert("Erro ao processar cura");
    } finally {
      setHealing(false);
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

  const hpPercentage = (player.hp / player.max_hp) * 100;
  const isFullHealth = player.hp >= player.max_hp;
  const maxHealPossible = player.max_hp - player.hp;

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
          🏥 Hospital
        </h1>
        <p className="text-[#888888] mb-8">
          Recupera a tua saúde em troca de dinheiro limpo
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Health Status */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="p-6 rounded-2xl bg-[#121212] border-2 border-[#222222]"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              ❤️ Estado de Saúde
            </h2>

            {/* HP Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span>HP Atual</span>
                <span className="font-bold">
                  {player.hp} / {player.max_hp}
                </span>
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-8 overflow-hidden">
                <div
                  className={`h-8 rounded-full transition-all duration-500 ${
                    hpPercentage > 75
                      ? 'bg-gradient-to-r from-green-600 to-green-500'
                      : hpPercentage > 50
                      ? 'bg-gradient-to-r from-yellow-600 to-yellow-500'
                      : hpPercentage > 25
                      ? 'bg-gradient-to-r from-orange-600 to-orange-500'
                      : 'bg-gradient-to-r from-red-600 to-red-500'
                  }`}
                  style={{ width: `${hpPercentage}%` }}
                >
                  <div className="h-full flex items-center justify-center text-sm font-bold">
                    {hpPercentage.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className={`p-4 rounded-lg border ${
              isFullHealth
                ? 'bg-green-900/20 border-green-600'
                : hpPercentage > 50
                ? 'bg-yellow-900/20 border-yellow-600'
                : 'bg-red-900/20 border-red-600'
            }`}>
              <p className={`font-bold ${
                isFullHealth ? 'text-green-400' : hpPercentage > 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {isFullHealth
                  ? '✅ Estás em perfeita saúde!'
                  : hpPercentage > 50
                  ? '⚠️ Tens alguns ferimentos'
                  : '🚨 Estás gravemente ferido!'}
              </p>
            </div>

            {/* Player Money */}
            <div className="mt-6 p-4 rounded-lg bg-[#1a1a1a]">
              <div className="flex justify-between items-center">
                <span className="text-[#888888]">Dinheiro Limpo:</span>
                <span className="text-2xl font-bold text-green-400">
                  ${player.cash.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Healing Options */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="p-6 rounded-2xl bg-[#121212] border-2 border-[#222222]"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              💊 Tratamento
            </h2>

            {!isFullHealth ? (
              <>
                {/* Full Heal Option */}
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-green-900/30 to-green-800/30 border-2 border-green-600">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-green-400">Cura Completa</span>
                    <span className="text-sm text-[#888888]">+{maxHealPossible} HP</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[#888888]">Custo:</span>
                    <span className="text-2xl font-bold text-yellow-400">
                      ${(maxHealPossible * HP_COST_PER_POINT).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => heal(true)}
                    disabled={healing || player.cash < maxHealPossible * HP_COST_PER_POINT}
                    className={`w-full py-3 rounded-lg font-bold transition-all ${
                      !healing && player.cash >= maxHealPossible * HP_COST_PER_POINT
                        ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white'
                        : 'bg-[#222222] text-[#555555] cursor-not-allowed'
                    }`}
                  >
                    {healing ? "A curar..." : player.cash >= maxHealPossible * HP_COST_PER_POINT ? "Curar Totalmente" : "Dinheiro Insuficiente"}
                  </button>
                </div>

                {/* Custom Heal Amount */}
                <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#333333]">
                  <h3 className="font-bold mb-3">Cura Personalizada</h3>
                  
                  <div className="mb-4">
                    <label className="text-sm text-[#888888] mb-2 block">
                      Quantidade de HP ({HP_COST_PER_POINT}$ por HP)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={maxHealPossible}
                      value={healAmount}
                      onChange={(e) => handleHealAmountChange(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-[#888888]">0</span>
                      <span className="text-green-400 font-bold">+{healAmount} HP</span>
                      <span className="text-[#888888]">{maxHealPossible}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[#888888]">Custo:</span>
                    <span className="text-xl font-bold text-yellow-400">
                      ${healCost.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => heal(false)}
                    disabled={healing || player.cash < healCost || healAmount === 0}
                    className={`w-full py-3 rounded-lg font-bold transition-all ${
                      !healing && player.cash >= healCost && healAmount > 0
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white'
                        : 'bg-[#222222] text-[#555555] cursor-not-allowed'
                    }`}
                  >
                    {healing ? "A curar..." : healAmount === 0 ? "Seleciona a quantidade" : `Curar ${healAmount} HP`}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-8 rounded-xl bg-green-900/20 border-2 border-green-600 text-center">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-xl font-bold text-green-400 mb-2">
                  Estás em Perfeita Saúde!
                </p>
                <p className="text-sm text-[#888888]">
                  Não precisas de tratamento
                </p>
              </div>
            )}

            {/* Info */}
            <div className="mt-6 p-3 rounded-lg bg-blue-900/20 border border-blue-600">
              <p className="text-xs text-blue-300">
                💡 <strong>Nota:</strong> O tratamento usa dinheiro limpo, não dinheiro sujo. Cada ponto de HP custa ${HP_COST_PER_POINT}.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
