import { redirect } from "next/navigation";
export default function Page() { redirect("/jogos/crime-empire/admin/logs"); };

import { useEffect, useState, useCallback } from "react";

type Log = {
  id:string; created_at:string; admin_id:string; admin_username:string;
  action:string; entity_type:string; entity_id:string|null;
  entity_name:string|null; details:Record<string,unknown>|null;
};

type Activity = {
  id:string; type:"gambling"|"crime"|"pvp"|"jail";
  player_id:string; player_username:string; player_display_name:string;
  summary:string; amount:number; profit:number|null;
  created_at:string; details:Record<string,unknown>;
};

const ACTION_COLOR: Record<string,string> = {
  create:"bg-green-900/30 text-green-400",
  update:"bg-blue-900/30 text-blue-400",
  delete:"bg-red-900/30 text-red-400",
  give_cash:"bg-green-900/30 text-green-400",
  take_cash:"bg-red-900/30 text-red-400",
  give_dirty_cash:"bg-yellow-900/30 text-yellow-400",
  take_dirty_cash:"bg-orange-900/30 text-orange-400",
  heal:"bg-pink-900/30 text-pink-400",
  free_jail:"bg-cyan-900/30 text-cyan-400",
  set_addiction:"bg-purple-900/30 text-purple-400",
  give_item:"bg-indigo-900/30 text-indigo-400",
};

const ACTIVITY_TYPE_COLOR: Record<string,string> = {
  gambling:"bg-yellow-900/30 text-yellow-400",
  crime:"bg-orange-900/30 text-orange-400",
  pvp:"bg-red-900/30 text-red-400",
  jail:"bg-blue-900/30 text-blue-400",
};

const ENTITY_TYPES = ["item","crime","business","player","system","shop"];
const ACTIVITY_TYPES = ["gambling","crime","pvp","jail"];

