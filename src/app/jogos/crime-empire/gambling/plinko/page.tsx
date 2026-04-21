"use client";

import { useState } from "react";
import Link from "next/link";

const MULTIPLIERS: Record<string, number[]> = {
  low:    [0.5, 0.7, 1.0, 1.2, 1.4, 1.2, 1.0, 0.7, 0.5],
  medium: [0.2, 0.4, 0.7, 1.0, 3.5, 1.0, 0.7, 0.4, 0.2],
  high:   [0.0, 0.2, 0.3, 0.5, 12.0, 0.5, 0.3, 0.2, 0.0],
};

const SLOT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444"];

function PlinkoBoard({ flips, slot, playing }: { flips: boolean[]; slot: number; playing: boolean }) {
  const ROWS = 8;
  const SLOTS = 9;

  // Calculate ball path positions for each row
  const ballPositions: number[] = [];
  if (flips.length > 0) {
    let pos = 0;
    for (const f of flips) { pos += f ? 1 : 0; ballPositions.push(pos); }
  }

  return (
    <div className="relative w-full max-w-xs mx-auto">
      {/* Rows of pegs */}
      {Array.from({ length: ROWS }).map((_, row) => {
        const pegsInRow = row + 2;
        const ballAtRow = flips.length > 0 ? ballPositions[row] : -1;
        return (
          <div key={row} className="flex justify-center gap-3 my-1">
            {Array.from({ length: pegsInRow }).map((_, peg) => {
              const isBallHere = ballAtRow === peg || ballAtRow === peg - 1;
              return (
                <div key={peg} className={`w-4 h-4 rounded-full transition-all duration-300 ${isBallHere && !playing ? "bg-orange-400 scale-125" : "bg-[#444]"}`} />
              );
            })}
          </div>
        );
      })}

      {/* Slot buckets */}
      <div className="flex mt-3 gap-1">
        {MULTIPLIERS.low.map((_, i) => (
          <div key={i} className={`flex-1 py-2 rounded text-center text-xs font-bold transition-all ${!playing && slot === i ? "scale-110 ring-2 ring-white" : ""}`}
            style={{ backgroundColor: SLOT_COLORS[i] + "33", color: SLOT_COLORS[i], borderWidth: 1, borderColor: SLOT_COLORS[i] + "66" }}>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlinkoPage() {
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number } | null>(null);
  const [bet, setBet] = useState(1000);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [flips, setFlips] = useState<boolean[]>([]);
  const [slot, setSlot] = useState(-1);
  const [multiplier, setMultiplier] = useState(0);
  const [payout, setPayout] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const loadPlayer = async () => {
    if (player) return;
    const res = await fetch("/api/crime-empire/gambling");
    const data = await res.json();
    setPlayer(data.player);
  };

  const drop = async () => {
    await loadPlayer();
    setPlaying(true);
    setHasResult(false);
    setFlips([]);
    setSlot(-1);

    const res = await fetch("/api/crime-empire/gambling/plinko", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bet, risk }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); setPlaying(false); return; }

    // Animate ball drop row by row
    for (let i = 0; i < data.flips.length; i++) {
      await new Promise((r) => setTimeout(r, 150));
      setFlips(data.flips.slice(0, i + 1));
    }

    setSlot(data.slot);
    setMultiplier(data.multiplier);
    setPayout(data.payout);
    setHasResult(true);
    setPlaying(false);
    setPlayer((p) => p ? { dirty_cash: p.dirty_cash - bet - (data.fee ?? 0), crypto: p.crypto + data.payout } : p);
  };

  const mults = MULTIPLIERS[risk];

  return (
    <div className="flex-1 text-white py-10 px-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link href="/jogos/crime-empire/gambling" className="text-sm text-[#888] hover:text-[#ff6a00] mb-2 inline-block">← Casino</Link>
          <h1 className="text-4xl font-black text-blue-400">🎯 PLINKO</h1>
        </div>

        {player && (
          <div className="flex gap-4 mb-6 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">⚡ <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-[#888]">Aposta</label>
            <input type="number" value={bet} onChange={(e) => setBet(Math.max(100, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white mt-1" min={100} />
          </div>
          <div>
            <label className="text-xs text-[#888]">Risco</label>
            <div className="flex gap-1 mt-1">
              {(["low", "medium", "high"] as const).map((r) => (
                <button key={r} onClick={() => setRisk(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${risk === r ? "bg-blue-700 border-blue-500" : "bg-[#1a1a1a] border-[#333] hover:border-blue-500"}`}>
                  {r === "low" ? "Baixo" : r === "medium" ? "Médio" : "Alto"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={drop} disabled={playing}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 font-bold disabled:opacity-50 mb-6"
          onMouseEnter={loadPlayer}>
          {playing ? "A cair..." : "🎯 Largar Bola"}
        </button>

        {/* Board */}
        <div className="p-4 rounded-2xl bg-[#0a0a1a] border border-blue-900 mb-4">
          <PlinkoBoard flips={flips} slot={slot} playing={playing} />

          {/* Multiplier slots */}
          <div className="flex mt-2 gap-1">
            {mults.map((m, i) => (
              <div key={i} className={`flex-1 py-1 rounded text-center text-xs font-bold transition-all ${!playing && hasResult && slot === i ? "scale-110 ring-2 ring-white" : ""}`}
                style={{ backgroundColor: SLOT_COLORS[i] + "33", color: SLOT_COLORS[i] }}>
                {m}x
              </div>
            ))}
          </div>
        </div>

        {hasResult && !playing && (
          <div className={`text-center text-2xl font-black ${multiplier >= 1 ? "text-green-400" : "text-red-400"}`}>
            {multiplier}x → ⚡{payout.toLocaleString()}
            {payout === 0 && <span className="block text-base text-[#888] mt-1">Slot vazio. Tenta de novo!</span>}
          </div>
        )}
      </div>
    </div>
  );
}
