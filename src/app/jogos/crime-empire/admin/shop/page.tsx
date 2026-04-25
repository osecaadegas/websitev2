"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

/* ── Types ──────────────────────────────────────────────────────── */
type Item = {
  id: string; name: string; description: string; category: string; rarity: string;
  base_price: number; image_url: string | null;
};
type ShopListing = {
  id: string; item_id: string; price_override: number | null; stock: number | null;
  rotation_type: string; rotation_ends_at: string | null; enabled: boolean;
};
type Row = Item & { listing: ShopListing | null };

const RARITY_META: Record<string, { color: string; label: string }> = {
  common:    { color: "#6b7280", label: "Comum"    },
  rare:      { color: "#3b82f6", label: "Raro"     },
  epic:      { color: "#a855f7", label: "Epico"    },
  legendary: { color: "#f59e0b", label: "Lendario" },
};
const ROTATION_TYPES = ["permanent", "daily", "weekly"];
const BLANK_FORM = { price_override: "", stock: "", rotation_type: "permanent", rotation_ends_at: "", enabled: true };

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#0e0e10", border: "1px solid #1a1a1e" }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#2a2a2a" }}>{label}</p>
      <p className="text-3xl font-black tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function RarityBar({ rarity }: { rarity: string }) {
  const meta = RARITY_META[rarity] ?? RARITY_META.common;
  return <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${meta.color}bb, transparent)` }} />;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer select-none transition-all"
      style={{ background: value ? "#05210e" : "#0e0e0e", border: `1px solid ${value ? "#22c55e30" : "#222"}` }}
      onClick={() => onChange(!value)}
    >
      <div className="w-10 h-5 rounded-full relative flex-shrink-0 transition-colors" style={{ background: value ? "#22c55e" : "#2a2a2a" }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: value ? "calc(100% - 1.125rem)" : "0.125rem" }} />
      </div>
      <span className="text-sm font-bold transition-colors" style={{ color: value ? "#22c55e" : "#555" }}>
        {value ? "Visivel na loja" : "Oculto"}
      </span>
    </div>
  );
}

export default function ShopAdminPage() {
  const [rows, setRows]               = useState<Row[]>([]);
  const [q, setQ]                     = useState("");
  const [catFilter, setCat]           = useState("");
  const [statusFilter, setStatus]     = useState<"all" | "in" | "out">("all");
  const [loading, setLoading]         = useState(false);
  const [modal, setModal]             = useState<"add" | "edit" | null>(null);
  const [activeItem, setActiveItem]   = useState<Item | null>(null);
  const [activeListing, setActiveListing] = useState<ShopListing | null>(null);
  const [form, setForm]               = useState<typeof BLANK_FORM>(BLANK_FORM);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Row | null>(null);
  const [toggling, setToggling]       = useState<string | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, shopRes] = await Promise.all([
      fetch("/api/admin/crime-empire/items?page=1&limit=500"),
      fetch("/api/admin/crime-empire/shop"),
    ]);
    const itemsData = await itemsRes.json();
    const shopData  = await shopRes.json();
    const listingMap: Record<string, ShopListing> = {};
    for (const l of (shopData.listings || [])) listingMap[l.item_id] = l;
    const merged: Row[] = (itemsData.items || []).map((item: Item) => ({
      ...item, listing: listingMap[item.id] ?? null,
    }));
    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const inShopCount   = rows.filter(r => r.listing).length;
  const enabledCount  = rows.filter(r => r.listing?.enabled).length;
  const disabledCount = rows.filter(r => r.listing && !r.listing.enabled).length;
  const noStockCount  = rows.filter(r => r.listing && r.listing.stock === 0).length;
  const categories    = [...new Set(rows.map(r => r.category))].sort();

  const filtered = rows.filter(r => {
    const matchQ      = !q         || r.name.toLowerCase().includes(q.toLowerCase());
    const matchCat    = !catFilter || r.category === catFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "in" ? !!r.listing : !r.listing);
    return matchQ && matchCat && matchStatus;
  });

  const openAdd = (row: Row) => {
    setActiveItem(row); setActiveListing(null); setForm(BLANK_FORM); setModal("add");
  };
  const openEdit = (row: Row) => {
    if (!row.listing) return;
    setActiveItem(row); setActiveListing(row.listing);
    setForm({
      price_override:   row.listing.price_override != null ? String(row.listing.price_override) : "",
      stock:            row.listing.stock != null ? String(row.listing.stock) : "",
      rotation_type:    row.listing.rotation_type,
      rotation_ends_at: row.listing.rotation_ends_at ? row.listing.rotation_ends_at.slice(0, 16) : "",
      enabled:          row.listing.enabled,
    });
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setActiveItem(null); setActiveListing(null); };

  const handleSave = async () => {
    if (!activeItem) return;
    setSaving(true);
    const payload = {
      item_id:          activeItem.id,
      price_override:   form.price_override !== "" ? Number(form.price_override) : null,
      stock:            form.stock          !== "" ? Number(form.stock)          : null,
      rotation_type:    form.rotation_type,
      rotation_ends_at: form.rotation_ends_at || null,
      enabled:          form.enabled,
    };
    const isEdit = modal === "edit" && activeListing;
    const res = await fetch(
      isEdit ? `/api/admin/crime-empire/shop/${activeListing!.id}` : "/api/admin/crime-empire/shop",
      { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const data = await res.json();
    setSaving(false);
    if (!data.error) { showToast(isEdit ? "Listagem atualizada!" : "Item adicionado!"); closeModal(); load(); }
    else showToast(data.error || "Erro", false);
  };

  const handleRemove = async (row: Row) => {
    if (!row.listing) return;
    const res  = await fetch(`/api/admin/crime-empire/shop/${row.listing.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { showToast("Removido da loja"); load(); }
    else showToast(data.error || "Erro", false);
    setConfirmRemove(null);
  };

  const toggleEnabled = async (row: Row) => {
    if (!row.listing) return;
    setToggling(row.id);
    await fetch(`/api/admin/crime-empire/shop/${row.listing.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !row.listing.enabled }),
    });
    setToggling(null); load();
  };

  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="mb-6">
        <h1 className="text-3xl font-black flex items-center gap-3">
          <span>🛒</span>
          <span className="bg-gradient-to-r from-[#ff6a00] to-[#f59e0b] bg-clip-text text-transparent">Loja do Chines</span>
        </h1>
        <p className="text-[#444] text-sm mt-1">Gere os itens disponiveis na loja e os seus precos</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard label="Na Loja"    value={inShopCount}   color="#f59e0b" />
        <StatCard label="Activos"    value={enabledCount}  color="#22c55e" />
        <StatCard label="Desactivos" value={disabledCount} color="#ef4444" />
        <StatCard label="Sem Stock"  value={noStockCount}  color="#888" />
      </div>

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar item..."
            className="w-full bg-[#0e0e10] border border-[#1e1e1e] rounded-xl px-4 py-2.5 text-sm text-white pl-9 outline-none focus:border-[#ff6a00] transition-colors" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] text-sm">🔍</span>
        </div>
        <select value={catFilter} onChange={e => setCat(e.target.value)}
          className="bg-[#0e0e10] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white outline-none">
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex rounded-xl overflow-hidden border border-[#1e1e1e]">
          {(["all", "in", "out"] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-4 py-2.5 text-xs font-black transition-colors ${statusFilter === s ? "bg-[#ff6a00] text-white" : "bg-[#0e0e10] text-[#555] hover:text-white"}`}>
              {s === "all" ? "Todos" : s === "in" ? "Na Loja" : "Fora da Loja"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[#2a2a2a] text-xs mb-4">{filtered.length} items</p>

      {loading ? (
        <div className="text-center py-20 text-[#333]">
          <div className="text-3xl mb-2 animate-pulse">🛒</div>
          <p className="text-sm">A carregar...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[#333] text-sm">Nenhum item encontrado</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(row => {
            const meta       = RARITY_META[row.rarity] ?? RARITY_META.common;
            const inShop     = !!row.listing;
            const isToggling = toggling === row.id;
            return (
              <div key={row.id} className="rounded-2xl overflow-hidden transition-all"
                style={{ background: inShop ? "#0d0d10" : "#0a0a0c", border: `1px solid ${inShop ? "#1e1e22" : "#141416"}`, opacity: inShop ? 1 : 0.55 }}>
                <RarityBar rarity={row.rarity} />
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {row.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.image_url} alt="" className="w-12 h-12 object-contain flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#111] flex items-center justify-center text-[#222] text-xs">?</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm leading-tight truncate">{row.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}15` }}>{meta.label}</span>
                        <span className="text-[10px] text-[#444] bg-[#111] px-2 py-0.5 rounded-full">{row.category}</span>
                      </div>
                    </div>
                    {inShop && (
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg flex-shrink-0 ${row.listing!.enabled ? "text-green-400 bg-green-900/20" : "text-[#555] bg-[#111]"}`}>
                        {row.listing!.enabled ? "ACTIVO" : "OFF"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-xs"><span className="text-[#333]">Base </span><span className="text-[#555] font-bold">💵{row.base_price.toLocaleString()}</span></div>
                    {row.listing?.price_override != null && (
                      <div className="text-xs"><span className="text-[#333]">Loja </span><span className="text-green-400 font-black">💵{row.listing.price_override.toLocaleString()}</span></div>
                    )}
                  </div>

                  {inShop && row.listing && (
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
                        style={{
                          background: row.listing.stock === null ? "#1a1a12" : row.listing.stock > 0 ? "#052210" : "#200505",
                          color:      row.listing.stock === null ? "#666"    : row.listing.stock > 0 ? "#22c55e" : "#ef4444",
                        }}>
                        {row.listing.stock === null ? "Infinito" : row.listing.stock > 0 ? `${row.listing.stock} stock` : "Sem stock"}
                      </span>
                      <span className="text-[10px] text-[#333] bg-[#111] px-2 py-1 rounded-lg capitalize">{row.listing.rotation_type}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {inShop ? (
                      <>
                        <button onClick={() => toggleEnabled(row)} disabled={isToggling}
                          className="px-3 py-1.5 rounded-lg text-xs font-black transition-all disabled:opacity-50"
                          style={{
                            background: row.listing!.enabled ? "#052210" : "#100505",
                            border:     `1px solid ${row.listing!.enabled ? "#22c55e25" : "#ef444420"}`,
                            color:      row.listing!.enabled ? "#22c55e" : "#ef4444",
                          }}>
                          {isToggling ? "..." : row.listing!.enabled ? "● ON" : "○ OFF"}
                        </button>
                        <button onClick={() => openEdit(row)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#1a1a1a] hover:bg-[#222] text-white transition-all border border-[#222]">
                          Editar
                        </button>
                        <button onClick={() => setConfirmRemove(row)}
                          className="py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all"
                          style={{ background: "#1a0505", border: "1px solid #3b0f0f", color: "#ef4444" }}>
                          X
                        </button>
                      </>
                    ) : (
                      <button onClick={() => openAdd(row)}
                        className="w-full py-1.5 rounded-lg text-xs font-black transition-all"
                        style={{ background: "#ff6a0015", border: "1px solid #ff6a0025", color: "#ff6a00" }}>
                        + Adicionar a Loja
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && activeItem && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#0d0d10] border border-[#252528] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#1a1a1a]">
              {activeItem.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeItem.image_url} alt="" className="w-12 h-12 object-contain flex-shrink-0" />
              )}
              <div>
                <h2 className="text-lg font-black text-white">{modal === "edit" ? "Editar Listagem" : "Adicionar a Loja"}</h2>
                <p className="text-[#555] text-sm">{activeItem.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs text-[#666] mb-1.5 block font-bold">Preco Override (vazio = base 💵{activeItem.base_price.toLocaleString()})</span>
                <input type="number" value={form.price_override}
                  onChange={e => setForm(f => ({ ...f, price_override: e.target.value }))}
                  placeholder={String(activeItem.base_price)}
                  className="w-full bg-[#0a0a0c] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#ff6a00] transition-colors" />
              </label>
              <label className="block">
                <span className="text-xs text-[#666] mb-1.5 block font-bold">Stock (vazio = infinito)</span>
                <input type="number" value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="infinito"
                  className="w-full bg-[#0a0a0c] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#ff6a00] transition-colors" />
              </label>
              <label className="block">
                <span className="text-xs text-[#666] mb-1.5 block font-bold">Tipo de Rotacao</span>
                <select value={form.rotation_type}
                  onChange={e => setForm(f => ({ ...f, rotation_type: e.target.value }))}
                  className="w-full bg-[#0a0a0c] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#ff6a00] transition-colors">
                  {ROTATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {form.rotation_type !== "permanent" && (
                <label className="block">
                  <span className="text-xs text-[#666] mb-1.5 block font-bold">Data de Fim</span>
                  <input type="datetime-local" value={form.rotation_ends_at}
                    onChange={e => setForm(f => ({ ...f, rotation_ends_at: e.target.value }))}
                    className="w-full bg-[#0a0a0c] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#ff6a00] transition-colors" />
                </label>
              )}
              <Toggle value={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} />
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-[#888] text-sm font-semibold hover:bg-[#222] transition-colors border border-[#222]">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-black disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, #ff6a00, #ee0979)" }}>
                {saving ? "A guardar..." : modal === "edit" ? "Guardar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0d10] border border-red-900/40 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-5">
              <p className="text-3xl mb-3">🗑️</p>
              <p className="text-white font-black text-base">Remover da loja?</p>
              <p className="text-[#555] text-xs mt-1">"{confirmRemove.name}" sai da loja mas nao e eliminado.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold border border-[#222]">Cancelar</button>
              <button onClick={() => handleRemove(confirmRemove)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black transition-colors">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
