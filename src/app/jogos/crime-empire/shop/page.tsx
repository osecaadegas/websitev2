"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: "weapon" | "armor" | "consumable" | "special";
  rarity?: "common" | "rare" | "epic" | "legendary";
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  stamina_restore: number;
  base_price: number;
  image_url: string | null;
  addiction_effect: number;
  required_level: number;
}

interface OwnedEntry {
  quantity: number;
  equipped: boolean;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  all:        { label: "Tudo",        icon: "🛍️" },
  weapon:     { label: "Armas",       icon: "🔫" },
  armor:      { label: "Armaduras",   icon: "🛡️" },
  consumable: { label: "Consumíveis", icon: "💊" },
  special:    { label: "Especiais",   icon: "⭐" },
};

const RARITY_META: Record<string, { label: string; color: string; glow: string; border: string }> = {
  common:    { label: "Comum",    color: "#9ca3af", glow: "transparent",          border: "#1f2937" },
  rare:      { label: "Raro",     color: "#60a5fa", glow: "rgba(96,165,250,0.15)", border: "#1d4ed8" },
  epic:      { label: "Épico",    color: "#c084fc", glow: "rgba(192,132,252,0.18)", border: "#7c3aed" },
  legendary: { label: "Lendário", color: "#fbbf24", glow: "rgba(251,191,36,0.22)", border: "#b45309" },
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
  const [boughtId, setBoughtId] = useState<string | null>(null);

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
        setBoughtId(item.id);
        setTimeout(() => setBoughtId(null), 800);
        notifyPlayerUpdate();
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
    const badges: { label: string; color: string }[] = [];
    if (item.power_bonus)        badges.push({ label: `+${item.power_bonus} Força`,               color: "#ef4444" });
    if (item.intelligence_bonus) badges.push({ label: `+${item.intelligence_bonus} Intel.`,        color: "#3b82f6" });
    if (item.charisma_bonus)     badges.push({ label: `+${item.charisma_bonus} Carisma`,           color: "#a855f7" });
    if (item.hp_bonus)           badges.push({ label: `+${item.hp_bonus} HP`,                     color: "#22c55e" });
    if (item.stamina_restore)    badges.push({ label: `+${item.stamina_restore} Stamina`,          color: "#f59e0b" });
    return badges;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-bounce">🏮</div>
          <p className="text-[#aa6622] font-bold tracking-widest uppercase text-sm animate-pulse">
            A abrir a loja...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0704" }}>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* ── HERO BANNER ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a0e04 0%, #0f0702 60%, #0a0500 100%)" }}
      >
        {/* Decorative lantern-string top stripe */}
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background:
              "repeating-linear-gradient(90deg, #cc4400 0px, #cc4400 12px, #ff6a00 12px, #ff6a00 16px, #cc4400 16px, #cc4400 28px, #0a0500 28px, #0a0500 40px)",
          }}
        />

        <div className="max-w-6xl mx-auto px-4 pt-6 pb-0 flex items-end gap-6">
          {/* Merchant portrait */}
          <div className="hidden sm:block relative flex-shrink-0 self-end" style={{ width: 160, height: 200 }}>
            <Image
              src="/images/Loja_chines/Chinese_merchant.jpg"
              alt="Loja do Chinês"
              fill
              className="object-cover object-top rounded-t-2xl"
              style={{ filter: "drop-shadow(0 0 20px rgba(255,106,0,0.35))" }}
            />
            {/* bottom fade */}
            <div
              className="absolute inset-x-0 bottom-0 h-16 rounded-b-2xl"
              style={{
                background:
                  "linear-gradient(to top, #0a0704 0%, transparent 100%)",
              }}
            />
          </div>

          {/* Title block */}
          <div className="flex-1 pb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏮</span>
              <span
                className="text-[10px] font-black uppercase tracking-[0.3em] px-2 py-0.5 rounded"
                style={{ background: "#cc440022", color: "#ff6a00", border: "1px solid #cc440040" }}
              >
                Loja do Bairro
              </span>
            </div>
            <h1
              className="text-4xl sm:text-5xl font-black leading-none mb-2"
              style={{
                color: "#fff",
                textShadow: "0 0 30px rgba(255,106,0,0.4), 0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              Loja do Chinês
            </h1>
            <p className="text-sm text-[#aa6622] max-w-md leading-relaxed">
              "Boas mercancias, bons preços, sem perguntas." — equipamento pago a dinheiro limpo.
            </p>

            {/* Wallet row */}
            <div className="flex flex-wrap gap-3 mt-4">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                style={{ background: "#0f0a04", borderColor: "#3a2008" }}
              >
                <span className="text-lg">💵</span>
                <div>
                  <p className="text-[9px] text-[#664422] uppercase tracking-widest font-bold">
                    Dinheiro Limpo
                  </p>
                  <p className="text-base font-black text-green-400">
                    {player?.cash?.toLocaleString() ?? "—"}
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                style={{ background: "#0f0a04", borderColor: "#3a2008" }}
              >
                <span className="text-lg">💰</span>
                <div>
                  <p className="text-[9px] text-[#664422] uppercase tracking-widest font-bold">
                    Dinheiro Sujo
                  </p>
                  <p className="text-base font-black text-yellow-400">
                    {player?.dirty_cash?.toLocaleString() ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade to page bg */}
        <div
          className="absolute inset-x-0 bottom-0 h-8 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, #0a0704)" }}
        />
      </div>

      {/* ── CATEGORY TABS ───────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex gap-2 flex-wrap mb-6">
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const active = activeCategory === key;
            const count = key === "all" ? items.length : items.filter((i) => i.category === key).length;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={
                  active
                    ? {
                        background: "#cc4400",
                        color: "#fff",
                        boxShadow: "0 0 14px rgba(204,68,0,0.4)",
                      }
                    : {
                        background: "#130c05",
                        color: "#664422",
                        border: "1px solid #2a1508",
                      }
                }
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span
                  className="text-[10px] font-black px-1.5 py-px rounded-full ml-1"
                  style={
                    active
                      ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                      : { background: "#1a0c04", color: "#4a2a10" }
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── ITEM GRID ──────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-[#3a2010]">
            <p className="text-5xl mb-3">📦</p>
            <p className="text-sm font-semibold">Nenhum item nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            {filtered.map((item) => {
              const owned = ownedMap[item.id];
              const isOwned = !!owned && owned.quantity > 0;
              const rarity = item.rarity ?? "common";
              const rarMeta = RARITY_META[rarity];
              const badges = statBadges(item);
              const canAfford = (player?.cash ?? 0) >= item.base_price;
              const meetsLevel = !player || player.level >= (item.required_level ?? 1);
              const isLocked = !meetsLevel;
              const isBuying = processing === item.id;
              const justBought = boughtId === item.id;
              const levelsNeeded = (item.required_level ?? 1) - (player?.level ?? 1);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl flex flex-col overflow-hidden transition-all duration-200"
                  style={{
                    background: isLocked
                      ? "#0d0903"
                      : `linear-gradient(160deg, #161008 0%, #0d0903 100%)`,
                    border: `1px solid ${isLocked ? "#1a1005" : rarMeta.border}`,
                    boxShadow: justBought
                      ? "0 0 24px rgba(255,106,0,0.6)"
                      : isLocked
                      ? "none"
                      : rarity !== "common"
                      ? `0 0 18px ${rarMeta.glow}`
                      : "none",
                    opacity: isLocked ? 0.6 : 1,
                    transform: justBought ? "scale(1.02)" : "scale(1)",
                    transition: "all 0.25s ease",
                  }}
                >
                  {/* Rarity top bar */}
                  {rarity !== "common" && (
                    <div
                      className="h-0.5 w-full"
                      style={{ background: rarMeta.color, opacity: 0.8 }}
                    />
                  )}

                  {/* Image zone */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      height: 120,
                      background: "rgba(0,0,0,0.3)",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain p-3"
                        style={{
                          filter: isLocked
                            ? "grayscale(1) brightness(0.4)"
                            : `drop-shadow(0 4px 12px ${rarMeta.glow})`,
                        }}
                      />
                    ) : (
                      <span className="text-5xl" style={{ filter: isLocked ? "grayscale(1) opacity(0.3)" : "none" }}>
                        {CATEGORY_META[item.category]?.icon ?? "📦"}
                      </span>
                    )}

                    {/* Lock overlay */}
                    {isLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
                        <span className="text-2xl">🔒</span>
                        <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
                          Nível {item.required_level}
                        </span>
                        <span className="text-[9px] text-[#666]">falta {levelsNeeded} nv.</span>
                      </div>
                    )}

                    {/* Rarity badge */}
                    {rarity !== "common" && (
                      <div
                        className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{
                          background: `${rarMeta.color}22`,
                          color: rarMeta.color,
                          border: `1px solid ${rarMeta.color}44`,
                        }}
                      >
                        {rarMeta.label}
                      </div>
                    )}

                    {/* Owned badge */}
                    {isOwned && !isLocked && (
                      <div
                        className="absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: "#cc440030", color: "#ff8533", border: "1px solid #cc440060" }}
                      >
                        ×{owned.quantity}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-3 pt-3 pb-2 flex-1 flex flex-col gap-2">
                    <div>
                      <h3 className="font-black text-sm text-white leading-tight">{item.name}</h3>
                      <p className="text-[11px] text-[#5a3a1a] mt-0.5 leading-relaxed">{item.description}</p>
                    </div>

                    {/* Stat badges */}
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {badges.map((b, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: `${b.color}18`,
                              color: b.color,
                              border: `1px solid ${b.color}30`,
                            }}
                          >
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Addiction warning */}
                    {item.addiction_effect > 0 && (
                      <div
                        className="text-[10px] font-bold px-2 py-1 rounded-lg"
                        style={{ background: "#3a080820", color: "#f87171", border: "1px solid #7f1d1d40" }}
                      >
                        ⚠️ +{item.addiction_effect} vício por uso
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-3 pb-3 pt-2 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-base">💵</span>
                        <span
                          className="font-black text-base"
                          style={{ color: canAfford && !isLocked ? "#4ade80" : "#4a2a10" }}
                        >
                          {item.base_price.toLocaleString()}
                        </span>
                      </div>
                      {isOwned && owned.equipped && (
                        <span
                          className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
                          style={{ background: "#cc440025", color: "#ff6a00" }}
                        >
                          Equipado
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => !isLocked && handleBuy(item)}
                      disabled={isBuying || isLocked || !canAfford}
                      className="w-full py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      style={
                        isLocked
                          ? { background: "#1a1008", color: "#3a2010", cursor: "not-allowed" }
                          : isBuying
                          ? { background: "#331a00", color: "#cc6600" }
                          : justBought
                          ? { background: "#22c55e", color: "#fff", boxShadow: "0 0 12px rgba(34,197,94,0.5)" }
                          : canAfford
                          ? {
                              background: "linear-gradient(135deg, #cc4400 0%, #ff6a00 100%)",
                              color: "#fff",
                              boxShadow: "0 0 12px rgba(255,106,0,0.35)",
                            }
                          : { background: "#130c05", color: "#3a1a08", cursor: "not-allowed" }
                      }
                    >
                      {isLocked
                        ? `🔒 Nível ${item.required_level}`
                        : isBuying
                        ? "A comprar..."
                        : justBought
                        ? "✓ Comprado!"
                        : canAfford
                        ? "Comprar"
                        : "Sem fundos"}
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
