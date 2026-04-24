"use client";

/**
 * RaidEscapeContext — Global Police Raid Escape System
 *
 * Wrap the app (or the game layout) with <RaidEscapeProvider>.
 * Then in ANY component, call:
 *
 *   const { startLockSequenceEscape } = useRaidEscape();
 *
 *   startLockSequenceEscape({
 *     level: "medium",        // "low" | "medium" | "high" | "elite"
 *     cashAtRisk: 5000,       // optional
 *     context: "brothel",     // optional — drives the intro message
 *     onEscape: (cashSaved) => { ... },
 *     onArrested: () => { ... },
 *   });
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import GlobalLockEscape, {
  type RaidLevel,
} from "@/components/crime-empire/raid/GlobalLockEscape";

// ─── Public API types ────────────────────────────────────────────────────────

export interface RaidEscapeOptions {
  /** Difficulty / threat tier */
  level: RaidLevel;
  /** How much cash (or value) the player stands to lose on arrest */
  cashAtRisk?: number;
  /**
   * Location context key — controls the intro flavour text.
   * Supported: "brothel" | "lab" | "warehouse" | "street" | "safehouse" | "smuggling" | "hq"
   * Falls back to a generic message for unknown keys.
   */
  context?: string;
  /**
   * Called when the player successfully completes the sequence.
   * Receives the cashAtRisk value for use in reward calculations.
   */
  onEscape: (cashSaved?: number) => void;
  /** Called when the arrest meter fills or the timer expires */
  onArrested: () => void;
}

interface RaidEscapeContextType {
  /** Trigger the Lock Sequence minigame globally. Only one instance at a time. */
  startLockSequenceEscape: (opts: RaidEscapeOptions) => void;
  /** Whether a raid is currently active (useful for disabling other interactions) */
  isRaidActive: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const RaidEscapeContext = createContext<RaidEscapeContextType>({
  startLockSequenceEscape: () => {},
  isRaidActive: false,
});

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRaidEscape(): RaidEscapeContextType {
  return useContext(RaidEscapeContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function RaidEscapeProvider({ children }: { children: ReactNode }) {
  const [activeRaid, setActiveRaid] = useState<RaidEscapeOptions | null>(null);

  const startLockSequenceEscape = useCallback((opts: RaidEscapeOptions) => {
    // Ignore if a raid is already running — first raid wins
    setActiveRaid((prev) => prev ?? opts);
  }, []);

  const handleEscape = useCallback(
    (cashSaved?: number) => {
      if (!activeRaid) return;
      const cb = activeRaid.onEscape;
      setActiveRaid(null);
      cb(cashSaved);
    },
    [activeRaid]
  );

  const handleArrested = useCallback(() => {
    if (!activeRaid) return;
    const cb = activeRaid.onArrested;
    setActiveRaid(null);
    cb();
  }, [activeRaid]);

  return (
    <RaidEscapeContext.Provider
      value={{
        startLockSequenceEscape,
        isRaidActive: activeRaid !== null,
      }}
    >
      {children}

      {activeRaid && (
        <GlobalLockEscape
          level={activeRaid.level}
          cashAtRisk={activeRaid.cashAtRisk}
          context={activeRaid.context}
          onEscape={handleEscape}
          onArrested={handleArrested}
        />
      )}
    </RaidEscapeContext.Provider>
  );
}
