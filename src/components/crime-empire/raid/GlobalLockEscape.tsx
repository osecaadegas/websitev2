"use client";

/**
 * GlobalLockEscape — Global Police Raid Lock Sequence Minigame
 *
 * Reusable, stateless minigame triggered from ANY location via RaidEscapeContext.
 * Call via: const { startLockSequenceEscape } = useRaidEscape();
 *
 * Difficulty tiers:
 *  low    → 4 keys, 12 s, 1.5%/s pressure, +10% mistake penalty
 *  medium → 5 keys, 10 s, 2.5%/s pressure, +15% mistake penalty
 *  high   → 6 keys,  8 s, 4.0%/s pressure, +20% mistake penalty
 *  elite  → 6 keys,  8 s, 6.0%/s pressure, +25% mistake penalty + 200 ms input delay
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

export type RaidLevel = "low" | "medium" | "high" | "elite";

const LEVEL_CONFIG: Record<
  RaidLevel,
  { keys: number; timeMs: number; pressurePerSec: number; mistakePct: number; inputDelayMs: number }
> = {
  low:    { keys: 4, timeMs: 12000, pressurePerSec: 1.5, mistakePct: 10, inputDelayMs: 0 },
  medium: { keys: 5, timeMs: 10000, pressurePerSec: 2.5, mistakePct: 15, inputDelayMs: 0 },
  high:   { keys: 6, timeMs:  8000, pressurePerSec: 4.0, mistakePct: 20, inputDelayMs: 0 },
  elite:  { keys: 6, timeMs:  8000, pressurePerSec: 6.0, mistakePct: 25, inputDelayMs: 200 },
};

const ALL_KEYS = ["W", "A", "S", "D"] as const;

type Phase = "intro" | "game" | "escaped" | "arrested";

const LEVEL_LABELS: Record<RaidLevel, string> = {
  low:    "BAIXO RISCO",
  medium: "RISCO MÉDIO",
  high:   "ALTO RISCO",
  elite:  "ELITE",
};

const LEVEL_COLORS: Record<RaidLevel, string> = {
  low:    "text-yellow-400 border-yellow-500/50",
  medium: "text-orange-400 border-orange-500/50",
  high:   "text-red-400 border-red-500/50",
  elite:  "text-purple-400 border-purple-500/50",
};

const CONTEXT_MESSAGES: Record<string, string> = {
  brothel:   "O teu bordel está a ser invadido!",
  lab:       "A tua lab está cercada pela polícia!",
  warehouse: "O teu armazém está sob vigilância policial!",
  street:    "Foste apanhado em flagrante na rua!",
  safehouse: "A tua base segura foi comprometida!",
  smuggling: "O teu ponto de contrabando foi descoberto!",
  hq:        "A tua sede está a ser assaltada!",
  default:   "Estás a ser cercado pela polícia!",
};

interface Props {
  level: RaidLevel;
  cashAtRisk?: number;
  /** Location context key — drives the intro message */
  context?: string;
  onEscape: (cashSaved?: number) => void;
  onArrested: () => void;
}

