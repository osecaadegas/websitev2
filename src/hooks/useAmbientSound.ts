"use client";

import { useState, useCallback } from "react";

/**
 * Simple audio toggle hook for ambient arena sounds.
 * Creates audio elements on demand — no autoplay (respects browser policy).
 */
export function useAmbientSound(src: string) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    if (!audio) {
      const a = new Audio(src);
      a.loop = true;
      a.volume = 0.3;
      a.play();
      setAudio(a);
      setPlaying(true);
    } else if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }, [audio, playing, src]);

  return { playing, toggle };
}
