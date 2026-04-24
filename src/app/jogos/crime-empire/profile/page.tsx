"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

interface Player {
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
  crypto?: number;
  stamina: number;
  max_stamina: number;
  addiction?: number;
  in_jail: boolean;
  jail_release_at: string | null;
}

const CLASS_LABELS: Record<string, string> = {
  thief: "Ladrão",
  hooligan: "Hooligan",
  businessman: "Empresário",
  hitman: "Assassino",
  scammer: "Burlão",
  brute: "Bruto",
  dealer: "Traficante",
  pimp: "Chulo",
  hacker: "Hacker",
};

const CLASS_GLOW: Record<string, string> = {
  thief: "#9333ea",
  hooligan: "#dc2626",
  businessman: "#2563eb",
  hitman: "#475569",
  scammer: "#d97706",
  brute: "#ea580c",
  dealer: "#16a34a",
  pimp: "#db2777",
  hacker: "#06b6d4",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/jogos/crime-empire"); return; }
    fetch("/api/crime-empire/player")
      .then((r) => r.json())
      .then((d) => {
        if (!d.player) { router.push("/jogos/crime-empire"); return; }
        setPlayer(d.player);
      })
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#ff6a00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) return null;

  const glow = CLASS_GLOW[player.class] ?? "#ff6a00";
  const hpPct = Math.min(100, Math.round((player.hp / player.max_hp) * 100));
  const staminaPct = Math.min(100, Math.round((player.stamina / player.max_stamina) * 100));
  const xpPct = Math.min(100, Math.round((player.xp / player.xp_to_next_level) * 100));
  const addiction = player.addiction ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Header card */}
      <div
        className="rounded-2xl p-6 border"
        style={{ background: `${glow}10`, borderColor: `${glow}30` }}
      >
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden border-2"
              style={{ borderColor: glow }}
            >
              <Image
                src={`/images/crime_empire/characters/${player.class}.png`}
                alt={player.class}
                width={80} height={80}
                className="w-full h-full object-contain bg-[#0a0a0a]"
              />
            </div>
            {player.in_jail && (
              <span className="absolute -bottom-1 -right-1 text-sm bg-red-600 rounded-full px-1.5">🚔</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white truncate">
              {player.display_name || player.username}
            </h1>
            <p className="text-sm text-[#888] truncate">@{player.username}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${glow}25`, color: glow }}
              >
                {CLASS_LABELS[player.class] ?? player.class}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#1a1a1a] text-white">
                Nível {player.level}
              </span>
              {player.prestige_level > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                  ⭐ Prestige {player.prestige_level}
                </span>
              )}
              {player.in_jail && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-900/40 text-red-400">
                  🚔 Na Prisão
                </span>
              )}
            </div>
          </div>
          {player.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatar_url}
              alt={player.display_name}
              className="w-12 h-12 rounded-full border-2 border-[#333] flex-shrink-0"
            />
          )}
        </div>

        {/* XP bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-[#888] mb-1.5">
            <span>XP {player.xp.toLocaleString()} / {player.xp_to_next_level.toLocaleString()}</span>
            <span>{xpPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${xpPct}%`, background: `linear-gradient(to right, ${glow}, #ff8533)` }}
            />
          </div>
        </div>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-1 gap-3">
        {[
          { label: "❤️ HP", value: player.hp, max: player.max_hp, pct: hpPct, color: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#eab308" : "#ef4444" },
          { label: "⚡ Stamina", value: player.stamina, max: player.max_stamina, pct: staminaPct, color: "#f59e0b" },
          ...(addiction > 0 ? [{ label: "💉 Vício", value: addiction, max: 100, pct: addiction, color: addiction < 40 ? "#eab308" : addiction < 70 ? "#f97316" : "#ef4444" }] : []),
        ].map((bar) => (
          <div key={bar.label} className="p-4 rounded-xl bg-[#111] border border-[#1e1e1e]">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-[#ccc]">{bar.label}</span>
              <span className="text-[#888]">{bar.value} / {bar.max}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#1a1a1a] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${bar.pct}%`, background: bar.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Combat stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Poder", value: player.power, icon: "⚔️", color: "#ef4444" },
          { label: "Inteligência", value: player.intelligence, icon: "🧠", color: "#3b82f6" },
          { label: "Carisma", value: player.charisma, icon: "✨", color: "#eab308" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-xl border text-center"
            style={{ background: `${s.color}10`, borderColor: `${s.color}30` }}
          >
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xs text-[#666] mb-1">{s.label}</p>
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Money & progression */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Dinheiro Sujo", value: `$${player.dirty_cash.toLocaleString()}`, icon: "💵", color: "#22c55e" },
          { label: "Dinheiro Limpo", value: `$${player.cash.toLocaleString()}`, icon: "💰", color: "#10b981" },
          { label: "Crypto", value: `₿${(player.crypto ?? 0).toLocaleString()}`, icon: "💎", color: "#a855f7" },
          { label: "VCash", value: `V${player.vcash.toLocaleString()}`, icon: "🪙", color: "#ec4899" },
          { label: "Respeito", value: player.respect.toLocaleString(), icon: "👑", color: "#f97316" },
          { label: "Níveis Totais", value: player.total_levels_earned.toLocaleString(), icon: "🏆", color: "#f59e0b" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-xl border"
            style={{ background: `${s.color}0d`, borderColor: `${s.color}25` }}
          >
            <p className="text-xs text-[#666] mb-1">{s.icon} {s.label}</p>
            <p className="text-lg font-black truncate" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
