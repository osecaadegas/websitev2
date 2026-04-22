"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ── Types ── */
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
  tradeable: boolean;
  image_url?: string | null;
}

interface InventoryEntry {
  id: string;
  item_id: string;
  quantity: number;
  equipped: boolean;
  items: ItemData;
}

interface PlayerStats {
  id: string;
  hp: number;
  max_hp: number;
  stamina: number;
  max_stamina: number;
}

/* ── Category config ── */
const CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
  all:        { label: "Tudo",        icon: "🎒",  color: "#ff6a00" },
  weapon:     { label: "Armas",       icon: "🔫",  color: "#ef4444" },
  armor:      { label: "Armaduras",   icon: "🛡️",  color: "#3b82f6" },
  consumable: { label: "Consumíveis", icon: "💊",  color: "#22c55e" },
  special:    { label: "Especiais",   icon: "⭐",  color: "#a855f7" },
  material:   { label: "Materiais",   icon: "🧱",  color: "#f59e0b" },
};

function categoryIcon(cat: string) {
  return CATEGORIES[cat]?.icon ?? "📦";
}
function categoryColor(cat: string) {
  return CATEGORIES[cat]?.color ?? "#888";
}

export default function InventoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchInventory = useCallback(async () => {
    const res = await fetch("/api/crime-empire/inventory");
    const data = await res.json();
    if (data.inventory) setInventory(data.inventory);
    if (data.player) setPlayer(data.player);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchInventory();
  }, [user, fetchInventory, router]);

  const doAction = async (entry: InventoryEntry, action: string) => {
    setProcessing(entry.id + action);
    try {
      const res = await fetch("/api/crime-empire/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, inventoryId: entry.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
        // Update hp/stamina locally if use action
        if (action === "use" && player) {
          setPlayer((p) => p ? { ...p, hp: data.newHp ?? p.hp, stamina: data.newStamina ?? p.stamina } : p);
        }
        // Refresh inventory
        await fetchInventory();
      } else {
        showToast(data.error || "Erro", false);
      }
    } finally {
      setProcessing(null);
    }
  };

  const filtered = activeCategory === "all"
    ? inventory
    : inventory.filter((e) => e.items?.category === activeCategory);

  // Count by category
  const countByCategory = (cat: string) =>
    cat === "all" ? inventory.length : inventory.filter((e) => e.items?.category === cat).length;

  const statBadges = (item: ItemData) => {
    const b: { label: string; color: string }[] = [];
    if (item.power_bonus)        b.push({ label: `+${item.power_bonus} Força`,           color: "#ef4444" });
    if (item.intelligence_bonus) b.push({ label: `+${item.intelligence_bonus} Intel.`,   color: "#3b82f6" });
    if (item.charisma_bonus)     b.push({ label: `+${item.charisma_bonus} Carisma`,      color: "#a855f7" });
    if (item.hp_bonus)           b.push({ label: `+${item.hp_bonus} HP`,                 color: "#22c55e" });
    if (item.stamina_restore)    b.push({ label: `+${item.stamina_restore} Stamina`,     color: "#f59e0b" });
    if (item.success_rate_bonus) b.push({ label: `+${item.success_rate_bonus}% Sucesso`, color: "#06b6d4" });
    return b;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🎒</div>
          <p className="text-[#888]">A carregar inventário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
              🎒 Inventário
            </h1>
            <p className="text-[#888] mt-1">Os teus items, armas, armaduras e consumíveis.</p>
          </div>

          {/* HP + Stamina bars */}
          {player && (
            <div className="flex gap-3 flex-wrap">
              <div className="bg-[#121212] border border-[#222] rounded-xl px-5 py-3 min-w-[160px]">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#888]">HP</span>
                  <span className="text-green-400 font-bold">{player.hp}/{player.max_hp}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#222]">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${Math.round((player.hp / player.max_hp) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="bg-[#121212] border border-[#222] rounded-xl px-5 py-3 min-w-[160px]">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#888]">Stamina</span>
                  <span className="text-yellow-400 font-bold">{player.stamina}/{player.max_stamina}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#222]">
                  <div
                    className="h-2 rounded-full bg-yellow-500 transition-all"
                    style={{ width: `${Math.round((player.stamina / player.max_stamina) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {Object.entries(CATEGORIES).map(([key, meta]) => {
            const count = countByCategory(key);
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeCategory === key
                    ? "text-white shadow-lg"
                    : "bg-[#121212] border border-[#222] text-[#666] hover:text-white hover:border-[#333]"
                }`}
                style={activeCategory === key ? { backgroundColor: meta.color } : {}}
              >
                {meta.icon} {meta.label}
                {count > 0 && (
                  <span className="ml-2 text-xs opacity-80">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-[#555]">
            <p className="text-5xl mb-4">🎒</p>
            {inventory.length === 0 ? (
              <>
                <p className="text-lg font-semibold text-[#444] mb-2">Inventário vazio</p>
                <p className="text-sm mb-6">Compra items na <span className="text-[#ff6a00]">Loja do Chinês</span> ou obtém-nos em crimes e negócios.</p>
                <Link
                  href="/jogos/crime-empire/shop"
                  className="inline-block px-6 py-3 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold transition-all"
                >
                  Ir à Loja
                </Link>
              </>
            ) : (
              <p className="text-sm">Nenhum item nesta categoria.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((entry) => {
              const item = entry.items;
              if (!item) return null;
              const badges = statBadges(item);
              const isConsumable = item.category === "consumable";
              const canEquip = item.category === "weapon" || item.category === "armor" || item.category === "special";
              const isBusy = processing?.startsWith(entry.id);

              return (
                <div
                  key={entry.id}
                  className={`bg-[#121212] border rounded-xl p-4 flex flex-col transition-all hover:border-[#2a2a2a] ${
                    entry.equipped ? "border-[#ff6a00]/50 shadow-[0_0_12px_rgba(255,106,0,0.1)]" : "border-[#1e1e1e]"
                  }`}
                >
                  {/* Top badges row */}
                  <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${categoryColor(item.category)}22`, color: categoryColor(item.category) }}
                    >
                      {categoryIcon(item.category)} {CATEGORIES[item.category]?.label ?? item.category}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {entry.equipped && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ff6a00]/20 text-[#ff6a00]">
                          ✓ Equipado
                        </span>
                      )}
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#888]">
                        x{entry.quantity}
                      </span>
                    </div>
                  </div>

                  {/* Name + description + image */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-base mb-1 leading-tight">{item.name}</h3>
                      <p className="text-[#666] text-xs">{item.description}</p>
                    </div>
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 object-contain flex-shrink-0 drop-shadow-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </div>

                  {/* Stat badges */}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {badges.map((b, i) => (
                        <span
                          key={i}
                          className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${b.color}22`, color: b.color }}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto space-y-2">
                    {isConsumable && (
                      <button
                        disabled={!!isBusy}
                        onClick={() => doAction(entry, "use")}
                        className="w-full py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50 disabled:cursor-wait"
                      >
                        {isBusy ? "A usar..." : "✓ Usar"}
                      </button>
                    )}

                    {canEquip && (
                      <button
                        disabled={!!isBusy}
                        onClick={() => doAction(entry, entry.equipped ? "unequip" : "equip")}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-wait ${
                          entry.equipped
                            ? "bg-[#1a1a1a] border border-[#ff6a00]/40 text-[#ff6a00] hover:bg-[#ff6a00]/10"
                            : "bg-[#ff6a00] hover:bg-[#ff8533] text-white shadow-md shadow-[#ff6a00]/20"
                        }`}
                      >
                        {isBusy
                          ? "..."
                          : entry.equipped
                          ? "⊘ Desequipar"
                          : "⚔ Equipar"}
                      </button>
                    )}

                    <div className="flex gap-2">
                      {item.tradeable && (
                        <Link
                          href="/jogos/crime-empire/black-market"
                          className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#1a1a1a] border border-[#222] text-[#888] hover:text-white hover:border-[#333] transition-all text-center"
                        >
                          💹 Vender
                        </Link>
                      )}
                      <button
                        disabled={!!isBusy || entry.equipped}
                        onClick={() => {
                          if (!confirm(`Descartar ${item.name}?`)) return;
                          doAction(entry, "drop");
                        }}
                        className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#1a1a1a] border border-[#222] text-[#666] hover:text-red-400 hover:border-red-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title={entry.equipped ? "Desequipa primeiro" : "Descartar"}
                      >
                        🗑 Descartar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer links */}
        {inventory.length > 0 && (
          <div className="mt-10 flex gap-4 flex-wrap">
            <Link
              href="/jogos/crime-empire/shop"
              className="px-5 py-2.5 rounded-lg bg-[#121212] border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-all"
            >
              🏪 Ir à Loja
            </Link>
            <Link
              href="/jogos/crime-empire/black-market"
              className="px-5 py-2.5 rounded-lg bg-[#121212] border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-all"
            >
              💹 Mercado Negro
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

