"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { usePlayer, CEPlayer as Player } from "@/lib/crime-empire/player-context";

/* ─────────────────── Types ─────────────────── */
// Player type is imported from player-context (CEPlayer as Player)

interface ItemData {
  id: string;
  name: string;
  description: string;
  category: string;
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  stamina_restore: number;
  success_rate_bonus: number;
  base_price: number;
  image_url?: string | null;
}

interface InventoryEntry {
  id: string;
  item_id: string;
  quantity: number;
  equipped: boolean;
  items: ItemData;
}

interface LeaderPlayer {
  id: string;
  username: string;
  display_name: string;
  class: string;
  level: number;
  respect: number;
  prestige_level: number;
  avatar_url?: string;
}

interface Extended {
  total_crimes_attempted: number;
  total_crimes_succeeded: number;
  pvp_wins: number;
  pvp_losses: number;
  contracts_completed: number;
  times_jailed: number;
  businesses_owned: number;
  total_workers: number;
  equipped_items: number;
  shares: { display_symbol: string; display_name: string; quantity: number; bought_price: number; dirty_cash_invested: number }[];
}

type Panel = "stats" | "inventory" | "leaderboard" | null;

/* ─────────────────── CLASS CONFIG ─────────────────── */
const CLASS_GLOW: Record<string, string> = {
  thief: "#9333ea",
  hooligan: "#dc2626",
  businessman: "#2563eb",
  hitman: "#475569",
  scammer: "#d97706",
  brute: "#ea580c",
  dealer: "#16a34a",
  pimp: "#db2777",
};

const CLASS_NAMES: Record<string, string> = {
  thief: "Ladrão",
  hooligan: "Hooligan",
  businessman: "Empresário",
  hitman: "Assassino",
  scammer: "Burlão",
  brute: "Bruto",
  dealer: "Traficante",
  pimp: "Chulo",
};

