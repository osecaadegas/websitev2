"use client";
import { useState, useEffect, useCallback, useRef } from "react";

export type Difficulty = "low" | "medium" | "high";

const SEQUENCE_LENGTH: Record<Difficulty, number> = { low: 5, medium: 7, high: 9 };
const ALL_KEYS = ["W", "A", "S", "D"];

interface Props {
  difficulty: Difficulty;
  onSuccess: () => void;
  onMistake: (amount: number) => void;
}

export default function LockSequence({ difficulty, onSuccess, onMistake }: Props) {
  const [sequence] = useState<string[]>(() => {
    const len = SEQUENCE_LENGTH[difficulty];
    return Array.from({ length: len }, () => ALL_KEYS[Math.floor(Math.random() * ALL_KEYS.length)]);
  });
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const doneRef     = useRef(false);
  const flashRef    = useRef<"good" | "bad" | null>(null);
  const progressRef = useRef(0);
  flashRef.current    = flash;
  progressRef.current = progress;

  const handleInput = useCallback((key: string) => {
    if (doneRef.current || flashRef.current === "bad") return;
    const cur      = progressRef.current;
    const expected = sequence[cur];
    if (key === expected) {
      setFlash("good");
      setTimeout(() => setFlash(null), 150);
      const next = cur + 1;
      setProgress(next);
      if (next >= sequence.length) { doneRef.current = true; onSuccess(); }
    } else {
      setFlash("bad");
      setTimeout(() => { setFlash(null); setProgress(0); }, 500);
      onMistake(25);
    }
  }, [sequence, onSuccess, onMistake]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (ALL_KEYS.includes(k)) { e.preventDefault(); handleInput(k); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleInput]);

  return (
    <div className="space-y-5 text-center">
      <div>
        <p className="text-xs text-[#666] uppercase tracking-widest mb-2">🔐 Sequência de Bloqueio</p>
        <p className="text-xs text-[#555] mb-4">Repete a sequência correctamente para escapar</p>
        <div className="flex justify-center gap-2 my-3">
          {sequence.map((k, i) => (
            <div key={i} className={`w-11 h-11 rounded-lg flex items-center justify-center text-base font-black border-2 transition-all duration-200 ${
              i < progress
                ? "bg-green-700 border-green-500 text-white"
                : i === progress
                ? "bg-pink-900/60 border-pink-400 text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                : "bg-[#1a1a1a] border-[#2a2a2a] text-[#333]"
            }`}>
              {i < progress ? "✓" : i === progress ? k : "?"}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#555]">{progress}/{sequence.length} teclas correctas</p>
      </div>

      <div className={`p-3 rounded-xl border-2 transition-all duration-200 ${
        flash === "good" ? "border-green-500 bg-green-900/20" :
        flash === "bad"  ? "border-red-500 bg-red-900/20"     :
        "border-[#222] bg-[#0a0a0a]"
      }`}>
        <div className="grid grid-cols-4 gap-2">
          {ALL_KEYS.map((k) => (
            <button
              key={k}
              onPointerDown={(e) => { e.preventDefault(); handleInput(k); }}
              className={`py-4 rounded-xl font-black text-xl transition-all active:scale-90 select-none bg-[#1a1a1a] border border-[#333] text-[#999] hover:bg-[#222] hover:text-white`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[#444]">Usa o teclado (W A S D) ou os botões</p>
    </div>
  );
}
