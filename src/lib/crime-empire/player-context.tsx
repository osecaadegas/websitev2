"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

/* ─── Types ─────────────────────────────────────────────────── */
export interface CEPlayer {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  class: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  prestige_level: number;
  total_levels_earned: number;
  hp: number;
  max_hp: number;
  respect: number;
  power: number;
  intelligence: number;
  charisma: number;
  dirty_cash: number;
  cash: number;
  vcash: number;
  crypto: number;
  stamina: number;
  max_stamina: number;
  addiction: number;
  in_jail: boolean;
  boost_active: boolean;
}

interface PlayerContextValue {
  player: CEPlayer | null;
  refreshPlayer: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue>({
  player: null,
  refreshPlayer: async () => {},
});

const POLL_INTERVAL = 10_000; // 10s auto-refresh safety net
const CE_REFRESH_EVENT = "ce:player-update";

/* ─── Helper: dispatch event from anywhere ───────────────────── */
export function notifyPlayerUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CE_REFRESH_EVENT));
  }
}

/* ─── Provider ───────────────────────────────────────────────── */
export function CrimePlayerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [player, setPlayer] = useState<CEPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isInGame =
    !!pathname?.startsWith("/jogos/crime-empire") &&
    pathname !== "/jogos/crime-empire/create-character";

  const fetchPlayer = useCallback(async () => {
    if (!isInGame) return;
    try {
      const res = await fetch("/api/crime-empire/player");
      const data = await res.json();
      if (data.player) {
        setPlayer((prev) => {
          // Detect level-up & broadcast
          if (prev && data.player.level > prev.level && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("ce:level-up", {
                detail: { fromLevel: prev.level, toLevel: data.player.level },
              }),
            );
          }
          return data.player;
        });
      }
    } catch {
      // silent
    }
  }, [isInGame]);

  /* Initial fetch + interval */
  useEffect(() => {
    if (!isInGame) return;
    fetchPlayer();
    intervalRef.current = setInterval(fetchPlayer, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isInGame, fetchPlayer]);

  /* Listen for event-based instant refresh */
  useEffect(() => {
    if (!isInGame) return;
    const handler = () => fetchPlayer();
    window.addEventListener(CE_REFRESH_EVENT, handler);
    return () => window.removeEventListener(CE_REFRESH_EVENT, handler);
  }, [isInGame, fetchPlayer]);

  return (
    <PlayerContext.Provider value={{ player, refreshPlayer: fetchPlayer }}>
      {children}
    </PlayerContext.Provider>
  );
}

/* ─── Hook ───────────────────────────────────────────────────── */
export function usePlayer() {
  return useContext(PlayerContext);
}
