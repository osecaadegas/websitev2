"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_CONFIGS, GAME_IDS, GAME_META, type GameDifficulty, type GameId } from "./gameConfig";
import { LockpickGame } from "./LockpickGame";
import { SafeCrackGame } from "./SafeCrackGame";
import { WireCutGame } from "./WireCutGame";
import { HackPatternGame } from "./HackPatternGame";
import { ThermiteGame } from "./ThermiteGame";
import { KeypadGame } from "./KeypadGame";
import { PanicEscapeGame } from "./PanicEscapeGame";

type Status = "playing" | "success" | "fail";

type Props = {
  /** Specific game to play. If omitted a random one is chosen. */
  gameId?: GameId;
  difficulty: GameDifficulty;
  title?: string;
  onSuccess: () => void;
  onFail: () => void;
};

export function CrimeMinigame({ gameId, difficulty, title, onSuccess, onFail }: Props) {
  const resolvedId: GameId = useMemo(
    () => gameId ?? GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const config = GAME_CONFIGS[difficulty];
  const meta = GAME_META[resolvedId];
  const [status, setStatus] = useState<Status>("playing");
  const [feedback, setFeedback] = useState("");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneCalled = useRef(false);

  const handleSuccess = useCallback((msg: string) => {
    setStatus("success");
    setFeedback(msg);
  }, []);

  const handleFail = useCallback((msg: string) => {
    setStatus("fail");
    setFeedback(msg);
  }, []);

  const handleFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(""), 1800);
  }, []);

  // Propagate result after a short delay so the UI can show outcome
  useEffect(() => {
    if (doneCalled.current) return;
    if (status === "success") {
      doneCalled.current = true;
      const t = setTimeout(onSuccess, 1600);
      return () => clearTimeout(t);
    }
    if (status === "fail") {
      doneCalled.current = true;
      const t = setTimeout(onFail, 1600);
      return () => clearTimeout(t);
    }
  }, [status, onSuccess, onFail]);

  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);

  const gameProps = { config, onSuccess: handleSuccess, onFail: handleFail, onFeedback: handleFeedback };

  const GameComponent = {
    lockpick: LockpickGame,
    safe:     SafeCrackGame,
    wires:    WireCutGame,
    hack:     HackPatternGame,
    thermite: ThermiteGame,
    keypad:   KeypadGame,
    panic:    PanicEscapeGame,
  }[resolvedId];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <div className="text-white font-black text-lg leading-none">{title ?? meta.name}</div>
            <div className="text-slate-400 text-xs">{meta.desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
            difficulty === "low" ? "bg-green-900/60 text-green-300" :
            difficulty === "medium" ? "bg-yellow-900/60 text-yellow-300" :
            "bg-red-900/60 text-red-300"
          }`}>
            {config.label}
          </span>
          {status !== "playing" && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
              status === "success" ? "bg-green-900/60 text-green-300" : "bg-red-900/60 text-red-300"
            }`}>
              {status === "success" ? "✓ Sucesso" : "✗ Falhado"}
            </span>
          )}
        </div>
      </div>

      {/* Game area */}
      <div className={`relative rounded-2xl border transition-all duration-300 overflow-hidden
        ${status === "playing"
          ? "border-slate-700 bg-slate-900/60"
          : status === "success"
          ? "border-green-500/60 bg-green-950/30"
          : "border-red-500/60 bg-red-950/30"
        }`}
      >
        <div className="p-4">
          {status === "playing" && <GameComponent {...gameProps} />}
          {status !== "playing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="text-5xl">{status === "success" ? "🔓" : "🚔"}</div>
              <div className={`text-xl font-black ${status === "success" ? "text-green-400" : "text-red-400"}`}>
                {feedback}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback ticker */}
      {status === "playing" && feedback && (
        <div className={`text-center text-sm font-bold py-1 px-3 rounded-xl border ${
          feedback.startsWith("✅") || feedback.startsWith("✓")
            ? "text-green-300 bg-green-950/40 border-green-700/40"
            : "text-red-300 bg-red-950/40 border-red-700/40"
        }`}>
          {feedback}
        </div>
      )}
    </div>
  );
}
