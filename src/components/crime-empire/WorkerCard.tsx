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
  slug?: string; // links to /images/hooker/{slug}.jpg
}

interface WorkerCardProps {
  worker: Worker;
  onFire: (id: string) => void;
  onPayBonus: (id: string) => void;
  compact?: boolean;
}

function StatBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const barColor = pct >= 70 ? color : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className={`w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden ${pct < 30 ? "animate-pulse" : ""}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function HappinessFace({ value }: { value: number }) {
  if (value >= 70) return <span>😊</span>;
  if (value >= 40) return <span>😐</span>;
  return <span className="animate-bounce inline-block">😠</span>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    healthy: { label: "Ativa", cls: "bg-green-900/60 text-green-400 border-green-600/40" },
    tired:   { label: "Cansada", cls: "bg-yellow-900/60 text-yellow-400 border-yellow-600/40" },
    sick:    { label: "Doente", cls: "bg-red-900/60 text-red-400 border-red-600/40" },
  };
  const conf = map[status] ?? { label: status, cls: "bg-[#222] text-[#888] border-[#333]" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${conf.cls}`}>
      {conf.label}
    </span>
  );
}

export default function WorkerCard({ worker, onFire, onPayBonus, compact = false }: WorkerCardProps) {
  const [expanded, setExpanded] = useState(false);

  const imageUrl = worker.slug ? `/images/hooker/${worker.slug}.jpg` : null;

  const borderColor =
    worker.happiness >= 70 ? "border-green-500/30" :
    worker.happiness >= 40 ? "border-yellow-500/30" :
    "border-red-500/50";

  const glowClass =
    worker.happiness < 30  ? "shadow-[0_0_14px_rgba(239,68,68,0.25)]" :
    worker.happiness >= 80 ? "shadow-[0_0_14px_rgba(34,197,94,0.15)]" : "";

  // ── COMPACT (overview page grid) ─────────────────────────────────────────
  if (compact) {
    return (
      <div
        className={`rounded-xl overflow-hidden border ${borderColor} ${glowClass} bg-[#111] transition-all cursor-pointer hover:border-pink-500/40 hover:scale-[1.02]`}
        onClick={() => setExpanded((v) => !v)}
      >
        {imageUrl ? (
          <div className="relative h-28 overflow-hidden">
            <img src={imageUrl} alt={worker.name} className="w-full h-full object-cover object-top" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
            <div className="absolute top-1.5 right-1.5"><StatusPill status={worker.status} /></div>
          </div>
        ) : (
          <div className="h-14 bg-gradient-to-br from-pink-900/20 to-purple-900/20 flex items-center justify-center text-2xl">💋</div>
        )}
        <div className="p-2.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-bold text-sm text-pink-200 truncate">{worker.name}</span>
            <HappinessFace value={worker.happiness} />
          </div>
          <div className="text-xs text-green-400 font-bold">${worker.income_per_hour.toLocaleString()}/h</div>
          {expanded && (
            <div className="mt-2 space-y-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between text-[#777]"><span>Atratividade</span><span className="text-pink-300">{worker.attractiveness}</span></div>
              <StatBar value={worker.attractiveness} color="bg-pink-500" />
              <div className="flex justify-between text-[#777]"><span>Stamina</span><span className="text-blue-300">{worker.stamina}</span></div>
              <StatBar value={worker.stamina} color="bg-blue-500" />
              <div className="flex justify-between text-[#777]"><span>Felicidade</span><span className="text-green-300">{worker.happiness}</span></div>
              <StatBar value={worker.happiness} color="bg-green-500" />
              {(worker.trait_1 || worker.trait_2) && (
                <div className="flex gap-1 flex-wrap pt-0.5">
                  {worker.trait_1 && <span className="px-1.5 py-0.5 rounded-full bg-pink-900/40 text-pink-300">{worker.trait_1}</span>}
                  {worker.trait_2 && <span className="px-1.5 py-0.5 rounded-full bg-purple-900/40 text-purple-300">{worker.trait_2}</span>}
                </div>
              )}
              <div className="flex gap-1 pt-1">
                {worker.happiness < 50 && (
                  <button onClick={() => onPayBonus(worker.id)}
                    className="flex-1 text-[10px] py-1 rounded-lg bg-yellow-700 hover:bg-yellow-600 font-bold transition-all">
                    💰 Bónus ($1.5k sujo)
                  </button>
                )}
                <button onClick={() => onFire(worker.id)}
                  className="text-[10px] py-1 px-2 rounded-lg bg-red-900/50 hover:bg-red-700 text-red-300 hover:text-white font-bold transition-all">
                  🗑️
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── FULL (management page) ────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl overflow-hidden border-2 ${borderColor} ${glowClass} bg-[#0f0f0f] transition-all hover:border-pink-500/40`}>
      {imageUrl ? (
        <div className="relative h-52 overflow-hidden">
          <img
            src={imageUrl} alt={worker.name}
            className="w-full h-full object-cover object-top transition-transform duration-500 hover:scale-105"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/10 to-transparent" />
          <div className="absolute top-2 right-2"><StatusPill status={worker.status} /></div>
          <div className="absolute bottom-2 right-2 text-xl"><HappinessFace value={worker.happiness} /></div>
        </div>
      ) : (
        <div className="relative h-44 bg-gradient-to-br from-pink-900/20 to-purple-900/20 flex items-center justify-center">
          <span className="text-5xl">💋</span>
          <div className="absolute top-2 right-2"><StatusPill status={worker.status} /></div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-black text-base text-white">{worker.name}</h4>
            <p className="text-lg font-bold text-green-400">
              ${worker.income_per_hour.toLocaleString()}<span className="text-xs text-[#555]">/h</span>
            </p>
          </div>
          {worker.assigned_room && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#666] border border-[#2a2a2a]">
              Sala {worker.assigned_room}
            </span>
          )}
        </div>

        {(worker.trait_1 || worker.trait_2) && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {worker.trait_1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-900/40 border border-pink-700/30 text-pink-300">{worker.trait_1}</span>
            )}
            {worker.trait_2 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/30 text-purple-300">{worker.trait_2}</span>
            )}
          </div>
        )}

        <div className="space-y-2 mb-4">
          {[
            { label: "Atratividade", val: worker.attractiveness, color: "bg-pink-500", text: "text-pink-300" },
            { label: "Stamina",      val: worker.stamina,        color: "bg-blue-500",  text: "text-blue-300" },
            { label: "Felicidade",   val: worker.happiness,      color: "bg-green-500", text: "text-green-300" },
            { label: "Mood",         val: worker.mood,           color: "bg-yellow-500",text: "text-yellow-300" },
          ].map(({ label, val, color, text }) => (
            <div key={label}>
              <div className="flex justify-between text-xs text-[#777] mb-1">
                <span>{label}</span><span className={text}>{val}</span>
              </div>
              <StatBar value={val} color={color} />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {worker.happiness < 50 && (
            <button onClick={() => onPayBonus(worker.id)}
              className="flex-1 py-2 rounded-xl bg-yellow-700/80 hover:bg-yellow-600 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95">
              💰 Pagar Bónus ($1.5k sujo)
            </button>
          )}
          <button onClick={() => onFire(worker.id)}
            className="py-2 px-3 rounded-xl bg-red-900/40 hover:bg-red-700/80 border border-red-700/40 text-red-400 hover:text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95">
            🗑️ Despedir
          </button>
        </div>
      </div>
    </div>
  );
}
