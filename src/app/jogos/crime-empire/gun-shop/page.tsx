"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import { CEToast } from "@/components/CEToast";
import Image from "next/image";

interface GunShopItem {
  id: string;
  name: string;
  description: string;
  category: "weapon" | "armor";
  rarity?: "common" | "rare" | "epic" | "legendary";
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  success_rate_bonus: number;
  stamina_reduction?: number;
  has_durability: boolean;
  max_durability: number | null;
  crypto_price: number;
  required_level: number;
  image_url: string | null;
}

interface OwnedEntry {
  quantity: number;
  equipped: boolean;
  durability: number | null;
  inventoryId: string;
}

/* ── Constants ──────────────────────────────────────────────── */
const RARITY_META: Record<string, { label: string; color: string; glow: string; bar: string }> = {
  common:    { label: "Comum",    color: "#9ca3af", glow: "transparent",           bar: "#374151" },
  rare:      { label: "Raro",     color: "#60a5fa", glow: "rgba(96,165,250,0.18)", bar: "#1d4ed8" },
  epic:      { label: "Épico",    color: "#c084fc", glow: "rgba(192,132,252,0.2)", bar: "#7c3aed" },
  legendary: { label: "Lendário", color: "#fbbf24", glow: "rgba(251,191,36,0.25)", bar: "#b45309" },
};

function DurabilityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const color = pct === 0 ? "#4b5563" : pct > 60 ? "#22c55e" : pct > 30 ? "#eab308" : "#ef4444";
  const label = pct === 0 ? "QUEBRADO" : `${current}/${max}`;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="font-semibold uppercase tracking-wide" style={{ color: "#4a5a3a" }}>Durabilidade</span>
        <span className="font-black" style={{ color }}>{label}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2008" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function GunShopPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<GunShopItem[]>([]);
  const [ownedMap, setOwnedMap] = useState<Record<string, OwnedEntry>>({});
  const [player, setPlayer] = useState<{ crypto: number; level: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"weapon" | "armor">("weapon");
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [boughtId, setBoughtId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/gun-shop");
    const data = await res.json();
    if (!data.error) {
      setItems(data.items || []);
      setOwnedMap(data.ownedMap || {});
      setPlayer(data.player || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const doAction = async (action: string, item: GunShopItem) => {
    const key = item.id + action;
    setProcessing(key);
    try {
      const res = await fetch("/api/crime-empire/gun-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId: item.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
        if (data.newCrypto !== undefined) setPlayer((p) => p ? { ...p, crypto: data.newCrypto } : p);
        if (action === "buy") {
          setBoughtId(item.id);
          setTimeout(() => setBoughtId(null), 800);
        }
        fetchData();
        notifyPlayerUpdate();
      } else {
        showToast(data.error || "Erro desconhecido.", false);
      }
    } finally {
      setProcessing(null);
    }
  };

  const statBadges = (item: GunShopItem) => {
    const b: { label: string; color: string }[] = [];
    if (item.power_bonus)         b.push({ label: `+${item.power_bonus} Força`,      color: "#ef4444" });
    if (item.intelligence_bonus)  b.push({ label: `+${item.intelligence_bonus} Intel`, color: "#3b82f6" });
    if (item.charisma_bonus)      b.push({ label: `+${item.charisma_bonus} Carisma`,  color: "#a855f7" });
    if (item.hp_bonus)            b.push({ label: `+${item.hp_bonus} HP`,             color: "#22c55e" });
    if (item.success_rate_bonus)  b.push({ label: `+${Math.round(item.success_rate_bonus * 100)}% Sucesso`, color: "#f59e0b" });
    if (item.stamina_reduction)   b.push({ label: `-${item.stamina_reduction} Stamina`, color: "#34d399" });
    return b;
  };

  const filtered = items.filter((i) => i.category === activeTab);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ background: "#060804" }}>
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🎖️</div>
          <p className="text-sm font-black uppercase tracking-[0.3em] animate-pulse" style={{ color: "#5a7a2a" }}>A carregar arsenal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#060804" }}>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* ── HERO BANNER ───────────────────────────────────────── */}
      <div className="relative" style={{ minHeight: 260 }}>
        {/* Background image — own overflow-hidden so it doesn't clip the portrait */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/images/sgt_marchado/background.jpeg"
            alt="arsenal background"
            fill
            className="object-cover object-center"
            style={{ filter: "brightness(0.3) saturate(0.7)" }}
            priority
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(6,8,4,0.97) 0%, rgba(6,8,4,0.75) 50%, rgba(6,8,4,0.2) 100%)" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-24"
            style={{ background: "linear-gradient(to bottom, transparent, #060804)" }}
          />
        </div>

        {/* Tactical top stripe */}
        <div
          className="absolute inset-x-0 top-0 h-1.5 z-10"
          style={{ background: "repeating-linear-gradient(90deg, #4a5c1f 0px, #4a5c1f 10px, #1a2005 10px, #1a2005 18px)" }}
        />

        {/* Merchant portrait — absolute, bleeds below the hero into the items section */}
        <div
          className="hidden md:block absolute bottom-0 right-12 z-20 pointer-events-none"
          style={{ width: 320, height: 500, transform: "translateY(38%)" }}
        >
          <Image
            src="/images/sgt_marchado/Sgt_marchado_shopkeeper.png"
            alt="Sgt. Marchado"
            fill
            className="object-contain object-bottom"
            style={{ filter: "drop-shadow(0 0 48px rgba(74,122,42,0.55))" }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8 pb-10 flex items-end gap-8">
          {/* Title + info */}
          <div className="flex-1 pb-2 md:pr-[360px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🎖️</span>
              <span
                className="text-[9px] font-black uppercase tracking-[0.35em] px-2 py-0.5 rounded"
                style={{ background: "#4a5c1f22", color: "#8aac3a", border: "1px solid #4a5c1f50" }}
              >
                Arsenal de Combate
              </span>
            </div>

            <h1
              className="text-4xl sm:text-5xl font-black tracking-[0.1em] uppercase leading-none mb-1"
              style={{ color: "#acd45a", textShadow: "0 0 30px rgba(74,122,42,0.5), 0 2px 8px rgba(0,0,0,0.9)" }}
            >
              SGT. MARCHADO
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#5a7a2a" }}>
              Equipamento Militar · Pagamento em 💎 Crypto
            </p>
            <p className="text-[12px] text-[#4a5a30] max-w-md leading-relaxed">
              "Só vendo ao que sabe usar. Cada arma tem um fim — mantém-nas operacionais."
            </p>

            {/* Info tips */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { icon: "⚔️", text: "−5 dur. por crime" },
                { icon: "🥊", text: "−10 dur. em PvP" },
                { icon: "🔧", text: "Reparo = 30% do preço" },
              ].map((t) => (
                <div
                  key={t.text}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]"
                  style={{ background: "#0a0f04", border: "1px solid #2a3a10", color: "#5a6a3a" }}
                >
                  <span>{t.icon}</span>
                  <span className="font-semibold">{t.text}</span>
                </div>
              ))}
            </div>

            {/* Wallet */}
            <div className="mt-4">
              <div
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border"
                style={{ background: "#0a1005", borderColor: "#3a5a1f" }}
              >
                <span className="text-xl">💎</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#5a7a2a" }}>Crypto Disponível</p>
                  <p className="text-xl font-black" style={{ color: "#acd45a" }}>{player?.crypto?.toLocaleString() ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-4 md:pr-[360px] lg:pr-[380px]">
        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: "#0a0f04", border: "1px solid #1e2a0a" }}
        >
          {(["weapon", "armor"] as const).map((tab) => {
            const active = activeTab === tab;
            const label = tab === "weapon" ? "🔫 Armas" : "🛡️ Equipamento";
            const count = items.filter((i) => i.category === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-black transition-all uppercase tracking-wider"
                style={
                  active
                    ? { background: "linear-gradient(135deg, #3a5a1f 0%, #4a7a2a 100%)", color: "#acd45a", boxShadow: "0 0 14px rgba(58,90,31,0.6)" }
                    : { color: "#3a4a2a" }
                }
              >
                <span>{label}</span>
                <span
                  className="text-[10px] font-black px-1.5 py-px rounded-full"
                  style={active ? { background: "#2a4a0f", color: "#8aac3a" } : { background: "#141a08", color: "#3a4a1a" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── ITEM GRID ────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-[#2a3a1a]">
            <p className="text-5xl mb-3">📦</p>
            <p className="text-sm font-semibold">Sem itens nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
            {filtered.map((item) => {
              const owned = ownedMap[item.id];
              const isOwned = !!owned && owned.quantity > 0;
              const isEquipped = isOwned && owned.equipped;
              const dur = owned?.durability ?? item.max_durability ?? 100;
              const maxDur = item.max_durability ?? 100;
              const isBroken = isOwned && item.has_durability && dur <= 0;
              const canAfford = !!player && player.crypto >= item.crypto_price;
              const meetsLevel = !!player && player.level >= (item.required_level ?? 1);
              const isLocked = !meetsLevel;
              const repairCost = Math.max(10, Math.floor(item.crypto_price * 0.30));
              const needsRepair = isOwned && item.has_durability && dur < maxDur;
              const canAffordRepair = !!player && player.crypto >= repairCost;
              const rarity = item.rarity ?? "common";
              const rarMeta = RARITY_META[rarity];
              const badges = statBadges(item);
              const levelsNeeded = (item.required_level ?? 1) - (player?.level ?? 1);
              const justBought = boughtId === item.id;

              const processingBuy    = processing === item.id + "buy";
              const processingEquip  = processing === item.id + "equip";
              const processingUneq   = processing === item.id + "unequip";
              const processingRepair = processing === item.id + "repair";

              const cardBorder = isEquipped ? "#4a7a2a" : isBroken ? "#7a2a2a" : isLocked ? "#141a08" : rarity !== "common" ? rarMeta.bar : "#2a3a10";

              return (
                <div
                  key={item.id}
                  className="rounded-2xl flex flex-col overflow-hidden transition-all duration-200"
                  style={{
                    background: isEquipped
                      ? "linear-gradient(160deg, #0f1f08 0%, #080f04 100%)"
                      : isBroken
                      ? "linear-gradient(160deg, #1a0808 0%, #0d0404 100%)"
                      : isLocked
                      ? "#060804"
                      : "linear-gradient(160deg, #0d1408 0%, #080b04 100%)",
                    border: `1px solid ${cardBorder}`,
                    boxShadow: justBought
                      ? "0 0 28px rgba(74,122,42,0.7)"
                      : isEquipped
                      ? "0 0 18px rgba(74,122,42,0.3)"
                      : rarity !== "common" && !isLocked
                      ? `0 0 16px ${rarMeta.glow}`
                      : "none",
                    opacity: isLocked ? 0.55 : 1,
                    transform: justBought ? "scale(1.02)" : "scale(1)",
                    transition: "all 0.25s ease",
                  }}
                >
                  {/* Rarity top line */}
                  {rarity !== "common" && !isLocked && (
                    <div className="h-0.5 w-full" style={{ background: rarMeta.color, opacity: 0.9 }} />
                  )}

                  {/* Image zone */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{ height: 140, background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain p-4"
                        style={{
                          filter: isLocked
                            ? "grayscale(1) brightness(0.3)"
                            : isBroken
                            ? "grayscale(0.8) brightness(0.6) sepia(0.4)"
                            : `drop-shadow(0 4px 16px ${rarMeta.glow})`,
                        }}
                      />
                    ) : (
                      <span className="text-6xl" style={{ filter: isLocked ? "grayscale(1) opacity(0.2)" : "none" }}>
                        {item.category === "weapon" ? "🔫" : "🛡️"}
                      </span>
                    )}

                    {/* Lock overlay */}
                    {isLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
                        <span className="text-3xl">🔒</span>
                        <span className="text-[11px] font-black text-yellow-400 uppercase tracking-widest">Nível {item.required_level}</span>
                        <span className="text-[9px]" style={{ color: "#4a5a30" }}>falta {levelsNeeded} nv.</span>
                      </div>
                    )}

                    {/* Broken badge */}
                    {isBroken && !isLocked && (
                      <div className="absolute top-2 left-2">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: "#4a0f0f", color: "#ef4444", border: "1px solid #7a1a1a" }}>💀 QUEBRADO</span>
                      </div>
                    )}

                    {/* Equipped badge */}
                    {isEquipped && (
                      <div className="absolute top-2 left-2">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: "#1a3a0a", color: "#7adf3a", border: "1px solid #2a5a14" }}>✓ EQUIPADO</span>
                      </div>
                    )}

                    {/* Rarity badge */}
                    {rarity !== "common" && !isLocked && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: `${rarMeta.color}20`, color: rarMeta.color, border: `1px solid ${rarMeta.color}40` }}
                        >{rarMeta.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Info block */}
                  <div className="px-4 pt-3 pb-2 flex-1 flex flex-col gap-2">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h3 className="font-black text-sm text-white leading-tight">{item.name}</h3>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={
                            item.category === "weapon"
                              ? { background: "#3a0808", color: "#ef4444", border: "1px solid #7a1a1a30" }
                              : { background: "#082038", color: "#60a5fa", border: "1px solid #1d4ed830" }
                          }
                        >
                          {item.category === "weapon" ? "🔫 Arma" : "🛡️ Equip."}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#4a5a30" }}>{item.description}</p>
                    </div>

                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {badges.map((b) => (
                          <span key={b.label} className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: `${b.color}18`, color: b.color, border: `1px solid ${b.color}35` }}
                          >{b.label}</span>
                        ))}
                      </div>
                    )}

                    {isOwned && item.has_durability && (
                      <DurabilityBar current={dur} max={maxDur} />
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-4 py-3 mt-auto border-t"
                    style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.3)" }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">💎</span>
                        <span className="font-black text-base" style={{ color: canAfford || isOwned ? "#8aac3a" : "#4a3a1a" }}>
                          {item.crypto_price.toLocaleString()}
                        </span>
                        <span className="text-[10px]" style={{ color: "#3a4a1a" }}>crypto</span>
                      </div>
                      {needsRepair && !isLocked && (
                        <span className="text-[10px]" style={{ color: "#5a4a20" }}>Reparo: 💎 {repairCost.toLocaleString()}</span>
                      )}
                    </div>

                    {!isOwned ? (
                      <button
                        onClick={() => doAction("buy", item)}
                        disabled={processingBuy || isLocked || !canAfford}
                        className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                        style={
                          isLocked
                            ? { background: "#0f1508", color: "#2a3a10", cursor: "not-allowed" }
                            : !canAfford
                            ? { background: "#0f1508", color: "#2a3a10", cursor: "not-allowed" }
                            : processingBuy
                            ? { background: "#2a4010", color: "#6a8a3a" }
                            : justBought
                            ? { background: "#22c55e", color: "#fff", boxShadow: "0 0 12px rgba(34,197,94,0.5)" }
                            : { background: "linear-gradient(135deg, #3a5a1f 0%, #4a7a2a 100%)", color: "#acd45a", boxShadow: "0 0 12px rgba(58,90,31,0.5)" }
                        }
                      >
                        {isLocked ? `🔒 Nível ${item.required_level}` : !canAfford ? "💎 Sem crypto" : processingBuy ? "A processar..." : justBought ? "✓ Adquirido!" : "🛒 Comprar"}
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {isEquipped ? (
                          <button
                            onClick={() => doAction("unequip", item)}
                            disabled={processingUneq}
                            className="py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all"
                            style={{ background: "#1a2f0a", color: "#5a8a3a", border: "1px solid #2a4a14" }}
                          >
                            {processingUneq ? "..." : "❌ Guardar"}
                          </button>
                        ) : (
                          <button
                            onClick={() => doAction("equip", item)}
                            disabled={processingEquip || isBroken}
                            className="py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all"
                            style={
                              isBroken
                                ? { background: "#1a0808", color: "#5a2a2a", cursor: "not-allowed" }
                                : { background: "linear-gradient(135deg, #2a4a10 0%, #3a6a1a 100%)", color: "#8adc4a", boxShadow: "0 0 8px rgba(42,74,16,0.5)" }
                            }
                          >
                            {processingEquip ? "..." : "⚔️ Equipar"}
                          </button>
                        )}
                        <button
                          onClick={() => doAction("repair", item)}
                          disabled={processingRepair || !needsRepair || !canAffordRepair}
                          className="py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all"
                          style={
                            !needsRepair
                              ? { background: "#0f1508", color: "#1e2a10", cursor: "not-allowed" }
                              : !canAffordRepair
                              ? { background: "#1a1008", color: "#3a2a10", cursor: "not-allowed" }
                              : processingRepair
                              ? { background: "#1a2a08", color: "#5a6a3a" }
                              : { background: "#2a1f08", color: "#c8a830", border: "1px solid #5a4010", boxShadow: "0 0 6px rgba(200,168,48,0.25)" }
                          }
                        >
                          {processingRepair ? "..." : "🔧 Reparar"}
                        </button>
                      </div>
                    )}
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