export default function LogsAdminPage() {
  const [tab, setTab] = useState<"admin"|"players">("admin");

  // ── Admin logs state ──
  const [logs, setLogs]         = useState<Log[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState("");
  const [entityType, setEType]  = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);

  // ── Player activity state ──
  const [activities, setActivities] = useState<Activity[]>([]);
  const [actQ, setActQ]             = useState("");
  const [actType, setActType]       = useState("");
  const [actFrom, setActFrom]       = useState("");
  const [actTo, setActTo]           = useState("");
  const [actLoading, setActLoading] = useState(false);
  const [actExpanded, setActExpanded] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({page:String(page),q,...(entityType&&{entity_type:entityType}),...(dateFrom&&{date_from:dateFrom}),...(dateTo&&{date_to:dateTo})});
    const res = await fetch(`/api/admin/crime-empire/logs?${params}`);
    const data = await res.json();
    setLogs(data.logs||[]); setTotal(data.total||0); setLoading(false);
  },[page,q,entityType,dateFrom,dateTo]);

  const loadActivity = useCallback(async () => {
    setActLoading(true);
    const params = new URLSearchParams({q:actQ,...(actType&&{type:actType}),...(actFrom&&{date_from:actFrom}),...(actTo&&{date_to:actTo})});
    const res = await fetch(`/api/admin/crime-empire/player-activity?${params}`);
    const data = await res.json();
    setActivities(data.activities||[]); setActLoading(false);
  },[actQ,actType,actFrom,actTo]);

  useEffect(()=>{ if(tab==="admin") load(); },[load,tab]);
  useEffect(()=>{ if(tab==="players") loadActivity(); },[loadActivity,tab]);

  const exportJson = () => {
    const src = tab==="admin" ? logs : activities;
    const blob = new Blob([JSON.stringify(src,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`ce-${tab}-logs.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">📋 Logs</h1>
          <p className="text-[#555] text-sm">{tab==="admin" ? `${total} ações de admin` : `${activities.length} atividades de jogadores`}</p>
        </div>
        <button onClick={exportJson} className="text-sm px-3 py-2 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] transition-all">
          ⬇️ Exportar JSON
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[#1e1e1e]">
        <button onClick={()=>setTab("admin")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${tab==="admin" ? "border-[#ff6a00] text-white" : "border-transparent text-[#555] hover:text-[#888]"}`}>
          🔐 Admin
        </button>
        <button onClick={()=>setTab("players")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${tab==="players" ? "border-[#ff6a00] text-white" : "border-transparent text-[#555] hover:text-[#888]"}`}>
          🎮 Jogadores
        </button>
      </div>

      {/* ── Admin Logs Filters ── */}
      {tab==="admin" && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Pesquisar por admin ou entidade…"
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[200px]"/>
          <select value={entityType} onChange={e=>{setEType(e.target.value);setPage(1);}}
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Todos os tipos</option>
            {ENTITY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}}
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white"/>
          <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}}
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white"/>
        </div>
      )}

      {/* ── Player Activity Filters ── */}
      {tab==="players" && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <input value={actQ} onChange={e=>setActQ(e.target.value)} placeholder="Pesquisar por jogador…"
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[200px]"/>
          <select value={actType} onChange={e=>setActType(e.target.value)}
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Todos os tipos</option>
            {ACTIVITY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={actFrom} onChange={e=>setActFrom(e.target.value)}
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white"/>
          <input type="date" value={actTo} onChange={e=>setActTo(e.target.value)}
            className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white"/>
          <button onClick={loadActivity} className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm text-white hover:border-[#555] transition-all">
            🔄 Atualizar
          </button>
        </div>
      )}


      {/* ── Admin Logs Table ── */}
      {tab==="admin" && (
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Admin</th>
                <th className="text-left px-4 py-3">Ação</th>
                <th className="text-left px-4 py-3">Entidade</th>
                <th className="text-left px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-[#444]">A carregar…</td></tr>
              ) : logs.map(log=>(
                <>
                  <tr key={log.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors cursor-pointer"
                      onClick={()=>setExpanded(expanded===log.id?null:log.id)}>
                    <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-PT")}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{log.admin_username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ACTION_COLOR[log.action]||"bg-[#1a1a1a] text-[#888]"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#888] text-xs font-mono">{log.entity_type}</p>
                      {log.entity_name && <p className="text-white text-xs">{log.entity_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#444] text-xs">
                      {log.details ? (
                        <span className="text-[#ff6a00]">▼ expandir</span>
                      ) : "—"}
                    </td>
                  </tr>
                  {expanded===log.id && log.details && (
                    <tr key={`${log.id}-exp`} className="border-b border-[#151515] bg-[#0a0a0a]">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-[#888] bg-[#111] rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(log.details,null,2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
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
      )}

      {/* ── Player Activity Table ── */}
      {tab==="players" && (
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Jogador</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Atividade</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-right px-4 py-3">Lucro</th>
                <th className="text-left px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {actLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#444]">A carregar…</td></tr>
              ) : activities.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#444]">Nenhuma atividade encontrada</td></tr>
              ) : activities.map(act=>(
                <>
                  <tr key={act.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors cursor-pointer"
                      onClick={()=>setActExpanded(actExpanded===act.id?null:act.id)}>
                    <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">{new Date(act.created_at).toLocaleString("pt-PT")}</td>
                    <td className="px-4 py-3 text-white font-medium">{act.player_display_name || act.player_username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ACTIVITY_TYPE_COLOR[act.type]||"bg-[#1a1a1a] text-[#888]"}`}>{act.type}</span>
                    </td>
                    <td className="px-4 py-3 text-[#888] text-xs max-w-xs truncate">{act.summary}</td>
                    <td className="px-4 py-3 text-right text-xs text-yellow-400">{act.amount > 0 ? `$${act.amount.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold">
                      {act.profit !== null ? (
                        <span className={act.profit >= 0 ? "text-green-400" : "text-red-400"}>
                          {act.profit >= 0 ? "+" : ""}{act.profit.toLocaleString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#444] text-xs">
                      {act.details && Object.keys(act.details).length > 0 ? <span className="text-[#ff6a00]">▼ expandir</span> : "—"}
                    </td>
                  </tr>
                  {actExpanded===act.id && (
                    <tr key={`${act.id}-exp`} className="border-b border-[#151515] bg-[#0a0a0a]">
                      <td colSpan={7} className="px-4 py-3">
                        <pre className="text-xs text-[#888] bg-[#111] rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(act.details,null,2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
