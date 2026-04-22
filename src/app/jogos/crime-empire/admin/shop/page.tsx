"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

type Item = {
  id: string; name: string; description: string; category: string; rarity: string; base_price: number; image_url: string | null;
};
type Listing = {
  id: string; item_id: string; price_override: number | null; stock: number | null;
  rotation_type: string; rotation_ends_at: string | null; enabled: boolean;
};
type Row = Item & { listing: Listing | null };

const RARITY_COLOR: Record<string, string> = {
  common: "text-[#888]", rare: "text-blue-400", epic: "text-purple-400", legendary: "text-yellow-400",
};
const ROTATION_TYPES = ["permanent", "daily", "weekly"];
const BLANK_LISTING = { price_override: "", stock: "", rotation_type: "permanent", rotation_ends_at: "", enabled: true };

export default function ShopAdminPage() {
  const [rows, setRows]       = useState<Row[]>([]);
  const [q, setQ]             = useState("");
  const [catFilter, setCat]   = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal]     = useState<"add" | "edit" | null>(null);
  const [activeItem, setActiveItem]   = useState<Item | null>(null);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [form, setForm]       = useState<typeof BLANK_LISTING>(BLANK_LISTING);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Row | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, shopRes] = await Promise.all([
      fetch("/api/admin/crime-empire/items?page=1&limit=500"),
      fetch("/api/admin/crime-empire/shop"),
    ]);
    const itemsData = await itemsRes.json();
    const shopData  = await shopRes.json();

    const listingMap: Record<string, Listing> = {};
    for (const l of (shopData.listings || [])) {
      listingMap[l.item_id] = { id: l.id, item_id: l.item_id, price_override: l.price_override, stock: l.stock, rotation_type: l.rotation_type, rotation_ends_at: l.rotation_ends_at, enabled: l.enabled };
    }
    const merged: Row[] = (itemsData.items || []).map((item: Item) => ({
      ...item,
      listing: listingMap[item.id] ?? null,
    }));
    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    const matchQ   = !q   || r.name.toLowerCase().includes(q.toLowerCase());
    const matchCat = !catFilter || r.category === catFilter;
    return matchQ && matchCat;
  });

  const categories = [...new Set(rows.map(r => r.category))].sort();

  const openAdd = (row: Row) => {
    setActiveItem(row);
    setActiveListing(null);
    setForm(BLANK_LISTING);
    setModal("add");
  };

  const openEdit = (row: Row) => {
    if (!row.listing) return;
    setActiveItem(row);
    setActiveListing(row.listing);
    setForm({
      price_override: row.listing.price_override != null ? String(row.listing.price_override) : "",
      stock: row.listing.stock != null ? String(row.listing.stock) : "",
      rotation_type: row.listing.rotation_type,
      rotation_ends_at: row.listing.rotation_ends_at ? row.listing.rotation_ends_at.slice(0, 16) : "",
      enabled: row.listing.enabled,
    });
    setModal("edit");
  };

  const closeModal = () => { setModal(null); setActiveItem(null); setActiveListing(null); };

  const handleSave = async () => {
    if (!activeItem) return;
    setSaving(true);
    const payload = {
      item_id: activeItem.id,
      price_override: form.price_override !== "" ? Number(form.price_override) : null,
      stock: form.stock !== "" ? Number(form.stock) : null,
      rotation_type: form.rotation_type,
      rotation_ends_at: form.rotation_ends_at || null,
      enabled: form.enabled,
    };
    const isEdit = modal === "edit" && activeListing;
    const res = await fetch(
      isEdit ? `/api/admin/crime-empire/shop/${activeListing.id}` : "/api/admin/crime-empire/shop",
      { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    const data = await res.json();
    setSaving(false);
    if (!data.error) {
      showToast(isEdit ? "Listagem atualizada!" : "Item adicionado a loja!");
      closeModal();
      load();
    } else showToast(data.error || "Erro", false);
  };

  const handleRemove = async (row: Row) => {
    if (!row.listing) return;
    const res = await fetch(`/api/admin/crime-empire/shop/${row.listing.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { showToast("Removido da loja"); load(); }
    else showToast(data.error || "Erro", false);
    setConfirmRemove(null);
  };

  const toggleEnabled = async (row: Row) => {
    if (!row.listing) return;
    await fetch(`/api/admin/crime-empire/shop/${row.listing.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !row.listing.enabled }),
    });
    load();
  };

  const inShop  = rows.filter(r => r.listing).length;
  const notShop = rows.filter(r => !r.listing).length;

  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-white">Loja do Chines - Admin</h1>
          <p className="text-[#555] text-sm">
            <span className="text-green-400 font-bold">{inShop} na loja</span>
            <span className="mx-2 text-[#333]">.</span>
            <span className="text-[#666]">{notShop} fora da loja</span>
            <span className="mx-2 text-[#333]">.</span>
            {rows.length} itens total
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar..."
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[200px]" />
        <select value={catFilter} onChange={e => setCat(e.target.value)}
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-right px-4 py-3">Preco Base</th>
              <th className="text-right px-4 py-3">Preco Loja</th>
              <th className="text-right px-4 py-3">Stock</th>
              <th className="text-center px-4 py-3">Na Loja</th>
              <th className="text-center px-4 py-3">Visivel</th>
              <th className="text-right px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-[#444]">A carregar...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-[#444]">Sem resultados</td></tr>
            ) : filtered.map(row => (
              <tr key={row.id} className={`border-b border-[#151515] hover:bg-[#141414] transition-colors ${!row.listing ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.image_url} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-white font-medium">{row.name}</p>
                      <p className={`text-xs font-bold ${RARITY_COLOR[row.rarity] || "text-[#888]"}`}>{row.rarity}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#888] text-xs">{row.category}</td>
                <td className="px-4 py-3 text-right text-[#555]">💵 {row.base_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-400 text-xs">
                  {row.listing?.price_override != null ? `💵 ${row.listing.price_override.toLocaleString()}` : <span className="text-[#333]">-</span>}
                </td>
                <td className="px-4 py-3 text-right text-[#888] text-xs">
                  {row.listing ? (row.listing.stock != null ? row.listing.stock : <span className="text-[#555]">inf</span>) : <span className="text-[#333]">-</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${row.listing ? "bg-green-600/20 text-green-400" : "bg-[#1a1a1a] text-[#444]"}`}>
                    {row.listing ? "SIM" : "NAO"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {row.listing ? (
                    <button onClick={() => toggleEnabled(row)}
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${row.listing.enabled ? "bg-green-600/20 text-green-400" : "bg-[#1a1a1a] text-[#444]"}`}>
                      {row.listing.enabled ? "ON" : "OFF"}
                    </button>
                  ) : <span className="text-[#333]">-</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    {row.listing ? (
                      <>
                        <button onClick={() => openEdit(row)} className="text-xs px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white">Editar</button>
                        <button onClick={() => setConfirmRemove(row)} className="text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400">Remover</button>
                      </>
                    ) : (
                      <button onClick={() => openAdd(row)} className="text-xs px-2 py-1 rounded bg-[#ff6a00]/20 hover:bg-[#ff6a00]/40 text-[#ff6a00] font-bold">+ Loja</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && activeItem && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-white mb-1">{modal === "edit" ? "Editar" : "Adicionar a Loja"}</h2>
            <p className="text-[#555] text-sm mb-5">{activeItem.name} · <span className={RARITY_COLOR[activeItem.rarity]}>{activeItem.rarity}</span></p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-[#666] mb-1 block">Preco Override (vazio = usa preco base de 💵{activeItem.base_price.toLocaleString()})</span>
                <input type="number" value={form.price_override} onChange={e => setForm(f => ({ ...f, price_override: e.target.value }))}
                  placeholder={String(activeItem.base_price)}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
              </label>
              <label className="block">
                <span className="text-xs text-[#666] mb-1 block">Stock (vazio = infinito)</span>
                <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="infinito"
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
              </label>
              <label className="block">
                <span className="text-xs text-[#666] mb-1 block">Tipo de Rotacao</span>
                <select value={form.rotation_type} onChange={e => setForm(f => ({ ...f, rotation_type: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                  {ROTATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {form.rotation_type !== "permanent" && (
                <label className="block">
                  <span className="text-xs text-[#666] mb-1 block">Data de fim de rotacao</span>
                  <input type="datetime-local" value={form.rotation_ends_at} onChange={e => setForm(f => ({ ...f, rotation_ends_at: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                </label>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4 accent-[#ff6a00]" />
                <span className="text-sm text-[#888]">Visivel na loja</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg bg-[#1a1a1a] text-[#888] text-sm font-semibold">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#ff6a00] text-white text-sm font-bold disabled:opacity-50">
                {saving ? "A guardar..." : modal === "edit" ? "Guardar" : "Adicionar a Loja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-900/50 rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-white font-bold mb-1">Remover "{confirmRemove.name}" da loja?</h3>
            <p className="text-[#555] text-xs mb-4">O item continua a existir, apenas sai da loja.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-white text-sm">Cancelar</button>
              <button onClick={() => handleRemove(confirmRemove)} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
