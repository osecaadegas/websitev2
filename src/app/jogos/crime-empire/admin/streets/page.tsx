"use client";

import { useEffect, useState } from "react";
import { CEToast } from "@/components/CEToast";

interface ActiveSession {
  id: string;
  zone: string;
  heat: number;
  started_at: string;
  crime_players: { username: string } | null;
}

interface RecentDeal {
  id: string;
  agreed_price: number | null;
  quantity: number;
  success: boolean;
  snitched: boolean;
  heat_added: number;
  created_at: string;
  street_sessions: { zone: string; crime_players: { username: string } | null } | null;
  items: { name: string } | null;
}

interface TodayStats {
  total: number;
  successful: number;
  snitched: number;
  revenue: number;
}

const STREET_SETTINGS = [
  { key: "street_heat_mult",   label: "🔥 Multiplicador de Calor", min: 0.1, max: 5, step: 0.1, desc: "Multiplica o calor gerado em cada venda na rua" },
  { key: "street_budget_mult", label: "💰 Multiplicador de Budget", min: 0.1, max: 5, step: 0.1, desc: "Multiplica o budget dos clientes (mais dinheiro = mais vendas possíveis)" },
  { key: "street_qty_min",     label: "📦 Qtd. Mínima Clientes",   min: 1, max: 50,  step: 1,   desc: "Gramas mínimas que um cliente pode pedir" },
  { key: "street_qty_max",     label: "📦 Qtd. Máxima Clientes",   min: 5, max: 500, step: 5,   desc: "Gramas máximas que um cliente pode pedir" },
];

const TOGGLE_SETTING = {
  key: "street_enabled",
  label: "🛣️ Sistema de Ruas",
  desc: "Ativa/desativa o sistema de venda na rua para todos os jogadores",
};

const ZONE_LABELS: Record<string, string> = {
  bairro_antigo:   "🏘️ Bairro Antigo",
  escola:          "🎓 Escola",
  mercado_negro:   "🏪 Mercado Negro",
  hospital:        "🏥 Hospital",
  porto:           "⚓ Porto",
  discoteca:       "🎵 Discoteca",
  zona_industrial: "🏭 Zona Industrial",
  aeroporto:       "✈️ Aeroporto",
  gueto:           "💀 Gueto",
};

function heatColor(h: number) {
  if (h < 30) return "#22c55e";
  if (h < 60) return "#eab308";
  if (h < 80) return "#f97316";
  return "#ef4444";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `${m}m atrás`;
  return `${Math.floor(m / 60)}h atrás`;
}

