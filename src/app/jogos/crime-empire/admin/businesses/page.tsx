"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

type Business = {
  id:string; name:string; type:string; description:string; purchase_price:number;
  base_income_per_hour:number; max_employees:number; employee_cost_per_hour:number;
  required_level:number; required_items:any[]; raid_risk:number; enabled:boolean;
};
type ItemOption = { id:string; name:string; image_url:string|null; category:string };
type InputItem  = { id:string; item_id:string; quantity_per_hour:number; items:ItemOption };
type OutputItem = { id:string; item_id:string; quantity_per_hour:number; drop_chance:number; items:ItemOption };

const BLANK: Partial<Business> = {
  name:"", type:"", description:"", purchase_price:0, base_income_per_hour:0,
  max_employees:5, employee_cost_per_hour:0, required_level:1,
  required_items:[], raid_risk:0.05, enabled:true,
};

export default function BusinessesAdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [q, setQ]                   = useState("");
  const [loading, setLoading]       = useState(false);
  const [modal, setModal]           = useState<"create"|"edit"|null>(null);
  const [form, setForm]             = useState<Partial<Business>>(BLANK);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<{msg:string;ok:boolean}|null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Business|null>(null);

  // Input/output items state
  const [allItems, setAllItems]           = useState<ItemOption[]>([]);
  const [inputs, setInputs]               = useState<InputItem[]>([]);
  const [outputs, setOutputs]             = useState<OutputItem[]>([]);
  const [ioLoading, setIoLoading]         = useState(false);
  const [inSearch, setInSearch]           = useState("");
  const [inItemId, setInItemId]           = useState("");
  const [inQty, setInQty]                 = useState("1");
  const [outSearch, setOutSearch]         = useState("");
  const [outItemId, setOutItemId]         = useState("");
  const [outQty, setOutQty]               = useState("1");
  const [outChance, setOutChance]         = useState("100");

  const showToast = (msg:string,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const loadAllItems = useCallback(async () => {
    const res = await fetch("/api/admin/crime-empire/items?page=1&limit=500");
    const data = await res.json();
    setAllItems(data.items || []);
  }, []);

  const loadIO = useCallback(async (bizId:string) => {
    setIoLoading(true);
    const [inRes, outRes] = await Promise.all([
      fetch(`/api/admin/crime-empire/businesses/${bizId}/inputs`),
      fetch(`/api/admin/crime-empire/businesses/${bizId}/outputs`),
    ]);
    const inData  = await inRes.json();
    const outData = await outRes.json();
    setInputs(inData.inputs   || []);
    setOutputs(outData.outputs || []);
    setIoLoading(false);
  }, []);

  const addInput = async () => {
    if (!inItemId || !form.id) return;
    const res = await fetch(`/api/admin/crime-empire/businesses/${form.id}/inputs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: inItemId, quantity_per_hour: parseFloat(inQty) || 1 }),
    });
    const data = await res.json();
    if (data.input) { setInputs(p => [...p.filter(x => x.item_id !== inItemId), data.input]); setInItemId(""); setInSearch(""); setInQty("1"); showToast("Item de entrada adicionado!"); }
    else showToast(data.error || "Erro", false);
  };

  const removeInput = async (id:string) => {
    if (!form.id) return;
    const res = await fetch(`/api/admin/crime-empire/businesses/${form.id}/inputs/${id}`, { method: "DELETE" });
    if (res.ok) { setInputs(p => p.filter(x => x.id !== id)); showToast("Input removido"); }
    else showToast("Erro ao remover", false);
  };

  const addOutput = async () => {
    if (!outItemId || !form.id) return;
    const chance = Math.max(1, Math.min(100, parseFloat(outChance) || 100)) / 100;
    const res = await fetch(`/api/admin/crime-empire/businesses/${form.id}/outputs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: outItemId, quantity_per_hour: parseFloat(outQty) || 1, drop_chance: chance }),
    });
    const data = await res.json();
    if (data.output) { setOutputs(p => [...p.filter(x => x.item_id !== outItemId), data.output]); setOutItemId(""); setOutSearch(""); setOutQty("1"); setOutChance("100"); showToast("Item de saída adicionado!"); }
    else showToast(data.error || "Erro", false);
  };

  const removeOutput = async (id:string) => {
    if (!form.id) return;
    const res = await fetch(`/api/admin/crime-empire/businesses/${form.id}/outputs/${id}`, { method: "DELETE" });
    if (res.ok) { setOutputs(p => p.filter(x => x.id !== id)); showToast("Output removido"); }
    else showToast("Erro ao remover", false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page:String(page), q });
    const res = await fetch(`/api/admin/crime-empire/businesses?${params}`);
    const data = await res.json();
    setBusinesses(data.businesses||[]); setTotal(data.total||0); setLoading(false);
  },[page,q]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ loadAllItems(); },[loadAllItems]);

  const openCreate = () => { setForm(BLANK); setInputs([]); setOutputs([]); setModal("create"); };
  const openEdit = (b:Business) => { setForm({...b}); loadIO(b.id); setModal("edit"); };
  const closeModal = () => { setModal(null); setForm(BLANK); };

  const handleSave = async () => {
    setSaving(true);
    const isEdit = modal==="edit";
    const res = await fetch(
      isEdit?`/api/admin/crime-empire/businesses/${form.id}`:"/api/admin/crime-empire/businesses",
      {method:isEdit?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}
    );
    const data = await res.json(); setSaving(false);
    if (data.business) { showToast(isEdit?"Negócio atualizado!":"Negócio criado!"); closeModal(); load(); }
    else showToast(data.error||"Erro",false);
  };

  const handleDelete = async (b:Business) => {
    const res = await fetch(`/api/admin/crime-empire/businesses/${b.id}`,{method:"DELETE"});
    const data = await res.json();
    if (data.success) { showToast("Negócio eliminado"); load(); }
    else showToast(data.error||"Erro",false);
    setConfirmDelete(null);
  };

  const toggleEnabled = async (b:Business) => {
    await fetch(`/api/admin/crime-empire/businesses/${b.id}`,{
      method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:!b.enabled})
    });
    load();
  };

  const tf = (key: keyof Business, label:string) => (
    <label className="block"><span className="text-xs text-[#666] mb-1 block">{label}</span>
      <input type="text" value={String(form[key]??"")} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
        className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
    </label>
  );
  const nf = (key: keyof Business, label:string, step="1") => (
    <label className="block"><span className="text-xs text-[#666] mb-1 block">{label}</span>
      <input type="number" step={step} value={String(form[key]??"")} onChange={e=>setForm(f=>({...f,[key]:Number(e.target.value)}))}
        className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
    </label>
  );

  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">🏢 Negócios</h1>
          <p className="text-[#555] text-sm">{total} negócios (inclui bordéis)</p>
        </div>
        <button onClick={openCreate} className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
          + Novo Negócio
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Pesquisar…"
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1"/>
      </div>

      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Nome / Tipo</th>
              <th className="text-right px-4 py-3">Preço Compra</th>
              <th className="text-right px-4 py-3">Income/h</th>
              <th className="text-right px-4 py-3">Trabalhadores</th>
              <th className="text-right px-4 py-3">Nível</th>
              <th className="text-center px-4 py-3">Ativo</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-[#444]">A carregar…</td></tr>
            ) : businesses.map((b) => (
              <tr key={b.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{b.name}</p>
                  <p className="text-[#444] text-xs font-mono">{b.type}</p>
                </td>
                <td className="px-4 py-3 text-right text-green-400">💵 {b.purchase_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-yellow-400">{b.base_income_per_hour.toLocaleString()}/h</td>
                <td className="px-4 py-3 text-right text-[#888]">{b.max_employees}</td>
                <td className="px-4 py-3 text-right text-[#888]">{b.required_level}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={()=>toggleEnabled(b)}
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${b.enabled?"bg-green-600/20 text-green-400":"bg-[#1a1a1a] text-[#444]"}`}>
                    {b.enabled?"ON":"OFF"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={()=>openEdit(b)} className="text-xs px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white">Editar</button>
                    <button onClick={()=>setConfirmDelete(b)} className="text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400">Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {modal && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <h2 className="text-lg font-black text-white mb-5">{modal==="edit"?"Editar":"Criar"} Negócio</h2>
            {modal==="edit" && <p className="text-xs text-[#444] mb-4 font-mono">tipo: {form.type} (não editável)</p>}
            <div className="space-y-3">
              {tf("name","Nome")}
              {modal==="create" && tf("type","Tipo (enum ex: weed_farm)")}
              <label className="block"><span className="text-xs text-[#666] mb-1 block">Descrição</span>
                <textarea value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {nf("purchase_price","Preço de Compra")}
                {nf("base_income_per_hour","Income/hora")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {nf("max_employees","Max. Trabalhadores")}
                {nf("employee_cost_per_hour","Custo Trabalhador/h")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {nf("required_level","Nível Req.")}
                {nf("raid_risk","Risco Raid (0-1)","0.01")}
              </div>
            </div>
            {/* Input items — only in edit mode (need business id) */}
            {modal === "edit" && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#ff6a00] mb-2">⚙️ Itens Necessários (consome por hora)</p>
                {ioLoading ? <p className="text-[#444] text-xs py-1">A carregar…</p> : (
                  <div className="space-y-1 mb-2">
                    {inputs.map(inp => (
                      <div key={inp.id} className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-1.5">
                        {inp.items?.image_url && <img src={inp.items.image_url} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
                        <span className="text-white text-xs flex-1 truncate">{inp.items?.name}</span>
                        <span className="text-[#555] text-xs">{inp.quantity_per_hour}/h</span>
                        <button onClick={() => removeInput(inp.id)} className="text-red-500 hover:text-red-400 text-xs ml-1">✕</button>
                      </div>
                    ))}
                    {inputs.length === 0 && <p className="text-[#444] text-xs">Nenhum item necessário</p>}
                  </div>
                )}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[160px] relative">
                    <span className="text-xs text-[#666] mb-1 block">Item</span>
                    <input value={inSearch} onChange={e => { setInSearch(e.target.value); setInItemId(""); }}
                      placeholder="Pesquisar item…"
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white" />
                    {inSearch && !inItemId && (
                      <div className="absolute z-10 mt-1 bg-[#111] border border-[#2a2a2a] rounded-lg max-h-40 overflow-y-auto w-full shadow-xl">
                        {allItems.filter(i => i.name.toLowerCase().includes(inSearch.toLowerCase())).slice(0, 15).map(i => (
                          <button key={i.id} onClick={() => { setInItemId(i.id); setInSearch(i.name); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#1e1e1e] flex items-center gap-2">
                            {i.image_url && <img src={i.image_url} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                            <span className="flex-1 truncate">{i.name}</span>
                            <span className="text-[#555]">{i.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-20">
                    <span className="text-xs text-[#666] mb-1 block">Qtd/hora</span>
                    <input type="number" min="0.01" step="0.01" value={inQty} onChange={e => setInQty(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                  <button onClick={addInput} disabled={!inItemId}
                    className="px-3 py-2 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white text-xs font-bold disabled:opacity-40">+ Add</button>
                </div>
              </div>
            )}

            {/* Output items — only in edit mode */}
            {modal === "edit" && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#ff6a00] mb-2">📦 Itens Produzidos (por hora)</p>
                {ioLoading ? <p className="text-[#444] text-xs py-1">A carregar…</p> : (
                  <div className="space-y-1 mb-2">
                    {outputs.map(out => (
                      <div key={out.id} className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-1.5">
                        {out.items?.image_url && <img src={out.items.image_url} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
                        <span className="text-white text-xs flex-1 truncate">{out.items?.name}</span>
                        <span className="text-[#555] text-xs">{out.quantity_per_hour}/h</span>
                        <span className="text-[#ff6a00] text-xs">{Math.round(out.drop_chance * 100)}%</span>
                        <button onClick={() => removeOutput(out.id)} className="text-red-500 hover:text-red-400 text-xs ml-1">✕</button>
                      </div>
                    ))}
                    {outputs.length === 0 && <p className="text-[#444] text-xs">Nenhum item produzido</p>}
                  </div>
                )}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[160px] relative">
                    <span className="text-xs text-[#666] mb-1 block">Item</span>
                    <input value={outSearch} onChange={e => { setOutSearch(e.target.value); setOutItemId(""); }}
                      placeholder="Pesquisar item…"
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white" />
                    {outSearch && !outItemId && (
                      <div className="absolute z-10 mt-1 bg-[#111] border border-[#2a2a2a] rounded-lg max-h-40 overflow-y-auto w-full shadow-xl">
                        {allItems.filter(i => i.name.toLowerCase().includes(outSearch.toLowerCase())).slice(0, 15).map(i => (
                          <button key={i.id} onClick={() => { setOutItemId(i.id); setOutSearch(i.name); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#1e1e1e] flex items-center gap-2">
                            {i.image_url && <img src={i.image_url} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                            <span className="flex-1 truncate">{i.name}</span>
                            <span className="text-[#555]">{i.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-20">
                    <span className="text-xs text-[#666] mb-1 block">Qtd/hora</span>
                    <input type="number" min="0.01" step="0.01" value={outQty} onChange={e => setOutQty(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                  <div className="w-20">
                    <span className="text-xs text-[#666] mb-1 block">Chance (%)</span>
                    <input type="number" min="1" max="100" value={outChance} onChange={e => setOutChance(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                  <button onClick={addOutput} disabled={!outItemId}
                    className="px-3 py-2 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white text-xs font-bold disabled:opacity-40">+ Add</button>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg bg-[#1a1a1a] text-[#888] text-sm font-semibold">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#ff6a00] text-white text-sm font-bold disabled:opacity-50">
                {saving?"A guardar…":modal==="edit"?"Guardar":"Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-900/50 rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-white font-bold mb-1">Eliminar "{confirmDelete.name}"?</h3>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setConfirmDelete(null)} className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-white text-sm">Cancelar</button>
              <button onClick={()=>handleDelete(confirmDelete)} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
