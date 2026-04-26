"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

type Card = { suit: string; value: string };

const RED_SUITS = ["♥", "♦"];

function CardComponent({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  if (hidden) return (
    <div className="ce-playing-card ce-playing-card-back">🂠</div>
  );
  const isRed = RED_SUITS.includes(card.suit);
  return (
    <div className={`ce-playing-card ${isRed ? "ce-playing-card-red" : "ce-playing-card-black"}`}>
      <span className="text-sm font-bold leading-none">{card.value}{card.suit}</span>
      <span className="text-lg text-center leading-none">{card.suit}</span>
      <span className="text-sm font-bold leading-none self-end rotate-180">{card.value}{card.suit}</span>
    </div>
  );
}

const RESULT_MSGS: Record<string, { text: string; color: string }> = {
  blackjack:         { text: "🃏 BLACKJACK! +1.25x aposta", color: "text-yellow-400" },
  dealer_blackjack:  { text: "💀 Dealer tem Blackjack!", color: "text-red-400" },
  win:               { text: "🏆 Ganhaste! +1x aposta", color: "text-green-400" },
  push:              { text: "🤝 Empate! Recebes 0.5x aposta", color: "text-yellow-400" },
  loss:              { text: "💸 Perdeste!", color: "text-red-400" },
  bust:              { text: "💥 Rebentaste!", color: "text-red-400" },
};

export default function BlackjackPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number; level: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [status, setStatus] = useState<"idle" | "active" | "finished">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [payout, setPayout] = useState(0);
  const [bet, setBet] = useState(500);
  const [canDouble, setCanDouble] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [fee, setFee] = useState(0);
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number; cryptoAtRisk: number } | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/crime-empire/gambling/blackjack");
    const data = await res.json();
    setPlayer(data.player);
    if (data.activeSession) {
      const s = data.activeSession;
      setSessionId(s.id);
      setPlayerHand(s.playerHand);
      setDealerHand(s.dealerHand);
      setPlayerValue(s.playerValue);
      setDealerValue(s.dealerValue);
      setCanDouble(s.canDouble);
      setStatus("active");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  const deal = async () => {
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/blackjack", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deal", bet }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); setActing(false); return; }
    setSessionId(data.sessionId);
    setPlayerHand(data.playerHand);
    setDealerHand(data.dealerHand);
    setPlayerValue(data.playerValue);
    setDealerValue(data.dealerValue);
    setStatus(data.status);
    setResult(data.result);
    setPayout(data.payout ?? 0);
    setCanDouble(data.canDouble);
    setFee(data.fee);
    setPlayer((p) => p ? { ...p, dirty_cash: p.dirty_cash - bet - data.fee, crypto: data.status === "finished" ? p.crypto + (data.payout ?? 0) : p.crypto } : p);
    setActing(false);
  };

  const action = async (act: "hit" | "stand" | "double") => {
    if (!sessionId) return;
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/blackjack", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act, sessionId }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); setActing(false); return; }
    setPlayerHand(data.playerHand);
    setDealerHand(data.dealerHand);
    setPlayerValue(data.playerValue);
    setDealerValue(data.dealerValue);
    setStatus(data.status);
    setResult(data.result ?? null);
    setPayout(data.payout ?? 0);
    setCanDouble(false);
    if (data.status === "finished") {
      if (data.escape_token) {
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20, cryptoAtRisk: data.crypto_at_risk ?? 0 });
      }
      const res2 = await fetch("/api/crime-empire/gambling/blackjack");
      const d2 = await res2.json();
      setPlayer(d2.player);
      notifyPlayerUpdate();
    }
    setActing(false);
  };

  const reset = () => { setStatus("idle"); setResult(null); setSessionId(null); setPlayerHand([]); setDealerHand([]); };

  if (loading) return <div className="flex-1 flex items-center justify-center text-white">A carregar...</div>;

  return (
    <div className="flex-1 text-white min-h-screen" style={{ background: "#080d0a" }}>
      <div className="ce-noise" />
      <div className="absolute inset-0 pointer-events-none z-0 ce-blackjack-header" style={{ height: "300px" }} />
      <div className="relative z-10 py-8 px-4 max-w-2xl mx-auto">

        {/* Header */}
        <div className="ce-page-header">
          <Link href="/jogos/crime-empire/gambling" className="inline-flex items-center gap-1.5 ce-text-muted hover:text-white text-xs font-semibold mb-4 transition-colors">
            ← Casino
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: "linear-gradient(145deg, rgba(34,197,94,0.2), rgba(21,128,61,0.1))", border: "1px solid rgba(34,197,94,0.3)" }}>
              🃏
            </div>
            <div>
              <p className="ce-page-eyebrow">Underground Casino</p>
              <h1 className="text-3xl font-black text-white">BLACKJACK</h1>
            </div>
          </div>
          <div className="ce-page-divider mt-3" style={{ background: "linear-gradient(90deg, rgba(34,197,94,0.4), rgba(34,197,94,0.1), transparent)" }} />
        </div>

        {/* Balances */}
        {player && (
          <div className="flex gap-3 mb-5">
            <div className="ce-stat flex-1">
              <span className="text-lg">💵</span>
              <div>
                <p className="ce-stat-label text-[9px]">Dinheiro Sujo</p>
                <p className="ce-stat-value ce-text-green">${player.dirty_cash.toLocaleString()}</p>
              </div>
            </div>
            <div className="ce-stat flex-1">
              <span className="text-lg">🪙</span>
              <div>
                <p className="ce-stat-label text-[9px]">Crypto</p>
                <p className="ce-stat-value ce-text-gold">{player.crypto.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Felt Table */}
        <div className="ce-felt-table p-6 mb-5">
          {/* Dealer */}
          <div className="mb-6">
            <p className="ce-stat-label text-xs mb-3 flex items-center gap-2">
              <span>DEALER</span>
              {status !== "idle" && <span className="ce-badge ce-badge-red">{dealerValue}</span>}
            </p>
            <div className="flex gap-2 flex-wrap min-h-[96px]">
              {dealerHand.map((c, i) => <CardComponent key={i} card={c} hidden={c.value === "?" && c.suit === "?"} />)}
            </div>
          </div>
          <div className="border-t border-green-800/60 my-4" />
          {/* Player */}
          <div>
            <p className="ce-stat-label text-xs mb-3 flex items-center gap-2">
              <span>TU</span>
              {status !== "idle" && <span className="ce-badge ce-badge-green">{playerValue}</span>}
            </p>
            <div className="flex gap-2 flex-wrap min-h-[96px]">
              {playerHand.map((c, i) => <CardComponent key={i} card={c} />)}
            </div>
          </div>
        </div>

        {/* Result */}
        {result && RESULT_MSGS[result] && (
          <div className={`ce-card rounded-2xl p-4 mb-5 text-center ${result === "win" || result === "blackjack" ? "ce-card-green" : result === "push" ? "" : "ce-card-red"}`}>
            <p className={`text-xl font-black ${RESULT_MSGS[result].color}`}>{RESULT_MSGS[result].text}</p>
            {payout > 0 && <p className="ce-text-gold font-black text-lg mt-1">🪙 +{payout.toLocaleString()} crypto</p>}
          </div>
        )}

        {/* Controls */}
        {status === "idle" || status === "finished" ? (
          <div className="ce-card rounded-2xl p-4 space-y-3">
            {status === "finished" && (
              <button onClick={reset} className="ce-btn ce-btn-ghost w-full py-3 rounded-xl">Nova Mão</button>
            )}
            {status === "idle" && (
              <>
                <div className="flex items-center gap-3">
                  <p className="ce-stat-label text-[10px] w-16">Aposta</p>
                  <input type="number" value={bet}
                    onChange={(e) => setBet(Math.min(100000, Math.max(100, parseInt(e.target.value) || 0)))}
                    className="ce-input flex-1" min={100} step={500} max={100000} />
                </div>
                {fee > 0 && <p className="text-xs text-orange-400">+ taxa casino: ${fee.toLocaleString()}</p>}
                {player && (
                  <p className="text-xs text-orange-400/60">
                    ⚠️ 15% risco de prisão · 💎 em risco: {Math.min(player.crypto, bet).toLocaleString()} crypto
                  </p>
                )}
                <button onClick={deal} disabled={acting} className="ce-btn ce-btn-success w-full py-3 rounded-xl">
                  {acting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A distribuir...</> : "🃏 Distribuir"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => action("hit")} disabled={acting} className="ce-btn ce-btn-primary flex-1 py-3 rounded-xl">🎴 Pedir</button>
            <button onClick={() => action("stand")} disabled={acting} className="ce-btn ce-btn-danger flex-1 py-3 rounded-xl">✋ Parar</button>
            {canDouble && <button onClick={() => action("double")} disabled={acting} className="ce-btn ce-btn-gold flex-1 py-3 rounded-xl">✌️ Dobrar</button>}
          </div>
        )}
      </div>
      {arrestEscape && (
        <RaidEscape
          difficulty="medium"
          cashAtRisk={bet}
          cryptoAtRisk={arrestEscape.cryptoAtRisk}
          onEscape={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: true }),
            });
            fetchState();
          }}
          onArrested={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: false }),
            });
            router.push("/jogos/crime-empire/jail");
          }}
        />
      )}
    </div>
  );
}

