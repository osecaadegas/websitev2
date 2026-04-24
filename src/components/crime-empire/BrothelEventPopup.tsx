"use client";
import { useState } from "react";
import RaidEscape from "./raid/RaidEscape";

interface EventChoice {
  label: string;
  action: string;
  reward_cash: number;
  reward_xp: number;
}

export interface BrothelEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  choices: EventChoice[];
  player_brothel_id: string;
}

interface Props {
  event: BrothelEvent;
  onResolve: (eventId: string, choice: string) => void;
  cashAtRisk?: number;
}

const EVENT_ICONS: Record<string, string> = {
  vip_client: "👑",
  worker_unhappy: "😤",
  police: "🚔",
  bonus: "🎉",
  supply_low: "⚠️",
};

export default function BrothelEventPopup({ event, onResolve, cashAtRisk = 5000 }: Props) {
  const [showRaid, setShowRaid] = useState(false);

  const handleChoice = (action: string) => {
    if (action === "police_risk") {
      setShowRaid(true);
      return;
    }
    onResolve(event.id, action);
  };

  if (showRaid) {
    return (
      <RaidEscape
        difficulty="medium"
        cashAtRisk={cashAtRisk}
        onEscape={() => onResolve(event.id, "police_risk_escaped")}
        onArrested={() => onResolve(event.id, "police_risk_arrested")}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md mx-4 p-6 rounded-2xl bg-gradient-to-br from-[#1a0a1a] to-[#110a1a] border-2 border-pink-500/60 shadow-[0_0_40px_rgba(236,72,153,0.3)]">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-2xl border border-purple-500/20 pointer-events-none" />

        <div className="text-5xl text-center mb-3">
          {EVENT_ICONS[event.event_type] ?? "⚡"}
        </div>
        <h3 className="text-xl font-black text-center text-white mb-2">{event.title}</h3>
        <p className="text-[#aaa] text-sm text-center mb-6 leading-relaxed">{event.description}</p>

        <div className="space-y-3">
          {event.choices.map((choice) => (
            <button
              key={choice.action}
              onClick={() => handleChoice(choice.action)}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-95
                bg-gradient-to-r from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600
                border border-pink-500/30 text-white shadow-lg"
            >
              {choice.label}
              {choice.reward_cash > 0 && (
                <span className="ml-2 text-green-300 text-xs">(+${choice.reward_cash.toLocaleString()})</span>
              )}
              {choice.reward_cash < 0 && (
                <span className="ml-2 text-red-300 text-xs">(-${Math.abs(choice.reward_cash).toLocaleString()})</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
