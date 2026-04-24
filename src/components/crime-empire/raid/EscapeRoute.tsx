"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Difficulty } from "./LockSequence";

/* ─────────────────────────────────────────────────────────────────────
   EscapeRoute — Choose a route, then complete a micro-challenge
   ───────────────────────────────────────────────────────────────────── */

type RouteKey = "rooftop" | "alley" | "sewer";

interface Props {
  difficulty: Difficulty;
  onSuccess: () => void;
  onMistake: (amount: number) => void;
}

const ROUTES = [
  { key: "rooftop" as RouteKey, icon: "🏚️", label: "Telhado", hint: "Sequência de teclas" },
  { key: "alley"   as RouteKey, icon: "🌆", label: "Beco",    hint: "Reação rápida"       },
  { key: "sewer"   as RouteKey, icon: "🕳️", label: "Esgoto", hint: "Teste de memória"    },
];

const CHOOSE_SECS = 5;

export default function EscapeRoute({ difficulty, onSuccess, onMistake }: Props) {
  const [route, setRoute] = useState<RouteKey | null>(null);
  const [timeLeft, setTimeLeft] = useState(CHOOSE_SECS);
  const timerDoneRef = useRef(false);

  // Countdown on choose screen
  useEffect(() => {
    if (route !== null) return;
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        const next = parseFloat((t - 0.1).toFixed(1));
        if (next <= 0 && !timerDoneRef.current) {
          timerDoneRef.current = true;
          clearInterval(iv);
          onMistake(100); // no choice = arrested
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [route, onMistake]);

  const pickRoute = (r: RouteKey) => {
    if (timerDoneRef.current) return;
    timerDoneRef.current = true;
    setRoute(r);
  };

  if (route === null) {
    const r = ROUTES.find((x) => x.key === route);
    return (
      <div className="space-y-4 text-center">
        <p className="text-xs text-[#666] uppercase tracking-widest">🗺️ Escolhe a Rota de Fuga</p>
        <div className="space-y-1">
          <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${(timeLeft / CHOOSE_SECS) * 100}%`, transition: "none" }}
            />
          </div>
          <p className="text-red-400 text-xs font-bold animate-pulse">{timeLeft.toFixed(1)}s</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ROUTES.map((ro) => (
            <button
              key={ro.key}
              onClick={() => pickRoute(ro.key)}
              className="p-4 rounded-xl bg-[#111] border-2 border-[#2a2a2a] hover:border-pink-500 hover:bg-[#1a1a1a] transition-all active:scale-95 flex flex-col items-center gap-2"
            >
              <span className="text-4xl">{ro.icon}</span>
              <span className="font-black text-sm text-white">{ro.label}</span>
              <span className="text-[10px] text-[#555]">{ro.hint}</span>
            </button>
          ))}
        </div>
        {r && <p className="text-xs text-pink-400">Escolhido: {r.label}</p>}
      </div>
    );
  }

  const chosen = ROUTES.find((x) => x.key === route)!;
  return (
    <div className="space-y-4">
      <p className="text-xs text-[#666] uppercase tracking-widest text-center">
        {chosen.icon} {chosen.label}
      </p>
      {route === "rooftop" && <RooftopChallenge difficulty={difficulty} onSuccess={onSuccess} onMistake={onMistake} />}
      {route === "alley"   && <AlleyChallenge   difficulty={difficulty} onSuccess={onSuccess} onMistake={onMistake} />}
      {route === "sewer"   && <SewerChallenge   difficulty={difficulty} onSuccess={onSuccess} onMistake={onMistake} />}
    </div>
  );
}

/* ─── Rooftop: key sequence ─────────────────────────────────────────────── */
const ROOFTOP_KEYS = ["W", "A", "S", "D"];
const ROOFTOP_LEN: Record<Difficulty, number> = { low: 3, medium: 4, high: 5 };

function RooftopChallenge({ difficulty, onSuccess, onMistake }: Props) {
  const [seq] = useState(() => {
    const len = ROOFTOP_LEN[difficulty];
    return Array.from({ length: len }, () => ROOFTOP_KEYS[Math.floor(Math.random() * ROOFTOP_KEYS.length)]);
  });
  const [idx, setIdx]     = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const doneRef    = useRef(false);
  const flashRef   = useRef<"good" | "bad" | null>(null);
  const idxRef     = useRef(0);
  flashRef.current = flash;
  idxRef.current   = idx;

  const press = useCallback((k: string) => {
    if (doneRef.current || flashRef.current === "bad") return;
    if (k === seq[idxRef.current]) {
      setFlash("good");
      setTimeout(() => setFlash(null), 150);
      const next = idxRef.current + 1;
      setIdx(next);
      if (next >= seq.length) { doneRef.current = true; onSuccess(); }
    } else {
      setFlash("bad");
      setTimeout(() => { setFlash(null); setIdx(0); }, 500);
      onMistake(20);
    }
  }, [seq, onSuccess, onMistake]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (ROOFTOP_KEYS.includes(k)) { e.preventDefault(); press(k); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [press]);

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs text-[#555]">Salta pelos telhados — digita a sequência!</p>
      <div className="flex justify-center gap-2">
        {seq.map((k, i) => (
          <div key={i} className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm border-2 transition-all ${
            i < idx      ? "bg-green-700 border-green-500 text-white"                            :
            i === idx    ? "bg-pink-900/60 border-pink-400 text-white shadow-[0_0_8px_rgba(236,72,153,0.5)] animate-pulse" :
                           "bg-[#1a1a1a] border-[#2a2a2a] text-[#333]"
          }`}>
            {i < idx ? "✓" : i === idx ? k : "?"}
          </div>
        ))}
      </div>
      <div className={`grid grid-cols-4 gap-2 p-3 rounded-xl border-2 ${
        flash === "good" ? "border-green-500 bg-green-900/20" :
        flash === "bad"  ? "border-red-500 bg-red-900/20"     :
        "border-[#222]"
      }`}>
        {ROOFTOP_KEYS.map((k) => (
          <button
            key={k}
            onPointerDown={(e) => { e.preventDefault(); press(k); }}
            className={`py-4 rounded-xl font-black text-lg active:scale-90 transition-all ${
              seq[idx] === k
                ? "bg-pink-700 border-2 border-pink-400 text-white hover:bg-pink-600"
                : "bg-[#1a1a1a] border border-[#333] text-[#777] hover:bg-[#222]"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Alley: button mash ─────────────────────────────────────────────────── */
const ALLEY_TARGET: Record<Difficulty, number> = { low: 8, medium: 11, high: 14 };
const ALLEY_TIME:   Record<Difficulty, number> = { low: 5, medium: 4,  high: 4  };

function AlleyChallenge({ difficulty, onSuccess, onMistake }: Props) {
  const target    = ALLEY_TARGET[difficulty];
  const timeLimit = ALLEY_TIME[difficulty];
  const [count, setCount]       = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const doneRef   = useRef(false);
  const countRef  = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        const next = parseFloat((t - 0.1).toFixed(1));
        if (next <= 0 && !doneRef.current) {
          doneRef.current = true;
          clearInterval(iv);
          if (countRef.current < target) onMistake(100);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [target, onMistake]);

  const tap = useCallback(() => {
    if (doneRef.current) return;
    const next = countRef.current + 1;
    countRef.current = next;
    setCount(next);
    if (next >= target) { doneRef.current = true; onSuccess(); }
  }, [target, onSuccess]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); tap(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tap]);

  const pct     = Math.min(100, (count / target) * 100);
  const timePct = (timeLeft / timeLimit) * 100;

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs text-[#555]">Foge pelo beco — clica o mais rápido que consegues!</p>
      <div className="flex justify-center gap-5 text-sm font-bold">
        <span className="text-pink-400">{count}/{target}</span>
        <span className={timeLeft < 1.5 ? "text-red-400 animate-pulse" : "text-[#777]"}>{timeLeft.toFixed(1)}s</span>
      </div>
      {/* Count bar */}
      <div className="w-full h-3 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#333]">
        <div
          className="h-full bg-gradient-to-r from-pink-600 to-purple-600 rounded-full"
          style={{ width: `${pct}%`, transition: "none" }}
        />
      </div>
      {/* Timer bar */}
      <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full bg-red-500 rounded-full"
          style={{ width: `${timePct}%`, transition: "none" }}
        />
      </div>
      <button
        onPointerDown={(e) => { e.preventDefault(); tap(); }}
        className="w-full py-8 rounded-2xl font-black text-2xl bg-gradient-to-r from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 active:scale-95 transition-all select-none shadow-[0_0_20px_rgba(236,72,153,0.3)]"
      >
        💨 CORRER!
      </button>
      <p className="text-[10px] text-[#444]">ESPAÇO / ENTER / TAP</p>
    </div>
  );
}

/* ─── Sewer: colour memory ───────────────────────────────────────────────── */
const SEWER_COLORS = [
  { id: 0, active: "bg-red-500    shadow-[0_0_16px_rgba(239,68,68,0.9)]",  idle: "bg-red-950    border-red-800",    label: "🔴" },
  { id: 1, active: "bg-blue-500   shadow-[0_0_16px_rgba(59,130,246,0.9)]", idle: "bg-blue-950   border-blue-800",   label: "🔵" },
  { id: 2, active: "bg-green-500  shadow-[0_0_16px_rgba(34,197,94,0.9)]",  idle: "bg-green-950  border-green-800",  label: "🟢" },
  { id: 3, active: "bg-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.9)]", idle: "bg-yellow-950 border-yellow-800", label: "🟡" },
];
const SEWER_LEN: Record<Difficulty, number> = { low: 3, medium: 3, high: 4 };

type SewerPhase = "showing" | "input";

function SewerChallenge({ difficulty, onSuccess, onMistake }: Props) {
  const [pattern] = useState(() => {
    const len = SEWER_LEN[difficulty];
    return Array.from({ length: len }, () => Math.floor(Math.random() * 4));
  });
  const [phase, setPhase]               = useState<SewerPhase>("showing");
  const [highlighted, setHighlighted]   = useState<number | null>(null);
  const [inputSeq, setInputSeq]         = useState<number[]>([]);
  const [errorFlash, setErrorFlash]     = useState(false);
  const doneRef  = useRef(false);
  const phaseRef = useRef<SewerPhase>("showing");
  phaseRef.current = phase;

  // Sequential reveal
  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const reveal = () => {
      if (cancelled) return;
      if (i >= pattern.length) {
        setTimeout(() => { if (!cancelled) setPhase("input"); }, 400);
        return;
      }
      setHighlighted(pattern[i]);
      setTimeout(() => {
        if (cancelled) return;
        setHighlighted(null);
        i++;
        setTimeout(reveal, 250);
      }, 700);
    };
    const t = setTimeout(reveal, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pattern]);

  const tap = useCallback((colorId: number) => {
    if (doneRef.current || phaseRef.current !== "input") return;
    setHighlighted(colorId);
    setTimeout(() => setHighlighted(null), 200);
    setInputSeq((prev) => {
      const pos = prev.length;
      if (colorId === pattern[pos]) {
        const next = [...prev, colorId];
        if (next.length >= pattern.length) {
          doneRef.current = true;
          setTimeout(onSuccess, 300);
        }
        return next;
      } else {
        setErrorFlash(true);
        setTimeout(() => setErrorFlash(false), 400);
        onMistake(25);
        return []; // reset
      }
    });
  }, [pattern, onSuccess, onMistake]);

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs text-[#555]">
        {phase === "showing" ? "Memoriza a sequência de cores..." : "Repete a sequência!"}
      </p>
      {/* Progress dots during input */}
      {phase === "input" && (
        <div className="flex justify-center gap-2">
          {pattern.map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full border transition-all ${
              i < inputSeq.length ? "bg-green-500 border-green-400" : "bg-[#1a1a1a] border-[#333]"
            }`} />
          ))}
        </div>
      )}
      <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl border-2 transition-all ${
        errorFlash ? "border-red-500 bg-red-900/10" : "border-[#222]"
      }`}>
        {SEWER_COLORS.map((c) => (
          <button
            key={c.id}
            onPointerDown={(e) => { e.preventDefault(); if (phase === "input") tap(c.id); }}
            className={`h-20 rounded-xl font-black text-3xl border-2 transition-all active:scale-95 ${
              highlighted === c.id
                ? `${c.active} scale-105 border-white/30`
                : `${c.idle} ${phase === "input" ? "hover:brightness-125 cursor-pointer" : "cursor-default opacity-60"}`
            }`}
          >
            {highlighted === c.id ? c.label : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
