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
  addiction: number;
}

export default function HospitalPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [healAmount, setHealAmount] = useState(0);
  const [healCost, setHealCost] = useState(0);
  const [healing, setHealing] = useState(false);
  const [curing, setCuring] = useState(false);
  const [cureMsg, setCureMsg] = useState<string | null>(null);

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

  const cureAddiction = async () => {
    if (!player || curing || player.addiction <= 0) return;
    setCuring(true);
    setCureMsg(null);
    try {
      const res = await fetch("/api/crime-empire/hospital/heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cure_addiction" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCureMsg(`❌ ${data.error || "Erro ao desintoxicar"}`);
      } else {
        setCureMsg(data.message);
        fetchPlayer();
      }
    } catch {
      setCureMsg("❌ Erro ao processar tratamento");
    } finally {
      setCuring(false);
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
  const addiction = player.addiction ?? 0;
  const detoxCost = Math.max(500, addiction * 100);

  return (
    <div className="flex-1 text-white min-h-screen ce-hospital-bg">
      <div className="ce-noise" />
      <div className="relative z-10 py-12 px-4 max-w-3xl mx-auto">
        <div className="ce-page-header mb-8">
          <p className="ce-page-eyebrow">Crime Empire</p>
          <h1 className="ce-page-title">HOSPITAL <span className="ce-page-title-accent">PRISIONAL</span></h1>
          <p className="ce-text-muted text-sm mt-1">Recupera a tua saúde em troca de dinheiro limpo</p>
          <div className="ce-page-divider" style={{ background: "linear-gradient(90deg, rgba(34,197,94,0.4), rgba(34,197,94,0.1), transparent)" }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Health Status */}
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="ce-hospital-card space-y-4">
            <h2 className="font-black text-base flex items-center gap-2">❤️ Estado de Saúde</h2>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="ce-stat-label text-[10px]">HP Atual</span>
                <span className="font-black text-sm">{player.hp} / {player.max_hp}</span>
              </div>
              <div className="ce-progress-track h-6 rounded-lg overflow-hidden">
                <div className={`h-full rounded-lg transition-all duration-500 flex items-center justify-center text-xs font-black ${hpPercentage > 75 ? "ce-progress-fill-green" : hpPercentage > 25 ? "ce-progress-fill-orange" : "ce-progress-fill-red"}`}
                  style={{ width: `${hpPercentage}%` }}>
                  {hpPercentage.toFixed(0)}%
                </div>
              </div>
            </div>
            <div className={`ce-card p-3 rounded-xl ${isFullHealth ? "ce-card-green" : hpPercentage > 50 ? "" : "ce-card-red"}`}>
              <p className={`font-bold text-sm ${isFullHealth ? "ce-text-green" : hpPercentage > 50 ? "ce-text-orange" : "ce-text-red"}`}>
                {isFullHealth ? "✅ Estás em perfeita saúde!" : hpPercentage > 50 ? "⚠️ Tens alguns ferimentos" : "🚨 Estás gravemente ferido!"}
              </p>
            </div>
            <div className="ce-stat">
              <span className="text-lg">💵</span>
              <div>
                <p className="ce-stat-label text-[9px]">Dinheiro Limpo</p>
                <p className="ce-stat-value ce-text-green">${player.cash.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>

          {/* Healing Options */}
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="ce-hospital-card space-y-4">
            <h2 className="font-black text-base flex items-center gap-2">💊 Tratamento</h2>
            {!isFullHealth ? (
              <>
                <div className="ce-card ce-card-green p-4 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black text-sm ce-text-green">Cura Completa</span>
                    <span className="ce-badge ce-badge-green">+{maxHealPossible} HP</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="ce-stat-label text-[10px]">Custo</span>
                    <span className="font-black text-xl ce-text-gold">${(maxHealPossible * HP_COST_PER_POINT).toLocaleString()}</span>
                  </div>
                  <button onClick={() => heal(true)} disabled={healing || player.cash < maxHealPossible * HP_COST_PER_POINT}
                    className={`ce-btn w-full py-3 rounded-xl ${!healing && player.cash >= maxHealPossible * HP_COST_PER_POINT ? "ce-btn-success" : "ce-btn-ghost opacity-40 cursor-not-allowed"}`}>
                    {healing ? "A curar..." : player.cash >= maxHealPossible * HP_COST_PER_POINT ? "Curar Totalmente" : "Dinheiro Insuficiente"}
                  </button>
                </div>
                <div className="ce-card p-4 rounded-2xl space-y-3">
                  <h3 className="font-black text-sm">Cura Personalizada</h3>
                  <div>
                    <label className="ce-stat-label text-[10px] mb-2 block">Quantidade de HP ({HP_COST_PER_POINT}$ por HP)</label>
                    <input type="range" min="0" max={maxHealPossible} value={healAmount}
                      onChange={(e) => handleHealAmountChange(parseInt(e.target.value))}
                      className="w-full accent-orange-500" />
                    <div className="flex justify-between text-xs mt-1">
                      <span className="ce-text-muted">0</span>
                      <span className="ce-text-orange font-black">+{healAmount} HP</span>
                      <span className="ce-text-muted">{maxHealPossible}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="ce-stat-label text-[10px]">Custo</span>
                    <span className="font-black text-lg ce-text-gold">${healCost.toLocaleString()}</span>
                  </div>
                  <button onClick={() => heal(false)} disabled={healing || player.cash < healCost || healAmount === 0}
                    className={`ce-btn w-full py-3 rounded-xl ${!healing && player.cash >= healCost && healAmount > 0 ? "ce-btn-primary" : "ce-btn-ghost opacity-40 cursor-not-allowed"}`}>
                    {healing ? "A curar..." : healAmount === 0 ? "Seleciona a quantidade" : `Curar ${healAmount} HP`}
                  </button>
                </div>
              </>
            ) : (
              <div className="ce-card ce-card-green p-8 rounded-2xl text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-black ce-text-green text-lg mb-1">Estás em Perfeita Saúde!</p>
                <p className="ce-text-muted text-sm">Não precisas de tratamento</p>
              </div>
            )}
            <div className="ce-card p-3 rounded-xl" style={{ borderColor: "rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.06)" }}>
              <p className="text-xs text-blue-300/80">💡 <strong>Nota:</strong> O tratamento usa dinheiro limpo. Cada HP custa ${HP_COST_PER_POINT}.</p>
            </div>
          </motion.div>
        </div>

        {/* Addiction Section */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className={`ce-card p-5 rounded-2xl ${addiction > 0 ? "ce-card-purple" : ""}`}
          style={addiction > 0 ? { boxShadow: "0 0 40px rgba(168,85,247,0.1)" } : {}}>
          <h2 className="font-black text-base flex items-center gap-2 mb-4">💊 Vício</h2>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="ce-stat-label text-[10px]">Nível de Vício</span>
              <span className={`font-black text-sm ${addiction === 0 ? "ce-text-green" : addiction < 40 ? "ce-text-orange" : "ce-text-red"}`}>{addiction}%</span>
            </div>
            <div className="ce-progress-track h-4 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${addiction === 0 ? "ce-progress-fill-green" : addiction < 40 ? "ce-progress-fill-orange" : "ce-progress-fill-red"}`}
                style={{ width: `${addiction}%` }} />
            </div>
          </div>
          {addiction === 0 ? (
            <div className="ce-card ce-card-green p-3 rounded-xl">
              <p className="ce-text-green text-sm font-semibold">✅ Sem vício. Os teus stats estão no máximo!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="ce-card p-4 rounded-xl" style={{ borderColor: "rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.06)" }}>
                <p className="ce-text-purple font-black text-sm mb-1">⚠️ Efeitos do Vício</p>
                <p className="ce-text-muted text-xs">Stats reduzidos em <span className="ce-text-red font-black">{((addiction / 100) * 50).toFixed(0)}%</span>. Taxa de sucesso em crimes penalizada.</p>
              </div>
              <div className="ce-card ce-card-purple p-4 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-black text-sm ce-text-purple">Desintoxicação Completa</span>
                  <span className="ce-badge ce-badge-purple">Vício → 0%</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="ce-stat-label text-[10px]">Custo</span>
                  <span className="font-black text-2xl ce-text-gold">${detoxCost.toLocaleString()}</span>
                </div>
                <button onClick={cureAddiction} disabled={curing || player.cash < detoxCost}
                  className={`ce-btn w-full py-3 rounded-xl ${!curing && player.cash >= detoxCost ? "ce-btn-purple" : "ce-btn-ghost opacity-40 cursor-not-allowed"}`}>
                  {curing ? "A desintoxicar..." : player.cash >= detoxCost ? "💉 Desintoxicar" : "Dinheiro Insuficiente"}
                </button>
              </div>
              {cureMsg && (
                <div className={`p-3 rounded-lg text-sm font-semibold ${cureMsg.startsWith("❌") ? "ce-card ce-card-red" : "ce-card ce-card-green"}`}>
                  {cureMsg}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
