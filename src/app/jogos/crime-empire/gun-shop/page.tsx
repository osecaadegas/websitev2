"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import { CEToast } from "@/components/CEToast";

interface GunShopItem {
  id: string;
  name: string;
  description: string;
  category: "weapon" | "armor";
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  success_rate_bonus: number;
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

function DurabilityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const color =
    pct > 60 ? "#22c55e" : pct > 30 ? "#eab308" : pct > 0 ? "#ef4444" : "#4b5563";
  const label = pct === 0 ? "QUEBRADO" : `${current}/${max}`;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-[#666] font-semibold tracking-wide uppercase">Durabilidade</span>
        <span style={{ color }} className="font-bold">{label}</span>
      </div>
      <div className="h-2 rounded-full bg-[#1a1f0a] overflow-hidden border border-[#2a3010]/50">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
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
    return b;
  };

  const filtered = items.filter((i) => i.category === activeTab);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ background: "#060804" }}>
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🎖️</div>
          <p className="text-[#5a6a2a] font-bold tracking-widest uppercase text-sm">A carregar arsenal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#060804" }}>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* ── Header ── */}
      <div className="relative border-b border-[#3a4a1f]/60" style={{ background: "linear-gradient(180deg, #0f1609 0%, #060804 100%)" }}>
        {/* Tactical stripe */}
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: "repeating-linear-gradient(90deg, #4a5c1f 0px, #4a5c1f 8px, #1a2005 8px, #1a2005 16px)" }}
        />
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-4xl">🎖️</span>
                <div>
                  <h1
                    className="text-3xl font-black tracking-[0.15em] uppercase"
                    style={{ color: "#8aac3a", textShadow: "0 0 20px #4a6a1f60" }}
                  >
                    SGT.MARCHADO
                  </h1>
                  <p className="text-xs text-[#5a6a3a] tracking-widest uppercase font-semibold">
                    Arsenal de Combate · Pagamento em 💎 Crypto
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-[#4a5a2a] mt-1">
                Armas e equipamento de qualidade militar. Cada peça desgasta com o uso — mantém-nas reparadas.
              </p>
            </div>
            {/* Wallet */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ background: "#0f1a05", borderColor: "#3a5a1f" }}
            >
              <span className="text-xl">💎</span>
              <div>
                <p className="text-[9px] text-[#5a6a3a] uppercase tracking-widest font-bold">Crypto</p>
                <p className="text-lg font-black text-[#8aac3a]">
                  {player?.crypto.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Info strip */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
            {[
              { icon: "⚔️", label: "Itens degradam -5 dur. por crime" },
              { icon: "🏹", label: "Itens degradam -10 dur. em PvP" },
              { icon: "🔧", label: "Reparo custa 30% do preço" },
            ].map((tip) => (
              <div
                key={tip.label}
                className="rounded-lg px-2 py-1.5 border"
                style={{ background: "#0a0f04", borderColor: "#2a3a10" }}
              >
                <span className="mr-1">{tip.icon}</span>
                <span className="text-[#5a6a3a]">{tip.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: "#0a0f04", border: "1px solid #2a3a10" }}
        >
          {(["weapon", "armor"] as const).map((tab) => {
            const active = activeTab === tab;
            const label = tab === "weapon" ? "🔫 Armas" : "🛡️ Equipamento";
            const count = items.filter((i) => i.category === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all"
                style={
                  active
                    ? { background: "#3a5a1f", color: "#acd45a", boxShadow: "0 0 12px #3a5a1f80" }
                    : { color: "#4a5a3a" }
                }
              >
                {label}
                <span
                  className="ml-1.5 text-[10px] font-black px-1.5 py-px rounded-full"
                  style={active ? { background: "#2a4a0f", color: "#8aac3a" } : { background: "#1a2008", color: "#4a5a2a" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Item Grid ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#3a4a1a]">
            <p className="text-5xl mb-3">📦</p>
            <p className="text-sm font-semibold">Sem itens nesta categoria de momento.</p>
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
              const repairCost = Math.max(10, Math.floor(item.crypto_price * 0.30));
              const needsRepair = isOwned && item.has_durability && dur < maxDur;
              const canAffordRepair = !!player && player.crypto >= repairCost;
              const badges = statBadges(item);
              const processingBuy = processing === item.id + "buy";
              const processingEquip = processing === item.id + "equip";
              const processingUnequip = processing === item.id + "unequip";
              const processingRepair = processing === item.id + "repair";

              return (
                <div
                  key={item.id}
                  className="rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:translate-y-[-1px]"
                  style={{
                    background: isEquipped
                      ? "linear-gradient(135deg, #0f1f08 0%, #0a0f04 100%)"
                      : isBroken
                      ? "linear-gradient(135deg, #1a0808 0%, #0d0505 100%)"
                      : "linear-gradient(135deg, #0c1208 0%, #080b04 100%)",
                    border: isEquipped
                      ? "1px solid #4a7a2a"
                      : isBroken
                      ? "1px solid #7a2a2a"
                      : "1px solid #2a3a10",
                    boxShadow: isEquipped ? "0 0 16px #3a6a1a30" : "none",
                  }}
                >
                  {/* Top badges */}
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                    <span
                      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                      style={
                        item.category === "weapon"
                          ? { background: "#7c1a1a20", color: "#ef4444", border: "1px solid #ef444430" }
                          : { background: "#1a3a7c20", color: "#3b82f6", border: "1px solid #3b82f630" }
                      }
                    >
                      {item.category === "weapon" ? "🔫 Arma" : "🛡️ Equipamento"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.required_level > 1 && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={
                            meetsLevel
                              ? { background: "#1a3a1a", color: "#4a8a4a" }
                              : { background: "#3a1a1a", color: "#8a4a4a" }
                          }
                        >
                          Nv.{item.required_level}
                        </span>
                      )}
                      {isEquipped && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: "#2a5a0f", color: "#7adf3a" }}>
                          ✓ EQUIPADO
                        </span>
                      )}
                      {isBroken && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: "#4a0f0f", color: "#df3a3a" }}>
                          💀 QUEBRADO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name + description */}
                  <div className="px-3 pb-2">
                    <h3 className="font-black text-sm text-white mb-0.5">{item.name}</h3>
                    <p className="text-[11px] text-[#5a6a3a] leading-relaxed">{item.description}</p>
                  </div>

                  {/* Stat badges */}
                  {badges.length > 0 && (
                    <div className="px-3 pb-2 flex flex-wrap gap-1">
                      {badges.map((b) => (
                        <StatBadge key={b.label} label={b.label} color={b.color} />
                      ))}
                    </div>
                  )}

                  {/* Durability bar (only if owned + has_durability) */}
                  {isOwned && item.has_durability && (
                    <div className="px-3 pb-2">
                      <DurabilityBar current={dur} max={maxDur} />
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Footer: price + actions */}
                  <div
                    className="px-3 py-2.5 mt-2 border-t space-y-2"
                    style={{ borderColor: "#1e2a0a", background: "rgba(0,0,0,0.3)" }}
                  >
                    {/* Price */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">💎</span>
                        <span
                          className="font-black text-base"
                          style={{ color: canAfford || isOwned ? "#8aac3a" : "#6a4a2a" }}
                        >
                          {item.crypto_price.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#4a5a2a]">crypto</span>
                      </div>
                      {needsRepair && (
                        <span className="text-[10px] text-[#5a4a2a]">
                          Reparo: 💎 {repairCost.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    {!isOwned ? (
                      <button
                        onClick={() => doAction("buy", item)}
                        disabled={processingBuy || !canAfford || !meetsLevel}
                        className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                        style={
                          !canAfford || !meetsLevel
                            ? { background: "#1a2008", color: "#3a4a1a", cursor: "not-allowed" }
                            : processingBuy
                            ? { background: "#2a4010", color: "#6a8a3a" }
                            : { background: "#3a5a1f", color: "#acd45a", boxShadow: "0 0 10px #3a5a1f60" }
                        }
                      >
                        {processingBuy
                          ? "A processar..."
                          : !meetsLevel
                          ? `🔒 Nível ${item.required_level} requerido`
                          : !canAfford
                          ? "💎 Crypto insuficiente"
                          : "🛒 Comprar"}
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Equip / Unequip */}
                        {isEquipped ? (
                          <button
                            onClick={() => doAction("unequip", item)}
                            disabled={processingUnequip}
                            className="py-1.5 rounded-lg text-[11px] font-bold transition-all"
                            style={{ background: "#1a2f0a", color: "#5a8a3a", border: "1px solid #2a4a14" }}
                          >
                            {processingUnequip ? "..." : "❌ Guardar"}
                          </button>
                        ) : (
                          <button
                            onClick={() => doAction("equip", item)}
                            disabled={processingEquip || isBroken}
                            className="py-1.5 rounded-lg text-[11px] font-bold transition-all"
                            style={
                              isBroken
                                ? { background: "#1a0808", color: "#5a2a2a", cursor: "not-allowed" }
                                : { background: "#2a4a10", color: "#8adc4a" }
                            }
                          >
                            {processingEquip ? "..." : "⚔️ Equipar"}
                          </button>
                        )}
                        {/* Repair */}
                        <button
                          onClick={() => doAction("repair", item)}
                          disabled={processingRepair || !needsRepair || !canAffordRepair}
                          className="py-1.5 rounded-lg text-[11px] font-bold transition-all"
                          style={
                            !needsRepair
                              ? { background: "#0f1a08", color: "#2a3a1a", cursor: "not-allowed" }
                              : !canAffordRepair
                              ? { background: "#1a1208", color: "#3a2a1a", cursor: "not-allowed" }
                              : processingRepair
                              ? { background: "#1a2a08", color: "#5a6a3a" }
                              : { background: "#2a1f08", color: "#c8a830", border: "1px solid #5a4010" }
                          }
                        >
                          {processingRepair ? "..." : `🔧 Reparar`}
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
