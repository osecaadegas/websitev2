"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";

/* ── Types ─────────────────────────────────────────────────────── */
interface ItemInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  equipment_slot: string | null;
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  stamina_restore: number;
  success_rate_bonus: number;
  has_durability: boolean;
  max_durability: number | null;
  crypto_price: number;
  base_price: number;
  tradeable: boolean;
  image_url: string | null;
  rarity?: string | null;
  addiction_effect?: number;
}

interface InvEntry {
  id: string;
  item_id: string;
  quantity: number;
  equipped: boolean;
  durability: number | null;
  items: ItemInfo;
}

interface StashEntry {
  id: string;
  item_id: string;
  quantity: number;
  items: ItemInfo;
}

interface PlayerData {
  id: string;
  cash: number;
  dirty_cash: number;
  crypto: number;
  level: number;
  class: string;
}

interface HideoutData {
  inventory_slots: number;
  stash_slots: number;
}

/* ── Constants ─────────────────────────────────────────────────── */
const RARITY_META: Record<string, { label: string; color: string }> = {
  common:    { label: "Comum",    color: "#888888" },
  rare:      { label: "Raro",     color: "#3b82f6" },
  epic:      { label: "Épico",    color: "#a855f7" },
  legendary: { label: "Lendário", color: "#f59e0b" },
};

// Inventory upgrade costs per current slot count
// index 0 = going 4→5 (dirty only), 1-5 = 5→10 (cash or crypto)
const INV_UPGRADE_COSTS = [
  { from: 4,  to: 5,  dirty: 5_000,   label: "$5K sujo",   dirtyCurrencyOnly: true },
  { from: 5,  to: 6,  cash: 10_000,   crypto: 5_000,   label: "$10K / 💎5K" },
  { from: 6,  to: 7,  cash: 25_000,   crypto: 12_500,  label: "$25K / 💎12.5K" },
  { from: 7,  to: 8,  cash: 50_000,   crypto: 25_000,  label: "$50K / 💎25K" },
  { from: 8,  to: 9,  cash: 100_000,  crypto: 50_000,  label: "$100K / 💎50K" },
  { from: 9,  to: 10, cash: 200_000,  crypto: 100_000, label: "$200K / 💎100K" },
] as const;

// Stash upgrade costs per current slot count (10→20)
const STASH_UPGRADE_COSTS = [
  { from: 10, to: 11, cash: 20_000,  crypto: 10_000,  label: "$20K / 💎10K" },
  { from: 11, to: 12, cash: 35_000,  crypto: 17_500,  label: "$35K / 💎17.5K" },
  { from: 12, to: 13, cash: 55_000,  crypto: 27_500,  label: "$55K / 💎27.5K" },
  { from: 13, to: 14, cash: 80_000,  crypto: 40_000,  label: "$80K / 💎40K" },
  { from: 14, to: 15, cash: 110_000, crypto: 55_000,  label: "$110K / 💎55K" },
  { from: 15, to: 16, cash: 150_000, crypto: 75_000,  label: "$150K / 💎75K" },
  { from: 16, to: 17, cash: 200_000, crypto: 100_000, label: "$200K / 💎100K" },
  { from: 17, to: 18, cash: 260_000, crypto: 130_000, label: "$260K / 💎130K" },
  { from: 18, to: 19, cash: 330_000, crypto: 165_000, label: "$330K / 💎165K" },
  { from: 19, to: 20, cash: 400_000, crypto: 200_000, label: "$400K / 💎200K" },
] as const;

/* ── DurabilityBar ─────────────────────────────────────────────── */
function DurabilityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const col = pct > 60 ? "#22c55e" : pct > 30 ? "#eab308" : "#ef4444";
  return (
    <div>
      <div className="flex justify-between text-[9px] mb-0.5">
        <span style={{ color: "#555" }}>Durabilidade</span>
        <span className="font-bold tabular-nums" style={{ color: col }}>{current}/{max}</span>
      </div>
      <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
      </div>
    </div>
  );
}

