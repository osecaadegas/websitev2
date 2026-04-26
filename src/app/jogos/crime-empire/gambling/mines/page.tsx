"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

type TileState = null | "safe" | "mine";

const MINE_PRESETS = [1, 3, 5, 10, 15, 20, 24];

export default function MinesPage() {
  const router = useRouter();
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
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number; cryptoAtRisk: number } | null>(null);

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
    setCurrentPayout(data.currentPayout);
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
      if (data.escape_token) {
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20, cryptoAtRisk: data.crypto_at_risk ?? 0 });
      }
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
      setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20, cryptoAtRisk: data.crypto_at_risk ?? 0 });
    }
    setActing(false);
  };

  const reset = () => { setStatus("idle"); setGameResult(null); setSessionId(null); setRevealed(new Array(25).fill(null)); setRevealedCount(0); };

  if (loading) return <div className="flex-1 flex items-center justify-center text-white">A carregar...</div>;

  return (
    <div className="flex-1 text-white min-h-screen" style={{ background: "#0a0808" }}>
      <div className="ce-noise" />
      <div className="absolute inset-0 pointer-events-none z-0 ce-mines-header" style={{ height: "300px" }} />
      <div className="relative z-10 py-8 px-4 max-w-xl mx-auto">

        {/* Header */}
        <div className="ce-page-header">
          <Link href="/jogos/crime-empire/gambling" className="inline-flex items-center gap-1.5 ce-text-muted hover:text-white text-xs font-semibold mb-4 transition-colors">
            ← Casino
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: "linear-gradient(145deg, rgba(239,68,68,0.2), rgba(185,28,28,0.1))", border: "1px solid rgba(239,68,68,0.3)" }}>
              💣
            </div>
            <div>
              <p className="ce-page-eyebrow">Underground Casino</p>
              <h1 className="text-3xl font-black text-white">MINES</h1>
            </div>
          </div>
          <div className="ce-page-divider mt-3" style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.4), rgba(239,68,68,0.1), transparent)" }} />
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

        {/* Active game stats */}
        {status === "active" && (
          <div className="ce-card ce-card-green ce-card--metal-acid rounded-2xl p-4 mb-5 flex items-center justify-between gap-3"
            style={{ boxShadow: "0 0 40px rgba(34,197,94,0.1)" }}>
            <div>
              <p className="ce-stat-label text-[9px]">Multiplicador</p>
              <p className="ce-multiplier text-3xl">{currentMultiplier}x</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="ce-stat-label text-[9px]">Cashout disponível</p>
              <p className="text-2xl font-black ce-text-gold">🪙{currentPayout.toLocaleString()}</p>
            </div>
            <button onClick={cashout} disabled={acting || revealedCount === 0}
              className="ce-btn ce-btn-success px-5 py-3 rounded-xl text-sm">
              💰 Cashout
            </button>
          </div>
        )}

        {/* Game result */}
        {gameResult === "mine" && (
          <div className="ce-card ce-card-red rounded-2xl p-4 mb-5 text-center" style={{ boxShadow: "0 0 40px rgba(239,68,68,0.15)" }}>
            <p className="text-2xl font-black ce-text-red">💥 BOOM! Perdeste tudo!</p>
          </div>
        )}
        {gameResult === "cashout" && (
          <div className="ce-card ce-card-green rounded-2xl p-4 mb-5 text-center" style={{ boxShadow: "0 0 40px rgba(34,197,94,0.15)" }}>
            <p className="text-2xl font-black ce-text-green">✅ Cashout!</p>
            <p className="ce-text-gold font-black text-lg mt-1">🪙 +{currentPayout.toLocaleString()} <span className="ce-text-muted text-sm font-normal">({currentMultiplier}x)</span></p>
          </div>
        )}

        {/* Mines Grid */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {Array.from({ length: 25 }).map((_, i) => {
            const state = revealed[i];
            let tileClass = "ce-mine-tile ";
            let icon = "";
            if (state === "safe") { tileClass += "ce-mine-tile-safe"; icon = "💎"; }
            else if (state === "mine") { tileClass += "ce-mine-tile-mine"; icon = "💣"; }
            else { tileClass += "ce-mine-tile-hidden"; icon = ""; }
            return (
              <button key={i} onClick={() => revealTile(i)}
                className={tileClass}
                style={{ height: "clamp(48px, 16vw, 72px)" }}
                disabled={status !== "active" || state !== null || acting}
              >
                {state ? icon : (
                  <span className="text-white/10 text-xl font-black select-none">?</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        {(status === "idle" || status === "finished") && (
          <div className="ce-card rounded-2xl p-4 space-y-3">
            {status === "finished" && (
              <button onClick={reset} className="ce-btn ce-btn-ghost w-full py-3 rounded-xl">Novo Jogo</button>
            )}
            {status === "idle" && (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="ce-stat-label text-[10px] mb-1.5">Aposta</p>
                    <input type="number" value={bet}
                      onChange={(e) => setBet(Math.min(100000, Math.max(100, parseInt(e.target.value) || 100)))}
                      className="ce-input" min={100} max={100000} step={100} />
                  </div>
                  <div>
                    <p className="ce-stat-label text-[10px] mb-1.5">Minas</p>
                    <div className="flex gap-1 flex-wrap">
                      {MINE_PRESETS.map((m) => (
                        <button key={m} onClick={() => setMineCount(m)}
                          className={`ce-btn rounded-lg px-2.5 py-2 text-xs ${mineCount === m ? "ce-btn-danger" : "ce-btn-ghost"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {fee > 0 && <p className="text-xs text-orange-400">+ taxa casino: ${fee.toLocaleString()}</p>}
                {player && (
                  <p className="text-xs text-orange-400/60">
                    ⚠️ 15% risco de prisão · 💎 em risco: {Math.min(player.crypto, bet).toLocaleString()} crypto
                  </p>
                )}
                <button onClick={startGame} disabled={acting} className="ce-btn ce-btn-danger w-full py-3 rounded-xl">
                  {acting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A iniciar...</> : "💣 Iniciar"}
                </button>
              </>
            )}
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

