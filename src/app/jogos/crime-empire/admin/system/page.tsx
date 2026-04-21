"use client";

import { useEffect, useState } from "react";

type Settings = { [key:string]: string };

const KEYS = [
  { key:"police_intensity",    label:"🚔 Intensidade Policial", min:0, max:100, step:1,  type:"slider",  desc:"0 = sem polícia · 100 = máxima vigilância" },
  { key:"crime_multiplier",    label:"💰 Multiplicador Crimes",  min:0.1, max:5, step:0.1, type:"slider", desc:"Multiplicador do dinheiro ganho em crimes" },
  { key:"income_multiplier",   label:"🏢 Multiplicador Income",  min:0.1, max:5, step:0.1, type:"slider", desc:"Multiplicador do rendimento dos negócios" },
  { key:"xp_multiplier",       label:"⭐ Multiplicador XP",      min:0.1, max:5, step:0.1, type:"slider", desc:"Multiplicador de XP ganho em todas as ações" },
  { key:"maintenance_mode",    label:"🔧 Modo Manutenção",      type:"toggle", desc:"Bloqueia o acesso ao jogo para todos os jogadores" },
];

function policeColor(v:number) {
  if (v < 30) return "#22c55e";
  if (v < 60) return "#eab308";
  if (v < 80) return "#f97316";
  return "#ef4444";
}

export default function SystemPage() {
  const [settings, setSettings]   = useState<Settings>({});
  const [pendingKeys, setPending]  = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey]  = useState<string|null>(null);
  const [toast, setToast]          = useState<{msg:string;ok:boolean}|null>(null);
  const [loading, setLoading]      = useState(true);

  const showToast = (msg:string,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/crime-empire/system");
    const data = await res.json();
    setSettings(data.settings||{}); setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const markPending = (key:string) => setPending(p=>{const n=new Set(p);n.add(key);return n;});

  const setValue = (key:string, val:string|number|boolean) => {
    setSettings(s=>({...s,[key]:String(val)}));
    markPending(key);
  };

  const save = async (key:string) => {
    setSavingKey(key);
    let value: string|number|boolean = settings[key];
    const def = KEYS.find(k=>k.key===key);
    if (def?.type==="slider") value = Number(value);
    if (def?.type==="toggle") value = value==="true";
    const res = await fetch("/api/admin/crime-empire/system",{
      method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value})
    });
    const data = await res.json();
    setSavingKey(null);
    if (data.success) { showToast(`${key} guardado!`); setPending(p=>{const n=new Set(p);n.delete(key);return n;}); }
    else showToast(data.error||"Erro",false);
  };

  const numVal = (key:string) => Number(settings[key]??0);
  const boolVal = (key:string) => settings[key]==="true";

  if (loading) return <p className="text-[#444] text-center py-12">A carregar definições…</p>;

  return (
    <div>
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.ok?"bg-green-600":"bg-red-600"} text-white`}>
          {toast.msg}
        </div>
      )}
      <h1 className="text-2xl font-black text-white mb-2">⚙️ Controlo do Sistema</h1>
      <p className="text-[#555] text-sm mb-8">Ajustes globais que afetam todos os jogadores em tempo real.</p>

      <div className="space-y-4 max-w-2xl">
        {KEYS.map(def=>{
          const pending = pendingKeys.has(def.key);
          const saving = savingKey===def.key;

          if (def.type==="toggle") {
            const val = boolVal(def.key);
            return (
              <div key={def.key} className={`bg-[#0e0e0e] border rounded-2xl p-5 transition-colors ${pending?"border-[#ff6a00]/40":"border-[#1e1e1e]"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold">{def.label}</p>
                    <p className="text-[#444] text-xs mt-0.5">{def.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={()=>setValue(def.key, !val)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${val?"bg-red-500":"bg-[#2a2a2a]"}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${val?"left-6":"left-0.5"}`}/>
                    </button>
                    {pending && (
                      <button onClick={()=>save(def.key)} disabled={saving}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold disabled:opacity-50">
                        {saving?"…":"Guardar"}
                      </button>
                    )}
                  </div>
                </div>
                {val && (
                  <div className="mt-3 bg-red-900/20 border border-red-900/40 rounded-lg px-4 py-2">
                    <p className="text-red-400 text-xs font-bold">⚠️ Modo manutenção ativo — jogo bloqueado para todos os jogadores!</p>
                  </div>
                )}
              </div>
            );
          }

          // slider
          const val = numVal(def.key);
          const isPolice = def.key==="police_intensity";
          const pct = def.max ? ((val-def.min!)/(def.max!-def.min!))*100 : 0;
          const trackColor = isPolice ? policeColor(val) : "#ff6a00";

          return (
            <div key={def.key} className={`bg-[#0e0e0e] border rounded-2xl p-5 transition-colors ${pending?"border-[#ff6a00]/40":"border-[#1e1e1e]"}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-bold">{def.label}</p>
                  <p className="text-[#444] text-xs mt-0.5">{def.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white" style={{color:isPolice?policeColor(val):undefined}}>
                    {val}{isPolice?" %":"×"}
                  </span>
                </div>
              </div>
              <input
                type="range" min={def.min} max={def.max} step={def.step}
                value={val}
                onChange={e=>setValue(def.key,Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background:`linear-gradient(to right,${trackColor} ${pct}%,#1e1e1e ${pct}%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#333] mt-1">
                <span>{def.min}</span><span>{def.max}</span>
              </div>
              {pending && (
                <button onClick={()=>save(def.key)} disabled={saving}
                  className="mt-4 w-full py-2 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white text-sm font-bold disabled:opacity-50">
                  {saving?"A guardar…":"Guardar alteração"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