export default function GlobalLockEscape({
  level,
  cashAtRisk = 0,
  context = "default",
  onEscape,
  onArrested,
}: Props) {
  const cfg = LEVEL_CONFIG[level];

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");

  // Sequence is stable after first render
  const [sequence] = useState<string[]>(() =>
    Array.from({ length: cfg.keys }, () => ALL_KEYS[Math.floor(Math.random() * ALL_KEYS.length)])
  );

  const [progress, setProgress] = useState(0);
  const [arrestPct, setArrestPct] = useState(0);
  const [timeLeft, setTimeLeft] = useState(cfg.timeMs);
  const [keyFlash, setKeyFlash] = useState<"good" | "bad" | null>(null);

  // Refs for closure-safe access
  const doneRef       = useRef(false);
  const inputLockRef  = useRef(false);
  const progressRef   = useRef(0);
  progressRef.current = progress;

  useEffect(() => { setMounted(true); }, []);

  // Intro → game after 2.5 s
  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("game"), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  // Timer countdown (100 ms ticks)
  useEffect(() => {
    if (phase !== "game") return;
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 100;
        if (next <= 0 && !doneRef.current) {
          doneRef.current = true;
          setPhase("arrested");
          clearInterval(iv);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [phase]);

  // Passive arrest pressure (100 ms ticks)
  useEffect(() => {
    if (phase !== "game") return;
    const rate = cfg.pressurePerSec / 10;
    const iv = setInterval(() => {
      setArrestPct((p) => {
        const next = p + rate;
        if (next >= 100 && !doneRef.current) {
          doneRef.current = true;
          setPhase("arrested");
          return 100;
        }
        return Math.min(next, 100);
      });
    }, 100);
    return () => clearInterval(iv);
  }, [phase, cfg.pressurePerSec]);

  // Escaped / arrested → fire callback after result display
  useEffect(() => {
    if (phase === "escaped") {
      const t = setTimeout(() => onEscape(cashAtRisk), 1800);
      return () => clearTimeout(t);
    }
    if (phase === "arrested") {
      const t = setTimeout(() => onArrested(), 1800);
      return () => clearTimeout(t);
    }
  }, [phase, onEscape, onArrested, cashAtRisk]);

  const handleInput = useCallback(
    (key: string) => {
      if (doneRef.current || inputLockRef.current || phase !== "game") return;

      const cur      = progressRef.current;
      const expected = sequence[cur];

      if (key === expected) {
        setKeyFlash("good");
        setTimeout(() => setKeyFlash(null), 150);

        const next = cur + 1;
        setProgress(next);

        if (next >= sequence.length) {
          doneRef.current = true;
          setPhase("escaped");
        }

        // Elite delay between valid inputs
        if (cfg.inputDelayMs > 0) {
          inputLockRef.current = true;
          setTimeout(() => { inputLockRef.current = false; }, cfg.inputDelayMs);
        }
      } else {
        // Wrong key: reset progress + bump arrest meter
        setKeyFlash("bad");
        setProgress(0);
        setArrestPct((p) => {
          const next = p + cfg.mistakePct;
          if (next >= 100 && !doneRef.current) {
            doneRef.current = true;
            setPhase("arrested");
            return 100;
          }
          return Math.min(next, 100);
        });
        setTimeout(() => setKeyFlash(null), 450);
      }
    },
    [sequence, cfg, phase]
  );

  // Keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if ((ALL_KEYS as readonly string[]).includes(k)) {
        e.preventDefault();
        handleInput(k);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleInput]);

  if (!mounted) return null;

  const timePct     = (timeLeft / cfg.timeMs) * 100;
  const contextMsg  = CONTEXT_MESSAGES[context] ?? CONTEXT_MESSAGES.default;
  const levelLabel  = LEVEL_LABELS[level];
  const levelColor  = LEVEL_COLORS[level];

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black/97 flex flex-col items-center justify-center select-none">
      {/* Alternating red/blue siren flash */}
      {(phase === "intro" || phase === "game") && (
        <>
          <div className="absolute inset-y-0 left-0 w-1/2 bg-red-600/10 pointer-events-none animate-siren-left" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-blue-600/10 pointer-events-none animate-siren-right" />
        </>
      )}

      {/* Thief — slides from off-screen-left to off-screen-right, loops every 2 s */}
      {(phase === "intro" || phase === "game") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/crime_empire/thief-minigame.png"
          alt=""
          className="absolute pointer-events-none z-[2] animate-thiefRun"
          style={{ bottom: "6%", height: "180px", width: "auto" }}
        />
      )}

      {/* Police officer — slides up from bottom-left when minigame starts */}
      {phase === "game" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/crime_empire/police-minigame.png"
          alt=""
          className="absolute bottom-0 left-6 pointer-events-none z-[1] animate-policeSlideUp"
          style={{ height: "260px", width: "auto" }}
        />
      )}

      {/* ── INTRO ─────────────────────────────────────────────────────── */}
      {phase === "intro" && (
        <div className="text-center space-y-5 animate-raidFadeIn px-6 max-w-md">
          <div className="text-8xl animate-bounce">🚔</div>

          {/* "RAID EM CURSO" banner */}
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-black text-red-400 tracking-wider animate-pulse">
              RAID EM CURSO!
            </h2>
            <div className="mt-1 text-xs text-red-600/70 uppercase tracking-[0.3em] font-bold">
              ████████████████████████████
            </div>
          </div>

          <p className="text-[#bbb] text-base md:text-lg">{contextMsg}</p>

          <div className={`mt-2 px-6 py-4 rounded-2xl bg-[#0f0a0a] border ${levelColor.split(" ")[1]} inline-flex flex-col items-center gap-2`}>
            <span className={`font-black text-sm tracking-widest ${levelColor.split(" ")[0]}`}>
              ⚠ NÍVEL: {levelLabel}
            </span>
            {cashAtRisk > 0 && (
              <span className="text-[#aaa] text-xs">
                Em risco: <span className="text-red-300 font-bold">${cashAtRisk.toLocaleString()}</span>
              </span>
            )}
            <span className="text-[#444] text-xs">A gerar sequência de fuga…</span>
          </div>
        </div>
      )}

      {/* ── GAME ──────────────────────────────────────────────────────── */}
      {phase === "game" && (
        <div className="w-full max-w-md mx-auto px-4 flex flex-col gap-4">

          {/* Top header */}
          <div className="text-center">
            <p className="text-red-400 font-black text-xs tracking-[0.25em] uppercase animate-pulse">
              🚨 Raid em Curso — Foge Agora
            </p>
            <p className={`text-xs font-bold mt-0.5 ${levelColor.split(" ")[0]}`}>
              {levelLabel}
            </p>
          </div>

          {/* Timer bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#555]">
              <span className="font-bold">⏱ TEMPO</span>
              <span className={timePct < 25 ? "text-red-400 animate-pulse font-bold" : "text-[#777]"}>
                {(timeLeft / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-none ${
                  timePct < 25  ? "bg-red-500"    :
                  timePct < 50  ? "bg-orange-400" : "bg-sky-500"
                }`}
                style={{ width: `${timePct}%` }}
              />
            </div>
          </div>

          {/* Arrest pressure meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-red-400">🔒 PRESSÃO DE PRISÃO</span>
              <span className={arrestPct > 70 ? "text-red-400 animate-pulse" : "text-[#555]"}>
                {Math.floor(arrestPct)}%
              </span>
            </div>
            <div className="w-full h-4 bg-[#111] rounded-full overflow-hidden border border-[#1e1e1e]">
              <div
                className={`h-full rounded-full transition-none ${
                  arrestPct > 70 ? "bg-red-500" :
                  arrestPct > 40 ? "bg-orange-500" : "bg-yellow-500"
                }`}
                style={{ width: `${arrestPct}%` }}
              />
            </div>
          </div>

          {/* Sequence display */}
          <div
            className={`p-5 rounded-2xl border-2 transition-all duration-150 ${
              keyFlash === "good"
                ? "border-green-500 bg-green-900/20 shadow-[0_0_24px_rgba(34,197,94,0.35)]"
                : keyFlash === "bad"
                ? "border-red-500 bg-red-900/20 shadow-[0_0_24px_rgba(239,68,68,0.35)]"
                : "border-[#1a1a1a] bg-[#080808]"
            }`}
          >
            <p className="text-[10px] text-[#444] uppercase tracking-[0.3em] text-center mb-3">
              🔐 Sequência de Código — Repete exactamente
            </p>
            <div className="flex justify-center gap-2 mb-3">
              {sequence.map((k, i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black border-2 transition-all duration-150 ${
                    i < progress
                      ? "bg-green-800 border-green-400 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                      : i === progress
                      ? "bg-pink-900/60 border-pink-400 text-white shadow-[0_0_16px_rgba(236,72,153,0.5)]"
                      : "bg-[#0e0e0e] border-[#1e1e1e] text-[#2a2a2a]"
                  }`}
                >
                  {i < progress ? "✓" : i === progress ? k : "?"}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-[#444]">
              {progress} / {sequence.length} correctas
            </p>
          </div>

          {/* WASD input buttons */}
          <div className="grid grid-cols-4 gap-2">
            {ALL_KEYS.map((k) => (
              <button
                key={k}
                onPointerDown={(e) => { e.preventDefault(); handleInput(k); }}
                className={`py-5 rounded-2xl font-black text-2xl transition-all active:scale-90 ${
                  sequence[progress] === k
                    ? "bg-pink-700 border-2 border-pink-400 text-white shadow-[0_0_16px_rgba(236,72,153,0.4)] hover:bg-pink-600"
                    : "bg-[#0e0e0e] border border-[#1e1e1e] text-[#555] hover:bg-[#161616]"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Status hint line */}
          <div className="min-h-[18px] text-center">
            {keyFlash === "bad" && (
              <p className="text-red-400 text-xs font-bold animate-pulse">
                ✗ Tecla errada! Sequência reiniciada.
              </p>
            )}
            {keyFlash === "good" && (
              <p className="text-green-400 text-xs font-bold">✓ Correcto!</p>
            )}
            {level === "elite" && !keyFlash && (
              <p className="text-purple-500 text-[10px]">
                ⚠ Modo Elite — janela de input reduzida
              </p>
            )}
          </div>

          <p className="text-center text-[10px] text-[#2a2a2a] -mt-2">
            Usa o teclado (W A S D) ou toca nos botões
          </p>
        </div>
      )}

      {/* ── ESCAPED ───────────────────────────────────────────────────── */}
      {phase === "escaped" && (
        <div className="text-center space-y-4 animate-raidFadeIn px-6">
          <div className="text-8xl">🏃</div>
          <h2 className="text-4xl font-black text-green-400">FUGISTE!</h2>
          <p className="text-[#aaa] text-lg">Escapaste da polícia!</p>
          {cashAtRisk > 0 && (
            <div className="px-6 py-3 rounded-xl bg-green-900/20 border border-green-500/30 inline-block">
              <p className="text-green-300 font-bold">
                💰 ${cashAtRisk.toLocaleString()} protegidos
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── ARRESTED ──────────────────────────────────────────────────── */}
      {phase === "arrested" && (
        <div className="text-center space-y-4 animate-raidFadeIn px-6">
          <div className="text-8xl">🔒</div>
          <h2 className="text-4xl font-black text-red-400">APANHADO!</h2>
          <p className="text-[#aaa] text-lg">Não conseguiste escapar.</p>
          {cashAtRisk > 0 && (
            <div className="px-6 py-3 rounded-xl bg-red-900/20 border border-red-500/30 inline-block">
              <p className="text-red-300 font-bold">
                💸 Consequências em curso…
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inline keyframe definitions */}
      <style jsx global>{`
        @keyframes sirenLeft  { 0%,49%,100%{opacity:0} 50%,98%{opacity:1} }
        @keyframes sirenRight { 0%,49%,100%{opacity:1} 50%,98%{opacity:0} }
        .animate-siren-left  { animation: sirenLeft  0.7s ease-in-out infinite; }
        .animate-siren-right { animation: sirenRight 0.7s ease-in-out infinite; }
        @keyframes raidFadeIn { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
        .animate-raidFadeIn { animation: raidFadeIn 0.35s ease-out forwards; }
        @keyframes thiefRun { 0%{transform:translateX(-190px)} 100%{transform:translateX(calc(100vw + 60px))} }
        .animate-thiefRun { animation: thiefRun 2000ms linear infinite; }
        @keyframes policeSlideUp { from{transform:translateY(120%);opacity:0} to{transform:translateY(0);opacity:1} }
        .animate-policeSlideUp { animation: policeSlideUp 0.7s ease-out forwards; }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
