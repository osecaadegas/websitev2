"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import LockSequence, { type Difficulty } from "./LockSequence";
import HeatZone from "./HeatZone";
import EscapeRoute from "./EscapeRoute";

/* ─────────────────────────────────────────────────────────────────────
   RaidEscape — Orchestrator
   Randomly picks one of 3 minigames and manages the global arrest meter.
   ───────────────────────────────────────────────────────────────────── */

type MinigameType = "lock_sequence" | "heat_zone" | "escape_route";
type Phase = "intro" | "game" | "escaped" | "arrested";

interface Props {
  /** base_income_per_hour — used to derive difficulty (ignored when `difficulty` is set) */
  businessValue?: number;
  /** Direct difficulty override — skips businessValue calculation */
  difficulty?: Difficulty;
  /** Dirty cash the player stands to lose */
  cashAtRisk: number;
  /** Crypto the player stands to lose (15% of balance) */
  cryptoAtRisk?: number;
  onEscape: (cashSaved: number) => void;
  onArrested: () => void;
}

const ARREST_FILL_RATE: Record<Difficulty, number> = {
  low:    1.5,  // % per second
  medium: 2.5,
  high:   4.0,
};

function getDifficulty(val: number): Difficulty {
  if (val < 3000) return "low";
  if (val < 8000) return "medium";
  return "high";
}

const MINIGAME_NAMES: Record<MinigameType, string> = {
  lock_sequence: "Quebra de Código",
  heat_zone:     "Zona de Calor",
  escape_route:  "Rota de Fuga",
};

