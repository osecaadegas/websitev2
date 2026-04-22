"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: "weapon" | "armor" | "consumable" | "special";
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  stamina_restore: number;
  base_price: number;
  image_url: string | null;
}

interface OwnedEntry {
  quantity: number;
  equipped: boolean;
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  all:       { label: "Tudo",        icon: "🛍️",  color: "#ff6a00" },
  weapon:    { label: "Armas",       icon: "🔫",  color: "#ef4444" },
  armor:     { label: "Armaduras",   icon: "🛡️",  color: "#3b82f6" },
  consumable:{ label: "Consumíveis", icon: "💊",  color: "#22c55e" },
  special:   { label: "Especiais",   icon: "⭐",  color: "#a855f7" },
};

export default function ShopPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [ownedMap, setOwnedMap] = useState<Record<string, OwnedEntry>>({});
  const [player, setPlayer] = useState<{ cash: number; dirty_cash: number; level: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/crime-empire/shop");
      const data = await res.json();
      setItems(data.items || []);
      setOwnedMap(data.ownedMap || {});
      setPlayer(data.player || null);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleBuy = async (item: ShopItem) => {
    if (!player || player.cash < item.base_price) {
      showToast("Dinheiro limpo insuficiente!", false);
      return;
    }
    setProcessing(item.id);
    try {
      const res = await fetch("/api/crime-empire/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, quantity: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
        setPlayer((p) => p ? { ...p, cash: data.newCash } : p);
        setOwnedMap((m) => ({
          ...m,
          [item.id]: { quantity: (m[item.id]?.quantity || 0) + 1, equipped: m[item.id]?.equipped || false },
        }));
      } else {
        showToast(data.error || "Erro ao comprar item", false);
      }
    } finally {
      setProcessing(null);
    }
  };

  const filtered = activeCategory === "all"
    ? items
    : items.filter((i) => i.category === activeCategory);

  const statBadges = (item: ShopItem) => {
    const badges = [];
    if (item.power_bonus)        badges.push({ label: `+${item.power_bonus} Força`,        color: "#ef4444" });
    if (item.intelligence_bonus) badges.push({ label: `+${item.intelligence_bonus} Intel.`, color: "#3b82f6" });
    if (item.charisma_bonus)     badges.push({ label: `+${item.charisma_bonus} Carisma`,   color: "#a855f7" });
    if (item.hp_bonus)           badges.push({ label: `+${item.hp_bonus} HP`,              color: "#22c55e" });
    if (item.stamina_restore)    badges.push({ label: `+${item.stamina_restore} Stamina`,  color: "#f59e0b" });
    return badges;
  };

  const categoryIcon = (cat: string) => CATEGORY_META[cat]?.icon || "📦";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🏪</div>
          <p className="text-[#888]">A carregar a loja...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl transition-all ${
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
              🏪 Loja do Chinês
            </h1>
            <p className="text-[#888] mt-1">Compra armas, armaduras e equipamentos com dinheiro limpo.</p>
          </div>

          {/* Cash balance */}
          <div className="flex gap-3">
            <div className="bg-[#121212] border border-[#222] rounded-xl px-5 py-3 text-center min-w-[140px]">
              <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Dinheiro Limpo</p>
              <p className="text-xl font-black text-green-400">
                💵 {player?.cash?.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="bg-[#121212] border border-[#222] rounded-xl px-5 py-3 text-center min-w-[140px]">
              <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Dinheiro Sujo</p>
              <p className="text-xl font-black text-yellow-400">
                💰 {player?.dirty_cash?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
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
              {key !== "all" && (
                <span className="ml-2 text-xs opacity-70">
                  ({items.filter((i) => i.category === key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Item grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#555]">
            <p className="text-4xl mb-3">📦</p>
            <p>Nenhum item nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => {
              const owned = ownedMap[item.id];
              const catMeta = CATEGORY_META[item.category];
              const badges = statBadges(item);
              const canAfford = (player?.cash ?? 0) >= item.base_price;
              const isBuying = processing === item.id;

              return (
                <div
                  key={item.id}
                  className={`bg-[#121212] border rounded-xl p-4 flex flex-col transition-all hover:border-[#333] ${
                    owned ? "border-[#2a2a2a]" : "border-[#1e1e1e]"
                  }`}
                >
                  {/* Category badge + owned badge */}
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${catMeta?.color}22`, color: catMeta?.color }}
                    >
                      {categoryIcon(item.category)} {catMeta?.label}
                    </span>
                    {owned && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ff6a00]/20 text-[#ff6a00]">
                        x{owned.quantity} possuídos
                      </span>
                    )}
                  </div>

                  {/* Name + description + image */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="font-black text-base mb-1">{item.name}</h3>
                      <p className="text-[#666] text-xs flex-1">{item.description}</p>
                    </div>
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 object-contain rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex-shrink-0 p-1"
                      />
                    )}
                  </div>

                  {/* Stat badges */}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {badges.map((b, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${b.color}22`, color: b.color }}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Price + buy button */}
                  <div className="mt-auto">
                    <p className="text-green-400 font-black text-lg mb-2">
                      💵 {item.base_price.toLocaleString()}
                    </p>
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={isBuying || !canAfford}
                      className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
                        isBuying
                          ? "bg-[#333] text-[#666] cursor-wait"
                          : canAfford
                          ? "bg-[#ff6a00] hover:bg-[#ff8533] text-white shadow-md shadow-[#ff6a00]/20"
                          : "bg-[#1a1a1a] text-[#444] cursor-not-allowed border border-[#222]"
                      }`}
                    >
                      {isBuying ? "A comprar..." : canAfford ? "Comprar" : "Sem fundos"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
