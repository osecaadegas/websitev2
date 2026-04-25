"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Difficulty } from "./LockSequence";

const HITS_NEEDED = 5;
const ZONE_WIDTH: Record<Difficulty, number> = { low: 20, medium: 14, high: 9 };
const BASE_SPEED: Record<Difficulty, number>  = { low: 28, medium: 42, high: 65 };

interface Props {
  difficulty: Difficulty;
  onSuccess: () => void;
  onMistake: (amount: number) => void;
}

export default function HeatZone({ difficulty, onSuccess, onMistake }: Props) {
  const [hits, setHits]               = useState(0);
  const [misses, setMisses]           = useState(0);
  const [flash, setFlash]             = useState<"good" | "bad" | null>(null);
  const [indicatorPos, setIndicatorPos] = useState(0);

  // Refs for values read inside RAF / event handlers without stale closures
  const posRef    = useRef(0);
  const dirRef    = useRef(1);
  const hitsRef   = useRef(0);
  const missesRef = useRef(0);
  const flashRef  = useRef<"good" | "bad" | null>(null);
  const doneRef   = useRef(false);

  hitsRef.current   = hits;
  missesRef.current = misses;
  flashRef.current  = flash;

  // Safe zone position — re-randomised after each successful hit
  const [zonePos, setZonePos] = useState(() => 8 + Math.random() * 55);
  const zoneWidth = ZONE_WIDTH[difficulty];
  const baseSpeed = BASE_SPEED[difficulty];

  // RAF animation loop
  useEffect(() => {
    let lastTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      if (doneRef.current) return;
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const multiplier = 1 + hitsRef.current * 0.1;
      posRef.current += dirRef.current * baseSpeed * multiplier * dt * 100;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0)   { posRef.current = 0;   dirRef.current =  1; }
      setIndicatorPos(posRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { doneRef.current = true; cancelAnimationFrame(raf); };
  }, [baseSpeed]);

  const handleHit = useCallback(() => {
    if (flashRef.current !== null || doneRef.current) return;
    const inZone = posRef.current >= zonePos && posRef.current <= zonePos + zoneWidth;
    if (inZone) {
      const next = hitsRef.current + 1;
      setHits(next);
      setFlash("good");
      // Move zone to a new random position for the next hit
      setZonePos(8 + Math.random() * 55);
      setTimeout(() => setFlash(null), 200);
      if (next >= HITS_NEEDED) { doneRef.current = true; onSuccess(); }
    } else {
      const m = missesRef.current + 1;
      setMisses(m);
      setFlash("bad");
      setTimeout(() => setFlash(null), 300);
      onMistake(20);
      if (m >= 3) { doneRef.current = true; onMistake(100); } // 3 misses = bust
    }
  }, [zonePos, zoneWidth, onSuccess, onMistake]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); handleHit(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleHit]);

  return (
    <div className="space-y-5 text-center">
      <div>
        <p className="text-xs text-[#666] uppercase tracking-widest mb-2">⚡ Zona de Calor</p>
        <p className="text-xs text-[#555] mb-3">Acerta na zona verde {HITS_NEEDED} vezes para escapar</p>
        <div className="flex justify-center gap-6">
          <span className="text-sm font-bold text-green-400">✅ {hits}/{HITS_NEEDED}</span>
          <span className="text-sm font-bold text-red-400">❌ {misses}/3</span>
        </div>
      </div>

      {/* Sliding bar */}
      <div className={`relative w-full h-14 bg-[#111] rounded-full overflow-hidden border-2 transition-colors duration-150 ${
        flash === "good" ? "border-green-500" :
        flash === "bad"  ? "border-red-500"   :
        "border-[#2a2a2a]"
      }`}>
        {/* Safe zone */}
        <div
          className="absolute top-0 bottom-0 bg-green-500/25 border-l-2 border-r-2 border-green-500/60"
          style={{ left: `${zonePos}%`, width: `${zoneWidth}%` }}
        />
        {/* Moving indicator */}
        <div
          className="absolute top-2 bottom-2 w-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
          style={{ left: `calc(${indicatorPos}% - 6px)`, transition: "none" }}
        />
      </div>

      {/* Tap button */}
      <button
        onPointerDown={(e) => { e.preventDefault(); handleHit(); }}
        className={`w-full py-7 rounded-2xl font-black text-2xl select-none transition-all active:scale-95 ${
          flash === "good" ? "bg-green-700 border-2 border-green-500 text-white" :
          flash === "bad"  ? "bg-red-700 border-2 border-red-500 text-white"     :
          "bg-[#1a1a1a] border-2 border-[#333] hover:border-pink-500 text-white"
        }`}
      >
        ESPAÇO / TAP
      </button>
      <p className="text-[10px] text-[#444]">Pressiona quando o indicador estiver na zona verde</p>
    </div>
  );
}
