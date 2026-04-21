"use client";

import { useEffect, useState, useCallback } from "react";

type Item = {
  id: string; name: string; description: string; category: string; rarity: string;
  power_bonus: number; intelligence_bonus: number; charisma_bonus: number;
  hp_bonus: number; stamina_restore: number; base_price: number; tradeable: boolean;
};

const CATEGORIES = ["weapon","armor","consumable","special","material"];
const RARITIES   = ["common","rare","epic","legendary"];

const RARITY_COLOR: Record<string,string> = {
  common:"text-[#888]", rare:"text-blue-400", epic:"text-purple-400", legendary:"text-yellow-400"
};

const BLANK: Partial<Item> = {
  name:"", description:"", category:"weapon", rarity:"common",
  power_bonus:0, intelligence_bonus:0, charisma_bonus:0, hp_bonus:0,
  stamina_restore:0, base_price:100, tradeable:true,
};

export default function ItemsAdminPage() {
  const [items, setItems]       = useState<Item[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState<"create"|"edit"|null>(null);
  const [form, setForm]         = useState<Partial<Item>>(BLANK);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<{msg:string;ok:boolean}|null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item|null>(null);

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), q, ...(catFilter && { category: catFilter }) });
    const res = await fetch(`/api/admin/crime-empire/items?${params}`);
    const data = await res.json();
    setItems(data.items || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, q, catFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(BLANK); setModal("create"); };
  const openEdit   = (item: Item) => { setForm({...item}); setModal("edit"); };
  const closeModal = () => { setModal(null); setForm(BLANK); };

  const handleSave = async () => {
    setSaving(true);
    const isEdit = modal === "edit";
    const url  = isEdit ? `/api/admin/crime-empire/items/${form.id}` : "/api/admin/crime-empire/items";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(form) });
    const data = await res.json();
    setSaving(false);
    if (data.item) {
      showToast(isEdit ? "Item atualizado!" : "Item criado!");
      closeModal();
      load();
    } else {
      showToast(data.error || "Erro", false);
    }
  };

  const handleDelete = async (item: Item) => {
    const res = await fetch(`/api/admin/crime-empire/items/${item.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { showToast("Item eliminado"); load(); }
    else showToast(data.error || "Erro", false);
    setConfirmDelete(null);
  };

  const field = (key: keyof Item, label: string, type="text", opts?: string[]) => (
    <label className="block">
      <span className="text-xs text-[#666] mb-1 block">{label}</span>
      {opts ? (
        <select
          value={String(form[key] ?? "")}
          onChange={(e) => setForm((f) => ({...f,[key]:e.target.value}))}
          className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
        >
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "checkbox" ? (
        <input
          type="checkbox"
          checked={Boolean(form[key])}
          onChange={(e) => setForm((f) => ({...f,[key]:e.target.checked}))}
          className="mt-1"
        />
      ) : (
        <input
          type={type}
          value={String(form[key] ?? "")}
          onChange={(e) => setForm((f) => ({...f,[key]:type==="number"?Number(e.target.value):e.target.value}))}
          className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
        />
      )}
    </label>
  );

  return (
    <div>
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.ok?"bg-green-600":"bg-red-600"} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">⚔️ Items</h1>
          <p className="text-[#555] text-sm">{total} items no total</p>
        </div>
        <button onClick={openCreate} className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
          + Novo Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Pesquisar por nome…"
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[200px]"
        />
        <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-left px-4 py-3">Raridade</th>
              <th className="text-right px-4 py-3">Preço</th>
              <th className="text-right px-4 py-3">Stats</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-[#444]">A carregar…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[#444]">Nenhum item encontrado</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors">
                <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                <td className="px-4 py-3 text-[#888]">{item.category}</td>
                <td className={`px-4 py-3 font-bold ${RARITY_COLOR[item.rarity] || "text-[#888]"}`}>{item.rarity}</td>
                <td className="px-4 py-3 text-right text-green-400 font-mono">💵 {item.base_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-xs text-[#555]">
                  {[
                    item.power_bonus        && `⚔️${item.power_bonus}`,
                    item.intelligence_bonus && `🧠${item.intelligence_bonus}`,
                    item.charisma_bonus     && `✨${item.charisma_bonus}`,
                    item.hp_bonus           && `❤️${item.hp_bonus}`,
                    item.stamina_restore    && `⚡${item.stamina_restore}`,
                  ].filter(Boolean).join(" ") || "–"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(item)} className="text-xs px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white transition-all">Editar</button>
                    <button onClick={() => setConfirmDelete(item)} className="text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-all">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e1e]">
            <span className="text-xs text-[#444]">Página {page} de {Math.ceil(total/50)}</span>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">← Anterior</button>
              <button disabled={page*50>=total} onClick={()=>setPage(p=>p+1)} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">Próxima →</button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
            <h2 className="text-lg font-black text-white mb-5">{modal==="edit"?"Editar":"Criar"} Item</h2>
            <div className="space-y-3">
              {field("name", "Nome")}
              {field("description", "Descrição")}
              <div className="grid grid-cols-2 gap-3">
                {field("category", "Categoria", "text", CATEGORIES)}
                {field("rarity", "Raridade", "text", RARITIES)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field("base_price", "Preço Base", "number")}
                <label className="block">
                  <span className="text-xs text-[#666] mb-1 block">Comercializável</span>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={Boolean(form.tradeable)} onChange={(e)=>setForm(f=>({...f,tradeable:e.target.checked}))} className="w-4 h-4 accent-[#ff6a00]"/>
                    <span className="text-sm text-[#888]">Sim</span>
                  </div>
                </label>
              </div>
              <p className="text-xs text-[#444] uppercase tracking-widest pt-2">Bónus de Stats</p>
              <div className="grid grid-cols-3 gap-2">
                {field("power_bonus","⚔️ Força","number")}
                {field("intelligence_bonus","🧠 Intel.","number")}
                {field("charisma_bonus","✨ Carisma","number")}
                {field("hp_bonus","❤️ HP","number")}
                {field("stamina_restore","⚡ Stamina","number")}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg bg-[#1a1a1a] text-[#888] text-sm font-semibold hover:bg-[#222]">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#ff6a00] text-white text-sm font-bold hover:bg-[#ff8533] disabled:opacity-50">
                {saving?"A guardar…":modal==="edit"?"Guardar":"Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-900/50 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <h3 className="text-white font-bold mb-1">Eliminar "{confirmDelete.name}"?</h3>
            <p className="text-[#555] text-sm mb-5">Esta ação não pode ser revertida.</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmDelete(null)} className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-white text-sm">Cancelar</button>
              <button onClick={()=>handleDelete(confirmDelete)} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
