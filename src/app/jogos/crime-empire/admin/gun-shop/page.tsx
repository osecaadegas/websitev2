"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CEToast } from "@/components/CEToast";

/* ── Types ──────────────────────────────────────────────────────── */
type GunItem = {
  id: string;
  name: string;
  description: string;
  category: "weapon" | "armor";
  rarity: string;
  equipment_slot: string | null;
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  stamina_restore: number;
  success_rate_bonus: number;
  stamina_reduction: number;
  base_price: number;
  crypto_price: number | null;
  has_durability: boolean;
  max_durability: number | null;
  required_level: number;
  tradeable: boolean;
  image_url: string | null;
};

type FormData = {
  name: string;
  description: string;
  category: string;
  rarity: string;
  equipment_slot: string;
  power_bonus: string;
  intelligence_bonus: string;
  charisma_bonus: string;
  hp_bonus: string;
  stamina_restore: string;
  success_rate_bonus: string;
  stamina_reduction: string;
  base_price: string;
  crypto_price: string;
  has_durability: boolean;
  max_durability: string;
  required_level: string;
  tradeable: boolean;
  image_url: string;
};

/* ── Constants ──────────────────────────────────────────────────── */
const RARITY_META: Record<string, { color: string; label: string; glow: string }> = {
  common:    { color: "#6b7280", label: "Comum",    glow: "transparent" },
  rare:      { color: "#3b82f6", label: "Raro",     glow: "rgba(59,130,246,0.12)" },
  epic:      { color: "#a855f7", label: "Epico",    glow: "rgba(168,85,247,0.12)" },
  legendary: { color: "#f59e0b", label: "Lendario", glow: "rgba(245,158,11,0.14)" },
};
const RARITIES        = ["common", "rare", "epic", "legendary"];
const EQUIPMENT_SLOTS = ["weapon", "head", "body"];

const BLANK: FormData = {
  name: "", description: "", category: "weapon", rarity: "common",
  equipment_slot: "weapon",
  power_bonus: "0", intelligence_bonus: "0", charisma_bonus: "0",
  hp_bonus: "0", stamina_restore: "0", success_rate_bonus: "0", stamina_reduction: "0",
  base_price: "100", crypto_price: "",
  has_durability: false, max_durability: "",
  required_level: "1", tradeable: true, image_url: "",
};

