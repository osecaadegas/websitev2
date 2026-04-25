"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";

const MULTIPLIERS: Record<string, number[]> = {
  low:    [0.5, 0.7, 1.0, 1.3, 1.8, 1.3, 1.0, 0.7, 0.5],
  medium: [0.2, 0.4, 0.7, 1.0, 3.0, 1.0, 0.7, 0.4, 0.2],
  high:   [0.0, 0.2, 0.3, 0.5, 5.0, 0.5, 0.3, 0.2, 0.0],
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
              const isBallHere = ballAtRow === peg;
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
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number; addiction: number; level: number } | null>(null);
  const [casinoFee, setCasinoFee] = useState(0);
  const [bet, setBet] = useState(500);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [flips, setFlips] = useState<boolean[]>([]);
  const [slot, setSlot] = useState(-1);
  const [multiplier, setMultiplier] = useState(0);
  const [payout, setPayout] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number; cryptoAtRisk: number } | null>(null);

  const loadPlayer = async () => {
    if (player) return;
    const res = await fetch("/api/crime-empire/gambling");
    const data = await res.json();
    setPlayer(data.player);
    setCasinoFee(data.casinoFee ?? 0);
  };

  // Load on mount so addiction warning shows immediately
  useEffect(() => { loadPlayer(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setPlayer((p) => p ? {
      dirty_cash: p.dirty_cash - bet - (data.fee ?? 0),
      crypto: p.crypto + data.payout,
      addiction: Math.min(100, p.addiction + 2),
      level: p.level,
    } : p);
    notifyPlayerUpdate();
    if (data.escape_token) {
      setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_minutes ?? 20, cryptoAtRisk: data.crypto_at_risk ?? 0 });
    }
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
          <div className="flex gap-4 mb-4 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">🪙 <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}

        {/* Addiction warning — shown before playing so player is informed */}
        {player && player.addiction > 0 && (
          <div className={`rounded-xl p-3 mb-4 border text-xs ${
            player.addiction >= 70
              ? "bg-red-900/30 border-red-500/50 text-red-200"
              : player.addiction >= 30
              ? "bg-yellow-900/30 border-yellow-500/50 text-yellow-200"
              : "bg-orange-900/20 border-orange-500/30 text-orange-200"
          }`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold">
                {player.addiction >= 70 ? "🚨 Vício Grave" : player.addiction >= 30 ? "⚠️ Vício Moderado" : "💊 Vício Leve"}
              </span>
              <span className="font-mono font-bold">{player.addiction}%</span>
            </div>
            <p className="opacity-90">
              Penalidade nos crimes: <span className="font-bold">-{(player.addiction / 2).toFixed(1)}%</span> taxa de sucesso
            </p>
            {player.addiction >= 70 && (
              <p className="mt-0.5 font-bold text-red-300">Máximo: -{Math.min(50, player.addiction / 2).toFixed(0)}% nos crimes. Cada jogo piora.</p>
            )}
          </div>
        )}

        {/* Casino info hints */}
        <div className="rounded-xl p-3 mb-4 bg-[#0d0d0d] border border-[#222] text-xs text-gray-500 space-y-0.5">
          <p>💵 Apostar <strong className="text-white">Dinheiro Sujo</strong> → Ganhar <strong className="text-yellow-400">💎 Crypto</strong></p>
          {casinoFee > 0 && <p>🎰 Taxa de entrada: <strong className="text-orange-400">${casinoFee.toLocaleString()}</strong> por jogo</p>}
          <p>📈 Vantagem da casa: <strong>Baixo ~34%</strong> · <strong>Médio ~28%</strong> · <strong>Alto ~17%</strong></p>
          <p>💊 Cada jogo: <strong className="text-orange-300">+2% vício</strong> (penaliza crimes)</p>
          <p>🚔 Risco de prisão: <strong>15%</strong> por jogo · Crypto em risco: <strong>até o valor da aposta</strong></p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-[#888]">Aposta</label>
            <input type="number" value={bet} onChange={(e) => setBet(Math.min(100000, Math.max(100, parseInt(e.target.value) || 100)))}
              className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white mt-1" min={100} max={100000} step={100} />
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
            {multiplier}x → 🪙{payout.toLocaleString()}
            {payout === 0 && <span className="block text-base text-[#888] mt-1">Slot vazio. Tenta de novo!</span>}
          </div>
        )}
        {hasResult && !playing && player && (
          <p className="text-xs text-center text-orange-400/60 mt-1">
            +2% vício · vício atual: {Math.min(100, (player.addiction ?? 0) + 2)}% → -{Math.min(50, ((player.addiction ?? 0) + 2) / 2).toFixed(1)}% crimes
          </p>
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

