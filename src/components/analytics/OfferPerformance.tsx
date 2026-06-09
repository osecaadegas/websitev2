"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface OfferStat {
  offer_id: string;
  offer_name: string;
  casino_name: string;
  total_clicks: number;
  unique_sessions: number;
  suspicious_clicks: number;
  legitimate_clicks: number;
}

/* ── Click log types ─────────────────────────────────────────── */
interface ClickEvent {
  id: string;
  offer_id: string;
  metadata: { offer_name?: string } | null;
  is_suspicious: boolean;
  created_at: string;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  analytics_sessions: {
    id: string;
    ip_address: string;
    user_agent: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    isp: string | null;
    referrer: string | null;
    referrer_source: string | null;
    is_suspicious: boolean;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    screen_width: number | null;
    screen_height: number | null;
    language: string | null;
    timezone: string | null;
    users: {
      display_name: string;
      login: string;
      profile_image_url: string | null;
    } | null;
  } | null;
  casino_offers: {
    name: string;
    slug: string;
  } | null;
}

interface OfferOption {
  id: string;
  name: string;
  slug: string;
}

export default function OfferPerformance() {
  const [offers, setOffers] = useState<OfferStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const loadData = useCallback(async () => {
    setLoading(true);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // Get all offer clicks
    const { data: events } = await supabase
      .from("analytics_events")
      .select("offer_id, session_id, is_suspicious")
      .eq("event_type", "offer_click")
      .not("offer_id", "is", null)
      .gte("created_at", since);

    if (!events || events.length === 0) {
      setOffers([]);
      setLoading(false);
      return;
    }

    // Get offer details
    const offerIds = [...new Set(events.map((e) => e.offer_id))];
    const { data: offerData } = await supabase
      .from("casino_offers")
      .select("id, name")
      .in("id", offerIds);

    const offerMap: Record<string, { name: string }> = {};
    for (const o of offerData ?? []) {
      offerMap[o.id] = { name: o.name };
    }

    // Aggregate stats
    const statsMap: Record<string, OfferStat> = {};
    for (const e of events) {
      const oid = e.offer_id!;
      if (!statsMap[oid]) {
        const info = offerMap[oid];
        statsMap[oid] = {
          offer_id: oid,
          offer_name: info?.name ?? "Desconhecida",
          casino_name: "—",
          total_clicks: 0,
          unique_sessions: 0,
          suspicious_clicks: 0,
          legitimate_clicks: 0,
        };
      }
      statsMap[oid].total_clicks++;
      if (e.is_suspicious) statsMap[oid].suspicious_clicks++;
      else statsMap[oid].legitimate_clicks++;
    }

    // Count unique sessions per offer
    for (const oid of Object.keys(statsMap)) {
      const uniqueSessions = new Set(
        events.filter((e) => e.offer_id === oid).map((e) => e.session_id)
      );
      statsMap[oid].unique_sessions = uniqueSessions.size;
    }

    const sorted = Object.values(statsMap).sort((a, b) => b.total_clicks - a.total_clicks);
    setOffers(sorted);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartData = offers.slice(0, 10).map((o) => ({
    name: o.offer_name.length > 20 ? o.offer_name.slice(0, 20) + "…" : o.offer_name,
    cliques: o.legitimate_clicks,
    suspeitos: o.suspicious_clicks,
  }));

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Performance de Ofertas" subtitle="Cliques e interações por oferta" />

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
        ) : offers.length === 0 ? (
          <p className="text-center text-arena-ash mt-12">Nenhum dado de oferta neste período.</p>
        ) : (
          <>
            {/* Bar chart of top 10 */}
            <div className="arena-card p-6 rounded-xl border border-arena-gold/10 mb-8">
              <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4">
                Top 10 Ofertas por Cliques
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fill: "#999", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#999", fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #d4a853", borderRadius: 8 }}
                    labelStyle={{ color: "#d4a853" }}
                  />
                  <Bar dataKey="cliques" fill="#d4a853" name="Cliques legítimos" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="suspeitos" fill="#c0392b" name="Suspeitos" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Offer table */}
            <div className="arena-card rounded-xl border border-arena-gold/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-arena-dark/60 text-arena-gold/80 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Oferta</th>
                      <th className="px-4 py-3">Casino</th>
                      <th className="px-4 py-3">Cliques Totais</th>
                      <th className="px-4 py-3">Sessões Únicas</th>
                      <th className="px-4 py-3">Legítimos</th>
                      <th className="px-4 py-3">Suspeitos</th>
                      <th className="px-4 py-3">% Suspeitos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-arena-gold/5">
                    {offers.map((o) => {
                      const suspectPct =
                        o.total_clicks > 0
                          ? ((o.suspicious_clicks / o.total_clicks) * 100).toFixed(1)
                          : "0";
                      return (
                        <tr key={o.offer_id} className="hover:bg-arena-dark/40 transition-colors">
                          <td className="px-4 py-3 text-arena-smoke">{o.offer_name}</td>
                          <td className="px-4 py-3 text-arena-ash">{o.casino_name}</td>
                          <td className="px-4 py-3 text-arena-gold font-medium">{o.total_clicks}</td>
                          <td className="px-4 py-3 text-arena-smoke">{o.unique_sessions}</td>
                          <td className="px-4 py-3 text-green-400">{o.legitimate_clicks}</td>
                          <td className="px-4 py-3 text-red-400">{o.suspicious_clicks}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-medium ${
                                Number(suspectPct) > 20 ? "text-red-400" : "text-arena-ash"
                              }`}
                            >
                              {suspectPct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CSV Export */}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  const header = "Oferta,Casino,Cliques,Sessões Únicas,Legítimos,Suspeitos,% Suspeitos\n";
                  const rows = offers.map((o) => {
                    const pct = o.total_clicks > 0 ? ((o.suspicious_clicks / o.total_clicks) * 100).toFixed(1) : "0";
                    return `"${o.offer_name}","${o.casino_name}",${o.total_clicks},${o.unique_sessions},${o.legitimate_clicks},${o.suspicious_clicks},${pct}%`;
                  });
                  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `ofertas-performance-${period}.csv`;
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

        {/* ═══════════════════════════════════════════════════════
           DETAILED CLICK LOG
           ═══════════════════════════════════════════════════════ */}
        <OfferClickLog period={period} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OFFER CLICK LOG — Detailed per-click view with filters & search
   ═══════════════════════════════════════════════════════════════════ */
function OfferClickLog({ period }: { period: string }) {
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const [allOffers, setAllOffers] = useState<OfferOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterOffer, setFilterOffer] = useState("");
  const [filterSuspicious, setFilterSuspicious] = useState<"" | "true" | "false">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;

  const fetchClicks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      period,
      page: String(page),
      limit: String(limit),
    });
    if (filterOffer) params.set("offer_id", filterOffer);
    if (filterSuspicious) params.set("suspicious", filterSuspicious);
    if (search) params.set("search", search);

    try {
      const r = await fetch(`/api/analytics/offer-clicks?${params}`);
      const d = await r.json();
      if (d.events) {
        setClicks(d.events);
        setTotal(d.total);
        if (d.offers) setAllOffers(d.offers);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [period, page, filterOffer, filterSuspicious, search]);

  useEffect(() => { setPage(1); }, [period, filterOffer, filterSuspicious, search]);
  useEffect(() => { fetchClicks(); }, [fetchClicks]);

  const totalPages = Math.ceil(total / limit);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const handleSearch = () => setSearch(searchInput);
  const handleSearchKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const referrerLabel = (src: string | null) => {
    const map: Record<string, string> = {
      direct: "Direto", twitch: "Twitch", social: "Redes Sociais",
      search: "Pesquisa", other: "Outro",
    };
    return map[src || ""] || src || "—";
  };

  const getBrowser = (ua: string | null) => {
    if (!ua) return "—";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    return "Outro";
  };

  const getDevice = (ua: string | null) => {
    if (!ua) return "—";
    if (/mobile|android|iphone|ipad/i.test(ua)) return "📱 Mobile";
    return "💻 Desktop";
  };

  return (
    <div className="mt-12">
      <h3 className="font-display text-xl uppercase tracking-wider text-arena-gold mb-6">
        Registo Detalhado de Cliques
      </h3>

      {/* ── Filters Bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-arena-ash uppercase tracking-wider mb-1 block">Pesquisar</label>
          <div className="flex">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Utilizador, oferta, IP, cidade..."
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-l-lg px-3 py-2 text-sm text-arena-white placeholder:text-arena-ash/50 focus:border-arena-gold/50 focus:ring-1 focus:ring-arena-gold/20 outline-none"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-arena-gold/10 border border-l-0 border-white/10 rounded-r-lg text-arena-gold hover:bg-arena-gold/20 transition text-sm"
            >🔍</button>
          </div>
        </div>

        {/* Offer filter */}
        <div className="min-w-[180px]">
          <label className="text-xs text-arena-ash uppercase tracking-wider mb-1 block">Oferta</label>
          <select
            value={filterOffer}
            onChange={(e) => setFilterOffer(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white focus:border-arena-gold/50 outline-none [color-scheme:dark]"
          >
            <option value="">Todas</option>
            {allOffers.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        {/* Suspicious filter */}
        <div className="min-w-[140px]">
          <label className="text-xs text-arena-ash uppercase tracking-wider mb-1 block">Estado</label>
          <select
            value={filterSuspicious}
            onChange={(e) => setFilterSuspicious(e.target.value as "" | "true" | "false")}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white focus:border-arena-gold/50 outline-none [color-scheme:dark]"
          >
            <option value="">Todos</option>
            <option value="false">Legítimos</option>
            <option value="true">Suspeitos</option>
          </select>
        </div>

        {/* Clear filters */}
        {(search || filterOffer || filterSuspicious) && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setFilterOffer(""); setFilterSuspicious(""); }}
            className="px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-arena-smoke text-sm hover:bg-white/[0.08] transition"
          >✕ Limpar</button>
        )}
      </div>

      {/* ── Results count ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-arena-ash">
          {total} clique{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          {search && <span className="text-arena-gold ml-1">para &quot;{search}&quot;</span>}
        </span>
        <span className="text-xs text-arena-ash">
          Página {page} de {Math.max(1, totalPages)}
        </span>
      </div>

      {/* ── Click Cards ────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
        </div>
      ) : clicks.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-arena-smoke">Nenhum clique encontrado</p>
          <p className="text-sm text-arena-ash mt-1">Ajusta os filtros ou o período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clicks.map((click) => {
            const session = click.analytics_sessions;
            const user = session?.users;
            const offer = click.casino_offers;
            const isExpanded = expandedId === click.id;

            return (
              <div
                key={click.id}
                className={`bg-white/[0.03] border rounded-xl transition-all ${
                  click.is_suspicious
                    ? "border-red-500/20 hover:border-red-500/40"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                {/* Main row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : click.id)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    click.is_suspicious ? "bg-red-400" : "bg-green-400"
                  }`} />

                  {/* User */}
                  <div className="w-36 shrink-0 truncate">
                    {user ? (
                      <div>
                        <span className="text-sm font-medium text-arena-white">{user.display_name}</span>
                        <span className="text-xs text-arena-ash block">@{user.login}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-arena-ash italic">Anónimo</span>
                    )}
                  </div>

                  {/* Offer */}
                  <div className="flex-1 min-w-0 truncate">
                    <span className="text-sm text-arena-gold font-medium">
                      {offer?.name || (click.metadata as Record<string, string> | null)?.offer_name || "—"}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="w-28 shrink-0 text-right hidden sm:block">
                    <span className="text-xs text-arena-ash">
                      {session?.country || "—"}{session?.city ? `, ${session.city}` : ""}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="w-32 shrink-0 text-right">
                    <span className="text-xs text-arena-ash">{formatTime(click.created_at)}</span>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-arena-ash shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-3">
                      <DetailItem label="IP" value={session?.ip_address || "—"} />
                      <DetailItem label="País" value={session?.country || "—"} />
                      <DetailItem label="Cidade" value={session?.city || "—"} />
                      <DetailItem label="Região" value={session?.region || "—"} />
                      <DetailItem label="ISP" value={session?.isp || "—"} />
                      <DetailItem label="Origem" value={referrerLabel(session?.referrer_source || null)} />
                      <DetailItem label="Browser" value={session?.browser || getBrowser(session?.user_agent || null)} />
                      <DetailItem label="Dispositivo" value={session?.device_type || getDevice(session?.user_agent || null)} />
                      <DetailItem label="OS" value={session?.os || "—"} />
                      <DetailItem label="Ecrã" value={session?.screen_width && session?.screen_height ? `${session.screen_width}×${session.screen_height}` : "—"} />
                      <DetailItem label="Idioma" value={session?.language || "—"} />
                      <DetailItem label="Timezone" value={session?.timezone || "—"} />
                      <DetailItem label="Oferta" value={offer?.name || "—"} />
                      <DetailItem label="Slug" value={offer?.slug || "—"} />
                      <DetailItem
                        label="Estado"
                        value={click.is_suspicious ? "⚠️ Suspeito" : "✅ Legítimo"}
                        valueClass={click.is_suspicious ? "text-red-400" : "text-green-400"}
                      />
                      <DetailItem label="Sessão Suspeita" value={session?.is_suspicious ? "Sim" : "Não"} />
                      {session?.referrer && (
                        <div className="col-span-full">
                          <DetailItem label="Referrer" value={session.referrer} />
                        </div>
                      )}
                      {session?.user_agent && (
                        <div className="col-span-full">
                          <DetailItem label="User Agent" value={session.user_agent} mono />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-arena-smoke hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >← Anterior</button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) pageNum = i + 1;
            else if (page <= 3) pageNum = i + 1;
            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
            else pageNum = page - 2 + i;

            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                  page === pageNum
                    ? "bg-arena-gold/20 text-arena-gold border border-arena-gold/30"
                    : "bg-white/[0.04] text-arena-smoke border border-white/10 hover:bg-white/[0.08]"
                }`}
              >{pageNum}</button>
            );
          })}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-arena-smoke hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >Seguinte →</button>
        </div>
      )}
    </div>
  );
}

/* ── Detail item helper ────────────────────────────────────── */
function DetailItem({ label, value, valueClass, mono }: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] text-arena-ash uppercase tracking-wider block mb-0.5">{label}</span>
      <span className={`text-sm ${valueClass || "text-arena-smoke"} ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value}
      </span>
    </div>
  );
}
