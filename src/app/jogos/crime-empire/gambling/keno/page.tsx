"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

const MAX_PICKS = 10;

export default function KenoPage() {
  const router = useRouter();
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
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number; cryptoAtRisk: number } | null>(null);

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
      setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20, cryptoAtRisk: data.crypto_at_risk ?? 0 });
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
    <div className="flex-1 text-white min-h-screen" style={{ background: "#08080d" }}>
      <div className="ce-noise" />
      <div className="absolute inset-0 pointer-events-none z-0 ce-keno-header" style={{ height: "300px" }} />
      <div className="relative z-10 py-8 px-4 max-w-2xl mx-auto">

        {/* Header */}
        <div className="ce-page-header">
          <Link href="/jogos/crime-empire/gambling" className="inline-flex items-center gap-1.5 ce-text-muted hover:text-white text-xs font-semibold mb-4 transition-colors">
            ← Casino
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: "linear-gradient(145deg, rgba(168,85,247,0.2), rgba(124,58,237,0.1))", border: "1px solid rgba(168,85,247,0.3)" }}>
              🎱
            </div>
            <div>
              <p className="ce-page-eyebrow">Underground Casino</p>
              <h1 className="text-3xl font-black text-white">KENO</h1>
            </div>
          </div>
          <p className="ce-text-muted text-sm">Escolhe até 10 números (1–80). 20 serão sorteados.</p>
          {player && (
            <p className="text-xs text-orange-400/60 mt-1.5">
              ⚠️ 15% risco de prisão · 💎 em risco: {Math.min(player.crypto, bet).toLocaleString()} crypto
            </p>
          )}
          <div className="ce-page-divider mt-4" style={{ background: "linear-gradient(90deg, rgba(168,85,247,0.4), rgba(168,85,247,0.1), transparent)" }} />
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

        {/* Pick counter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="ce-stat-label text-[10px]">Selecionados:</span>
            <span className="font-black text-sm" style={{ color: picks.length >= MAX_PICKS ? "#f87171" : "#c084fc" }}>
              {picks.length}<span className="ce-text-muted font-normal">/{MAX_PICKS}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {picks.length > 0 && !hasResult && (
              <button onClick={() => setPicks([])} className="ce-btn ce-btn-ghost px-3 py-1.5 text-xs rounded-lg">Limpar</button>
            )}
            {hasResult && (
              <button onClick={reset} className="ce-btn ce-btn-purple px-3 py-1.5 text-xs rounded-lg">Nova Ronda</button>
            )}
          </div>
        </div>

        {/* Number Grid */}
        <div className="ce-card ce-card-purple p-3 mb-5 rounded-2xl">
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
              const isPicked = picksSet.has(n);
              const isDrawn = revealedSet.has(n);
              const isHit = isPicked && isDrawn;
              let tileClass = "ce-keno-tile ";
              if (isHit) tileClass += "ce-keno-tile-hit";
              else if (isPicked) tileClass += "ce-keno-tile-picked";
              else if (isDrawn) tileClass += "ce-keno-tile-drawn";
              else tileClass += "ce-keno-tile-idle";
              return (
                <button key={n} onClick={() => togglePick(n)} className={tileClass} disabled={hasResult}>{n}</button>
              );
            })}
          </div>
        </div>

        {/* Result */}
        {hasResult && (
          <div className={`ce-card rounded-2xl p-5 mb-5 text-center ${payout > 0 ? "ce-card-purple" : ""}`}
            style={payout > 0 ? { boxShadow: "0 0 40px rgba(168,85,247,0.2)" } : {}}>
            <p className="ce-text-muted text-xs mb-1">{hits} acerto{hits !== 1 ? "s" : ""} em {picks.length} número{picks.length !== 1 ? "s" : ""}</p>
            {payout > 0 ? (
              <>
                <p className="text-3xl font-black ce-text-purple mb-1">
                  🪙 +{payout.toLocaleString()}
                </p>
                <div className="ce-badge ce-badge-purple mx-auto">{multiplier}x multiplicador</div>
              </>
            ) : (
              <p className="text-xl font-black ce-text-red">Sem prémio desta vez</p>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="ce-card rounded-2xl p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <p className="ce-stat-label text-[10px] mb-1.5">Aposta</p>
              <input
                type="number" value={bet}
                onChange={(e) => setBet(Math.min(100000, Math.max(100, parseInt(e.target.value) || 100)))}
                className="ce-input" min={100} max={100000} step={100}
              />
            </div>
            <button
              onClick={play} disabled={playing || picks.length === 0} onMouseEnter={loadPlayer}
              className="ce-btn ce-btn-purple px-8 py-3 rounded-xl"
            >
              {playing ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A sortear...</> : "🎱 Jogar"}
            </button>
          </div>
        </div>
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
            router.push("/jogos/crime-empire/jail");
          }}
        />
      )}
    </div>
  );
}