/* ─────────────────── MINI STAT BAR ─────────────────── */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/* ─────────────────── STATS PANEL ─────────────────── */
function StatsPanel({ player }: { player: Player }) {
  const glow = CLASS_GLOW[player.class] ?? "#ff6a00";
  const addiction = player.addiction ?? 0;
  const [ext, setExt] = useState<Extended | null>(null);
  const [extLoading, setExtLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crime-empire/player-full")
      .then((r) => r.json())
      .then((d) => { setExt(d.extended ?? null); setExtLoading(false); })
      .catch(() => setExtLoading(false));
  }, []);

  return (
    <div className="space-y-4 px-5 py-5">
      {/* Identity */}
      <div className="p-4 rounded-2xl border" style={{ background: `${glow}12`, borderColor: `${glow}40` }}>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: glow }}>
            <Image src={`/images/crime_empire/characters/${player.class}.png`} alt={player.class} width={56} height={56} className="w-full h-full object-contain bg-[#0a0a0a]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-base truncate">{player.display_name || player.username}</p>
            <p className="text-xs text-[#666]">@{player.username}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: `${glow}25`, color: glow }}>
                {CLASS_NAMES[player.class] ?? player.class}
              </span>
              {player.prestige_level > 0 && <span className="text-yellow-400 text-[10px] font-bold">⭐ P{player.prestige_level}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black text-white">{player.level}</p>
            <p className="text-[10px] text-[#555] uppercase tracking-widest">Nível</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-[#555] mb-1">
            <span>XP</span><span>{player.xp.toLocaleString()} / {player.xp_to_next_level.toLocaleString()}</span>
          </div>
          <MiniBar value={player.xp} max={player.xp_to_next_level} color={glow} />
        </div>
        {player.in_jail && <p className="mt-2 text-[10px] text-red-400 font-semibold">🚔 Na prisão</p>}
        {player.boost_active && <p className="mt-1 text-[10px] text-green-400 font-semibold">⚡ Bónus novo jogador ativo</p>}
      </div>

      {/* HP, Stamina, Addiction */}
      <div className="space-y-2">
        <div className="p-3 rounded-xl bg-[#111] border border-[#1e1e1e]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-red-400 font-semibold">❤️ HP</span>
            <span className="text-[10px] text-[#666]">{player.hp}/{player.max_hp}</span>
          </div>
          <MiniBar value={player.hp} max={player.max_hp} color="#ef4444" />
        </div>
        <div className="p-3 rounded-xl bg-[#111] border border-[#1e1e1e]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-yellow-400 font-semibold">⚡ Stamina</span>
            <span className="text-[10px] text-[#666]">{player.stamina}/{player.max_stamina}</span>
          </div>
          <MiniBar value={player.stamina} max={player.max_stamina} color="#eab308" />
        </div>
        <div className="p-3 rounded-xl border" style={{
          background: addiction === 0 ? "#0f0f0f" : addiction < 40 ? "#78350f18" : addiction < 70 ? "#7c2d1218" : "#7f1d1d18",
          borderColor: addiction === 0 ? "#1e1e1e" : addiction < 40 ? "#92400e50" : addiction < 70 ? "#9a341250" : "#991b1b50",
        }}>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-semibold" style={{ color: addiction === 0 ? "#555" : addiction < 40 ? "#fb923c" : "#ef4444" }}>💉 Vício</span>
            <span className="text-[10px] font-bold" style={{ color: addiction === 0 ? "#444" : addiction < 40 ? "#fb923c" : "#ef4444" }}>{addiction}%</span>
          </div>
          <MiniBar value={addiction} max={100} color={addiction === 0 ? "#2a2a2a" : addiction < 40 ? "#f59e0b" : addiction < 70 ? "#f97316" : "#ef4444"} />
        </div>
      </div>

      {/* Combat stats */}
      <div>
        <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#333] mb-2">Atributos de Combate</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Poder",    value: player.power,        icon: "⚔️", color: "#ef4444" },
            { label: "Intel.",   value: player.intelligence, icon: "🧠", color: "#3b82f6" },
            { label: "Carisma", value: player.charisma,     icon: "✨", color: "#eab308" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl bg-[#111] border border-[#1e1e1e] text-center">
              <div className="text-base mb-1">{s.icon}</div>
              <p className="text-sm font-black" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
              <p className="text-[9px] text-[#444] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div>
        <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#333] mb-2">Recursos</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Dinheiro Sujo",  value: `$${player.dirty_cash.toLocaleString()}`, icon: "💵", color: "#22c55e" },
            { label: "Dinheiro Limpo", value: `$${player.cash.toLocaleString()}`,        icon: "💰", color: "#10b981" },
            { label: "Crypto",         value: `₿${(player.crypto ?? 0).toLocaleString()}`, icon: "💎", color: "#a855f7" },
            { label: "VCash",          value: `V${player.vcash.toLocaleString()}`,       icon: "🪙", color: "#ec4899" },
            { label: "Respeito",       value: player.respect.toLocaleString(),           icon: "👑", color: "#f97316" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center gap-2">
              <span className="text-base">{s.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-[#444]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity stats */}
      {extLoading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-[#333] animate-spin" />
        </div>
      ) : ext && (
        <>
          <div>
            <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#333] mb-2">Actividade</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Crimes Tentados",  value: ext.total_crimes_attempted,  icon: "🔫", color: "#ef4444" },
                { label: "Crimes Sucedidos", value: ext.total_crimes_succeeded,  icon: "✅", color: "#22c55e" },
                { label: "Espancamentos",    value: ext.pvp_wins,                icon: "👊", color: "#f97316" },
                { label: "Derrotas PvP",     value: ext.pvp_losses,              icon: "💀", color: "#6b7280" },
                { label: "Contratos",        value: ext.contracts_completed,     icon: "🎯", color: "#3b82f6" },
                { label: "Vezes Preso",      value: ext.times_jailed,            icon: "🚔", color: "#9ca3af" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center gap-2">
                  <span className="text-base">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
                    <p className="text-[9px] text-[#444]">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#333] mb-2">Império</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Itens Equipados",  value: ext.equipped_items,   icon: "⚡", color: "#ff6a00" },
                { label: "Negócios",         value: ext.businesses_owned, icon: "🏢", color: "#2563eb" },
                { label: "Workers Totais",   value: ext.total_workers,    icon: "👷", color: "#d97706" },
                { label: "Ações no Mercado", value: ext.shares.length,    icon: "📈", color: "#10b981" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center gap-2">
                  <span className="text-base">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
                    <p className="text-[9px] text-[#444]">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shares breakdown */}
          {ext.shares.length > 0 && (
            <div>
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#333] mb-2">Carteira de Ações</p>
              <div className="space-y-1.5">
                {ext.shares.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-[#ff6a00] w-12 truncate">{s.display_symbol}</span>
                      <span className="text-[10px] text-[#555] truncate max-w-[100px]">{s.display_name}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-bold text-white">{s.quantity.toLocaleString()} un.</p>
                      <p className="text-[9px] text-[#444]">${s.dirty_cash_invested.toLocaleString()} inv.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


/* ─────────────────── INVENTORY PANEL ─────────────────── */
function InventoryPanel() {
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/crime-empire/inventory")
      .then((r) => r.json())
      .then((d) => { setInventory(d.inventory ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const doAction = async (entry: InventoryEntry, action: string) => {
    setActionLoading(entry.id);
    try {
      const res = await fetch("/api/crime-empire/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, inventoryId: entry.id }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ msg: data.message, ok: true });
        refresh();
      } else {
        setFeedback({ msg: data.error || "Erro", ok: false });
      }
    } catch {
      setFeedback({ msg: "Erro de rede", ok: false });
    }
    setActionLoading(null);
    setTimeout(() => setFeedback(null), 3000);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#ff6a00] animate-spin" />
      </div>
    );

  const equipped = inventory.filter((e) => e.equipped);
  const unequipped = inventory.filter((e) => !e.equipped);

  const statLabel: Record<string, { label: string; color: string }> = {
    power_bonus:           { label: "Poder",         color: "#ef4444" },
    intelligence_bonus:    { label: "Inteligência",  color: "#3b82f6" },
    charisma_bonus:        { label: "Carisma",       color: "#eab308" },
    hp_bonus:              { label: "HP",            color: "#22c55e" },
    stamina_restore:       { label: "Stamina",       color: "#f59e0b" },
    success_rate_bonus:    { label: "Sucesso %",     color: "#a855f7" },
  };

  function ItemCard({ entry, isEquipped }: { entry: InventoryEntry; isEquipped: boolean }) {
    const item = entry.items;
    if (!item) return null;
    const bonuses = Object.entries(statLabel)
      .filter(([k]) => (item as unknown as Record<string, number>)[k] > 0)
      .map(([k, v]) => ({ ...v, value: (item as unknown as Record<string, number>)[k] }));
    const busy = actionLoading === entry.id;
    const isConsumable = item.category === "consumable";
    const canEquip = item.category !== "consumable" && item.category !== "material";

    return (
      <div
        className="p-3 rounded-xl border transition-all"
        style={{
          background: isEquipped ? "rgba(255,106,0,0.08)" : "#0f0f0f",
          borderColor: isEquipped ? "#ff6a0040" : "#1e1e1e",
        }}
      >
        <div className="flex items-start gap-3">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-10 h-10 rounded-lg object-contain bg-[#0a0a0a] flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-lg flex-shrink-0">
              {item.category === "weapon" ? "🔫" : item.category === "armor" ? "🛡️" : item.category === "consumable" ? "💊" : "📦"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-white truncate">{item.name}</p>
              {entry.quantity > 1 && (
                <span className="text-[10px] text-[#555] flex-shrink-0">×{entry.quantity}</span>
              )}
            </div>
            {bonuses.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {bonuses.map((b) => (
                  <span
                    key={b.label}
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: `${b.color}20`, color: b.color }}
                  >
                    +{b.value} {b.label}
                  </span>
                ))}
              </div>
            )}
            {/* Action buttons */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {isConsumable && (
                <button
                  disabled={busy}
                  onClick={() => doAction(entry, "use")}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-green-900/40 text-green-400 hover:bg-green-900/60 disabled:opacity-50 transition-colors font-bold"
                >
                  {busy ? "…" : "💊 Usar"}
                </button>
              )}
              {canEquip && !isEquipped && (
                <button
                  disabled={busy}
                  onClick={() => doAction(entry, "equip")}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-[#ff6a00]/20 text-[#ff6a00] hover:bg-[#ff6a00]/30 disabled:opacity-50 transition-colors font-bold"
                >
                  {busy ? "…" : "⚡ Equipar"}
                </button>
              )}
              {canEquip && isEquipped && (
                <button
                  disabled={busy}
                  onClick={() => doAction(entry, "unequip")}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-[#1a1a1a] text-[#888] hover:bg-[#222] disabled:opacity-50 transition-colors font-bold"
                >
                  {busy ? "…" : "Desequipar"}
                </button>
              )}
              {!isEquipped && (
                <button
                  disabled={busy}
                  onClick={() => doAction(entry, "drop")}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-50 transition-colors font-bold"
                >
                  {busy ? "…" : "🗑 Descartar"}
                </button>
              )}
            </div>
          </div>
          {isEquipped && (
            <span className="flex-shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-[#ff6a00]/20 text-[#ff6a00] font-bold border border-[#ff6a00]/30">
              EQUIPADO
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-xs px-3 py-2 rounded-lg font-medium ${feedback.ok ? "bg-green-900/40 text-green-300 border border-green-800/40" : "bg-red-900/40 text-red-300 border border-red-800/40"}`}
          >
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {equipped.length > 0 && (
        <div>
          <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#ff6a00] mb-3">
            ⚡ Itens Equipados ({equipped.length})
          </p>
          <div className="space-y-2">
            {equipped.map((e) => (
              <ItemCard key={e.id} entry={e} isEquipped />
            ))}
          </div>
        </div>
      )}

      {unequipped.length > 0 && (
        <div>
          <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#333] mb-3">
            Mochila ({unequipped.length} {unequipped.length === 1 ? "item" : "itens"})
          </p>
          <div className="space-y-2">
            {unequipped.map((e) => (
              <ItemCard key={e.id} entry={e} isEquipped={false} />
            ))}
          </div>
        </div>
      )}

      {inventory.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎒</p>
          <p className="text-[#555] text-sm">Inventário vazio</p>
          <p className="text-[#333] text-xs mt-1">Visita a Loja ou o Black Market</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── LEADERBOARD PANEL ─────────────────── */
function LeaderboardPanel() {
  const [players, setPlayers] = useState<LeaderPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crime-empire/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setPlayers(d.players ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#ff6a00] animate-spin" />
      </div>
    );

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="px-5 py-5">
      <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#333] mb-4">
        Top Jogadores por Nível
      </p>
      <div className="space-y-2">
        {players.map((p, i) => {
          const glow = CLASS_GLOW[p.class] ?? "#ff6a00";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 p-3 rounded-xl border"
              style={{
                background: i < 3 ? `${glow}10` : "#0f0f0f",
                borderColor: i < 3 ? `${glow}30` : "#1e1e1e",
              }}
            >
              <span className="w-6 text-center text-sm flex-shrink-0">
                {i < 3 ? medals[i] : <span className="text-[#444] text-xs font-bold">#{i + 1}</span>}
              </span>
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt={p.display_name}
                  className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                  style={{ border: `1.5px solid ${glow}` }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden"
                  style={{ border: `1.5px solid ${glow}` }}
                >
                  <Image
                    src={`/images/crime_empire/characters/${p.class}.png`}
                    alt={p.class}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain bg-[#0a0a0a]"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {p.display_name || p.username}
                  {p.prestige_level > 0 && (
                    <span className="ml-1 text-yellow-400 text-[10px]">⭐{p.prestige_level}</span>
                  )}
                </p>
                <p className="text-[10px] text-[#555]">
                  {CLASS_NAMES[p.class] ?? p.class} · {p.respect.toLocaleString()} respeito
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-black" style={{ color: glow }}>
                  {p.level}
                </p>
                <p className="text-[9px] text-[#444] uppercase tracking-wide">nível</p>
              </div>
            </motion.div>
          );
        })}
      </div>
      {players.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-[#555] text-sm">Sem jogadores ainda</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── MAIN COMPONENT ─────────────────── */
export function CEFloatingMenu() {
  const { player, refreshPlayer } = usePlayer();
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>(null);


  // Refresh player when stats panel opens (for latest stats)
  useEffect(() => {
    if (activePanel === "stats") refreshPlayer();
  }, [activePanel, refreshPlayer]);

  if (!player) return null;

  const glow = CLASS_GLOW[player.class] ?? "#ff6a00";

  const dialOptions = [
    { id: "inventory"   as Panel, icon: "🎒", label: "Inventário", dx: -88, dy: -14 },
    { id: "stats"       as Panel, icon: "📊", label: "Stats",      dx: -70, dy: -74 },
    { id: "leaderboard" as Panel, icon: "🏆", label: "Rankings",   dx: -14, dy: -90 },
  ];

  const panelTitle: Record<NonNullable<Panel>, string> = {
    stats: "Estatísticas",
    inventory: "Inventário",
    leaderboard: "Leaderboard",
  };

  const openPanel = (id: Panel) => {
    setOpen(false);
    setActivePanel(id);
  };

  return (
    <>
      {/* Floating trigger */}
      <div className="fixed bottom-6 right-6 z-50" style={{ pointerEvents: "auto" }}>
        {/* Dial options */}
        <AnimatePresence>
          {open &&
            dialOptions.map((opt, i) => (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                animate={{ opacity: 1, x: opt.dx, y: opt.dy, scale: 1 }}
                exit={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 340, damping: 26, delay: i * 0.06 }}
                onClick={() => openPanel(opt.id)}
                className="absolute bottom-0 right-0 flex flex-col items-center gap-1 group"
                style={{ width: 56 }}
              >
                <motion.div
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #1a1a1a 0%, #111 100%)",
                    border: `1.5px solid ${glow}60`,
                    boxShadow: `0 4px 16px rgba(0,0,0,0.7), 0 0 12px ${glow}30`,
                  }}
                >
                  {opt.icon}
                </motion.div>
                <span
                  className="text-[9px] font-bold tracking-wide uppercase whitespace-nowrap px-2 py-0.5 rounded-full"
                  style={{ background: "#0a0a0aee", color: glow, border: `1px solid ${glow}40` }}
                >
                  {opt.label}
                </span>
              </motion.button>
            ))}
        </AnimatePresence>

        {/* Main avatar button */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen((v) => !v)}
          className="relative w-14 h-14 rounded-full overflow-hidden"
          style={{
            border: `2.5px solid ${open ? glow : glow + "80"}`,
            boxShadow: open
              ? `0 0 0 4px ${glow}25, 0 0 28px ${glow}55, 0 8px 24px rgba(0,0,0,0.8)`
              : `0 0 0 2px ${glow}18, 0 8px 24px rgba(0,0,0,0.6)`,
            transition: "box-shadow 0.25s, border-color 0.25s",
          }}
        >
          <Image
            src={`/images/crime_empire/characters/${player.class}.png`}
            alt={player.class}
            width={56}
            height={56}
            className="w-full h-full object-contain bg-[#0a0a0a]"
          />
          {/* Close indicator */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-lg"
              >
                ✕
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Backdrop click to close dial */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel popout */}
      <AnimatePresence>
        {activePanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setActivePanel(null)}
            />

            {/* Popout card — expands from the bottom-right (floating button origin) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.75, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.75, y: 24 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              style={{
                transformOrigin: "bottom right",
                width: "min(420px, calc(100vw - 3rem))",
                maxHeight: "min(640px, calc(100vh - 8rem))",
                background: "linear-gradient(180deg, #0d0d0d 0%, #080808 100%)",
                borderLeft: `1px solid ${glow}30`,
                borderTop: `1px solid ${glow}30`,
                borderRight: `1px solid ${glow}20`,
                borderBottom: `1px solid ${glow}20`,
                boxShadow: `-4px -4px 40px rgba(0,0,0,0.7), 0 0 0 1px #0a0a0a`,
              }}
              className="fixed bottom-24 right-6 z-50 rounded-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: `1px solid #1a1a1a` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full overflow-hidden border"
                    style={{ borderColor: glow }}
                  >
                    <Image
                      src={`/images/crime_empire/characters/${player.class}.png`}
                      alt={player.class}
                      width={32}
                      height={32}
                      className="w-full h-full object-contain bg-[#0a0a0a]"
                    />
                  </div>
                  <div>
                    <p className="text-white font-black text-sm">{panelTitle[activePanel]}</p>
                    <p className="text-[10px] text-[#444]">
                      {player.display_name || player.username} · {CLASS_NAMES[player.class] ?? player.class}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setActivePanel(null)}
                  className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#666] hover:text-white transition-colors text-sm"
                >
                  ✕
                </motion.button>
              </div>

              {/* Panel accent line */}
              <div
                className="h-[2px] flex-shrink-0"
                style={{ background: `linear-gradient(90deg, ${glow}, transparent)` }}
              />

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto">
                {activePanel === "stats" && <StatsPanel player={player} />}
                {activePanel === "inventory" && <InventoryPanel />}
                {activePanel === "leaderboard" && <LeaderboardPanel />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
