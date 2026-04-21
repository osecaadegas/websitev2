"use client";

import { useEffect, useState, useCallback } from "react";

type Log = {
  id:string; created_at:string; admin_id:string; admin_username:string;
  action:string; entity_type:string; entity_id:string|null;
  entity_name:string|null; details:Record<string,unknown>|null;
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

const ENTITY_TYPES = ["item","crime","business","player","system","shop"];

export default function LogsAdminPage() {
  const [logs, setLogs]         = useState<Log[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState("");
  const [entityType, setEType]  = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({page:String(page),q,...(entityType&&{entity_type:entityType}),...(dateFrom&&{date_from:dateFrom}),...(dateTo&&{date_to:dateTo})});
    const res = await fetch(`/api/admin/crime-empire/logs?${params}`);
    const data = await res.json();
    setLogs(data.logs||[]); setTotal(data.total||0); setLoading(false);
  },[page,q,entityType,dateFrom,dateTo]);

  useEffect(()=>{ load(); },[load]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(logs,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`ce-logs-page${page}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">📋 Audit Logs</h1>
          <p className="text-[#555] text-sm">{total} registos</p>
        </div>
        <button onClick={exportJson} className="text-sm px-3 py-2 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] transition-all">
          ⬇️ Exportar JSON
        </button>
      </div>

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
    </div>
  );
}
