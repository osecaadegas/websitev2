"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { CrimeMinigame } from "../minigames/CrimeMinigame";
import { GAME_IDS, GAME_META, type GameId } from "../minigames/gameConfig";
import type { Difficulty } from "./LockSequence";

/* ─────────────────────────────────────────────────────────────────────
   RaidEscape — Orchestrator
   Randomly picks one of 3 minigames and manages the global arrest meter.
   ───────────────────────────────────────────────────────────────────── */

type MinigameType = GameId;
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
  /**
   * Probability (0–1) that the player gets a chance to escape via minigame.
   * If omitted: low=0.7, medium=0.5, high=0.3
   */
  escapeChance?: number;
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



const ESCAPE_CHANCE: Record<Difficulty, number> = {
  low:    0.7,
  medium: 0.5,
  high:   0.3,
};

export default function RaidEscape({ businessValue, difficulty: difficultyProp, cashAtRisk, cryptoAtRisk = 0, escapeChance: escapeChanceProp, onEscape, onArrested }: Props) {
  const [mounted, setMounted]     = useState(false);
  const [phase, setPhase]         = useState<Phase>("intro");
  const [arrestPct, setArrestPct] = useState(0);
  const [minigame]                = useState<MinigameType>(() =>
    GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)]
  );

  const difficulty = difficultyProp ?? getDifficulty(businessValue ?? 0);

  // Roll once at mount — determines whether player even gets a minigame
  const [canEscape] = useState(() => {
    const d = difficultyProp ?? getDifficulty(businessValue ?? 0);
    const chance = escapeChanceProp ?? ESCAPE_CHANCE[d];
    return Math.random() < chance;
  });
  const phaseRef   = useRef<Phase>("intro");
  const doneRef    = useRef(false);
  phaseRef.current = phase;

  useEffect(() => { setMounted(true); }, []);

  // Intro → game (or straight to arrested if canEscape is false) after 2.5s
  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase(canEscape ? "game" : "arrested"), 2500);
    return () => clearTimeout(t);
  }, [phase, canEscape]);

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

  const handleMinigameFail = useCallback(() => {
    bumpArrest(100);
  }, [bumpArrest]);

  if (!mounted) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black/97 flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Police siren flash (intro + game) */}
      {(phase === "intro" || phase === "game") && (
        <>
          <div className="absolute inset-y-0 left-0 w-1/2 bg-red-600/12 pointer-events-none animate-siren-left" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-blue-600/12 pointer-events-none animate-siren-right" />
          {/* Edge vignette + scanlines for cop-show vibe */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.85)_100%)]" />
          <div className="absolute inset-0 pointer-events-none opacity-[0.07] bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_2px,rgba(255,255,255,0.5)_2px,rgba(255,255,255,0.5)_3px)]" />
        </>
      )}

      {/* Thief — slides from off-screen-left to off-screen-right, loops every 2s */}
      {(phase === "intro" || phase === "game") && canEscape && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/crime_empire/thief-minigame.png"
          alt=""
          className="absolute pointer-events-none z-[2] animate-thiefRun drop-shadow-[0_8px_18px_rgba(0,0,0,0.7)]"
          style={{ bottom: "6%", height: "180px", width: "auto" }}
        />
      )}

      {/* Police officer — slides up from bottom-left when minigame starts */}
      {(phase === "game" || (phase === "intro" && !canEscape)) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/crime_empire/police-minigame.png"
          alt=""
          className="absolute bottom-0 left-6 pointer-events-none z-[1] animate-policeSlideUp drop-shadow-[0_-6px_30px_rgba(59,130,246,0.5)]"
          style={{ height: "260px", width: "auto" }}
        />
      )}

      {/* ── INTRO ── */}
      {phase === "intro" && (
        <div className="relative z-10 text-center space-y-4 animate-fadeIn px-4">
          <div className="text-8xl">{canEscape ? "🚔" : "👮"}</div>
          <h2 className="text-5xl font-black text-red-400 animate-pulse tracking-wide">
            {canEscape ? "RAID POLICIAL!" : "APANHADO!"}
          </h2>
          <p className="text-[#aaa] text-lg">
            {canEscape ? "O teu negócio está a ser invadido!" : "A polícia cortou todas as saídas. Sem hipótese de fuga!"}
          </p>
          {(cashAtRisk > 0 || cryptoAtRisk > 0) && (
            <div className="mt-3 px-6 py-3 rounded-xl bg-red-900/20 border border-red-500/40 inline-block space-y-1">
              <p className="text-red-300 font-bold text-sm">⚠️ Ativos em risco</p>
              {cashAtRisk > 0 && <p className="text-pink-300 text-sm">💸 Dinheiro Sujo: ${cashAtRisk.toLocaleString()}</p>}
              {cryptoAtRisk > 0 && <p className="text-purple-300 text-sm">💎 Crypto: ${cryptoAtRisk.toLocaleString()}</p>}
              <p className="text-orange-300 text-sm">💊 Drogas: % confiscadas se apanhado</p>
            </div>
          )}
          {canEscape ? (
            <div className="mt-3 px-6 py-3 rounded-xl bg-[#1a0a0a] border border-red-500/40 inline-block">
              <p className="text-pink-300 font-bold text-sm">{GAME_META[minigame].icon} {GAME_META[minigame].name}</p>
              <p className="text-[#444] text-xs mt-1">A preparar fuga…</p>
            </div>
          ) : (
            <div className="mt-3 px-6 py-3 rounded-xl bg-[#1a0a0a] border border-red-700/60 inline-block">
              <p className="text-red-400 font-bold text-sm">🚨 Nível de polícia elevado</p>
              <p className="text-[#444] text-xs mt-1">A ser detido…</p>
            </div>
          )}
        </div>
      )}

      {/* ── GAME ── */}
      {phase === "game" && (
        <div className="relative z-10 w-full max-w-lg mx-4 flex flex-col gap-4">
          {/* Header */}
          <div className="text-center -mb-1">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-500/40 text-red-300 text-[10px] font-black tracking-[0.3em] uppercase shadow-[0_0_20px_rgba(239,68,68,0.25)]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              RAID EM CURSO
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <p className="mt-2 text-[11px] text-[#666] uppercase tracking-[0.25em]">
              {GAME_META[minigame].icon} {GAME_META[minigame].name}
            </p>
          </div>

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
                  arrestPct > 70 ? "bg-gradient-to-r from-red-600 to-red-400" :
                  arrestPct > 40 ? "bg-gradient-to-r from-orange-600 to-orange-400" : "bg-gradient-to-r from-yellow-600 to-yellow-400"
                }`}
                style={{ width: `${arrestPct}%` }}
              />
            </div>
          </div>

          {/* Minigame card with siren-pulsing border */}
          <div className="relative p-5 rounded-2xl bg-[#0d0d0d] border-2 border-red-500/40 shadow-[0_0_60px_rgba(239,68,68,0.25)] animate-cardSiren">
            <div className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
            <div className="absolute -bottom-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-blue-500/70 to-transparent" />
            <CrimeMinigame
              gameId={minigame}
              difficulty={difficulty}
              onSuccess={handleSuccess}
              onFail={handleMinigameFail}
            />
          </div>
        </div>
      )}

      {/* ── ESCAPED ── */}
      {phase === "escaped" && (
        <div className="relative z-10 text-center space-y-4 animate-fadeIn px-4">
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
        <div className="relative z-10 text-center space-y-4 animate-fadeIn px-4">
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
        @keyframes thiefRun { 0%{transform:translateX(-220px)} 100%{transform:translateX(calc(100vw + 60px))} }
        .animate-thiefRun { animation: thiefRun 2200ms linear infinite; }
        @keyframes policeSlideUp { from{transform:translateY(120%);opacity:0} to{transform:translateY(0);opacity:1} }
        .animate-policeSlideUp { animation: policeSlideUp 0.8s ease-out forwards; }
        @keyframes cardSiren {
          0%,100% { box-shadow: 0 0 60px rgba(239,68,68,0.25), 0 0 0 0 rgba(59,130,246,0); border-color: rgba(239,68,68,0.45); }
          50%     { box-shadow: 0 0 60px rgba(59,130,246,0.30), 0 0 0 0 rgba(239,68,68,0); border-color: rgba(59,130,246,0.45); }
        }
        .animate-cardSiren { animation: cardSiren 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
