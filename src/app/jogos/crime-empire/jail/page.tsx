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
    <div className="flex-1 text-white min-h-screen ce-jail-bg">
      <div className="ce-noise" />
      <div className="relative z-10 py-12 px-4 max-w-2xl mx-auto">

        {/* Header */}
        <div className="ce-page-header mb-8">
          <p className="ce-page-eyebrow">Crime Empire</p>
          <h1 className="ce-page-title"><span className="ce-page-title-accent">PRISÃO</span></h1>
          <p className="ce-text-muted text-sm mt-1">Sistema de detenção criminal</p>
          <div className="ce-page-divider" style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.4), rgba(239,68,68,0.1), transparent)" }} />
        </div>

        {player.in_jail ? (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="ce-jail-card space-y-4">
            <div className="text-center py-4">
              <div className="text-6xl mb-3">🚔</div>
              <h2 className="text-3xl font-black ce-text-red mb-1">ESTÁS PRESO!</h2>
              <p className="ce-text-muted text-sm">Foste apanhado a cometer um crime</p>
            </div>
            <div className="ce-countdown text-center py-5">
              <p className="ce-stat-label text-[10px] mb-2">Tempo Restante</p>
              <p className="text-5xl font-black ce-text-red" style={{ fontVariantNumeric: "tabular-nums" }}>{timeRemaining}</p>
            </div>
            <div className="ce-card p-5 rounded-2xl">
              <h3 className="font-black text-base ce-text-gold mb-3 flex items-center gap-2"><span>💰</span> Libertação Antecipada</h3>
              <p className="ce-text-muted text-xs mb-4">Paga a fiança para sair imediatamente da prisão usando dinheiro limpo.</p>
              <div className="flex justify-between items-center mb-2">
                <span className="ce-stat-label text-[10px]">Custo da Fiança</span>
                <span className="font-black text-xl ce-text-gold">${earlyReleaseCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mb-5">
                <span className="ce-stat-label text-[10px]">Teu Dinheiro Limpo</span>
                <span className={`font-black text-base ${player.cash >= earlyReleaseCost ? "ce-text-green" : "ce-text-red"}`}>
                  ${player.cash.toLocaleString()}
                </span>
              </div>
              <button onClick={payForRelease} disabled={player.cash < earlyReleaseCost || releasing}
                className={`ce-btn w-full py-3.5 rounded-xl ${player.cash >= earlyReleaseCost && !releasing ? "ce-btn-gold" : "ce-btn-ghost opacity-40 cursor-not-allowed"}`}>
                {releasing ? "A processar..." : player.cash >= earlyReleaseCost ? "Pagar Fiança" : "Dinheiro Insuficiente"}
              </button>
            </div>
            <div className="ce-card p-4 rounded-xl" style={{ borderColor: "rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.06)" }}>
              <p className="text-xs text-blue-300/80">
                💡 <strong>Dica:</strong> Podes esperar pela libertação automática ou pagar a fiança usando dinheiro limpo.
              </p>
            </div>
            {hasValidEscapeToken() && (
              <div className="ce-card p-5 rounded-2xl" style={{ borderColor: "rgba(168,85,247,0.35)", background: "rgba(168,85,247,0.05)" }}>
                <h3 className="font-black text-base ce-text-purple mb-2 flex items-center gap-2">🏃 Tentativa de Fuga</h3>
                <p className="text-xs ce-text-muted mb-3">
                  Tens uma janela de oportunidade para fugir. Completa o minijogo para escapar — se falhares, perdes os ativos em risco.
                </p>
                {(player.escape_cash_at_risk > 0 || player.escape_crypto_at_risk > 0) && (
                  <div className="mb-4 space-y-1 text-xs">
                    {player.escape_cash_at_risk > 0 && <p className="text-pink-300">💸 Em risco: ${player.escape_cash_at_risk.toLocaleString()} dinheiro sujo</p>}
                    {player.escape_crypto_at_risk > 0 && <p className="text-purple-300">💎 Em risco: ${player.escape_crypto_at_risk.toLocaleString()} crypto</p>}
                  </div>
                )}
                <button onClick={() => setShowEscape(true)} className="ce-btn ce-btn-purple w-full py-3.5 rounded-xl">🏃 Tentar Fugir</button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="ce-card ce-card-green rounded-2xl p-8 text-center"
            style={{ boxShadow: "0 0 60px rgba(34,197,94,0.1)" }}>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-black ce-text-green mb-2">ESTÁS LIVRE!</h2>
            <p className="ce-text-muted mb-6">Não estás atualmente na prisão</p>
            <button onClick={() => router.push("/jogos/crime-empire/dashboard")} className="ce-btn ce-btn-primary px-8 py-3 rounded-xl">
              Voltar ao Dashboard
            </button>
          </motion.div>
        )}
      </div>

      {/* Escape Minigame Overlay */}
      {showEscape && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {escapeResult === null ? (
              <>
                <div className="mb-6 text-center">
                  <h2 className="text-3xl font-black ce-text-purple mb-1">🏃 Tentativa de Fuga</h2>
                  <p className="ce-text-muted text-sm">Completa o desafio para escapar da prisão</p>
                </div>
                <div className="ce-card p-5 rounded-2xl" style={{ borderColor: "rgba(168,85,247,0.3)" }}>
                  <CrimeMinigame difficulty={escapeDifficulty()} onSuccess={handleEscapeSuccess} onFail={handleEscapeFail} />
                </div>
                <button onClick={() => setShowEscape(false)}
                  className="mt-4 w-full py-2 rounded-xl ce-text-muted hover:text-white text-sm transition-colors">
                  Cancelar
                </button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-7xl">{escapeResult === "success" ? "🏃" : "👮"}</div>
                <h2 className={`text-4xl font-black ${escapeResult === "success" ? "ce-text-green" : "ce-text-red"}`}>
                  {escapeResult === "success" ? "FUGISTE!" : "FALHASTE!"}
                </h2>
                <p className="ce-text-muted">
                  {escapeResult === "success" ? "Conseguiste escapar da prisão!" : "Não conseguiste escapar. Os teus ativos foram confiscados."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
