"use client";

import { useState } from "react";
import Link from "next/link";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

const MAX_PICKS = 10;

export default function KenoPage() {
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number } | null>(null);
  const [bet, setBet] = useState(500);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [hits, setHits] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [payout, setPayout] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [revealedDrawn, setRevealedDrawn] = useState<number[]>([]);
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

  const loadPlayer = async () => {
    if (player) return;
    const res = await fetch("/api/crime-empire/gambling");
    const data = await res.json();
    setPlayer(data.player);
  };

  const togglePick = (n: number) => {
    if (hasResult) return;
    if (picks.includes(n)) { setPicks(picks.filter((p) => p !== n)); return; }
    if (picks.length >= MAX_PICKS) return;
    setPicks([...picks, n]);
  };

  const play = async () => {
    if (picks.length === 0) { alert("Escolhe pelo menos 1 número!"); return; }
    await loadPlayer();
    setPlaying(true);
    setHasResult(false);
    setRevealedDrawn([]);

    const res = await fetch("/api/crime-empire/gambling/keno", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bet, picks }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); setPlaying(false); return; }

    setDrawn(data.drawn);
    setHits(data.hits);
    setMultiplier(data.multiplier);
    setPayout(data.payout);

    // Reveal drawn numbers one by one
    for (let i = 0; i < data.drawn.length; i++) {
      await new Promise((r) => setTimeout(r, 80));
      setRevealedDrawn(data.drawn.slice(0, i + 1));
    }

    setHasResult(true);
    setPlaying(false);
    setPlayer((p) => p ? { dirty_cash: p.dirty_cash - bet - (data.fee ?? 0), crypto: p.crypto + data.payout } : p);
    notifyPlayerUpdate();
    if (data.escape_token) {
      setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20 });
    }
  };

  const reset = () => {
    setPicks([]);
    setDrawn([]);
    setRevealedDrawn([]);
    setHasResult(false);
    setHits(0);
    setMultiplier(0);
    setPayout(0);
  };

  const picksSet = new Set(picks);
  const drawnSet = new Set(drawn);
  const revealedSet = new Set(revealedDrawn);

  return (
    <div className="flex-1 text-white py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/jogos/crime-empire/gambling" className="text-sm text-[#888] hover:text-[#ff6a00] mb-2 inline-block">← Casino</Link>
          <h1 className="text-4xl font-black text-purple-400">🎱 KENO</h1>
          <p className="text-sm text-[#888]">Escolhe até 10 números (1–80). 20 serão sorteados.</p>
        </div>

        {player && (
          <div className="flex gap-4 mb-4 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">🪙 <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}

        {/* Picks info */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-[#888]">Selecionados: <span className="text-purple-400 font-bold">{picks.length}/{MAX_PICKS}</span></span>
          {picks.length > 0 && !hasResult && <button onClick={() => setPicks([])} className="text-xs text-red-400 hover:text-red-300">Limpar</button>}
          {hasResult && <button onClick={reset} className="text-xs text-purple-400 hover:text-purple-300 font-bold">Nova Ronda</button>}
        </div>

        {/* Number grid */}
        <div className="grid grid-cols-10 gap-1 mb-6">
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const isPicked = picksSet.has(n);
            const isDrawn = revealedSet.has(n);
            const isHit = isPicked && isDrawn;
            let cls = "h-8 rounded text-xs font-bold transition-all border ";
            if (isHit) cls += "bg-purple-600 border-purple-400 text-white scale-105";
            else if (isPicked) cls += "bg-[#2a1a3a] border-purple-500 text-purple-300";
            else if (isDrawn) cls += "bg-[#1a2a1a] border-green-700 text-green-400";
            else cls += "bg-[#1a1a1a] border-[#2a2a2a] text-[#666] hover:border-purple-600 hover:text-white";
            return (
              <button key={n} onClick={() => togglePick(n)} className={cls} disabled={hasResult}>{n}</button>
            );
          })}
        </div>

        {/* Result */}
        {hasResult && (
          <div className={`text-center p-4 rounded-xl mb-4 border ${payout > 0 ? "bg-purple-900/20 border-purple-500" : "bg-[#1a1a1a] border-[#333]"}`}>
            <p className="text-lg font-bold">{hits} acerto{hits !== 1 ? "s" : ""} em {picks.length} número{picks.length !== 1 ? "s" : ""}</p>
            {payout > 0
              ? <p className="text-2xl font-black text-green-400 mt-1">🪙 +{payout.toLocaleString()} ({multiplier}x)</p>
              : <p className="text-lg text-red-400 mt-1">Sem prémio desta vez!</p>}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-[#888]">Aposta</label>
            <input type="number" value={bet} onChange={(e) => setBet(Math.min(100000, Math.max(100, parseInt(e.target.value) || 100)))}
              className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white mt-1" min={100} max={100000} step={100} />
          </div>
          <div className="flex items-end">
            <button onClick={play} disabled={playing || picks.length === 0} onMouseEnter={loadPlayer}
              className="px-8 py-2 rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 font-bold disabled:opacity-50">
              {playing ? "A sortear..." : "🎱 Jogar"}
            </button>
          </div>
        </div>
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
            notifyPlayerUpdate();
          }}
          onArrested={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: false }),
            });
            notifyPlayerUpdate();
          }}
        />
      )}
    </div>
  );
}