/* ── Stat badges helper ────────────────────────────────────────── */
function StatBadges({ item }: { item: ItemInfo }) {
  const b: { label: string; color: string }[] = [];
  if (item.power_bonus)        b.push({ label: `⚔+${item.power_bonus}`,    color: "#ef4444" });
  if (item.intelligence_bonus) b.push({ label: `🧠+${item.intelligence_bonus}`, color: "#3b82f6" });
  if (item.charisma_bonus)     b.push({ label: `✨+${item.charisma_bonus}`, color: "#a855f7" });
  if (item.hp_bonus)           b.push({ label: `❤+${item.hp_bonus}`,       color: "#22c55e" });
  if (item.success_rate_bonus) b.push({ label: `%+${item.success_rate_bonus}`, color: "#06b6d4" });
  if (!b.length) return null;
  return (
    <div className="flex gap-1 flex-wrap mb-2">
      {b.map((s, i) => (
        <span key={i} className="text-[10px] font-bold px-1.5 py-px rounded" style={{ color: s.color, background: `${s.color}18` }}>{s.label}</span>
      ))}
    </div>
  );
}

/* ── Equipment Slot Card ───────────────────────────────────────── */
function EquipSlot({
  slot, label, icon, entry, onUnequip, busy,
}: {
  slot: string; label: string; icon: string;
  entry: InvEntry | null;
  onUnequip: (id: string) => void;
  busy: boolean;
}) {
  const item = entry?.items;
  const isBroken = item?.has_durability && entry && entry.durability !== null && (entry.durability ?? 1) <= 0;
  const rarity = RARITY_META[item?.rarity ?? "common"] ?? RARITY_META.common;

  return (
    <div
      className="flex-1 rounded-2xl overflow-hidden transition-all"
      style={{
        background: item ? `linear-gradient(160deg, ${rarity.color}10, #0c0c0e 60%)` : "#0a0a0c",
        border: `1px solid ${item ? (isBroken ? "#3b0f0f" : `${rarity.color}30`) : "#1a1a1e"}`,
        minHeight: 140,
      }}
    >
      {/* Rarity top bar */}
      {item && <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${rarity.color}cc, transparent)` }} />}

      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#333]">{label}</p>
          {isBroken && <span className="text-[9px] font-black px-1.5 py-px rounded-full bg-red-900/30 text-red-400 ml-auto">QUEBRADO</span>}
        </div>

        {item && entry ? (
          <>
            <div className="flex items-start gap-2.5 mb-2">
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url} alt={item.name}
                  className="w-10 h-10 object-contain flex-shrink-0"
                  style={{ filter: isBroken ? "grayscale(1) opacity(0.5)" : "none" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-white leading-tight truncate">{item.name}</p>
                <span className="text-[9px] font-bold px-1.5 py-px rounded" style={{ color: rarity.color, background: `${rarity.color}15` }}>
                  {rarity.label}
                </span>
              </div>
            </div>

            <StatBadges item={item} />

            {item.has_durability && entry.durability !== null && item.max_durability && (
              <div className="mb-2">
                <DurabilityBar current={entry.durability ?? 0} max={item.max_durability} />
              </div>
            )}

            <button
              onClick={() => onUnequip(entry.id)}
              disabled={busy}
              className="mt-auto w-full py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }}
            >
              {busy ? "..." : "⊘ Desequipar"}
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#222] text-xs font-bold text-center">Vazio<br /><span className="text-[10px] font-normal text-[#1a1a1a]">Equipa um item abaixo</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── InventoryItemCard ─────────────────────────────────────────── */
function InventoryItemCard({
  entry, onEquip, onUnequip, onStash, busy,
}: {
  entry: InvEntry;
  onEquip: () => void; onUnequip: () => void; onStash: () => void;
  busy: boolean;
}) {
  const item = entry.items;
  const isBroken = item?.has_durability && entry.durability !== null && (entry.durability ?? 1) <= 0;
  const rarity = RARITY_META[item?.rarity ?? "common"] ?? RARITY_META.common;
  const canEquip = item.category === "weapon" || item.category === "armor";

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: entry.equipped ? "#0d1117" : "#0f0f11",
        border: `1px solid ${entry.equipped ? "#ff6a0030" : isBroken ? "#2a0f0f" : "#1e1e20"}`,
        boxShadow: entry.equipped ? "0 0 10px rgba(255,106,0,0.06)" : "none",
      }}
    >
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${rarity.color}80, transparent)` }} />
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start gap-2.5 mb-2">
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url} alt={item.name}
              className="w-9 h-9 object-contain flex-shrink-0"
              style={{ filter: isBroken ? "grayscale(1) opacity(0.5)" : "none" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
              <p className="font-black text-sm text-white leading-tight truncate">{item.name}</p>
              {entry.equipped && <span className="text-[9px] font-black px-1.5 py-px rounded-full bg-[#ff6a00]/20 text-[#ff6a00]">EQ</span>}
              {isBroken && <span className="text-[9px] font-black px-1.5 py-px rounded-full bg-red-900/30 text-red-400">💀</span>}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold px-1.5 py-px rounded" style={{ color: rarity.color, background: `${rarity.color}15` }}>{rarity.label}</span>
              <span className="text-[9px] text-[#444] px-1.5 py-px rounded bg-[#111] font-bold">x{entry.quantity}</span>
            </div>
          </div>
        </div>

        <StatBadges item={item} />

        {item.has_durability && entry.durability !== null && item.max_durability && (
          <div className="mb-2">
            <DurabilityBar current={entry.durability ?? 0} max={item.max_durability} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1.5">
          {canEquip && (
            <button
              onClick={entry.equipped ? onUnequip : onEquip}
              disabled={busy}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={entry.equipped
                ? { background: "#1a0a00", border: "1px solid #ff6a0040", color: "#ff6a00" }
                : { background: "#ff6a0018", border: "1px solid #ff6a0030", color: "#ff6a00" }}
            >
              {busy ? "..." : entry.equipped ? "⊘ Deseq." : "⚔ Equipar"}
            </button>
          )}
          <button
            onClick={onStash}
            disabled={busy || entry.equipped}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
            style={{ background: "#111", border: "1px solid #222", color: "#666" }}
            title={entry.equipped ? "Desequipa primeiro" : "Guardar no esconderijo"}
          >
            {busy ? "..." : "→ Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── StashItemCard ─────────────────────────────────────────────── */
function StashItemCard({
  entry, onRetrieve, busy, invFull,
}: {
  entry: StashEntry;
  onRetrieve: () => void;
  busy: boolean;
  invFull: boolean;
}) {
  const item = entry.items;
  const rarity = RARITY_META[item?.rarity ?? "common"] ?? RARITY_META.common;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: "#0c0e0f", border: "1px solid #191b1e" }}
    >
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${rarity.color}50, transparent)` }} />
      <div className="p-3">
        <div className="flex items-start gap-2.5 mb-2">
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url} alt={item.name}
              className="w-9 h-9 object-contain flex-shrink-0 opacity-75"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-[#ccc] leading-tight truncate">{item.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] font-bold px-1.5 py-px rounded" style={{ color: rarity.color, background: `${rarity.color}15` }}>{rarity.label}</span>
              <span className="text-[9px] text-[#444] px-1.5 py-px rounded bg-[#111] font-bold">x{entry.quantity}</span>
            </div>
          </div>
        </div>

        <StatBadges item={item} />

        <button
          onClick={onRetrieve}
          disabled={busy || invFull}
          className="w-full py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
          style={{ background: "#0d1a12", border: "1px solid #1a3a22", color: invFull ? "#333" : "#22c55e" }}
          title={invFull ? "Inventário cheio — faz upgrade ou guarda itens" : "Mover para inventário"}
        >
          {busy ? "..." : invFull ? "Inv. cheio" : "← Retirar"}
        </button>
      </div>
    </div>
  );
}

/* ── Upgrade Modal ─────────────────────────────────────────────── */
function UpgradeModal({
  type, costs, player, onConfirm, onClose, loading,
}: {
  type: "inventory" | "stash";
  costs: { label: string; dirty?: number; cash?: number; crypto?: number; dirtyCurrencyOnly?: boolean } | null;
  player: PlayerData;
  onConfirm: (currency: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  if (!costs) return null;

  const isDirtyOnly = (costs as any).dirtyCurrencyOnly;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#0e0e10", border: "1px solid #2a2a2a" }}>
        <div className="h-0.5" style={{ background: "linear-gradient(90deg, #22c55e, transparent)" }} />
        <div className="p-6">
          <p className="text-white font-black text-lg mb-1">
            {type === "inventory" ? "🎒 Expandir Inventário" : "🏚️ Expandir Esconderijo"}
          </p>
          <p className="text-[#555] text-sm mb-5">
            {type === "inventory" ? "Mais 1 slot no teu inventário portátil." : "Mais 1 slot no teu esconderijo."}
          </p>

          <div className="space-y-2 mb-6">
            {isDirtyOnly && costs.dirty && (
              <button
                onClick={() => onConfirm("dirty")}
                disabled={loading || player.dirty_cash < costs.dirty!}
                className="w-full p-3 rounded-xl text-left transition-all disabled:opacity-40"
                style={{ background: player.dirty_cash >= costs.dirty ? "#1a1100" : "#0f0f0f", border: `1px solid ${player.dirty_cash >= costs.dirty ? "#eab30840" : "#1e1e1e"}` }}
              >
                <p className="font-black text-sm text-yellow-400">${costs.dirty.toLocaleString()} sujo</p>
                <p className="text-[10px] text-[#555] mt-0.5">Tens: ${player.dirty_cash.toLocaleString()}</p>
              </button>
            )}
            {!isDirtyOnly && costs.cash && (
              <button
                onClick={() => onConfirm("cash")}
                disabled={loading || player.cash < costs.cash!}
                className="w-full p-3 rounded-xl text-left transition-all disabled:opacity-40"
                style={{ background: player.cash >= costs.cash ? "#0d1a0d" : "#0f0f0f", border: `1px solid ${player.cash >= costs.cash ? "#22c55e40" : "#1e1e1e"}` }}
              >
                <p className="font-black text-sm text-green-400">${costs.cash.toLocaleString()} limpo</p>
                <p className="text-[10px] text-[#555] mt-0.5">Tens: ${player.cash.toLocaleString()}</p>
              </button>
            )}
            {!isDirtyOnly && costs.crypto && (
              <button
                onClick={() => onConfirm("crypto")}
                disabled={loading || player.crypto < costs.crypto!}
                className="w-full p-3 rounded-xl text-left transition-all disabled:opacity-40"
                style={{ background: player.crypto >= costs.crypto ? "#0d0d1a" : "#0f0f0f", border: `1px solid ${player.crypto >= costs.crypto ? "#6366f140" : "#1e1e1e"}` }}
              >
                <p className="font-black text-sm text-indigo-400">💎 {costs.crypto.toLocaleString()} crypto</p>
                <p className="text-[10px] text-[#555] mt-0.5">Tens: 💎 {player.crypto.toLocaleString()}</p>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-sm text-[#555] hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function EsconderijoPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InvEntry[]>([]);
  const [stash, setStash] = useState<StashEntry[]>([]);
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [hideout, setHideout] = useState<HideoutData>({ inventory_slots: 4, stash_slots: 10 });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<"inventory" | "stash" | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/esconderijo");
    const data = await res.json();
    if (!res.ok) { setLoading(false); return; }
    setInventory(data.inventory || []);
    setStash(data.stash || []);
    setPlayer(data.player);
    setHideout(data.hideout);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  const doAction = async (action: string, body: Record<string, unknown>) => {
    const id = action + JSON.stringify(body);
    setBusy(id);
    try {
      const res = await fetch("/api/crime-empire/esconderijo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
        notifyPlayerUpdate();
        await fetchData();
      } else {
        showToast(data.error || "Erro", false);
      }
    } finally {
      setBusy(null);
    }
  };

  const doUpgrade = async (currency: string) => {
    if (!upgradeModal) return;
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/crime-empire/esconderijo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: `upgrade_${upgradeModal}`, currency }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
        notifyPlayerUpdate();
        await fetchData();
        setUpgradeModal(null);
      } else {
        showToast(data.error || "Erro", false);
      }
    } finally {
      setUpgradeLoading(false);
    }
  };

  // Get equipped items per slot
  const equippedWeapon = inventory.find((e) => e.equipped && (e.items?.equipment_slot === "weapon" || (e.items?.equipment_slot == null && e.items?.category === "weapon"))) ?? null;
  const equippedVest   = inventory.find((e) => e.equipped && (e.items?.equipment_slot === "body"   || (e.items?.equipment_slot == null && e.items?.category === "armor")))  ?? null;
  const equippedHelmet = inventory.find((e) => e.equipped && e.items?.equipment_slot === "head") ?? null;

  // Current inv/stash usage (unique items = rows)
  const invUsed = inventory.length;
  const stashUsed = stash.length;
  const invFull = invUsed >= hideout.inventory_slots;

  // Upgrade costs lookup
  const invUpgradeCost = INV_UPGRADE_COSTS.find((c) => c.from === hideout.inventory_slots) ?? null;
  const stashUpgradeCost = STASH_UPGRADE_COSTS.find((c) => c.from === hideout.stash_slots) ?? null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🏚️</div>
          <p className="text-[#555]">A carregar esconderijo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* Upgrade modal */}
      {upgradeModal && player && (
        <UpgradeModal
          type={upgradeModal}
          costs={upgradeModal === "inventory"
            ? invUpgradeCost as any
            : stashUpgradeCost as any}
          player={player}
          onConfirm={doUpgrade}
          onClose={() => setUpgradeModal(null)}
          loading={upgradeLoading}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-end gap-3 mb-1">
            <h1 className="text-4xl font-black bg-gradient-to-r from-[#4ade80] to-[#166534] bg-clip-text text-transparent">
              🏚️ O Esconderijo
            </h1>
            {player && (
              <div className="mb-1 flex items-center gap-3 text-sm">
                <span className="text-[#555]">💵 ${player.cash.toLocaleString()}</span>
                <span className="text-[#555]">💰 ${player.dirty_cash.toLocaleString()} sujo</span>
                <span className="text-[#555]">💎 {player.crypto.toLocaleString()}</span>
              </div>
            )}
          </div>
          <p className="text-[#444] text-sm">Guarda o teu arsenal, equipa-te e mantém o teu stock em segurança.</p>
        </div>

        {/* ── Equipment Section ────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#333] mb-3">⚔️ Equipamento Activo</p>
          <div className="flex gap-3">
            <EquipSlot
              slot="weapon" label="Arma" icon="🔫"
              entry={equippedWeapon}
              onUnequip={(id) => doAction("unequip", { inventoryId: id })}
              busy={!!busy}
            />
            <EquipSlot
              slot="body" label="Colete" icon="🦺"
              entry={equippedVest}
              onUnequip={(id) => doAction("unequip", { inventoryId: id })}
              busy={!!busy}
            />
            <EquipSlot
              slot="head" label="Elmo" icon="⛑️"
              entry={equippedHelmet}
              onUnequip={(id) => doAction("unequip", { inventoryId: id })}
              busy={!!busy}
            />
          </div>
        </div>

        {/* ── Main two-column layout ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Inventory ─────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0c", border: "1px solid #1a1a1e" }}>
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-[#141416]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-base text-white flex items-center gap-2">
                    🎒 Inventário
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-full"
                      style={{ background: invFull ? "#3b0f0f" : "#0d1a12", color: invFull ? "#ef4444" : "#22c55e" }}
                    >
                      {invUsed}/{hideout.inventory_slots}
                    </span>
                  </p>
                  <p className="text-[11px] text-[#444] mt-0.5">Items que carregas contigo</p>
                </div>

                {/* Upgrade button */}
                {invUpgradeCost ? (
                  <button
                    onClick={() => setUpgradeModal("inventory")}
                    className="px-3 py-1.5 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95"
                    style={{ background: "#0d1a12", border: "1px solid #22c55e30", color: "#22c55e" }}
                  >
                    + Expandir<br />
                    <span className="text-[9px] font-normal text-[#555]">{invUpgradeCost.label}</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-[#333] font-bold px-2 py-1 rounded-lg bg-[#0f0f11]">MAX</span>
                )}
              </div>

              {/* Slot progress bar */}
              <div className="mt-3">
                <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (invUsed / hideout.inventory_slots) * 100))}%`,
                      background: invFull ? "#ef4444" : "linear-gradient(90deg, #22c55e, #16a34a)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Items grid */}
            <div className="p-4">
              {inventory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3 opacity-20">🎒</p>
                  <p className="text-[#333] text-sm">Inventário vazio</p>
                  <p className="text-[#222] text-xs mt-1">Os teus itens aparecem aqui</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {inventory.map((entry) => (
                    <InventoryItemCard
                      key={entry.id}
                      entry={entry}
                      busy={busy === "equip" + JSON.stringify({ inventoryId: entry.id }) ||
                            busy === "unequip" + JSON.stringify({ inventoryId: entry.id }) ||
                            busy === "stash_item" + JSON.stringify({ inventoryId: entry.id })}
                      onEquip={() => doAction("equip", { inventoryId: entry.id })}
                      onUnequip={() => doAction("unequip", { inventoryId: entry.id })}
                      onStash={() => doAction("stash_item", { inventoryId: entry.id, quantity: entry.quantity })}
                    />
                  ))}
                </div>
              )}

              {/* Empty slots indicator */}
              {invFull && (
                <div className="mt-3 px-3 py-2 rounded-xl text-xs text-red-400 font-bold text-center" style={{ background: "#1a0808", border: "1px solid #3b0f0f" }}>
                  Inventário cheio — guarda itens no esconderijo ou faz upgrade
                </div>
              )}

              {/* Quick shop links */}
              <div className="mt-4 flex gap-2">
                <Link href="/jogos/crime-empire/shop" className="flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all" style={{ background: "#111", border: "1px solid #1e1e1e", color: "#555" }}>
                  🏪 Loja
                </Link>
                <Link href="/jogos/crime-empire/gun-shop" className="flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all" style={{ background: "#111", border: "1px solid #1e1e1e", color: "#555" }}>
                  🔫 SGT. Machado
                </Link>
              </div>
            </div>
          </div>

          {/* ── Right: Stash ────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#09090b", border: "1px solid #181818" }}>
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-[#131315]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-base text-white flex items-center gap-2">
                    🏚️ Esconderijo
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-full"
                      style={{ background: stashUsed >= hideout.stash_slots ? "#3b0f0f" : "#0d1117", color: stashUsed >= hideout.stash_slots ? "#ef4444" : "#6366f1" }}
                    >
                      {stashUsed}/{hideout.stash_slots}
                    </span>
                  </p>
                  <p className="text-[11px] text-[#444] mt-0.5">Stock seguro — drogas, armas, items</p>
                </div>

                {stashUpgradeCost ? (
                  <button
                    onClick={() => setUpgradeModal("stash")}
                    className="px-3 py-1.5 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95"
                    style={{ background: "#0d0d1a", border: "1px solid #6366f130", color: "#6366f1" }}
                  >
                    + Expandir<br />
                    <span className="text-[9px] font-normal text-[#555]">{stashUpgradeCost.label}</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-[#333] font-bold px-2 py-1 rounded-lg bg-[#0f0f11]">MAX</span>
                )}
              </div>

              {/* Slot progress bar */}
              <div className="mt-3">
                <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (stashUsed / hideout.stash_slots) * 100))}%`,
                      background: stashUsed >= hideout.stash_slots ? "#ef4444" : "linear-gradient(90deg, #6366f1, #4338ca)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Items grid */}
            <div className="p-4">
              {stash.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3 opacity-20">🔒</p>
                  <p className="text-[#333] text-sm">Esconderijo vazio</p>
                  <p className="text-[#222] text-xs mt-1">Guarda drogas, armas e items aqui</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {stash.map((entry) => (
                    <StashItemCard
                      key={entry.id}
                      entry={entry}
                      invFull={invFull}
                      busy={busy === "retrieve_item" + JSON.stringify({ stashId: entry.id })}
                      onRetrieve={() => doAction("retrieve_item", { stashId: entry.id, quantity: entry.quantity })}
                    />
                  ))}
                </div>
              )}

              {/* Upgrade path info */}
              <div className="mt-4 px-3 py-3 rounded-xl text-xs" style={{ background: "#0c0c0e", border: "1px solid #141416" }}>
                <p className="font-bold text-[#444] mb-1">📈 Upgrades disponíveis</p>
                <p className="text-[#2a2a2a] leading-relaxed">
                  Esconderijo: {hideout.stash_slots}/20 slots · Inventário: {hideout.inventory_slots}/10 slots
                </p>
                <p className="text-[#222] text-[10px] mt-1">Paga com cash limpo ou crypto (2× mais barato em crypto)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
