"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smoothly tweens a numeric value over `durationMs` using cubic ease-out.
 * Pair with the `.ce-tick-number` class for tabular-nums alignment, and
 * toggle `.ce-tick-number--flash` on changes for a gold flash highlight.
 *
 * @example
 *   const display = useTickingNumber(player.cash, 600);
 *   <span className="ce-tick-number">${display.toLocaleString()}</span>
 */
export function useTickingNumber(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(target);

  useEffect(() => {
    if (target === targetRef.current) return;
    fromRef.current = value;
    targetRef.current = target;
    startRef.current = null;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(t === 1 ? target : next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
