"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supabase } from "@/lib/supabase";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";

import type { PieLabelRenderProps } from "recharts";

interface OverviewStats {
  totalSessions: number;
  uniqueVisitors: number;
  totalEvents: number;
  offerClicks: number;
  suspiciousSessions: number;
  pageviews: number;
}

interface DailyData {
  date: string;
  sessions: number;
  pageviews: number;
  clicks: number;
}

interface TopPage {
  page_url: string;
  count: number;
}

interface TrafficBreakdown {
  source: string;
  count: number;
}

const CHART_COLORS = ["#d4a853", "#c0392b", "#8e6f3e", "#e67e22", "#6a4c2a", "#95a5a6"];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="arena-card p-5 rounded-xl border border-arena-gold/10">
      <p className="text-arena-smoke text-xs uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-arena-gold mt-1 font-[family-name:var(--font-ui)]">
        {typeof value === "number" ? value.toLocaleString("pt-PT") : value}
      </p>
      {sub && <p className="text-arena-ash text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsOverview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficBreakdown[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // Fetch overview stats
    const [sessionsRes, eventsRes, offerClicksRes, suspiciousRes, pageviewsRes] =
      await Promise.all([
        supabase
          .from("analytics_sessions")
          .select("id, ip_address", { count: "exact" })
          .gte("created_at", since),
        supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "offer_click")
          .gte("created_at", since),
        supabase
          .from("analytics_sessions")
          .select("id", { count: "exact", head: true })
          .eq("is_suspicious", true)
          .gte("created_at", since),
        supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "pageview")
          .gte("created_at", since),
      ]);

    // Unique visitors by distinct IP
    const uniqueIPs = new Set(
      (sessionsRes.data ?? []).map((s: { ip_address: string }) => s.ip_address)
    );

    setStats({
      totalSessions: sessionsRes.count ?? 0,
      uniqueVisitors: uniqueIPs.size,
      totalEvents: eventsRes.count ?? 0,
      offerClicks: offerClicksRes.count ?? 0,
      suspiciousSessions: suspiciousRes.count ?? 0,
      pageviews: pageviewsRes.count ?? 0,
    });

    // Daily chart data — aggregate from events
    const { data: allEvents } = await supabase
      .from("analytics_events")
      .select("event_type, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const { data: allSessions } = await supabase
      .from("analytics_sessions")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const dailyMap: Record<string, DailyData> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, sessions: 0, pageviews: 0, clicks: 0 };
    }

    for (const s of allSessions ?? []) {
      const key = s.created_at.slice(0, 10);
      if (dailyMap[key]) dailyMap[key].sessions++;
    }

    for (const e of allEvents ?? []) {
      const key = e.created_at.slice(0, 10);
      if (!dailyMap[key]) continue;
      if (e.event_type === "pageview") dailyMap[key].pageviews++;
      else dailyMap[key].clicks++;
    }

    setDailyData(Object.values(dailyMap));

    // Top pages
    const pageMap: Record<string, number> = {};
    for (const e of allEvents ?? []) {
      if (e.event_type === "pageview") {
        const rec = e as unknown as { page_url?: string };
        if (rec.page_url) {
          pageMap[rec.page_url] = (pageMap[rec.page_url] || 0) + 1;
        }
      }
    }
    const sortedPages = Object.entries(pageMap)
      .map(([page_url, count]) => ({ page_url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setTopPages(sortedPages);

    // Traffic sources from sessions
    const sourceMap: Record<string, number> = {};
    const { data: sessionSources } = await supabase
      .from("analytics_sessions")
      .select("referrer_source")
      .gte("created_at", since);

    for (const s of sessionSources ?? []) {
      const src = s.referrer_source || "direct";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    }
    setTrafficSources(
      Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
    );

    setLoading(false);
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="pt-24 pb-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Analitics" subtitle="A carregar dados..." />
          <div className="flex justify-center mt-20">
            <div className="animate-spin w-10 h-10 border-2 border-arena-gold border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Analitics" subtitle="Visão geral de estatísticas" />

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

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <StatCard label="Sessões" value={stats?.totalSessions ?? 0} />
          <StatCard label="Visitantes Únicos" value={stats?.uniqueVisitors ?? 0} />
          <StatCard label="Page Views" value={stats?.pageviews ?? 0} />
          <StatCard label="Eventos" value={stats?.totalEvents ?? 0} />
          <StatCard label="Cliques Ofertas" value={stats?.offerClicks ?? 0} />
          <StatCard
            label="Suspeitos"
            value={stats?.suspiciousSessions ?? 0}
            sub="sessões flagged"
          />
        </div>

        {/* Sessions & Pageviews Chart */}
        <div className="arena-card p-6 rounded-xl border border-arena-gold/10 mb-8">
          <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
            Sessões & Pageviews
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
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
              <Area
                type="monotone"
                dataKey="sessions"
                stroke="#d4a853"
                fill="#d4a853"
                fillOpacity={0.15}
                name="Sessões"
              />
              <Area
                type="monotone"
                dataKey="pageviews"
                stroke="#e67e22"
                fill="#e67e22"
                fillOpacity={0.1}
                name="Pageviews"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Clicks Chart */}
        <div className="arena-card p-6 rounded-xl border border-arena-gold/10 mb-8">
          <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
            Cliques por Dia
          </h3>
          <ResponsiveContainer width="100%" height={250}>
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
              <Bar dataKey="clicks" fill="#c0392b" name="Cliques" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Two columns: Top Pages + Traffic Sources */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Top Pages */}
          <div className="arena-card p-6 rounded-xl border border-arena-gold/10">
            <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
              Páginas Mais Visitadas
            </h3>
            <div className="space-y-2">
              {topPages.length === 0 && (
                <p className="text-arena-ash text-sm">Sem dados ainda.</p>
              )}
              {topPages.map((p, i) => (
                <div key={p.page_url} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-arena-gold/40 text-xs w-5">{i + 1}.</span>
                    <span className="text-arena-smoke text-sm truncate">{p.page_url}</span>
                  </div>
                  <span className="text-arena-gold font-medium text-sm shrink-0">
                    {p.count.toLocaleString("pt-PT")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Sources Pie */}
          <div className="arena-card p-6 rounded-xl border border-arena-gold/10">
            <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
              Fontes de Tráfego
            </h3>
            {trafficSources.length === 0 ? (
              <p className="text-arena-ash text-sm">Sem dados ainda.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={trafficSources}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(props: PieLabelRenderProps) => {
                        const src = (props as unknown as { source?: string }).source ?? "";
                        const pct = typeof props.percent === "number" ? (props.percent * 100).toFixed(0) : "0";
                        return `${src} ${pct}%`;
                      }}
                    >
                      {trafficSources.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4a853", borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {trafficSources.map((s, i) => (
                    <div key={s.source} className="flex items-center gap-1.5 text-xs text-arena-smoke">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {s.source}: {s.count}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
