"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

type TileState = null | "safe" | "mine";

const MINE_PRESETS = [1, 3, 5, 10, 15, 20, 24];

export default function MinesPage() {
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number; level: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<TileState[]>(new Array(25).fill(null));
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [currentPayout, setCurrentPayout] = useState(0);
  const [bet, setBet] = useState(500);
  const [mineCount, setMineCount] = useState(3);
  const [status, setStatus] = useState<"idle" | "active" | "finished">("idle");
  const [gameResult, setGameResult] = useState<"cashout" | "mine" | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [fee, setFee] = useState(0);
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/crime-empire/gambling/mines");
    const data = await res.json();
    setPlayer(data.player);
    if (data.activeSession) {
      const s = data.activeSession;
      setSessionId(s.id);
      setRevealed(s.revealed);
      setRevealedCount(s.revealedCount);
      setCurrentMultiplier(s.currentMultiplier);
      setCurrentPayout(s.currentPayout);
      setMineCount(s.mineCount);
      setStatus("active");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  const startGame = async () => {
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/mines", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", bet, mineCount }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); setActing(false); return; }
    setSessionId(data.sessionId);
    setRevealed(new Array(25).fill(null));
    setRevealedCount(0);
    setCurrentMultiplier(1);
    setCurrentPayout(bet);
    setFee(data.fee);
    setStatus("active");
    setGameResult(null);
    setPlayer((p) => p ? { ...p, dirty_cash: p.dirty_cash - bet - data.fee } : p);
    setActing(false);
  };

  const revealTile = async (idx: number) => {
    if (status !== "active" || revealed[idx] !== null || acting) return;
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/mines", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reveal", sessionId, tileIndex: idx }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); setActing(false); return; }
    setRevealed(data.revealed);
    if (data.hit === "mine") {
      setStatus("finished");
      setGameResult("mine");
      setCurrentPayout(0);
      setPlayer((p) => p ? { ...p } : p);
    } else {
      setRevealedCount(data.revealedCount);
      setCurrentMultiplier(data.currentMultiplier);
      setCurrentPayout(data.currentPayout);
      if (data.revealedCount === 25 - mineCount) {
        // All safe tiles revealed
        await cashout();
        return;
      }
    }
    setActing(false);
  };

  const cashout = async () => {
    if (!sessionId) return;
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/mines", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cashout", sessionId }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); setActing(false); return; }
    setStatus("finished");
    setGameResult("cashout");
    setCurrentPayout(data.payout);
    setCurrentMultiplier(data.multiplier);
    setPlayer((p) => p ? { ...p, crypto: p.crypto + data.payout } : p);
    notifyPlayerUpdate();
    if (data.escape_token) {
      setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20 });
    }
    setActing(false);
  };

  const reset = () => { setStatus("idle"); setGameResult(null); setSessionId(null); setRevealed(new Array(25).fill(null)); setRevealedCount(0); };

  if (loading) return <div className="flex-1 flex items-center justify-center text-white">A carregar...</div>;

  return (
    <div className="flex-1 text-white py-10 px-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Link href="/jogos/crime-empire/gambling" className="text-sm text-[#888] hover:text-[#ff6a00] mb-2 inline-block">← Casino</Link>
          <h1 className="text-4xl font-black text-red-400">💣 MINES</h1>
        </div>

        {player && (
          <div className="flex gap-4 mb-6 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">🪙 <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}

        {/* Multiplier display */}
        {status === "active" && (
          <div className="mb-4 p-4 rounded-xl bg-[#1a1a1a] border border-[#333] flex justify-between items-center">
            <div>
              <p className="text-xs text-[#888]">Multiplicador</p>
              <p className="text-2xl font-black text-yellow-400">{currentMultiplier}x</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#888]">Cashout disponível</p>
              <p className="text-2xl font-black text-green-400">🪙{currentPayout.toLocaleString()}</p>
            </div>
            <button onClick={cashout} disabled={acting || revealedCount === 0} className="px-5 py-3 rounded-lg bg-green-700 hover:bg-green-600 font-bold disabled:opacity-40">
              💰 Cashout
            </button>
          </div>
        )}

        {/* Result */}
        {gameResult === "mine" && <div className="mb-4 text-center text-2xl font-black text-red-400">💥 BOOM! Perdeste tudo!</div>}
        {gameResult === "cashout" && <div className="mb-4 text-center text-2xl font-black text-green-400">✅ Cashout! 🪙+{currentPayout.toLocaleString()} ({currentMultiplier}x)</div>}

        {/* Grid */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {Array.from({ length: 25 }).map((_, i) => {
            const state = revealed[i];
            let bg = "bg-[#222] hover:bg-[#2a2a2a] border-[#333] cursor-pointer";
            let icon = "❓";
            if (state === "safe") { bg = "bg-green-900/40 border-green-600/60 cursor-default"; icon = "💎"; }
            if (state === "mine") { bg = "bg-red-900/60 border-red-600/60 cursor-default"; icon = "💣"; }
            return (
              <button key={i} onClick={() => revealTile(i)}
                className={`h-14 rounded-lg border-2 text-2xl transition-all ${bg} ${status !== "active" || state !== null ? "cursor-default" : ""}`}
                disabled={status !== "active" || state !== null || acting}
              >{icon}</button>
            );
          })}
        </div>

        {/* Controls */}
        {status === "idle" || status === "finished" ? (
          <div className="space-y-3">
            {status === "finished" && <button onClick={reset} className="w-full py-3 rounded-lg bg-[#1a1a1a] border border-[#333] font-bold hover:bg-[#222]">Novo Jogo</button>}
            {status === "idle" && (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-[#888]">Aposta</label>
                    <input type="number" value={bet} onChange={(e) => setBet(Math.min(10000, Math.max(100, parseInt(e.target.value) || 100)))}
                      className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white mt-1" min={100} max={10000} step={100} />
                  </div>
                  <div>
                    <label className="text-xs text-[#888]">Minas</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {MINE_PRESETS.map((m) => (
                        <button key={m} onClick={() => setMineCount(m)}
                          className={`px-2 py-1 rounded text-sm font-bold border ${mineCount === m ? "bg-red-700 border-red-500" : "bg-[#1a1a1a] border-[#333] hover:border-red-500"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {fee > 0 && <p className="text-xs text-orange-400">+ taxa casino: ${fee.toLocaleString()}</p>}
                <button onClick={startGame} disabled={acting} className="w-full py-3 rounded-lg bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 font-bold disabled:opacity-50">
                  {acting ? "A iniciar..." : "💣 Iniciar"}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      {arrestEscape && (
        <RaidEscape
          difficulty="low"
          cashAtRisk={0}
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

