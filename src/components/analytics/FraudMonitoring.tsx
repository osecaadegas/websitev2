"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FraudLogRow {
  id: string;
  session_id: string | null;
  user_id: string | null;
  ip_address: string;
  reason: string;
  risk_score: number;
  resolved: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface DailyFraud {
  date: string;
  count: number;
}

interface FraudConfigRow {
  id: string;
  key: string;
  value: number;
  description: string | null;
}

export default function FraudMonitoring() {
  const [logs, setLogs] = useState<FraudLogRow[]>([]);
  const [dailyData, setDailyData] = useState<DailyFraud[]>([]);
  const [config, setConfig] = useState<FraudConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const loadData = useCallback(async () => {
    setLoading(true);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // Fraud logs
    let query = supabase
      .from("fraud_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!showResolved) {
      query = query.eq("resolved", false);
    }

    const { data: fraudLogs } = await query;
    setLogs((fraudLogs as FraudLogRow[]) ?? []);

    // Daily fraud counts
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const log of (fraudLogs as FraudLogRow[]) ?? []) {
      const key = log.created_at.slice(0, 10);
      if (dailyMap[key] !== undefined) dailyMap[key]++;
    }
    setDailyData(Object.entries(dailyMap).map(([date, count]) => ({ date, count })));

    // Fraud config
    const { data: configData } = await supabase.from("fraud_config").select("*");
    setConfig((configData as FraudConfigRow[]) ?? []);

    setLoading(false);
  }, [period, showResolved]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resolveLog = async (logId: string) => {
    await supabase.from("fraud_logs").update({ resolved: true }).eq("id", logId);
    setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, resolved: true } : l)));
  };

  const updateConfig = async (key: string, value: number) => {
    await supabase.from("fraud_config").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    setConfig((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const riskColor = (score: number) => {
    if (score >= 80) return "text-red-400";
    if (score >= 50) return "text-orange-400";
    return "text-yellow-400";
  };

  const riskBg = (score: number) => {
    if (score >= 80) return "bg-red-900/20 border-red-500/30";
    if (score >= 50) return "bg-orange-900/15 border-orange-500/20";
    return "bg-yellow-900/10 border-yellow-500/15";
  };

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Monitorização de Fraude" subtitle="Sessões suspeitas e gestão de risco" />

        {/* Period + Filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? "bg-arena-gold text-arena-black"
                  : "bg-arena-dark/60 text-arena-smoke hover:bg-arena-dark"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              showResolved
                ? "bg-arena-gold/20 text-arena-gold"
                : "bg-arena-dark/60 text-arena-smoke hover:bg-arena-dark"
            }`}
          >
            {showResolved ? "✓ Mostrar resolvidos" : "Mostrar resolvidos"}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center mt-16">
            <div className="animate-spin w-10 h-10 border-2 border-arena-gold border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="arena-card p-4 rounded-xl border border-arena-gold/10 text-center">
                <p className="text-arena-smoke text-xs uppercase">Total Alertas</p>
                <p className="text-2xl font-bold text-red-400 mt-1 font-[family-name:var(--font-ui)]">
                  {logs.length}
                </p>
              </div>
              <div className="arena-card p-4 rounded-xl border border-arena-gold/10 text-center">
                <p className="text-arena-smoke text-xs uppercase">Risco Alto (80+)</p>
                <p className="text-2xl font-bold text-red-400 mt-1 font-[family-name:var(--font-ui)]">
                  {logs.filter((l) => l.risk_score >= 80).length}
                </p>
              </div>
              <div className="arena-card p-4 rounded-xl border border-arena-gold/10 text-center">
                <p className="text-arena-smoke text-xs uppercase">Risco Médio (50-79)</p>
                <p className="text-2xl font-bold text-orange-400 mt-1 font-[family-name:var(--font-ui)]">
                  {logs.filter((l) => l.risk_score >= 50 && l.risk_score < 80).length}
                </p>
              </div>
              <div className="arena-card p-4 rounded-xl border border-arena-gold/10 text-center">
                <p className="text-arena-smoke text-xs uppercase">IPs Únicos</p>
                <p className="text-2xl font-bold text-arena-gold mt-1 font-[family-name:var(--font-ui)]">
                  {new Set(logs.map((l) => l.ip_address)).size}
                </p>
              </div>
            </div>

            {/* Daily fraud chart */}
            <div className="arena-card p-6 rounded-xl border border-arena-gold/10 mb-8">
              <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                Alertas por Dia
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#999", fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fill: "#999", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4a853", borderRadius: 8 }}
                    labelStyle={{ color: "#d4a853" }}
                  />
                  <Bar dataKey="count" fill="#c0392b" name="Alertas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fraud logs list */}
            <div className="arena-card rounded-xl border border-arena-gold/10 mb-8">
              <div className="p-5">
                <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                  Registos de Fraude
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-arena-dark/60 text-arena-gold/80 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Risco</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">Razão</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-arena-gold/5">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`${riskBg(log.risk_score)} border-l-2 transition-colors`}
                      >
                        <td className="px-4 py-3">
                          <span className={`font-bold text-lg font-[family-name:var(--font-ui)] ${riskColor(log.risk_score)}`}>
                            {log.risk_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-arena-ash font-mono text-xs">{log.ip_address}</td>
                        <td className="px-4 py-3 text-arena-smoke text-xs max-w-sm">
                          <p className="line-clamp-2">{log.reason}</p>
                        </td>
                        <td className="px-4 py-3 text-arena-ash text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleDateString("pt-PT")}{" "}
                          {new Date(log.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          {log.resolved ? (
                            <span className="text-green-400 text-xs">✓ Resolvido</span>
                          ) : (
                            <span className="text-red-400 text-xs">⚠ Ativo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!log.resolved && (
                            <button
                              onClick={() => resolveLog(log.id)}
                              className="text-arena-gold/70 hover:text-arena-gold text-xs underline"
                            >
                              Resolver
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-arena-ash">
                          Nenhum alerta de fraude encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fraud Config */}
            <div className="arena-card p-6 rounded-xl border border-arena-gold/10">
              <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                Configuração de Deteção
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {config.map((c) => (
                  <div key={c.key} className="bg-arena-dark/30 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-arena-smoke text-sm font-medium">{c.key}</label>
                      <input
                        type="number"
                        value={c.value}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0) updateConfig(c.key, val);
                        }}
                        className="w-20 px-2 py-1 bg-arena-dark border border-arena-gold/20 rounded text-arena-gold text-sm text-right focus:outline-none focus:border-arena-gold/50"
                      />
                    </div>
                    {c.description && (
                      <p className="text-arena-ash text-xs">{c.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CSV Export */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  const header = "Risco,IP,Razão,Data,Status\n";
                  const rows = logs.map((l) =>
                    `${l.risk_score},"${l.ip_address}","${l.reason.replace(/"/g, '""')}","${new Date(l.created_at).toISOString()}","${l.resolved ? "Resolvido" : "Ativo"}"`
                  );
                  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `fraud-report-${period}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-arena-gold/10 text-arena-gold text-sm rounded-lg hover:bg-arena-gold/20 transition-colors"
              >
                📥 Exportar CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
