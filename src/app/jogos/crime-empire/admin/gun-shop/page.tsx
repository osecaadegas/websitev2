"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CEToast } from "@/components/CEToast";

/* ── Types ──────────────────────────────────────────────────────── */
type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  base_price: number;
  image_url: string | null;
  crypto_price: number | null;
  required_level: number;
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  stamina_restore: number;
  success_rate_bonus: number;
  stamina_reduction: number;
  has_durability: boolean;
  max_durability: number | null;
};

/* ── Constants ──────────────────────────────────────────────────── */
const RARITY_META: Record<string, { color: string; label: string }> = {
  common:    { color: "#6b7280", label: "Comum"    },
  rare:      { color: "#3b82f6", label: "Raro"     },
  epic:      { color: "#a855f7", label: "Epico"    },
  legendary: { color: "#f59e0b", label: "Lendario" },
};

const BLANK_FORM = {
  crypto_price: "", required_level: "1",
  power_bonus: "0", intelligence_bonus: "0", charisma_bonus: "0",
  hp_bonus: "0", stamina_restore: "0", success_rate_bonus: "0", stamina_reduction: "0",
};

/* ── Sub-components ─────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#0e0e10", border: "1px solid #1a1a1e" }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#2a2a2a" }}>{label}</p>
      <p className="text-3xl font-black tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function RarityBar({ rarity }: { rarity: string }) {
  const c = RARITY_META[rarity]?.color ?? "#333";
  return <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${c}cc, transparent)` }} />;
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function GunShopAdminPage() {
  const [items, setItems]     = useState<Item[]>([]);
  const [q, setQ]             = useState("");
  const [catFilter, setCat]   = useState("");
  const [shopFilter, setShop] = useState<"all" | "in" | "out">("all");
  const [loading, setLoading] = useState(false);
  const [modal, setModal]     = useState<"add" | "edit" | null>(null);
  const [activeItem, setActiveItem]       = useState<Item | null>(null);
  const [form, setForm]                   = useState(BLANK_FORM);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Item | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/admin/crime-empire/items?page=1&limit=500");
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Derived stats ─────────────────────────────────────────────── */
  const inShopCount  = items.filter(i => i.crypto_price != null).length;
  const outShopCount = items.filter(i => i.crypto_price == null).length;
  const categories   = [...new Set(items.map(i => i.category))].sort();

  const filtered = useMemo(() => items.filter(i => {
    const matchQ    = !q         || i.name.toLowerCase().includes(q.toLowerCase());
    const matchCat  = !catFilter || i.category === catFilter;
    const matchShop = shopFilter === "all"
      || (shopFilter === "in"  ? i.crypto_price != null  : i.crypto_price == null);
    return matchQ && matchCat && matchShop;
  }), [items, q, catFilter, shopFilter]);

  /* ── Actions ───────────────────────────────────────────────────── */
  const statFields = (item: Item) => ({
    power_bonus:        String(item.power_bonus        ?? 0),
    intelligence_bonus: String(item.intelligence_bonus ?? 0),
    charisma_bonus:     String(item.charisma_bonus     ?? 0),
    hp_bonus:           String(item.hp_bonus           ?? 0),
    stamina_restore:    String(item.stamina_restore    ?? 0),
    success_rate_bonus: String(item.success_rate_bonus ?? 0),
    stamina_reduction:  String(item.stamina_reduction  ?? 0),
  });

  const openAdd = (item: Item) => {
    setActiveItem(item);
    setForm({ crypto_price: "", required_level: String(item.required_level ?? 1), ...statFields(item) });
    setModal("add");
  };

  const openEdit = (item: Item) => {
    setActiveItem(item);
    setForm({
      crypto_price:   String(item.crypto_price ?? ""),
      required_level: String(item.required_level ?? 1),
      ...statFields(item),
    });
    setModal("edit");
  };

  const closeModal = () => { setModal(null); setActiveItem(null); };

  const handleSave = async () => {
    if (!activeItem) return;
    setSaving(true);
    const res = await fetch(`/api/admin/crime-empire/items/${activeItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crypto_price:       form.crypto_price !== "" ? Number(form.crypto_price) : null,
        required_level:     Number(form.required_level) || 1,
        power_bonus:        Number(form.power_bonus)        || 0,
        intelligence_bonus: Number(form.intelligence_bonus) || 0,
        charisma_bonus:     Number(form.charisma_bonus)     || 0,
        hp_bonus:           Number(form.hp_bonus)           || 0,
        stamina_restore:    Number(form.stamina_restore)    || 0,
        success_rate_bonus: Number(form.success_rate_bonus) || 0,
        stamina_reduction:  Number(form.stamina_reduction)  || 0,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.item) {
      showToast(modal === "edit" ? "Listagem atualizada!" : "Item adicionado ao SGT Marchado!");
      closeModal();
      load();
    } else {
      showToast(data.error || "Erro", false);
    }
  };

  const handleRemove = async (item: Item) => {
    const res = await fetch(`/api/admin/crime-empire/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crypto_price: null }),
    });
    const data = await res.json();
    if (data.item) { showToast("Removido do SGT Marchado"); load(); }
    else showToast(data.error || "Erro", false);
    setConfirmRemove(null);
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black flex items-center gap-3">
          <span>🔫</span>
          <span className="bg-gradient-to-r from-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
            SGT Marchado
          </span>
        </h1>
        <p className="text-[#444] text-sm mt-1">
          Gere os itens disponiveis na loja crypto — preco em 💎 Crypto
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard label="No SGT"   value={inShopCount}     color="#a855f7" />
        <StatCard label="Fora"     value={outShopCount}    color="#555"    />
        <StatCard label="Total"    value={items.length}    color="#3b82f6" />
        <StatCard label="Filtrado" value={filtered.length} color="#888"    />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Pesquisar item..."
            className="w-full bg-[#0e0e10] border border-[#1e1e1e] rounded-xl px-4 py-2.5 text-sm text-white pl-9 outline-none focus:border-[#a855f7] transition-colors"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] text-sm">🔍</span>
        </div>
        <select
          value={catFilter}
          onChange={e => setCat(e.target.value)}
          className="bg-[#0e0e10] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white outline-none"
        >
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex rounded-xl overflow-hidden border border-[#1e1e1e]">
          {(["all", "in", "out"] as const).map(s => (
            <button
              key={s}
              onClick={() => setShop(s)}
              className={`px-4 py-2.5 text-xs font-black transition-colors ${
                shopFilter === s
                  ? "bg-[#a855f7] text-white"
                  : "bg-[#0e0e10] text-[#555] hover:text-white"
              }`}
            >
              {s === "all" ? "Todos" : s === "in" ? "No SGT" : "Fora"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[#2a2a2a] text-xs mb-4">{filtered.length} items</p>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-[#333]">
          <div className="text-3xl mb-2 animate-pulse">🔫</div>
          <p className="text-sm">A carregar...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[#333] text-sm">Nenhum item encontrado</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => {
            const meta   = RARITY_META[item.rarity] ?? RARITY_META.common;
            const inShop = item.crypto_price != null;
            return (
              <div
                key={item.id}
                className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: inShop ? "#0d0d10" : "#0a0a0c",
                  border: `1px solid ${inShop ? "#1e1e22" : "#141416"}`,
                  opacity: inShop ? 1 : 0.55,
                }}
              >
                <RarityBar rarity={item.rarity} />
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-12 h-12 object-contain flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#111] flex items-center justify-center text-[#222] text-xs flex-shrink-0">?</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm leading-tight truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: meta.color, background: `${meta.color}15` }}
                        >{meta.label}</span>
                        <span className="text-[10px] text-[#444] bg-[#111] px-2 py-0.5 rounded-full capitalize">{item.category}</span>
                        {item.required_level > 1 && (
                          <span className="text-[10px] text-yellow-400/70 bg-yellow-900/20 px-2 py-0.5 rounded-full">
                            Nv.{item.required_level}
                          </span>
                        )}
                      </div>
                    </div>
                    {inShop && (
                      <span className="text-[9px] font-black px-2 py-1 rounded-lg flex-shrink-0 text-purple-400 bg-purple-900/20 whitespace-nowrap">
                        💎 {item.crypto_price?.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Stat pills */}
                  {(() => {
                    const pills = [
                      item.power_bonus        > 0 && { label: `⚔ +${item.power_bonus}`,                        color: "#ef4444" },
                      item.intelligence_bonus > 0 && { label: `🧠 +${item.intelligence_bonus}`,                  color: "#3b82f6" },
                      item.charisma_bonus     > 0 && { label: `✨ +${item.charisma_bonus}`,                      color: "#a855f7" },
                      item.hp_bonus          > 0 && { label: `❤ +${item.hp_bonus} HP`,                         color: "#22c55e" },
                      item.stamina_restore   > 0 && { label: `⚡ +${item.stamina_restore} ST`,                   color: "#34d399" },
                      item.success_rate_bonus > 0 && { label: `🎯 +${(item.success_rate_bonus * 100).toFixed(0)}%`, color: "#06b6d4" },
                      item.stamina_reduction > 0 && { label: `💨 -${item.stamina_reduction} ST`,                color: "#f59e0b" },
                      item.has_durability && item.max_durability && { label: `🔧 ${item.max_durability} dur`, color: "#f97316" },
                    ].filter(Boolean) as { label: string; color: string }[];
                    if (!pills.length) return null;
                    return (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {pills.map((p, i) => (
                          <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ color: p.color, background: `${p.color}18` }}>{p.label}</span>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="text-xs mb-3">
                    <span className="text-[#333]">Base </span>
                    <span className="text-[#555] font-bold">💵 {item.base_price.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {inShop ? (
                      <>
                        <button
                          onClick={() => openEdit(item)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#1a1a1a] hover:bg-[#222] text-white transition-all border border-[#222]"
                        >
                          Editar Preco
                        </button>
                        <button
                          onClick={() => setConfirmRemove(item)}
                          className="py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all"
                          style={{ background: "#1a0505", border: "1px solid #3b0f0f", color: "#ef4444" }}
                        >
                          X
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openAdd(item)}
                        className="w-full py-1.5 rounded-lg text-xs font-black transition-all"
                        style={{ background: "#a855f715", border: "1px solid #a855f725", color: "#a855f7" }}
                      >
                        + Adicionar ao SGT Marchado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────────────── */}
      {modal && activeItem && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[#0d0d10] border border-[#252528] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#1a1a1a]">
              {activeItem.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeItem.image_url} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
              )}
              <div>
                <h2 className="text-base font-black text-white">
                  {modal === "edit" ? "Editar Listagem" : "Adicionar ao SGT Marchado"}
                </h2>
                <p className="text-[#555] text-xs mt-0.5">{activeItem.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs text-[#666] mb-1.5 block font-bold">Preco em Crypto 💎</span>
                <input
                  type="number"
                  min={1}
                  value={form.crypto_price}
                  onChange={e => setForm(f => ({ ...f, crypto_price: e.target.value }))}
                  placeholder="ex: 500"
                  className="w-full bg-[#0a0a0c] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#a855f7] transition-colors"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <p className="text-[#333] text-[10px] mt-1">
                  Cash base: 💵 {activeItem.base_price.toLocaleString()}
                </p>
              </label>
              <label className="block">
                <span className="text-xs text-[#666] mb-1.5 block font-bold">🔒 Nivel Minimo</span>
                <input
                  type="number"
                  min={1}
                  value={form.required_level}
                  onChange={e => setForm(f => ({ ...f, required_level: e.target.value }))}
                  className="w-full bg-[#0a0a0c] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#a855f7] transition-colors"
                />
              </label>

              {/* ── Stat Boosts ───────────────────────────────────── */}
              <div>
                <p className="text-xs text-[#555] font-black uppercase tracking-widest mb-3 pt-1 border-t border-[#1a1a1a]">Stat Boosts</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { key: "power_bonus",        label: "⚔ Power",        color: "#ef4444" },
                    { key: "intelligence_bonus", label: "🧠 Intelligence",  color: "#3b82f6" },
                    { key: "charisma_bonus",     label: "✨ Charisma",     color: "#a855f7" },
                    { key: "hp_bonus",           label: "❤ HP Bonus",     color: "#22c55e" },
                    { key: "stamina_restore",    label: "⚡ Stamina Rest.", color: "#34d399" },
                    { key: "stamina_reduction",  label: "💨 Stamina Red.", color: "#f59e0b" },
                  ] as const).map(({ key, label, color }) => (
                    <label key={key} className="block">
                      <span className="text-[10px] font-bold mb-1 block" style={{ color }}>{label}</span>
                      <input
                        type="number"
                        min={0}
                        value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-[#0a0a0c] border border-[#1e1e1e] rounded-lg px-2.5 py-2 text-sm text-white outline-none transition-colors"
                        style={{ focusBorderColor: color } as React.CSSProperties}
                      />
                    </label>
                  ))}
                  <label className="block col-span-2">
                    <span className="text-[10px] font-bold mb-1 block" style={{ color: "#06b6d4" }}>🎯 Success Rate (0–1, ex: 0.05 = 5%)</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={form.success_rate_bonus}
                      onChange={e => setForm(f => ({ ...f, success_rate_bonus: e.target.value }))}
                      className="w-full bg-[#0a0a0c] border border-[#1e1e1e] rounded-lg px-2.5 py-2 text-sm text-white outline-none transition-colors"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-[#888] text-sm font-semibold hover:bg-[#222] transition-colors border border-[#222]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.crypto_price || Number(form.crypto_price) <= 0}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-black disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
              >
                {saving ? "A guardar..." : modal === "edit" ? "Guardar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Remove ────────────────────────────────────────── */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0d10] border border-red-900/40 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-5">
              <p className="text-3xl mb-3">🗑️</p>
              <p className="text-white font-black text-base">Remover do SGT Marchado?</p>
              <p className="text-[#555] text-xs mt-1">
                &quot;{confirmRemove.name}&quot; sai da loja mas nao e eliminado.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold border border-[#222]"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRemove(confirmRemove)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
