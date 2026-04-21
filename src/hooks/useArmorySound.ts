"use client";

import { useCallback, useRef } from "react";

const preloaded = new Map<string, HTMLAudioElement>();

function preload(src: string) {
  if (preloaded.has(src)) return preloaded.get(src)!;
  const audio = new Audio(src);
  audio.preload = "auto";
  preloaded.set(src, audio);
  return audio;
}

export function useArmorySound() {
  const ready = useRef(false);

  const init = useCallback(() => {
    if (ready.current) return;
    ready.current = true;
    preload("/sounds/hover.mp3");
    preload("/sounds/click.mp3");
    preload("/sounds/redeem.mp3");
  }, []);

  const play = useCallback((type: "hover" | "click" | "redeem") => {
    const map = { hover: "/sounds/hover.mp3", click: "/sounds/click.mp3", redeem: "/sounds/redeem.mp3" };
    try {
      const audio = preload(map[type]);
      audio.currentTime = 0;
      audio.volume = type === "hover" ? 0.15 : type === "click" ? 0.3 : 0.5;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  const vibrate = useCallback((type: "hover" | "click" | "success") => {
    if (!navigator.vibrate) return;
    const patterns = { hover: [10], click: [25], success: [50, 30, 80] };
    try { navigator.vibrate(patterns[type]); } catch {}
  }, []);

  return { init, play, vibrate };
}