export default function RaidEscape({ businessValue, difficulty: difficultyProp, cashAtRisk, cryptoAtRisk = 0, onEscape, onArrested }: Props) {
  const [mounted, setMounted]     = useState(false);
  const [phase, setPhase]         = useState<Phase>("intro");
  const [arrestPct, setArrestPct] = useState(0);
  const [minigame]                = useState<MinigameType>(() => {
    const all: MinigameType[] = ["lock_sequence", "heat_zone", "escape_route"];
    return all[Math.floor(Math.random() * all.length)];
  });

  const difficulty = difficultyProp ?? getDifficulty(businessValue ?? 0);
  const phaseRef   = useRef<Phase>("intro");
  const doneRef    = useRef(false);
  phaseRef.current = phase;

  useEffect(() => { setMounted(true); }, []);

  // Intro → game after 2.5s
  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("game"), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  // Arrest meter passive fill
  useEffect(() => {
    if (phase !== "game") return;
    const rate = ARREST_FILL_RATE[difficulty] / 10; // per 100ms tick
    const iv = setInterval(() => {
      setArrestPct((p) => {
        const next = p + rate;
        if (next >= 100 && !doneRef.current) {
          doneRef.current = true;
          clearInterval(iv);
          setPhase("arrested");
          return 100;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [phase, difficulty]);

  const bumpArrest = useCallback((amount: number) => {
    if (doneRef.current) return;
    setArrestPct((p) => {
      const next = p + amount;
      if (next >= 100) {
        doneRef.current = true;
        setPhase("arrested");
        return 100;
      }
      return next;
    });
  }, []);

  const handleSuccess = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("escaped");
  }, []);

  if (!mounted) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black/96 flex flex-col items-center justify-center overflow-hidden">
      {/* Police siren flash (intro + game) */}
      {(phase === "intro" || phase === "game") && (
        <>
          <div className="absolute inset-y-0 left-0 w-1/2 bg-red-600/12 pointer-events-none animate-siren-left" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-blue-600/12 pointer-events-none animate-siren-right" />
        </>
      )}

      {/* ── INTRO ── */}
      {phase === "intro" && (
        <div className="text-center space-y-4 animate-fadeIn px-4">
          <div className="text-8xl">🚔</div>
          <h2 className="text-5xl font-black text-red-400 animate-pulse tracking-wide">RAID POLICIAL!</h2>
          <p className="text-[#aaa] text-lg">O teu negócio está a ser invadido!</p>
          {(cashAtRisk > 0 || cryptoAtRisk > 0) && (
            <div className="mt-3 px-6 py-3 rounded-xl bg-red-900/20 border border-red-500/40 inline-block space-y-1">
              <p className="text-red-300 font-bold text-sm">⚠️ Ativos em risco</p>
              {cashAtRisk > 0 && <p className="text-pink-300 text-sm">💸 Dinheiro Sujo: ${cashAtRisk.toLocaleString()}</p>}
              {cryptoAtRisk > 0 && <p className="text-purple-300 text-sm">💎 Crypto: ${cryptoAtRisk.toLocaleString()}</p>}
              <p className="text-orange-300 text-sm">💊 Drogas: % confiscadas se apanhado</p>
            </div>
          )}
          <div className="mt-3 px-6 py-3 rounded-xl bg-[#1a0a0a] border border-red-500/40 inline-block">
            <p className="text-pink-300 font-bold text-sm">Minijogo: {MINIGAME_NAMES[minigame]}</p>
            <p className="text-[#444] text-xs mt-1">A preparar fuga…</p>
          </div>
        </div>
      )}

      {/* ── GAME ── */}
      {phase === "game" && (
        <div className="w-full max-w-lg mx-4 flex flex-col gap-4">
          {/* Arrest meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-red-400">🚔 PRISÃO</span>
              <span className={arrestPct > 70 ? "text-red-400 animate-pulse" : "text-[#666]"}>
                {Math.floor(arrestPct)}%
              </span>
            </div>
            <div className="w-full h-4 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#2a2a2a]">
              <div
                className={`h-full rounded-full transition-none ${
                  arrestPct > 70 ? "bg-red-500" :
                  arrestPct > 40 ? "bg-orange-500" : "bg-yellow-500"
                }`}
                style={{ width: `${arrestPct}%` }}
              />
            </div>
          </div>

          {/* Minigame card */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border-2 border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.12)]">
            {minigame === "lock_sequence" && (
              <LockSequence difficulty={difficulty} onSuccess={handleSuccess} onMistake={bumpArrest} />
            )}
            {minigame === "heat_zone" && (
              <HeatZone difficulty={difficulty} onSuccess={handleSuccess} onMistake={bumpArrest} />
            )}
            {minigame === "escape_route" && (
              <EscapeRoute difficulty={difficulty} onSuccess={handleSuccess} onMistake={bumpArrest} />
            )}
          </div>
        </div>
      )}

      {/* ── ESCAPED ── */}
      {phase === "escaped" && (
        <div className="text-center space-y-4 animate-fadeIn px-4">
          <div className="text-8xl">🏃</div>
          <h2 className="text-5xl font-black text-green-400 tracking-wide">FUGISTE!</h2>
          {(cashAtRisk > 0 || cryptoAtRisk > 0) ? (
            <>
              <p className="text-[#aaa] text-lg">Escapaste, mas a polícia apanhou metade!</p>
              <div className="px-6 py-4 rounded-xl bg-yellow-900/20 border border-yellow-500/40 inline-block space-y-1">
                <p className="text-yellow-300 font-bold text-lg">⚠️ Só conseguiste agarrar 50%</p>
                {cashAtRisk > 0 && (
                  <>
                    <p className="text-green-400 font-bold">💸 ${Math.floor(cashAtRisk / 2).toLocaleString()} dinheiro sujo recuperado</p>
                    <p className="text-red-400 text-sm">💸 ${Math.floor(cashAtRisk / 2).toLocaleString()} dinheiro sujo confiscado</p>
                  </>
                )}
                {cryptoAtRisk > 0 && (
                  <>
                    <p className="text-green-400 font-bold">💎 ${Math.floor(cryptoAtRisk / 2).toLocaleString()} crypto recuperado</p>
                    <p className="text-red-400 text-sm">💎 ${Math.floor(cryptoAtRisk / 2).toLocaleString()} crypto confiscado</p>
                  </>
                )}
                <p className="text-orange-400 text-xs mt-1">💊 10% das drogas confiscadas</p>
              </div>
            </>
          ) : (
            <p className="text-[#aaa] text-lg">Escapaste pelos seus pés.</p>
          )}
          <button
            onClick={() => onEscape(Math.floor(cashAtRisk / 2))}
            className="mt-2 px-10 py-4 rounded-xl font-black text-lg bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 text-white transition-all hover:scale-[1.02] active:scale-95 block mx-auto"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ── ARRESTED ── */}
      {phase === "arrested" && (
        <div className="text-center space-y-4 animate-fadeIn px-4">
          <div className="text-8xl">👮</div>
          <h2 className="text-5xl font-black text-red-400 tracking-wide">PRESO!</h2>
          <p className="text-[#aaa] text-lg">Não conseguiste escapar.</p>
          <div className="px-6 py-3 rounded-xl bg-red-900/20 border border-red-500/40 inline-block space-y-1">
            {cashAtRisk > 0 && <p className="text-red-300 font-bold">💸 ${cashAtRisk.toLocaleString()} dinheiro sujo confiscado</p>}
            {cryptoAtRisk > 0 && <p className="text-red-300 font-bold">💎 ${cryptoAtRisk.toLocaleString()} crypto confiscado</p>}
            <p className="text-orange-400 text-sm">💊 25% das drogas confiscadas</p>
          </div>
          <button
            onClick={onArrested}
            className="mt-2 px-10 py-4 rounded-xl font-black text-lg bg-gradient-to-r from-red-800 to-red-950 hover:from-red-700 hover:to-red-900 text-white transition-all hover:scale-[1.02] active:scale-95 block mx-auto"
          >
            Aceitar Destino
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes sirenLeft  { 0%,49%,100%{opacity:0}  50%,98%{opacity:1} }
        @keyframes sirenRight { 0%,49%,100%{opacity:1}  50%,98%{opacity:0} }
        .animate-siren-left  { animation: sirenLeft  0.7s ease-in-out infinite; }
        .animate-siren-right { animation: sirenRight 0.7s ease-in-out infinite; }
        @keyframes raidFadeIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        .animate-fadeIn { animation: raidFadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
