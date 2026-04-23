"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CEToast } from "@/components/CEToast";

type Item = {
  id: string; name: string; description: string; category: string; rarity: string;
  power_bonus: number; intelligence_bonus: number; charisma_bonus: number;
  hp_bonus: number; stamina_restore: number; base_price: number; tradeable: boolean;
  image_url: string;
};

type ImageManifest = Record<string, string[]>;

const CATEGORIES = ["weapon","armor","consumable","special","material","drug"];
const RARITIES   = ["common","rare","epic","legendary"];

const RARITY_COLOR: Record<string,string> = {
  common:"text-[#888]", rare:"text-blue-400", epic:"text-purple-400", legendary:"text-yellow-400"
};

const BLANK: Partial<Item> = {
  name:"", description:"", category:"weapon", rarity:"common",
  power_bonus:0, intelligence_bonus:0, charisma_bonus:0, hp_bonus:0,
  stamina_restore:0, base_price:100, tradeable:true, image_url:"",
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

  // Image picker state
  const [manifest, setManifest]         = useState<ImageManifest | null>(null);
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [pickerCat, setPickerCat]       = useState("");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState("");

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  // Load image manifest once
  useEffect(() => {
    fetch("/images/crime_empire/items/manifest.json")
      .then((r) => r.json())
      .then((data: ImageManifest) => setManifest(data))
      .catch(() => {/* non-critical */});
  }, []);

  const pickerImages = useMemo(() => {
    if (!manifest || !pickerCat) return [];
    const files = manifest[pickerCat] || [];
    if (!pickerSearch.trim()) return files;
    const lq = pickerSearch.toLowerCase();
    return files.filter((f) => f.toLowerCase().includes(lq));
  }, [manifest, pickerCat, pickerSearch]);

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
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt="" className="w-7 h-7 object-contain rounded bg-[#1a1a1a] flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-[#1a1a1a] flex-shrink-0" />
                    )}
                    <span className="text-white font-medium">{item.name}</span>
                  </div>
                </td>
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

              {/* Image picker trigger */}
              <div>
                <span className="text-xs text-[#666] mb-2 block">Imagem</span>
                <div className="flex items-center gap-2">
                  {form.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image_url} alt="" className="w-10 h-10 rounded-lg object-contain bg-[#1a1a1a] border border-[#333] flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[#444] text-lg flex-shrink-0">?</div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPickerSelected(form.image_url || "");
                      setPickerSearch("");
                      if (manifest) setPickerCat(Object.keys(manifest).sort()[0] || "");
                      setPickerOpen(true);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] text-white border border-[#333] transition-all"
                  >
                    🖼️ Escolher Imagem
                  </button>
                  {form.image_url && (
                    <button type="button" onClick={() => setForm(f => ({...f, image_url: ""}))}
                      className="text-xs px-2 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all">
                      ✕ Limpar
                    </button>
                  )}
                </div>
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

      {/* Image Picker Overlay */}
      {pickerOpen && (
        <div className="fixed top-16 left-56 right-0 bottom-0 z-[200] bg-[#080808]" style={{display:"flex",flexDirection:"column"}}>

          {/* Header */}
          <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[#1e1e1e]">
            <h3 className="text-white font-black text-sm flex-1">🖼️ Escolher Imagem</h3>
            <input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Pesquisar ficheiro…"
              className="bg-[#0e0e0e] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-white w-52"
            />
            <button onClick={() => setPickerOpen(false)} className="text-[#555] hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded transition-colors">✕</button>
          </div>

          {/* Body — min-h-0 is required so flex children can scroll */}
          <div className="flex min-h-0" style={{flex:1}}>

            {/* Category sidebar */}
            <div className="flex-shrink-0 w-52 border-r border-[#2a2a2a] overflow-y-auto bg-[#0a0a0a]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff6a00] px-4 pt-3 pb-2 border-b border-[#1e1e1e]">Categorias</p>
              <div className="p-2 space-y-0.5">
              {manifest && Object.keys(manifest).sort().map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setPickerCat(cat); setPickerSearch(""); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all capitalize flex items-center justify-between ${
                    pickerCat === cat
                      ? "bg-[#ff6a00] text-white font-bold"
                      : "text-[#aaa] hover:text-white hover:bg-[#1e1e1e]"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] ml-2 flex-shrink-0 ${pickerCat === cat ? "text-white/70" : "text-[#555]"}`}>
                    {(manifest[cat] || []).length}
                  </span>
                </button>
              ))}
              </div>
            </div>

            {/* Images grid */}
            <div className="flex-1 overflow-y-auto p-4 min-w-0">
              {!pickerCat ? (
                <p className="text-[#444] text-center py-20 text-sm">← Seleciona uma categoria à esquerda</p>
              ) : pickerImages.length === 0 ? (
                <p className="text-[#333] text-center py-20 text-sm">Sem resultados para &quot;{pickerSearch}&quot;</p>
              ) : (
                <>
                  <p className="text-[#555] text-xs mb-3">{pickerImages.length} imagens{pickerImages.length > 300 ? " (a mostrar 300)" : ""}</p>
                  <div className="grid gap-2" style={{gridTemplateColumns:"repeat(auto-fill,minmax(64px,1fr))"}}>
                    {pickerImages.slice(0, 300).map((filename) => {
                      const url = `/images/crime_empire/items/${encodeURIComponent(pickerCat)}/${encodeURIComponent(filename)}`;
                      const isCurrent = pickerSelected === url;
                      return (
                        <button
                          key={filename}
                          title={filename.replace(/\.[^.]+$/, "")}
                          onClick={() => setPickerSelected(url)}
                          className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex items-center justify-center p-1 bg-[#111] hover:border-[#ff6a00] ${
                            isCurrent ? "border-[#ff6a00] ring-2 ring-[#ff6a00]/40" : "border-[#1e1e1e]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={filename} className="w-full h-full object-contain" loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer — confirm bar */}
          <div className="flex-shrink-0 border-t border-[#1e1e1e] px-5 py-3 flex items-center gap-4 bg-[#0a0a0a]">
            {pickerSelected ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pickerSelected} alt="" className="w-12 h-12 object-contain rounded-lg bg-[#1a1a1a] border border-[#333] flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#333] flex-shrink-0" />
            )}
            <span className="text-sm text-[#555] flex-1 truncate">
              {pickerSelected ? pickerSelected.split("/").pop()?.replace(/\.[^.]+$/, "") : "Nenhuma imagem selecionada"}
            </span>
            <button
              onClick={() => setPickerOpen(false)}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-[#888] text-sm hover:bg-[#222] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => { setForm(f => ({...f, image_url: pickerSelected})); setPickerOpen(false); }}
              disabled={!pickerSelected}
              className="px-5 py-2 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white text-sm font-bold disabled:opacity-40 transition-all"
            >
              ✓ Usar esta imagem
            </button>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-900/50 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <h3 className="text-white font-bold mb-1">Eliminar &quot;{confirmDelete.name}&quot;?</h3>
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
