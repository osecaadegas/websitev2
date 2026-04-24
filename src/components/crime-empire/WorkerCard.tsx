"use client";

import { useState } from "react";

export interface Worker {
  id: string;
  name: string;
  status: string;
  income_per_hour: number;
  attractiveness: number;
  stamina: number;
  mood: number;
  happiness: number;
  trait_1?: string;
  trait_2?: string;
  charisma_bonus: number;
  player_brothel_id?: string;
  assigned_room?: number;
}

interface WorkerCardProps {
  worker: Worker;
  onFire: (id: string) => void;
  onPayBonus: (id: string) => void;
  compact?: boolean;
}

function StatBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const pulseClass =
    pct < 30 ? "animate-pulse" : pct < 60 ? "" : "";
  const barColor =
    pct >= 70 ? color : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className={`w-full h-1.5 bg-[#222] rounded-full overflow-hidden ${pulseClass}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function HappinessFace({ value }: { value: number }) {
  if (value >= 70) return <span title="Feliz">😊</span>;
  if (value >= 40) return <span title="Neutra">😐</span>;
  return <span title="Infeliz" className="animate-bounce inline-block">😠</span>;
}

export default function WorkerCard({ worker, onFire, onPayBonus, compact = false }: WorkerCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const borderColor =
    worker.happiness >= 70
      ? "border-green-500/40 hover:border-green-400"
      : worker.happiness >= 40
      ? "border-yellow-500/40 hover:border-yellow-400"
      : "border-red-500/60 hover:border-red-400";

  const glowClass =
    worker.happiness < 30
      ? "shadow-[0_0_12px_rgba(239,68,68,0.3)]"
      : worker.happiness >= 80
      ? "shadow-[0_0_12px_rgba(34,197,94,0.15)]"
      : "";

  if (compact) {
    return (
      <div
        className={`p-3 rounded-xl bg-[#111] border ${borderColor} ${glowClass} transition-all cursor-pointer`}
        onClick={() => setShowDetails((v) => !v)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">💋</span>
          <span className="font-bold text-sm text-pink-200 truncate flex-1">{worker.name}</span>
          <HappinessFace value={worker.happiness} />
        </div>
        <div className="text-xs text-green-400">${worker.income_per_hour}/h</div>
        {showDetails && (
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#999]">
              <span>Atratividade</span><span className="text-pink-300">{worker.attractiveness}</span>
            </div>
            <StatBar value={worker.attractiveness} color="bg-pink-500" />
            <div className="flex justify-between text-[#999]">
              <span>Stamina</span><span className="text-blue-300">{worker.stamina}</span>
            </div>
            <StatBar value={worker.stamina} color="bg-blue-500" />
            <div className="flex justify-between text-[#999]">
              <span>Felicidade</span><span className="text-green-300">{worker.happiness}</span>
            </div>
            <StatBar value={worker.happiness} color="bg-green-500" />
            <div className="flex gap-1 mt-1 flex-wrap">
              {worker.trait_1 && <span className="px-1.5 py-0.5 rounded bg-pink-900/50 text-pink-300">{worker.trait_1}</span>}
              {worker.trait_2 && <span className="px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">{worker.trait_2}</span>}
            </div>
            <div className="flex gap-1 mt-1">
              {worker.happiness < 50 && (
                <button onClick={(e) => { e.stopPropagation(); onPayBonus(worker.id); }}
                  className="flex-1 text-xs py-1 rounded bg-yellow-600 hover:bg-yellow-500 font-bold">
                  💰 Bónus ($2k)
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onFire(worker.id); }}
                className="flex-1 text-xs py-1 rounded bg-red-900 hover:bg-red-700 text-red-300">
                Despedir
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl bg-[#131313] border-2 ${borderColor} ${glowClass} transition-all group`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
            💋
          </div>
          <div>
            <h4 className="font-bold text-white text-base">{worker.name}</h4>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {worker.trait_1 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-pink-900/60 text-pink-300 border border-pink-700/40">
                  {worker.trait_1}
                </span>
              )}
              {worker.trait_2 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/40">
                  {worker.trait_2}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-green-400 font-bold">${worker.income_per_hour}/h</div>
          <div className="text-xl mt-0.5"><HappinessFace value={worker.happiness} /></div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2.5 mb-4">
        <div>
          <div className="flex justify-between text-xs text-[#888] mb-1">
            <span>✨ Atratividade</span><span className="text-pink-300">{worker.attractiveness}/100</span>
          </div>
          <StatBar value={worker.attractiveness} color="bg-pink-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-[#888] mb-1">
            <span>⚡ Stamina</span><span className="text-blue-300">{worker.stamina}/100</span>
          </div>
          <StatBar value={worker.stamina} color="bg-blue-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-[#888] mb-1">
            <span>💖 Felicidade</span><span className="text-green-300">{worker.happiness}/100</span>
          </div>
          <StatBar value={worker.happiness} color="bg-green-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-[#888] mb-1">
            <span>🎭 Mood</span><span className="text-yellow-300">{worker.mood}/100</span>
          </div>
          <StatBar value={worker.mood} color="bg-yellow-500" />
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          worker.status === "healthy" ? "bg-green-900/60 text-green-300 border border-green-700/40" :
          worker.status === "sick"    ? "bg-orange-900/60 text-orange-300 border border-orange-700/40" :
          "bg-red-900/60 text-red-300 border border-red-700/40"
        }`}>
          {worker.status === "healthy" ? "✅ Saudável" : worker.status === "sick" ? "🤒 Doente" : "❌ Inativa"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {worker.happiness < 50 && (
          <button
            onClick={() => onPayBonus(worker.id)}
            className="flex-1 py-2 rounded-lg bg-yellow-600/80 hover:bg-yellow-500 text-sm font-bold transition-all hover:scale-105 active:scale-95"
          >
            💰 Bónus ($2k)
          </button>
        )}
        <button
          onClick={() => onFire(worker.id)}
          className="flex-1 py-2 rounded-lg bg-red-900/60 hover:bg-red-700/80 text-red-300 text-sm font-bold transition-all hover:scale-105 active:scale-95"
        >
          🗑️ Despedir
        </button>
      </div>
    </div>
  );
}
