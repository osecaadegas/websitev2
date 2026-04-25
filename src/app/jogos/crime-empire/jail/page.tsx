"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { CrimeMinigame } from "@/components/crime-empire/minigames/CrimeMinigame";
import type { GameDifficulty } from "@/components/crime-empire/minigames/gameConfig";

interface Player {
  id: string;
  username: string;
  level: number;
  cash: number;
  dirty_cash: number;
  in_jail: boolean;
  jail_release_at: string | null;
  escape_token: string | null;
  escape_token_expires_at: string | null;
  escape_cash_at_risk: number;
  escape_crypto_at_risk: number;
}

export default function JailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [earlyReleaseCost, setEarlyReleaseCost] = useState(0);
  const [releasing, setReleasing] = useState(false);
  const [showEscape, setShowEscape] = useState(false);
  const [escapeResult, setEscapeResult] = useState<"success" | "fail" | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchPlayer();
  }, [user]);

  useEffect(() => {
    if (player?.in_jail && player.jail_release_at) {
      const interval = setInterval(() => {
        updateTimeRemaining();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [player]);

  const fetchPlayer = async () => {
    try {
      const res = await fetch("/api/crime-empire/player");
      const data = await res.json();
      if (data.player) {
        setPlayer(data.player);
        if (data.player.in_jail && data.player.jail_release_at) {
          calculateEarlyReleaseCost(data.player.jail_release_at);
        }
      }
    } catch (error) {
      console.error("Error fetching player:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTimeRemaining = () => {
    if (!player?.jail_release_at) return;

    const now = new Date();
    const release = new Date(player.jail_release_at);
    const diff = release.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeRemaining("A libertar...");
      setEarlyReleaseCost(0);
      setTimeout(() => fetchPlayer(), 1000);
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    setTimeRemaining(`${minutes}m ${seconds}s`);

    // Update bail cost every second so it counts down in real-time
    const minutesRemaining = Math.ceil(diff / 60000);
    setEarlyReleaseCost(Math.max(0, minutesRemaining * 1000));
  };

  const calculateEarlyReleaseCost = (releaseAt: string) => {
    const now = new Date();
    const release = new Date(releaseAt);
    const minutesRemaining = Math.ceil((release.getTime() - now.getTime()) / 60000);
    // Cost: $1000 per minute remaining
    const cost = Math.max(0, minutesRemaining * 1000);
    setEarlyReleaseCost(cost);
  };

  const hasValidEscapeToken = (): boolean => {
    if (!player?.escape_token || !player?.escape_token_expires_at) return false;
    return new Date(player.escape_token_expires_at) > new Date();
  };

  const escapeDifficulty = (): GameDifficulty => {
    const lvl = player?.level ?? 1;
    if (lvl < 10) return "low";
    if (lvl < 25) return "medium";
    return "high";
  };

  const handleEscapeSuccess = async () => {
    try {
      const res = await fetch("/api/crime-empire/escape-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: player?.escape_token, escaped: true }),
      });
      setEscapeResult("success");
      if (res.ok) setTimeout(() => { fetchPlayer(); setShowEscape(false); setEscapeResult(null); }, 2500);
    } catch {
      setEscapeResult("success");
    }
  };

  const handleEscapeFail = async () => {
    try {
      await fetch("/api/crime-empire/escape-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: player?.escape_token, escaped: false }),
      });
    } catch { /* ignore */ }
    setEscapeResult("fail");
    setTimeout(() => { fetchPlayer(); setShowEscape(false); setEscapeResult(null); }, 2500);
  };

  const payForRelease = async () => {    if (!player || releasing) return;

    if (player.cash < earlyReleaseCost) {
      alert("Não tens dinheiro suficiente para pagar a fiança!");
      return;
    }

    setReleasing(true);

    try {
      const res = await fetch("/api/crime-empire/jail/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao libertar da prisão");
        setReleasing(false);
        return;
      }

      alert("✅ Libertado da prisão!");
      fetchPlayer();
    } catch (error) {
      console.error("Error releasing from jail:", error);
      alert("Erro ao processar libertação");
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">A carregar...</div>
      </div>
    );
  }

  if (!player) return null;

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
          🚔 Prisão
        </h1>
        <p className="text-[#888888] mb-8">
          Sistema de detenção criminal
        </p>

        {player.in_jail ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-8 rounded-2xl bg-gradient-to-br from-red-900/30 to-red-800/30 border-2 border-red-600"
          >
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🚔</div>
              <h2 className="text-3xl font-black text-red-400 mb-2">ESTÁS PRESO!</h2>
              <p className="text-[#888888]">Foste apanhado a cometer um crime</p>
            </div>

            {/* Time Remaining */}
            <div className="mb-8 p-6 rounded-xl bg-[#0a0a0a] border border-red-600">
              <div className="text-center">
                <p className="text-sm text-[#888888] mb-2">Tempo Restante</p>
                <p className="text-4xl font-black text-red-400">{timeRemaining}</p>
              </div>
            </div>

            {/* Early Release Option */}
            <div className="p-6 rounded-xl bg-[#121212] border border-[#333333]">
              <h3 className="text-xl font-bold mb-4 text-yellow-400">💰 Libertação Antecipada</h3>
              <p className="text-sm text-[#888888] mb-4">
                Paga a fiança para sair imediatamente da prisão
              </p>

              <div className="flex justify-between items-center mb-4">
                <span className="text-[#888888]">Custo da Fiança:</span>
                <span className="text-2xl font-bold text-yellow-400">${earlyReleaseCost.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-[#888888]">Teu Dinheiro Limpo:</span>
                <span className={`text-lg font-bold ${player.cash >= earlyReleaseCost ? 'text-green-400' : 'text-red-400'}`}>
                  ${player.cash.toLocaleString()}
                </span>
              </div>

              <button
                onClick={payForRelease}
                disabled={player.cash < earlyReleaseCost || releasing}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                  player.cash >= earlyReleaseCost && !releasing
                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white'
                    : 'bg-[#222222] text-[#555555] cursor-not-allowed'
                }`}
              >
                {releasing ? "A processar..." : player.cash >= earlyReleaseCost ? "Pagar Fiança" : "Dinheiro Insuficiente"}
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 rounded-lg bg-blue-900/20 border border-blue-600">
              <p className="text-sm text-blue-300">
                💡 <strong>Dica:</strong> Podes esperar pela libertação automática ou pagar a fiança usando dinheiro limpo (não dinheiro sujo).
              </p>
            </div>

            {/* Escape Attempt */}
            {hasValidEscapeToken() && (
              <div className="mt-6 p-6 rounded-xl bg-slate-900/60 border border-purple-500/50">
                <h3 className="text-xl font-bold mb-2 text-purple-300">🏃 Tentativa de Fuga</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Tens uma janela de oportunidade para fugir. Completa o minijogo para escapar — se falhares, perdes os ativos em risco.
                </p>
                {(player.escape_cash_at_risk > 0 || player.escape_crypto_at_risk > 0) && (
                  <div className="mb-4 space-y-1 text-sm">
                    {player.escape_cash_at_risk > 0 && <p className="text-pink-300">💸 Em risco: ${player.escape_cash_at_risk.toLocaleString()} dinheiro sujo</p>}
                    {player.escape_crypto_at_risk > 0 && <p className="text-purple-300">💎 Em risco: ${player.escape_crypto_at_risk.toLocaleString()} crypto</p>}
                  </div>
                )}
                <button
                  onClick={() => setShowEscape(true)}
                  className="w-full py-4 rounded-xl font-black text-lg bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white transition-all hover:scale-[1.02] active:scale-95"
                >
                  🏃 Tentar Fugir
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-8 rounded-2xl bg-[#121212] border border-green-600 text-center"
          >
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-black text-green-400 mb-2">ESTÁS LIVRE!</h2>
            <p className="text-[#888888] mb-6">Não estás atualmente na prisão</p>
            
            <button
              onClick={() => router.push("/jogos/crime-empire/dashboard")}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-[#ff6a00] to-[#ff8533] text-white font-bold hover:scale-105 transition-all"
            >
              Voltar ao Dashboard
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Escape Minigame Overlay ── */}
      {showEscape && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {escapeResult === null ? (
              <>
                <div className="mb-6 text-center">
                  <h2 className="text-3xl font-black text-purple-300 mb-1">🏃 Tentativa de Fuga</h2>
                  <p className="text-slate-400 text-sm">Completa o desafio para escapar da prisão</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-purple-500/30">
                  <CrimeMinigame
                    difficulty={escapeDifficulty()}
                    onSuccess={handleEscapeSuccess}
                    onFail={handleEscapeFail}
                  />
                </div>
                <button
                  onClick={() => setShowEscape(false)}
                  className="mt-4 w-full py-2 rounded-xl text-slate-500 hover:text-slate-300 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-7xl">{escapeResult === "success" ? "🏃" : "👮"}</div>
                <h2 className={`text-4xl font-black ${escapeResult === "success" ? "text-green-400" : "text-red-400"}`}>
                  {escapeResult === "success" ? "FUGISTE!" : "FALHASTE!"}
                </h2>
                <p className="text-slate-400">
                  {escapeResult === "success"
                    ? "Conseguiste escapar da prisão!"
                    : "Não conseguiste escapar. Os teus ativos foram confiscados."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
