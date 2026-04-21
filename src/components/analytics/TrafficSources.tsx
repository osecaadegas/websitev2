"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supabase } from "@/lib/supabase";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";

interface SourceData {
  source: string;
  sessions: number;
  percentage: number;
}

interface ReferrerData {
  referrer: string;
  count: number;
}

const CHART_COLORS = ["#d4a853", "#c0392b", "#e67e22", "#8e6f3e", "#6a4c2a"];
const SOURCE_LABELS: Record<string, string> = {
  direct: "Direto",
  twitch: "Twitch",
  social: "Redes Sociais",
  search: "Pesquisa",
  other: "Outros",
};

export default function TrafficSources() {
  const [sources, setSources] = useState<SourceData[]>([]);
  const [topReferrers, setTopReferrers] = useState<ReferrerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const loadData = useCallback(async () => {
    setLoading(true);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: sessions } = await supabase
      .from("analytics_sessions")
      .select("referrer_source, referrer")
      .gte("created_at", since);

    if (!sessions || sessions.length === 0) {
      setSources([]);
      setTopReferrers([]);
      setLoading(false);
      return;
    }

    // Source breakdown
    const sourceMap: Record<string, number> = {};
    const referrerMap: Record<string, number> = {};
    const total = sessions.length;

    for (const s of sessions) {
      const src = s.referrer_source || "direct";
      sourceMap[src] = (sourceMap[src] || 0) + 1;

      if (s.referrer) {
        try {
          const hostname = new URL(s.referrer).hostname;
          referrerMap[hostname] = (referrerMap[hostname] || 0) + 1;
        } catch {
          referrerMap[s.referrer] = (referrerMap[s.referrer] || 0) + 1;
        }
      }
    }

    setSources(
      Object.entries(sourceMap)
        .map(([source, sessions]) => ({
          source,
          sessions,
          percentage: Math.round((sessions / total) * 100),
        }))
        .sort((a, b) => b.sessions - a.sessions)
    );

    setTopReferrers(
      Object.entries(referrerMap)
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
    );

    setLoading(false);
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Fontes de Tráfego" subtitle="De onde vêm os visitantes" />

        {/* Period selector */}
        <div className="flex justify-center gap-2 mb-8">
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
        </div>

        {loading ? (
          <div className="flex justify-center mt-16">
            <div className="animate-spin w-10 h-10 border-2 border-arena-gold border-t-transparent rounded-full" />
          </div>
        ) : sources.length === 0 ? (
          <p className="text-center text-arena-ash mt-12">Sem dados de tráfego neste período.</p>
        ) : (
          <>
            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              {/* Pie Chart */}
              <div className="arena-card p-6 rounded-xl border border-arena-gold/10">
                <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                  Distribuição por Fonte
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={sources}
                      dataKey="sessions"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(props: PieLabelRenderProps) => {
                        const src = (props as unknown as { source?: string }).source ?? "";
                        const pct = typeof props.percent === "number" ? (props.percent * 100).toFixed(0) : "0";
                        return `${SOURCE_LABELS[src] || src} ${pct}%`;
                      }}
                    >
                      {sources.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4a853", borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {sources.map((s, i) => (
                    <div key={s.source} className="flex items-center gap-2 text-sm text-arena-smoke">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span>{SOURCE_LABELS[s.source] || s.source}</span>
                      <span className="text-arena-ash">({s.sessions})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source stats cards */}
              <div className="space-y-4">
                {sources.map((s, i) => (
                  <div
                    key={s.source}
                    className="arena-card p-4 rounded-xl border border-arena-gold/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <div>
                        <p className="text-arena-smoke font-medium">
                          {SOURCE_LABELS[s.source] || s.source}
                        </p>
                        <p className="text-arena-ash text-xs">{s.percentage}% do tráfego total</p>
                      </div>
                    </div>
                    <p className="text-arena-gold text-xl font-[family-name:var(--font-ui)]">
                      {s.sessions.toLocaleString("pt-PT")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Referrers */}
            {topReferrers.length > 0 && (
              <div className="arena-card p-6 rounded-xl border border-arena-gold/10">
                <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                  Top Referrers
                </h3>
                <ResponsiveContainer width="100%" height={Math.max(200, topReferrers.length * 30)}>
                  <BarChart data={topReferrers} layout="vertical" margin={{ left: 150 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" tick={{ fill: "#999", fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="referrer"
                      tick={{ fill: "#999", fontSize: 11 }}
                      width={150}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4a853", borderRadius: 8 }}
                      labelStyle={{ color: "#d4a853" }}
                    />
                    <Bar dataKey="count" fill="#d4a853" name="Sessões" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