export default function AdminStreetsPage() {
  const [loading, setLoading]       = useState(true);
  const [settings, setSettings]     = useState<Record<string, string>>({});
  const [sessions, setSessions]     = useState<ActiveSession[]>([]);
  const [deals, setDeals]           = useState<RecentDeal[]>([]);
  const [today, setToday]           = useState<TodayStats | null>(null);
  const [zones, setZones]           = useState<Record<string, number>>({});
  const [pendingKeys, setPending]   = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey]   = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    const res  = await fetch("/api/admin/crime-empire/streets");
    const data = await res.json();
    setSettings(data.settings ?? {});
    setSessions(data.activeSessions ?? []);
    setDeals(data.recentDeals ?? []);
    setToday(data.today ?? null);
    setZones(data.zoneBreakdown ?? {});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markPending = (key: string) =>
    setPending((p) => { const n = new Set(p); n.add(key); return n; });

  const setVal = (key: string, val: string | number | boolean) => {
    setSettings((s) => ({ ...s, [key]: String(val) }));
    markPending(key);
  };

  const save = async (key: string) => {
    setSavingKey(key);
    const raw = settings[key];
    const isToggle = key === TOGGLE_SETTING.key;
    const value = isToggle ? raw === "true" : Number(raw);
    const res = await fetch("/api/admin/crime-empire/system", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const data = await res.json();
    setSavingKey(null);
    if (res.ok) {
      showToast(`${key} guardado`, true);
      setPending((p) => { const n = new Set(p); n.delete(key); return n; });
    } else {
      showToast(data.error ?? "Erro ao guardar", false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-white">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="mb-6">
        <h3 className="text-base font-black text-white mb-0.5">🛣️ Gestão de Ruas</h3>
        <p className="text-xs text-[#444]">Configuração do sistema de venda na rua, sessões ativas e histórico de vendas.</p>
      </div>

      {/* Stats row */}
      {today && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Vendas Hoje",    value: today.total,                        color: "#94a3b8" },
            { label: "Com Sucesso",    value: today.successful,                   color: "#22c55e" },
            { label: "Delatores",      value: today.snitched,                     color: "#ef4444" },
            { label: "Receita Hoje",   value: `$${today.revenue.toLocaleString()}`, color: "#eab308" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: "#0f0f11", border: "1px solid #1e1e1e" }}>
              <p className="text-[10px] text-[#444] font-bold uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* ── Settings ── */}
        <div className="rounded-xl p-5" style={{ background: "#0f0f11", border: "1px solid #1e1e1e" }}>
          <p className="text-xs font-black text-white uppercase tracking-widest mb-4">⚙️ Configurações</p>

          {/* Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg mb-4" style={{ background: "#0a0a0c", border: "1px solid #1e1e1e" }}>
            <div>
              <p className="text-sm font-bold text-white">{TOGGLE_SETTING.label}</p>
              <p className="text-[10px] text-[#444] mt-0.5">{TOGGLE_SETTING.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setVal(TOGGLE_SETTING.key, settings[TOGGLE_SETTING.key] !== "true"); save(TOGGLE_SETTING.key); }}
                className={`relative w-10 h-5 rounded-full transition-all ${settings[TOGGLE_SETTING.key] === "true" ? "bg-green-600" : "bg-[#2a2a2a]"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings[TOGGLE_SETTING.key] === "true" ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Sliders */}
          {STREET_SETTINGS.map((cfg) => {
            const val = parseFloat(settings[cfg.key] ?? String(cfg.min));
            return (
              <div key={cfg.key} className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-white">{cfg.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs tabular-nums" style={{ color: "#eab308" }}>{val}</span>
                    {pendingKeys.has(cfg.key) && (
                      <button
                        onClick={() => save(cfg.key)}
                        disabled={savingKey === cfg.key}
                        className="px-2 py-0.5 rounded text-[9px] font-black bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-all">
                        {savingKey === cfg.key ? "..." : "GUARDAR"}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={cfg.min} max={cfg.max} step={cfg.step}
                  value={val}
                  onChange={(e) => setVal(cfg.key, e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#22c55e" }}
                />
                <p className="text-[10px] text-[#333] mt-1">{cfg.desc}</p>
              </div>
            );
          })}
        </div>

        {/* ── Zone breakdown ── */}
        <div className="rounded-xl p-5" style={{ background: "#0f0f11", border: "1px solid #1e1e1e" }}>
          <p className="text-xs font-black text-white uppercase tracking-widest mb-4">🗺️ Vendas por Zona</p>
          {Object.keys(ZONE_LABELS).map((zoneId) => {
            const count = zones[zoneId] ?? 0;
            const maxCount = Math.max(...Object.values(zones), 1);
            return (
              <div key={zoneId} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#888]">{ZONE_LABELS[zoneId] ?? zoneId}</span>
                  <span className="text-xs font-black text-white tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(count / maxCount) * 100}%`, background: "#22c55e" }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(zones).length === 0 && (
            <p className="text-[#333] text-xs text-center py-4">Sem dados ainda.</p>
          )}
        </div>
      </div>

      {/* ── Active Sessions ── */}
      <div className="rounded-xl p-5 mb-6" style={{ background: "#0f0f11", border: "1px solid #1e1e1e" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-black text-white uppercase tracking-widest">👥 Sessões Ativas ({sessions.length})</p>
          <button onClick={load} className="text-[10px] text-[#444] hover:text-white transition-all">↻ Atualizar</button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-[#333] text-xs text-center py-4">Nenhuma sessão ativa de momento.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "#0a0a0c", border: "1px solid #141416" }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{ZONE_LABELS[s.zone]?.split(" ")[0] ?? "🗺️"}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{s.crime_players?.username ?? "—"}</p>
                    <p className="text-[10px] text-[#444]">{ZONE_LABELS[s.zone] ?? s.zone} · {timeAgo(s.started_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.heat}%`, background: heatColor(s.heat) }} />
                  </div>
                  <span className="text-[10px] font-black tabular-nums" style={{ color: heatColor(s.heat) }}>{s.heat}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Deals ── */}
      <div className="rounded-xl p-5" style={{ background: "#0f0f11", border: "1px solid #1e1e1e" }}>
        <p className="text-xs font-black text-white uppercase tracking-widest mb-4">📋 Últimas Vendas</p>
        {deals.length === 0 ? (
          <p className="text-[#333] text-xs text-center py-4">Sem vendas registadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  {["Jogador", "Zona", "Produto", "Preço", "Qtd", "Total", "Calor", "Estado", "Quando"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] font-bold text-[#333] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const username = d.street_sessions?.crime_players?.username ?? "—";
                  const zone     = d.street_sessions?.zone ?? "—";
                  const total    = (d.agreed_price ?? 0) * d.quantity;
                  const state    = d.snitched ? "🚨 Delatou" : d.success ? "✅ Sucesso" : "❌ Falhou";
                  return (
                    <tr key={d.id} className="border-b border-[#0f0f11] hover:bg-[#111] transition-all">
                      <td className="py-2 px-2 font-bold text-white">{username}</td>
                      <td className="py-2 px-2 text-[#555]">{ZONE_LABELS[zone]?.split(" ").slice(1).join(" ") ?? zone}</td>
                      <td className="py-2 px-2 text-[#555]">{d.items?.name ?? "—"}</td>
                      <td className="py-2 px-2 text-[#888]">{d.agreed_price != null ? `$${d.agreed_price}` : "—"}</td>
                      <td className="py-2 px-2 text-[#888]">{d.quantity}g</td>
                      <td className="py-2 px-2 font-bold" style={{ color: d.success ? "#22c55e" : "#ef4444" }}>
                        {d.success ? `$${total.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 px-2 tabular-nums" style={{ color: heatColor(d.heat_added * 5) }}>+{d.heat_added}</td>
                      <td className="py-2 px-2">{state}</td>
                      <td className="py-2 px-2 text-[#333]">{timeAgo(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