/* ── Sub-components ─────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#0c0d0f", border: "1px solid #181a1e" }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#252527" }}>{label}</p>
      <p className="text-3xl font-black tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function RarityBar({ rarity }: { rarity: string }) {
  const c = RARITY_META[rarity]?.color ?? "#333";
  return <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${c}cc, transparent)` }} />;
}

function StatBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color, background: `${color}15` }}>
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[#555] mb-1.5 block font-bold">{label}</span>
      {children}
    </label>
  );
}

const INPUT_CLS = "w-full bg-[#0a0a0c] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#ff6a00] transition-colors";

/* ── Quick Set Crypto Modal ─────────────────────────────────────── */
function QuickCryptoModal({
  item, onSave, onClose, saving,
}: {
  item: GunItem | null;
  onSave: (price: number) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [price, setPrice] = useState("");
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0d0d10] border border-[#252528] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#1a1a1a]">
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
          )}
          <div>
            <p className="font-black text-white text-sm">Adicionar ao Gun Shop</p>
            <p className="text-[#555] text-xs mt-0.5">{item.name}</p>
          </div>
        </div>
        <Field label="Preco em Crypto 💎">
          <input
            type="number" min={1} value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="ex: 500"
            className={INPUT_CLS}
            autoFocus
          />
        </Field>
        <p className="text-[#333] text-[10px] mt-1 mb-5">Cash base: 💵{item.base_price.toLocaleString()}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-[#888] text-sm font-semibold border border-[#222]">Cancelar</button>
          <button
            onClick={() => { if (price && Number(price) > 0) onSave(Number(price)); }}
            disabled={saving || !price || Number(price) <= 0}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-black disabled:opacity-40 transition-all"
            style={{ background: "linear-gradient(135deg, #ff6a00, #ee0979)" }}
          >
            {saving ? "A guardar..." : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function GunShopAdminPage() {
  const [items, setItems]         = useState<GunItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState("");
  const [typeFilter, setType]     = useState<"all" | "weapon" | "armor">("all");
  const [rarityFilter, setRarity] = useState("");
  const [shopFilter, setShop]     = useState<"all" | "in" | "out">("all");
  const [modal, setModal]         = useState<"create" | "edit" | null>(null);
  const [form, setForm]           = useState<FormData>(BLANK);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GunItem | null>(null);
  const [quickCrypto, setQuickCrypto]     = useState<GunItem | null>(null);
  const [quickSaving, setQuickSaving]     = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/admin/crime-empire/items?limit=500");
    const data = await res.json();
    const gunItems = (data.items || []).filter(
      (i: GunItem) => i.category === "weapon" || i.category === "armor",
    );
    setItems(gunItems);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Derived stats */
  const totalWeapons = items.filter(i => i.category === "weapon").length;
  const totalArmor   = items.filter(i => i.category === "armor").length;
  const inShop       = items.filter(i => i.crypto_price != null).length;
  const outShop      = items.filter(i => i.crypto_price == null).length;

  const filtered = useMemo(() => items.filter(i => {
    const matchQ      = !q            || i.name.toLowerCase().includes(q.toLowerCase());
    const matchType   = typeFilter === "all" || i.category === typeFilter;
    const matchRarity = !rarityFilter || i.rarity === rarityFilter;
    const matchShop   = shopFilter === "all" || (shopFilter === "in" ? i.crypto_price != null : i.crypto_price == null);
    return matchQ && matchType && matchRarity && matchShop;
  }), [items, q, typeFilter, rarityFilter, shopFilter]);

  /* Modal helpers */
  const openCreate = () => { setForm(BLANK); setModal("create"); };
  const openEdit   = (item: GunItem) => {
    setForm({
      name: item.name, description: item.description ?? "",
      category: item.category, rarity: item.rarity,
      equipment_slot: item.equipment_slot ?? "weapon",
      power_bonus:         String(item.power_bonus ?? 0),
      intelligence_bonus:  String(item.intelligence_bonus ?? 0),
      charisma_bonus:      String(item.charisma_bonus ?? 0),
      hp_bonus:            String(item.hp_bonus ?? 0),
      stamina_restore:     String(item.stamina_restore ?? 0),
      success_rate_bonus:  String(item.success_rate_bonus ?? 0),
      stamina_reduction:   String(item.stamina_reduction ?? 0),
      base_price:    String(item.base_price),
      crypto_price:  item.crypto_price != null ? String(item.crypto_price) : "",
      has_durability: item.has_durability,
      max_durability: item.max_durability != null ? String(item.max_durability) : "",
      required_level: String(item.required_level ?? 1),
      tradeable: item.tradeable,
      image_url: item.image_url ?? "",
    });
    setModal("edit");
  };
  const closeModal = () => { setModal(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.base_price) return;
    setSaving(true);
    const payload = {
      name:               form.name.trim(),
      description:        form.description.trim(),
      category:           form.category,
      rarity:             form.rarity,
      equipment_slot:     form.equipment_slot || null,
      power_bonus:        Number(form.power_bonus)        || 0,
      intelligence_bonus: Number(form.intelligence_bonus) || 0,
      charisma_bonus:     Number(form.charisma_bonus)     || 0,
      hp_bonus:           Number(form.hp_bonus)           || 0,
      stamina_restore:    Number(form.stamina_restore)    || 0,
      success_rate_bonus: Number(form.success_rate_bonus) || 0,
      stamina_reduction:  Number(form.stamina_reduction)  || 0,
      base_price:  Number(form.base_price),
      crypto_price: form.crypto_price !== "" ? Number(form.crypto_price) : null,
      has_durability: form.has_durability,
      max_durability: form.has_durability && form.max_durability ? Number(form.max_durability) : null,
      required_level: Number(form.required_level) || 1,
      tradeable:  form.tradeable,
      image_url:  form.image_url.trim() || null,
    };

    const isEdit = modal === "edit";
    // For edit, we need the item id — find it from the current form via name (fragile) — better to store id
    // Actually we'll store the editing item id in a ref
    const editId = editingId;
    const url    = isEdit ? `/api/admin/crime-empire/items/${editId}` : "/api/admin/crime-empire/items";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (data.item) {
      showToast(isEdit ? "Item atualizado!" : "Item criado!");
      closeModal();
      load();
    } else showToast(data.error || "Erro", false);
  };

  // Store editing item id separately
  const [editingId, setEditingId] = useState<string | null>(null);
  const openEditWithId = (item: GunItem) => { setEditingId(item.id); openEdit(item); };

  const handleDelete = async (item: GunItem) => {
    const res  = await fetch(`/api/admin/crime-empire/items/${item.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { showToast("Item eliminado"); load(); }
    else showToast(data.error || "Erro", false);
    setConfirmDelete(null);
  };

  const removeFromGunShop = async (item: GunItem) => {
    const res  = await fetch(`/api/admin/crime-empire/items/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crypto_price: null }),
    });
    const data = await res.json();
    if (data.item) { showToast(`${item.name} removido do Gun Shop`); load(); }
    else showToast(data.error || "Erro", false);
  };

  const addToGunShop = async (price: number) => {
    if (!quickCrypto) return;
    setQuickSaving(true);
    const res  = await fetch(`/api/admin/crime-empire/items/${quickCrypto.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crypto_price: price }),
    });
    const data = await res.json();
    setQuickSaving(false);
    if (data.item) { showToast(`${quickCrypto.name} adicionado ao Gun Shop!`); setQuickCrypto(null); load(); }
    else showToast(data.error || "Erro", false);
  };

  /* ── RENDER ──────────────────────────────────────────────────── */
  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <span>🔫</span>
            <span className="bg-gradient-to-r from-[#4ade80] to-[#166534] bg-clip-text text-transparent">
              SGT. Machado
            </span>
          </h1>
          <p className="text-[#444] text-sm mt-1">Gere armas e armaduras disponíveis no Gun Shop</p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #22c55e, #166534)" }}
        >
          + Nova Arma / Armadura
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard label="Armas"      value={totalWeapons} color="#ef4444" />
        <StatCard label="Armaduras"  value={totalArmor}   color="#3b82f6" />
        <StatCard label="No Gun Shop" value={inShop}      color="#22c55e" />
        <StatCard label="Fora da Loja" value={outShop}    color="#555"    />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar item..."
            className="w-full bg-[#0c0d0f] border border-[#181a1e] rounded-xl px-4 py-2.5 text-sm text-white pl-9 outline-none focus:border-[#22c55e] transition-colors" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] text-sm">🔍</span>
        </div>

        {/* Type tabs */}
        <div className="flex rounded-xl overflow-hidden border border-[#181a1e]">
          {(["all", "weapon", "armor"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`px-4 py-2.5 text-xs font-black transition-colors ${typeFilter === t ? "bg-[#22c55e] text-white" : "bg-[#0c0d0f] text-[#555] hover:text-white"}`}>
              {t === "all" ? "Todos" : t === "weapon" ? "⚔ Armas" : "🛡 Armaduras"}
            </button>
          ))}
        </div>

        <select value={rarityFilter} onChange={e => setRarity(e.target.value)}
          className="bg-[#0c0d0f] border border-[#181a1e] rounded-xl px-3 py-2.5 text-sm text-white outline-none">
          <option value="">Todas raridades</option>
          {RARITIES.map(r => <option key={r} value={r}>{RARITY_META[r]?.label ?? r}</option>)}
        </select>

        {/* Shop status tabs */}
        <div className="flex rounded-xl overflow-hidden border border-[#181a1e]">
          {(["all", "in", "out"] as const).map(s => (
            <button key={s} onClick={() => setShop(s)}
              className={`px-4 py-2.5 text-xs font-black transition-colors ${shopFilter === s ? "bg-[#166534] text-white" : "bg-[#0c0d0f] text-[#555] hover:text-white"}`}>
              {s === "all" ? "Todos" : s === "in" ? "No Shop" : "Fora"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[#252527] text-xs mb-4">{filtered.length} items</p>

      {/* Card grid */}
      {loading ? (
        <div className="text-center py-20 text-[#333]">
          <div className="text-3xl mb-2 animate-pulse">🔫</div>
          <p className="text-sm">A carregar arsenal...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[#333] text-sm">Nenhum item encontrado</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => {
            const meta    = RARITY_META[item.rarity] ?? RARITY_META.common;
            const inGunShop = item.crypto_price != null;
            const stats: { label: string; color: string }[] = [];
            if (item.power_bonus)        stats.push({ label: `⚔ +${item.power_bonus}`,          color: "#ef4444" });
            if (item.intelligence_bonus) stats.push({ label: `🧠 +${item.intelligence_bonus}`,    color: "#3b82f6" });
            if (item.charisma_bonus)     stats.push({ label: `✨ +${item.charisma_bonus}`,        color: "#a855f7" });
            if (item.hp_bonus)           stats.push({ label: `❤ +${item.hp_bonus}`,              color: "#22c55e" });
            if (item.success_rate_bonus) stats.push({ label: `% +${item.success_rate_bonus}`,    color: "#06b6d4" });
            if (item.stamina_reduction)  stats.push({ label: `⚡ -${item.stamina_reduction}`,    color: "#34d399" });

            return (
              <div key={item.id} className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: inGunShop ? "#0c0e0d" : "#0a0a0c",
                  border: `1px solid ${inGunShop ? "#1a2e1e" : "#161618"}`,
                  boxShadow: inGunShop ? `0 0 20px ${meta.glow}` : "none",
                }}>
                <RarityBar rarity={item.rarity} />
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt="" className="w-12 h-12 object-contain flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#111] flex items-center justify-center text-lg">
                        {item.category === "weapon" ? "⚔" : "🛡"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm leading-tight truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}15` }}>{meta.label}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[#444] bg-[#111] capitalize">{item.category}</span>
                        {item.equipment_slot && (
                          <span className="text-[10px] text-[#333] bg-[#0f0f0f] px-2 py-0.5 rounded-full capitalize">{item.equipment_slot}</span>
                        )}
                      </div>
                    </div>
                    {/* Gun shop badge / price */}
                    {inGunShop && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-[#22c55e] font-black">GUN SHOP</p>
                        <p className="text-xs font-black text-green-400">💎 {item.crypto_price!.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  {stats.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {stats.map((s, i) => <StatBadge key={i} label={s.label} color={s.color} />)}
                    </div>
                  )}

                  {/* Durability + level info */}
                  <div className="flex items-center gap-3 mb-3">
                    {item.has_durability && item.max_durability && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded text-orange-400 bg-orange-900/20">
                        🔧 {item.max_durability} dur.
                      </span>
                    )}
                    <span className="text-[10px] text-[#333] font-medium">Nível {item.required_level}+</span>
                    <span className="text-[10px] text-[#333] font-medium">💵 {item.base_price.toLocaleString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {inGunShop ? (
                      <button
                        onClick={() => removeFromGunShop(item)}
                        className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                        style={{ background: "#052210", border: "1px solid #22c55e30", color: "#22c55e" }}
                      >
                        ✓ No Shop
                      </button>
                    ) : (
                      <button
                        onClick={() => setQuickCrypto(item)}
                        className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                        style={{ background: "#0a1a0c", border: "1px solid #22c55e20", color: "#555" }}
                      >
                        + Gun Shop
                      </button>
                    )}
                    <button
                      onClick={() => openEditWithId(item)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#1a1a1a] hover:bg-[#222] text-white transition-all border border-[#222]"
                    >
                      ✏ Editar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(item)}
                      className="py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: "#1a0505", border: "1px solid #3b0f0f", color: "#ef4444" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quick Crypto Modal ───────────────────────────────────── */}
      <QuickCryptoModal
        item={quickCrypto}
        onSave={addToGunShop}
        onClose={() => setQuickCrypto(null)}
        saving={quickSaving}
      />

      {/* ── Create / Edit Modal ──────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeModal}>
          <div
            className="bg-[#0d0d10] border border-[#252528] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#1a1a1a]">
              <div>
                <h2 className="text-lg font-black text-white">{modal === "edit" ? "Editar Item" : "Novo Item"}</h2>
                <p className="text-[#444] text-xs mt-0.5">Arma ou Armadura para o SGT. Machado</p>
              </div>
              <button onClick={closeModal} className="text-[#555] hover:text-white transition-colors text-xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-4">
                <Field label="Nome *">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do item" className={INPUT_CLS} />
                </Field>

                <Field label="Descricao">
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descricao..." rows={2}
                    className={`${INPUT_CLS} resize-none`} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Categoria">
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className={INPUT_CLS}>
                      <option value="weapon">Arma</option>
                      <option value="armor">Armadura</option>
                    </select>
                  </Field>
                  <Field label="Raridade">
                    <select value={form.rarity} onChange={e => setForm(f => ({ ...f, rarity: e.target.value }))}
                      className={INPUT_CLS}>
                      {RARITIES.map(r => <option key={r} value={r}>{RARITY_META[r]?.label ?? r}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Slot de Equipamento">
                  <select value={form.equipment_slot} onChange={e => setForm(f => ({ ...f, equipment_slot: e.target.value }))}
                    className={INPUT_CLS}>
                    <option value="">Nenhum</option>
                    {EQUIPMENT_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Preco Base 💵 *">
                    <input type="number" value={form.base_price}
                      onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
                      min={0} className={INPUT_CLS} />
                  </Field>
                  <Field label="Preco Crypto 💎 (Gun Shop)">
                    <input type="number" value={form.crypto_price}
                      onChange={e => setForm(f => ({ ...f, crypto_price: e.target.value }))}
                      placeholder="vazio = fora" min={0} className={INPUT_CLS} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nivel Requerido">
                    <input type="number" value={form.required_level}
                      onChange={e => setForm(f => ({ ...f, required_level: e.target.value }))}
                      min={1} className={INPUT_CLS} />
                  </Field>
                  <Field label="URL da Imagem">
                    <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="/images/..." className={INPUT_CLS} />
                  </Field>
                </div>
              </div>

              {/* Right column - Stats */}
              <div className="space-y-4">
                <p className="text-xs font-black text-[#333] uppercase tracking-widest">Estatisticas</p>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="⚔ Forca">
                    <input type="number" value={form.power_bonus}
                      onChange={e => setForm(f => ({ ...f, power_bonus: e.target.value }))}
                      className={INPUT_CLS} />
                  </Field>
                  <Field label="🧠 Inteligencia">
                    <input type="number" value={form.intelligence_bonus}
                      onChange={e => setForm(f => ({ ...f, intelligence_bonus: e.target.value }))}
                      className={INPUT_CLS} />
                  </Field>
                  <Field label="✨ Carisma">
                    <input type="number" value={form.charisma_bonus}
                      onChange={e => setForm(f => ({ ...f, charisma_bonus: e.target.value }))}
                      className={INPUT_CLS} />
                  </Field>
                  <Field label="❤ HP Bonus">
                    <input type="number" value={form.hp_bonus}
                      onChange={e => setForm(f => ({ ...f, hp_bonus: e.target.value }))}
                      className={INPUT_CLS} />
                  </Field>
                  <Field label="% Sucesso">
                    <input type="number" value={form.success_rate_bonus}
                      onChange={e => setForm(f => ({ ...f, success_rate_bonus: e.target.value }))}
                      step="0.01" className={INPUT_CLS} />
                  </Field>
                  <Field label="⚡ Reducao Stamina">
                    <input type="number" value={form.stamina_reduction}
                      onChange={e => setForm(f => ({ ...f, stamina_reduction: e.target.value }))}
                      className={INPUT_CLS} />
                  </Field>
                </div>

                <p className="text-xs font-black text-[#333] uppercase tracking-widest mt-2">Durabilidade</p>

                <div
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer select-none transition-all"
                  style={{ background: form.has_durability ? "#12150e" : "#0e0e0e", border: `1px solid ${form.has_durability ? "#a3e63530" : "#222"}` }}
                  onClick={() => setForm(f => ({ ...f, has_durability: !f.has_durability, max_durability: f.has_durability ? "" : f.max_durability }))}
                >
                  <div className="w-10 h-5 rounded-full relative flex-shrink-0" style={{ background: form.has_durability ? "#84cc16" : "#2a2a2a" }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.has_durability ? "calc(100% - 1.125rem)" : "0.125rem" }} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: form.has_durability ? "#84cc16" : "#555" }}>
                    {form.has_durability ? "Tem durabilidade" : "Sem durabilidade"}
                  </span>
                </div>

                {form.has_durability && (
                  <Field label="Durabilidade Maxima">
                    <input type="number" value={form.max_durability}
                      onChange={e => setForm(f => ({ ...f, max_durability: e.target.value }))}
                      placeholder="ex: 100" min={1} className={INPUT_CLS} />
                  </Field>
                )}

                {/* Preview mini card */}
                {form.name && (
                  <div className="rounded-xl overflow-hidden" style={{ background: "#0a0a0c", border: `1px solid ${RARITY_META[form.rarity]?.color ?? "#333"}25` }}>
                    <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${RARITY_META[form.rarity]?.color ?? "#333"}bb, transparent)` }} />
                    <div className="p-3">
                      <p className="text-[10px] text-[#333] font-black uppercase tracking-widest mb-1">Preview</p>
                      <p className="font-black text-white text-sm">{form.name}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: RARITY_META[form.rarity]?.color ?? "#888", background: `${RARITY_META[form.rarity]?.color ?? "#888"}15` }}>
                          {RARITY_META[form.rarity]?.label ?? form.rarity}
                        </span>
                        <span className="text-[10px] text-[#444] bg-[#111] px-2 py-0.5 rounded-full capitalize">{form.category}</span>
                      </div>
                      {form.crypto_price && (
                        <p className="text-xs text-green-400 font-black mt-1.5">💎 {Number(form.crypto_price).toLocaleString()} crypto</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-[#1a1a1a]">
              <button onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-[#888] text-sm font-semibold hover:bg-[#222] transition-colors border border-[#222]">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.base_price}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-black disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg, #22c55e, #166534)" }}>
                {saving ? "A guardar..." : modal === "edit" ? "Guardar Alteracoes" : "Criar Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0d10] border border-red-900/40 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-5">
              <p className="text-3xl mb-3">⚠️</p>
              <p className="text-white font-black text-base">Eliminar item?</p>
              <p className="text-[#555] text-xs mt-1 leading-relaxed">
                "{confirmDelete.name}" sera eliminado permanentemente de todos os inventarios.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold border border-[#222]">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
