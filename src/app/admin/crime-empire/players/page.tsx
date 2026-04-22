"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

type Player = {
  id:string; username:string; avatar_url:string; level:number; xp:number; hp:number;
  max_hp:number; stamina:number; max_stamina:number; cash:number; dirty_cash:number;
  crypto:number; class:string; respect:number; is_jailed:boolean; addiction:number;
  created_at:string;
};

type PlayerDetail = Player & {
  power:number; intelligence:number; charisma:number; agility:number;
  inventory_count:number; businesses_count:number;
  crimes_committed:number; crimes_successful:number;
  recent_inventory: {item_name:string; quantity:number}[];
};

type Action = "give_cash"|"take_cash"|"give_dirty_cash"|"take_dirty_cash"|"heal"|"free_jail"|"set_addiction"|"give_item";

const CLASS_COLORS: Record<string,string> = {
  street_rat:"text-[#888]", thug:"text-blue-400", gangster:"text-purple-400",
  capo:"text-yellow-400", boss:"text-orange-400", godfather:"text-red-400",
};

export default function PlayersAdminPage() {
  const [players, setPlayers]   = useState<Player[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState("");
  const [classFilter, setClass] = useState("");
  const [jailedFilter, setJailed] = useState("");
  const [loading, setLoading]   = useState(false);

  const [detail, setDetail]     = useState<PlayerDetail|null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionValue, setActionValue]     = useState("");
  const [itemId, setItemId]               = useState("");
  const [addictionVal, setAddictionVal]   = useState(0);

  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null);
  const showToast = (msg:string,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({page:String(page),q,...(classFilter&&{class:classFilter}),...(jailedFilter&&{jailed:jailedFilter})});
    const res = await fetch(`/api/admin/crime-empire/players?${params}`);
    const data = await res.json();
    setPlayers(data.players||[]); setTotal(data.total||0); setLoading(false);
  },[page,q,classFilter,jailedFilter]);

  useEffect(()=>{ load(); },[load]);

  const openDetail = async (p:Player) => {
    setDetailLoading(true); setDetail(null); setActionValue("");
    const res = await fetch(`/api/admin/crime-empire/players/${p.id}`);
    const data = await res.json();
    setDetail(data.player||null); setDetailLoading(false);
    if (data.player) setAddictionVal(data.player.addiction||0);
  };

  const doAction = async (action:Action) => {
    if (!detail) return;
    setActionLoading(true);
    const body: Record<string,unknown> = { action };
    if (["give_cash","take_cash","give_dirty_cash","take_dirty_cash"].includes(action)) body.amount = Number(actionValue);
    if (action==="give_item") body.itemId = itemId;
    if (action==="set_addiction") body.value = addictionVal;
    const res = await fetch(`/api/admin/crime-empire/players/${detail.id}`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    const data = await res.json(); setActionLoading(false);
    if (data.success) { showToast("Ação executada!"); openDetail(detail); load(); }
    else showToast(data.error||"Erro",false);
  };

  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">👥 Jogadores</h1>
          <p className="text-[#555] text-sm">{total} jogadores</p>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Pesquisar por username…"
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[200px]"/>
        <select value={classFilter} onChange={e=>{setClass(e.target.value);setPage(1);}}
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todas as classes</option>
          {["street_rat","thug","gangster","capo","boss","godfather"].map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={jailedFilter} onChange={e=>{setJailed(e.target.value);setPage(1);}}
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todos os estados</option>
          <option value="true">Na prisão</option>
          <option value="false">Em liberdade</option>
        </select>
      </div>

      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Jogador</th>
              <th className="text-left px-4 py-3">Classe</th>
              <th className="text-right px-4 py-3">Nível</th>
              <th className="text-right px-4 py-3">Cash</th>
              <th className="text-right px-4 py-3">Cash Sujo</th>
              <th className="text-left px-4 py-3">Vício</th>
              <th className="text-center px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-[#444]">A carregar…</td></tr>
            ) : players.map(p=>(
              <tr key={p.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors cursor-pointer" onClick={()=>openDetail(p)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.avatar_url && <img src={p.avatar_url} className="w-7 h-7 rounded-full" alt=""/>}
                    <span className="text-white font-medium">{p.username}</span>
                  </div>
                </td>
                <td className={`px-4 py-3 font-bold ${CLASS_COLORS[p.class]||"text-[#888]"}`}>{p.class}</td>
                <td className="px-4 py-3 text-right text-white">{p.level}</td>
                <td className="px-4 py-3 text-right text-green-400">{p.cash.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-yellow-400">{p.dirty_cash.toLocaleString()}</td>
                <td className="px-4 py-3 w-28">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full">
                      <div className="h-full rounded-full bg-purple-500" style={{width:`${p.addiction||0}%`}}/>
                    </div>
                    <span className="text-xs text-[#555]">{p.addiction||0}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.is_jailed?"bg-red-600/20 text-red-400":"bg-green-600/20 text-green-400"}`}>
                    {p.is_jailed?"Preso":"Livre"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 40 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e1e]">
            <span className="text-xs text-[#444]">Página {page} de {Math.ceil(total/40)}</span>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={e=>{e.stopPropagation();setPage(p=>p-1);}} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">← Anterior</button>
              <button disabled={page*40>=total} onClick={e=>{e.stopPropagation();setPage(p=>p+1);}} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">Próxima →</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {(detail||detailLoading) && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-end md:items-center justify-end md:justify-end p-0 md:p-4" onClick={()=>setDetail(null)}>
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] w-full md:w-[460px] h-full md:h-auto md:max-h-[90vh] overflow-y-auto rounded-none md:rounded-2xl p-6" onClick={e=>e.stopPropagation()}>
            {detailLoading ? (
              <p className="text-[#444] text-center py-12">A carregar perfil…</p>
            ) : detail ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    {detail.avatar_url && <img src={detail.avatar_url} className="w-10 h-10 rounded-full" alt=""/>}
                    <div>
                      <p className="text-white font-bold">{detail.username}</p>
                      <p className={`text-xs font-bold ${CLASS_COLORS[detail.class]||"text-[#888]"}`}>{detail.class} • Nível {detail.level}</p>
                    </div>
                  </div>
                  <button onClick={()=>setDetail(null)} className="text-[#444] hover:text-white">✕</button>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    {l:"💵 Cash",v:detail.cash.toLocaleString()},
                    {l:"💰 Sujo",v:detail.dirty_cash.toLocaleString()},
                    {l:"🔐 Crypto",v:detail.crypto},
                    {l:"⚔️ Força",v:detail.power},
                    {l:"🧠 Intel.",v:detail.intelligence},
                    {l:"✨ Carisma",v:detail.charisma},
                    {l:"🎒 Inventário",v:detail.inventory_count},
                    {l:"🏢 Negócios",v:detail.businesses_count},
                    {l:"🎯 Crimes",v:detail.crimes_committed},
                  ].map(s=>(
                    <div key={s.l} className="bg-[#141414] rounded-lg px-3 py-2">
                      <p className="text-[#444] text-xs">{s.l}</p>
                      <p className="text-white font-bold text-sm">{s.v}</p>
                    </div>
                  ))}
                </div>

                {/* HP + Stamina */}
                <div className="space-y-2 mb-5">
                  <div>
                    <div className="flex justify-between text-xs text-[#444] mb-1"><span>❤️ HP</span><span>{detail.hp}/{detail.max_hp}</span></div>
                    <div className="h-2 bg-[#1a1a1a] rounded-full"><div className="h-full rounded-full bg-red-500" style={{width:`${(detail.hp/detail.max_hp)*100}%`}}/></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#444] mb-1"><span>⚡ Stamina</span><span>{detail.stamina}/{detail.max_stamina}</span></div>
                    <div className="h-2 bg-[#1a1a1a] rounded-full"><div className="h-full rounded-full bg-yellow-500" style={{width:`${(detail.stamina/detail.max_stamina)*100}%`}}/></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#444] mb-1"><span>💊 Vício</span><span>{detail.addiction||0}%</span></div>
                    <div className="h-2 bg-[#1a1a1a] rounded-full"><div className="h-full rounded-full bg-purple-500" style={{width:`${detail.addiction||0}%`}}/></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-[#141414] rounded-xl p-4 space-y-3">
                  <p className="text-xs text-[#444] uppercase tracking-widest font-bold">Ações de Admin</p>

                  {/* Quick actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={()=>doAction("heal")} disabled={actionLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 disabled:opacity-50">❤️ Curar</button>
                    {detail.is_jailed && (
                      <button onClick={()=>doAction("free_jail")} disabled={actionLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-400 disabled:opacity-50">🔓 Libertar</button>
                    )}
                  </div>

                  {/* Amount input actions */}
                  <div className="space-y-2">
                    <input type="number" placeholder="Quantidade (cash/item)…" value={actionValue}
                      onChange={e=>setActionValue(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={()=>doAction("give_cash")} disabled={actionLoading||!actionValue}
                        className="text-xs py-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-400 disabled:opacity-50">+ Dar Cash</button>
                      <button onClick={()=>doAction("take_cash")} disabled={actionLoading||!actionValue}
                        className="text-xs py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 disabled:opacity-50">- Tirar Cash</button>
                      <button onClick={()=>doAction("give_dirty_cash")} disabled={actionLoading||!actionValue}
                        className="text-xs py-1.5 rounded-lg bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 disabled:opacity-50">+ Dar Sujo</button>
                      <button onClick={()=>doAction("take_dirty_cash")} disabled={actionLoading||!actionValue}
                        className="text-xs py-1.5 rounded-lg bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 disabled:opacity-50">- Tirar Sujo</button>
                    </div>
                  </div>

                  {/* Give item */}
                  <div className="flex gap-2">
                    <input type="text" placeholder="ID do item…" value={itemId} onChange={e=>setItemId(e.target.value)}
                      className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white"/>
                    <button onClick={()=>doAction("give_item")} disabled={actionLoading||!itemId}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 disabled:opacity-50">🎁 Dar Item</button>
                  </div>

                  {/* Addiction slider */}
                  <div>
                    <div className="flex justify-between text-xs text-[#444] mb-1"><span>💊 Definir Vício</span><span>{addictionVal}%</span></div>
                    <div className="flex gap-2 items-center">
                      <input type="range" min={0} max={100} value={addictionVal} onChange={e=>setAddictionVal(Number(e.target.value))}
                        className="flex-1 accent-purple-500"/>
                      <button onClick={()=>doAction("set_addiction")} disabled={actionLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 disabled:opacity-50">Definir</button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
