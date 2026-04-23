import { redirect } from "next/navigation";
export default function Page() { redirect("/jogos/crime-empire/admin/crimes"); };

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

type Crime = {
  id:string; name:string; description:string; difficulty:string; required_level:number;
  required_power:number; required_intelligence:number; base_success_rate:number;
  jail_risk:number; stamina_cost:number; min_dirty_cash:number; max_dirty_cash:number;
  xp_reward:number; respect_reward:number; cooldown_minutes:number; enabled:boolean;
};

const DIFFICULTIES = ["petty","small","medium","big","legendary"];
const DIFF_COLOR: Record<string,string> = {
  petty:"text-[#888]", small:"text-blue-400", medium:"text-yellow-400",
  big:"text-orange-400", legendary:"text-red-400",
};
const BLANK: Partial<Crime> = {
  name:"", description:"", difficulty:"petty", required_level:1, required_power:0,
  required_intelligence:0, base_success_rate:0.5, jail_risk:0.1, stamina_cost:10,
  min_dirty_cash:100, max_dirty_cash:500, xp_reward:50, respect_reward:5,
  cooldown_minutes:0, enabled:true,
};

export default function CrimesAdminPage() {
  const [crimes, setCrimes]   = useState<Crime[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [q, setQ]             = useState("");
  const [diffFilter, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal]     = useState<"create"|"edit"|null>(null);
  const [form, setForm]       = useState<Partial<Crime>>(BLANK);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{msg:string;ok:boolean}|null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Crime|null>(null);

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page:String(page), q, ...(diffFilter&&{difficulty:diffFilter}) });
    const res = await fetch(`/api/admin/crime-empire/crimes?${params}`);
    const data = await res.json();
    setCrimes(data.crimes||[]); setTotal(data.total||0); setLoading(false);
  }, [page,q,diffFilter]);

  useEffect(()=>{ load(); },[load]);

  const openCreate = () => { setForm(BLANK); setModal("create"); };
  const openEdit = (c:Crime) => { setForm({...c}); setModal("edit"); };
  const closeModal = () => { setModal(null); setForm(BLANK); };

  const handleSave = async () => {
    setSaving(true);
    const isEdit = modal==="edit";
    const res = await fetch(
      isEdit ? `/api/admin/crime-empire/crimes/${form.id}` : "/api/admin/crime-empire/crimes",
      { method:isEdit?"PUT":"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) }
    );
    const data = await res.json();
    setSaving(false);
    if (data.crime) { showToast(isEdit?"Crime atualizado!":"Crime criado!"); closeModal(); load(); }
    else showToast(data.error||"Erro",false);
  };

  const handleDelete = async (c:Crime) => {
    const res = await fetch(`/api/admin/crime-empire/crimes/${c.id}`,{method:"DELETE"});
    const data = await res.json();
    if (data.success) { showToast("Crime eliminado"); load(); }
    else showToast(data.error||"Erro",false);
    setConfirmDelete(null);
  };

  const toggleEnabled = async (c:Crime) => {
    await fetch(`/api/admin/crime-empire/crimes/${c.id}`,{
      method:"PUT", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({enabled:!c.enabled})
    });
    load();
  };

  const numField = (key: keyof Crime, label:string, step="1") => (
    <label key={key} className="block">
      <span className="text-xs text-[#666] mb-1 block">{label}</span>
      <input type="number" step={step} value={String(form[key]??"")}
        onChange={(e)=>setForm(f=>({...f,[key]:Number(e.target.value)}))}
        className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"
      />
    </label>
  );

  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">💰 Crimes</h1>
          <p className="text-[#555] text-sm">{total} crimes no total</p>
        </div>
        <button onClick={openCreate} className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
          + Novo Crime
        </button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={q} onChange={(e)=>{setQ(e.target.value);setPage(1);}} placeholder="Pesquisar…"
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[200px]"/>
        <select value={diffFilter} onChange={(e)=>{setDiff(e.target.value);setPage(1);}}
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todas as dificuldades</option>
          {DIFFICULTIES.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Dificuldade</th>
              <th className="text-right px-4 py-3">Sucesso</th>
              <th className="text-right px-4 py-3">Jail Risk</th>
              <th className="text-right px-4 py-3">Cash</th>
              <th className="text-center px-4 py-3">Ativo</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-[#444]">A carregar…</td></tr>
            ) : crimes.map((c) => (
              <tr key={c.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{c.name}</p>
                  <p className="text-[#444] text-xs">Nível {c.required_level}</p>
                </td>
                <td className={`px-4 py-3 font-bold ${DIFF_COLOR[c.difficulty]||"text-[#888]"}`}>{c.difficulty}</td>
                <td className="px-4 py-3 text-right text-green-400">{Math.round(c.base_success_rate*100)}%</td>
                <td className="px-4 py-3 text-right text-red-400">{Math.round(c.jail_risk*100)}%</td>
                <td className="px-4 py-3 text-right text-yellow-400 text-xs">
                  {c.min_dirty_cash.toLocaleString()}–{c.max_dirty_cash.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={()=>toggleEnabled(c)}
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${c.enabled?"bg-green-600/20 text-green-400":"bg-[#1a1a1a] text-[#444]"}`}>
                    {c.enabled?"ON":"OFF"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={()=>openEdit(c)} className="text-xs px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white transition-all">Editar</button>
                    <button onClick={()=>setConfirmDelete(c)} className="text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-all">Del</button>
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
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <h2 className="text-lg font-black text-white mb-5">{modal==="edit"?"Editar":"Criar"} Crime</h2>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-[#666] mb-1 block">Nome</span>
                <input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
              </label>
              <label className="block"><span className="text-xs text-[#666] mb-1 block">Descrição</span>
                <textarea value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block"><span className="text-xs text-[#666] mb-1 block">Dificuldade</span>
                  <select value={form.difficulty||"petty"} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                    {DIFFICULTIES.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                {numField("required_level","Nível Req.")}
                {numField("stamina_cost","Custo Stamina")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {numField("base_success_rate","Taxa Sucesso (0-1)","0.01")}
                {numField("jail_risk","Risco Prisão (0-1)","0.01")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {numField("min_dirty_cash","Min. Cash Sujo")}
                {numField("max_dirty_cash","Max. Cash Sujo")}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {numField("xp_reward","XP")}
                {numField("respect_reward","Respeito")}
                {numField("cooldown_minutes","Cooldown (min)")}
              </div>
            </div>
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
            <p className="text-4xl mb-3">🗑️</p>
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
