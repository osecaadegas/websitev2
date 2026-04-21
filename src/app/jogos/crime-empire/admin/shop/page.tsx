"use client";

import { useEffect, useState, useCallback } from "react";

type ShopItem = {
  id:string; item_id:string; item_name:string; item_category:string; item_rarity:string;
  item_base_price:number; price_override:number|null; stock:number|null;
  rotation_type:string; rotation_ends_at:string|null; enabled:boolean; created_at:string;
};

type Item = { id:string; name:string; category:string; rarity:string; base_price:number };

const RARITY_COLOR: Record<string,string> = {
  common:"text-[#888]", rare:"text-blue-400", epic:"text-purple-400", legendary:"text-yellow-400"
};
const ROTATION_TYPES = ["permanent","daily","weekly"];

const BLANK = { item_id:"", price_override:"", stock:"", rotation_type:"permanent", rotation_ends_at:"", enabled:true };

export default function ShopAdminPage() {
  const [listings, setListings] = useState<ShopItem[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState<"create"|"edit"|null>(null);
  const [form, setForm]         = useState<typeof BLANK & {id?:string}>(BLANK);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<{msg:string;ok:boolean}|null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShopItem|null>(null);

  // Item search for create modal
  const [itemQ, setItemQ]         = useState("");
  const [itemResults, setItemResults] = useState<Item[]>([]);
  const [selectedItem, setSelected]   = useState<Item|null>(null);

  const showToast = (msg:string,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/crime-empire/shop");
    const data = await res.json();
    setListings(data.listings||[]); setTotal(data.total||0); setLoading(false);
  },[]);

  useEffect(()=>{ load(); },[load]);

  // Search items for picker
  useEffect(()=>{
    if (!itemQ || itemQ.length<2) { setItemResults([]); return; }
    const timer = setTimeout(async ()=>{
      const res = await fetch(`/api/admin/crime-empire/items?q=${encodeURIComponent(itemQ)}&page=1`);
      const data = await res.json();
      setItemResults(data.items||[]);
    },300);
    return ()=>clearTimeout(timer);
  },[itemQ]);

  const openCreate = () => { setForm(BLANK); setSelected(null); setItemQ(""); setModal("create"); };
  const openEdit = (l:ShopItem) => {
    setForm({
      id:l.id, item_id:l.item_id, price_override:l.price_override!=null?String(l.price_override):"",
      stock:l.stock!=null?String(l.stock):"", rotation_type:l.rotation_type,
      rotation_ends_at:l.rotation_ends_at?l.rotation_ends_at.slice(0,16):"", enabled:l.enabled,
    });
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setForm(BLANK); setSelected(null); setItemQ(""); };

  const handleSave = async () => {
    setSaving(true);
    const isEdit = modal==="edit";
    const payload = {
      item_id: isEdit?form.item_id:selectedItem?.id,
      price_override: form.price_override!==""?Number(form.price_override):null,
      stock: form.stock!==""?Number(form.stock):null,
      rotation_type: form.rotation_type,
      rotation_ends_at: form.rotation_ends_at||null,
      enabled: form.enabled,
    };
    const res = await fetch(
      isEdit?`/api/admin/crime-empire/shop/${form.id}`:"/api/admin/crime-empire/shop",
      {method:isEdit?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}
    );
    const data = await res.json(); setSaving(false);
    if (data.listing) { showToast(isEdit?"Listagem atualizada!":"Listagem criada!"); closeModal(); load(); }
    else showToast(data.error||"Erro",false);
  };

  const handleDelete = async (l:ShopItem) => {
    const res = await fetch(`/api/admin/crime-empire/shop/${l.id}`,{method:"DELETE"});
    const data = await res.json();
    if (data.success) { showToast("Removido da loja"); load(); }
    else showToast(data.error||"Erro",false);
    setConfirmDelete(null);
  };

  const toggleEnabled = async (l:ShopItem) => {
    await fetch(`/api/admin/crime-empire/shop/${l.id}`,{
      method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:!l.enabled})
    });
    load();
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.ok?"bg-green-600":"bg-red-600"} text-white`}>
          {toast.msg}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">🛒 Loja do Chinês — Admin</h1>
          <p className="text-[#555] text-sm">{total} itens em loja</p>
        </div>
        <button onClick={openCreate} className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
          + Adicionar Item
        </button>
      </div>

      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-right px-4 py-3">Preço Base</th>
              <th className="text-right px-4 py-3">Preço Override</th>
              <th className="text-right px-4 py-3">Stock</th>
              <th className="text-left px-4 py-3">Rotação</th>
              <th className="text-center px-4 py-3">Ativo</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-[#444]">A carregar…</td></tr>
            ) : listings.length===0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-[#444]">Nenhum item em loja</td></tr>
            ) : listings.map(l=>(
              <tr key={l.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{l.item_name}</p>
                  <p className={`text-xs font-bold ${RARITY_COLOR[l.item_rarity]||"text-[#888]"}`}>{l.item_rarity}</p>
                </td>
                <td className="px-4 py-3 text-[#888]">{l.item_category}</td>
                <td className="px-4 py-3 text-right text-[#555]">💵 {l.item_base_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-400">
                  {l.price_override!=null?`💵 ${l.price_override.toLocaleString()}`:<span className="text-[#333]">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-[#888]">
                  {l.stock!=null?l.stock:<span className="text-[#555]">∞</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#666]">{l.rotation_type}</span>
                  {l.rotation_ends_at && (
                    <p className="text-xs text-[#333] mt-0.5">{new Date(l.rotation_ends_at).toLocaleDateString("pt-PT")}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={()=>toggleEnabled(l)}
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${l.enabled?"bg-green-600/20 text-green-400":"bg-[#1a1a1a] text-[#444]"}`}>
                    {l.enabled?"ON":"OFF"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={()=>openEdit(l)} className="text-xs px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white">Editar</button>
                    <button onClick={()=>setConfirmDelete(l)} className="text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400">Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <h2 className="text-lg font-black text-white mb-5">{modal==="edit"?"Editar":"Adicionar"} Item na Loja</h2>
            <div className="space-y-3">

              {/* Item picker — only on create */}
              {modal==="create" && (
                <div>
                  <span className="text-xs text-[#666] mb-1 block">Item</span>
                  {selectedItem ? (
                    <div className="flex items-center justify-between bg-[#141414] border border-[#333] rounded-lg px-3 py-2">
                      <div>
                        <p className="text-white text-sm font-medium">{selectedItem.name}</p>
                        <p className={`text-xs font-bold ${RARITY_COLOR[selectedItem.rarity]||"text-[#888]"}`}>{selectedItem.rarity}</p>
                      </div>
                      <button onClick={()=>{setSelected(null);setItemQ("");}} className="text-[#444] hover:text-red-400 text-xs">✕</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input value={itemQ} onChange={e=>setItemQ(e.target.value)} placeholder="Pesquisar item…"
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
                      {itemResults.length>0 && (
                        <div className="absolute top-full left-0 right-0 bg-[#0e0e0e] border border-[#333] rounded-lg mt-1 z-10 max-h-40 overflow-y-auto">
                          {itemResults.map(item=>(
                            <button key={item.id} onClick={()=>{setSelected(item);setItemQ("");setItemResults([]);}}
                              className="w-full text-left px-3 py-2 hover:bg-[#1a1a1a] border-b border-[#1a1a1a] last:border-0">
                              <p className="text-white text-sm">{item.name}</p>
                              <p className="text-[#444] text-xs">{item.category} · {item.rarity} · 💵{item.base_price.toLocaleString()}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <label className="block">
                <span className="text-xs text-[#666] mb-1 block">Preço Override (deixar vazio = usa preço base)</span>
                <input type="number" value={form.price_override} onChange={e=>setForm(f=>({...f,price_override:e.target.value}))}
                  placeholder="ex: 500"
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
              </label>

              <label className="block">
                <span className="text-xs text-[#666] mb-1 block">Stock (deixar vazio = infinito)</span>
                <input type="number" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))}
                  placeholder="ex: 10"
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
              </label>

              <label className="block">
                <span className="text-xs text-[#666] mb-1 block">Tipo de Rotação</span>
                <select value={form.rotation_type} onChange={e=>setForm(f=>({...f,rotation_type:e.target.value}))}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                  {ROTATION_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              {form.rotation_type!=="permanent" && (
                <label className="block">
                  <span className="text-xs text-[#666] mb-1 block">Data de fim de rotação</span>
                  <input type="datetime-local" value={form.rotation_ends_at} onChange={e=>setForm(f=>({...f,rotation_ends_at:e.target.value}))}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
                </label>
              )}

              <label className="block">
                <span className="text-xs text-[#666] mb-2 block">Visível na loja</span>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.enabled} onChange={e=>setForm(f=>({...f,enabled:e.target.checked}))} className="w-4 h-4 accent-[#ff6a00]"/>
                  <span className="text-sm text-[#888]">Ativo</span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg bg-[#1a1a1a] text-[#888] text-sm font-semibold">Cancelar</button>
              <button onClick={handleSave} disabled={saving||(modal==="create"&&!selectedItem)}
                className="flex-1 py-2.5 rounded-lg bg-[#ff6a00] text-white text-sm font-bold disabled:opacity-50">
                {saving?"A guardar…":modal==="edit"?"Guardar":"Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-900/50 rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-white font-bold mb-1">Remover "{confirmDelete.item_name}" da loja?</h3>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setConfirmDelete(null)} className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-white text-sm">Cancelar</button>
              <button onClick={()=>handleDelete(confirmDelete)} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
