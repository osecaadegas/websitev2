"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

type Card = { suit: string; value: string };

const RED_SUITS = ["♥", "♦"];

function CardComponent({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  if (hidden) return (
    <div className="w-16 h-24 rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 border-2 border-blue-500 flex items-center justify-center text-2xl shadow-lg">🂠</div>
  );
  const isRed = RED_SUITS.includes(card.suit);
  return (
    <div className={`w-16 h-24 rounded-lg bg-white border-2 border-gray-300 flex flex-col justify-between p-1.5 shadow-lg ${isRed ? "text-red-600" : "text-gray-900"}`}>
      <span className="text-sm font-bold leading-none">{card.value}{card.suit}</span>
      <span className="text-lg text-center leading-none">{card.suit}</span>
      <span className="text-sm font-bold leading-none self-end rotate-180">{card.value}{card.suit}</span>
    </div>
  );
}

const RESULT_MSGS: Record<string, { text: string; color: string }> = {
  blackjack:         { text: "🃏 BLACKJACK! +2.5x", color: "text-yellow-400" },
  dealer_blackjack:  { text: "💀 Dealer tem Blackjack!", color: "text-red-400" },
  win:               { text: "🏆 Ganhaste! +2x", color: "text-green-400" },
  push:              { text: "🤝 Empate! Aposta devolvida", color: "text-yellow-400" },
  loss:              { text: "💸 Perdeste!", color: "text-red-400" },
  bust:              { text: "💥 Rebentaste!", color: "text-red-400" },
};

export default function BlackjackPage() {
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
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

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
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20 });
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
    <div className="flex-1 text-white py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/jogos/crime-empire/gambling" className="text-sm text-[#888] hover:text-[#ff6a00] mb-2 inline-block">← Casino</Link>
          <h1 className="text-4xl font-black text-green-400">🃏 BLACKJACK</h1>
        </div>

        {/* Balances */}
        {player && (
          <div className="flex gap-4 mb-6 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">🪙 <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl bg-[#0d2a1a] border-2 border-green-700 p-6 mb-6">
          {/* Dealer */}
          <div className="mb-6">
            <p className="text-sm text-[#888] mb-2">Dealer {status !== "idle" && `(${dealerValue})`}</p>
            <div className="flex gap-2 flex-wrap min-h-[96px]">
              {dealerHand.map((c, i) => <CardComponent key={i} card={c} hidden={c.value === "?" && c.suit === "?"} />)}
            </div>
          </div>
          <div className="border-t border-green-800 my-4" />
          {/* Player */}
          <div>
            <p className="text-sm text-[#888] mb-2">Tu {status !== "idle" && `(${playerValue})`}</p>
            <div className="flex gap-2 flex-wrap min-h-[96px]">
              {playerHand.map((c, i) => <CardComponent key={i} card={c} />)}
            </div>
          </div>
        </div>

        {/* Result */}
        {result && RESULT_MSGS[result] && (
          <div className={`text-center text-2xl font-black mb-4 ${RESULT_MSGS[result].color}`}>
            {RESULT_MSGS[result].text}
            {payout > 0 && <span className="block text-lg text-yellow-400 mt-1">🪙 +{payout.toLocaleString()} crypto</span>}
          </div>
        )}

        {/* Controls */}
        {status === "idle" || status === "finished" ? (
          <div className="space-y-3">
            {status === "finished" && <button onClick={reset} className="w-full py-3 rounded-lg bg-[#1a1a1a] border border-[#333] font-bold hover:bg-[#222]">Nova Mão</button>}
            {status === "idle" && (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[#888] w-20">Aposta:</label>
                  <input type="number" value={bet} onChange={(e) => setBet(Math.min(100000, Math.max(100, parseInt(e.target.value) || 0)))}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white"
                    min={100} step={500} max={100000} />
                </div>
                {fee > 0 && <p className="text-xs text-orange-400">+ taxa casino: ${fee.toLocaleString()}</p>}
                <button onClick={deal} disabled={acting} className="w-full py-3 rounded-lg bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 font-bold disabled:opacity-50">
                  {acting ? "A distribuir..." : "🃏 Distribuir"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => action("hit")} disabled={acting} className="flex-1 py-3 rounded-lg bg-blue-700 hover:bg-blue-600 font-bold disabled:opacity-50">🎴 Pedir</button>
            <button onClick={() => action("stand")} disabled={acting} className="flex-1 py-3 rounded-lg bg-red-700 hover:bg-red-600 font-bold disabled:opacity-50">✋ Parar</button>
            {canDouble && <button onClick={() => action("double")} disabled={acting} className="flex-1 py-3 rounded-lg bg-yellow-700 hover:bg-yellow-600 font-bold disabled:opacity-50">✌️ Dobrar</button>}
          </div>
        )}
      </div>
      {arrestEscape && (
        <RaidEscape
          difficulty="medium"
          cashAtRisk={bet}
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
            fetchState();
          }}
        />
      )}
    </div>
  );
}

