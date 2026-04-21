"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CountryData {
  country: string;
  sessions: number;
  percentage: number;
}

interface CityData {
  city: string;
  country: string;
  sessions: number;
}

export default function GeoAnalytics() {
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [cities, setCities] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const loadData = useCallback(async () => {
    setLoading(true);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: sessions } = await supabase
      .from("analytics_sessions")
      .select("country, city")
      .gte("created_at", since);

    if (!sessions || sessions.length === 0) {
      setCountries([]);
      setCities([]);
      setLoading(false);
      return;
    }

    // Country breakdown
    const countryMap: Record<string, number> = {};
    const cityMap: Record<string, { country: string; count: number }> = {};
    const total = sessions.length;

    for (const s of sessions) {
      const c = s.country || "Desconhecido";
      countryMap[c] = (countryMap[c] || 0) + 1;

      if (s.city) {
        const key = `${s.city}|${c}`;
        if (!cityMap[key]) cityMap[key] = { country: c, count: 0 };
        cityMap[key].count++;
      }
    }

    setCountries(
      Object.entries(countryMap)
        .map(([country, sessions]) => ({
          country,
          sessions,
          percentage: Math.round((sessions / total) * 100),
        }))
        .sort((a, b) => b.sessions - a.sessions)
    );

    setCities(
      Object.entries(cityMap)
        .map(([key, { country, count }]) => ({
          city: key.split("|")[0],
          country,
          sessions: count,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 20)
    );

    setLoading(false);
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartCountries = countries.slice(0, 15);

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Análise Geográfica" subtitle="De onde vêm os visitantes" />

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
        ) : countries.length === 0 ? (
          <p className="text-center text-arena-ash mt-12">Sem dados geográficos neste período.</p>
        ) : (
          <>
            {/* Countries bar chart */}
            <div className="arena-card p-6 rounded-xl border border-arena-gold/10 mb-8">
              <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                Sessões por País
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(250, chartCountries.length * 28)}>
                <BarChart data={chartCountries} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fill: "#999", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="country"
                    tick={{ fill: "#999", fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4a853", borderRadius: 8 }}
                    labelStyle={{ color: "#d4a853" }}
                  />
                  <Bar dataKey="sessions" fill="#d4a853" name="Sessões" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Countries table */}
              <div className="arena-card rounded-xl border border-arena-gold/10 p-5">
                <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                  Todos os Países
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {countries.map((c, i) => (
                    <div key={c.country} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-arena-gold/40 text-xs w-6">{i + 1}.</span>
                        <span className="text-arena-smoke text-sm">{c.country}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-arena-dark/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-arena-gold rounded-full"
                            style={{ width: `${c.percentage}%` }}
                          />
                        </div>
                        <span className="text-arena-gold text-sm font-medium w-12 text-right">
                          {c.sessions}
                        </span>
                        <span className="text-arena-ash text-xs w-10 text-right">{c.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Cities */}
              <div className="arena-card rounded-xl border border-arena-gold/10 p-5">
                <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                  Top Cidades
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {cities.map((c, i) => (
                    <div key={`${c.city}-${c.country}`} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-arena-gold/40 text-xs w-6">{i + 1}.</span>
                        <div>
                          <span className="text-arena-smoke text-sm">{c.city}</span>
                          <span className="text-arena-ash text-xs ml-1.5">({c.country})</span>
                        </div>
                      </div>
                      <span className="text-arena-gold text-sm font-medium">{c.sessions}</span>
                    </div>
                  ))}
                  {cities.length === 0 && (
                    <p className="text-arena-ash text-sm text-center py-4">Sem dados de cidade.</p>
                  )}
                </div>
              </div>
            </div>

            {/* CSV Export */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  const header = "País,Sessões,Percentagem\n";
                  const rows = countries.map((c) => `"${c.country}",${c.sessions},${c.percentage}%`);
                  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `geo-analytics-${period}.csv`;
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
