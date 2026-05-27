"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supabase } from "@/lib/supabase";

interface SessionRow {
  id: string;
  user_id: string | null;
  ip_address: string;
  country: string | null;
  city: string | null;
  region: string | null;
  isp: string | null;
  referrer: string | null;
  referrer_source: string | null;
  is_suspicious: boolean;
  created_at: string;
  last_seen_at: string;
  // Enriched columns (from migration)
  device_type: string | null;
  browser: string | null;
  os: string | null;
  screen_width: number | null;
  screen_height: number | null;
  language: string | null;
  timezone: string | null;
  user_email: string | null;
  gpu_fingerprint: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  users: { display_name: string; login: string; profile_image_url: string | null } | null;
}

interface EventRow {
  id: string;
  event_type: string;
  page_url: string | null;
  is_suspicious: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface FraudLogRow {
  id: string;
  reason: string;
  risk_score: number;
  created_at: string;
  resolved: boolean;
}

const SESSION_SELECT = [
  "id", "user_id", "ip_address", "country", "city", "region", "isp",
  "referrer", "referrer_source", "is_suspicious", "created_at", "last_seen_at",
  "device_type", "browser", "os", "screen_width", "screen_height",
  "language", "timezone", "user_email", "gpu_fingerprint", "country_code",
  "latitude", "longitude", "users(display_name, login, profile_image_url)",
].join(", ");

const EVENT_ICONS: Record<string, string> = {
  pageview: "👁",
  click: "🖱",
  offer_click: "🎰",
  external_link: "🔗",
  conversion: "✅",
  button_click: "🔘",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-arena-ash shrink-0 w-28">{label}</span>
      <span className="text-arena-smoke break-all">{value}</span>
    </div>
  );
}

export default function UserAnalytics() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Detail panel state
  const [detail, setDetail] = useState<SessionRow | null>(null);
  const [timeline, setTimeline] = useState<EventRow[]>([]);
  const [fraudLogs, setFraudLogs] = useState<FraudLogRow[]>([]);
  const [otherSessions, setOtherSessions] = useState<SessionRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("analytics_sessions")
      .select(SESSION_SELECT)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search) {
      query = query.or(`ip_address.ilike.%${search}%,country.ilike.%${search}%,city.ilike.%${search}%`);
    }

    const { data } = await query;
    setSessions((data as unknown as SessionRow[]) ?? []);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const openDetail = async (session: SessionRow) => {
    setDetail(session);
    setDetailLoading(true);
    setTimeline([]);
    setFraudLogs([]);
    setOtherSessions([]);

    const [eventsRes, fraudRes, otherRes] = await Promise.all([
      // Event timeline
      supabase
        .from("analytics_events")
        .select("id, event_type, page_url, is_suspicious, created_at, metadata")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),

      // Fraud logs for this session
      supabase
        .from("fraud_logs")
        .select("id, reason, risk_score, created_at, resolved")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false }),

      // Other sessions from same user (if logged in) or same IP
      session.user_id
        ? supabase
            .from("analytics_sessions")
            .select(SESSION_SELECT)
            .eq("user_id", session.user_id)
            .neq("id", session.id)
            .order("created_at", { ascending: false })
            .limit(5)
        : supabase
            .from("analytics_sessions")
            .select(SESSION_SELECT)
            .eq("ip_address", session.ip_address)
            .neq("id", session.id)
            .order("created_at", { ascending: false })
            .limit(5),
    ]);

    setTimeline((eventsRes.data as EventRow[]) ?? []);
    setFraudLogs((fraudRes.data as FraudLogRow[]) ?? []);
    setOtherSessions((otherRes.data as unknown as SessionRow[]) ?? []);
    setDetailLoading(false);
  };

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Utilizadores" subtitle="Análise de sessões e utilizadores" />

        {/* Search */}
        <div className="mb-6 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Pesquisar por IP, país ou cidade..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full px-4 py-2 bg-arena-dark/80 border border-arena-gold/20 rounded-lg text-arena-smoke text-sm focus:outline-none focus:border-arena-gold/50"
          />
        </div>

        {loading ? (
          <div className="flex justify-center mt-16">
            <div className="animate-spin w-10 h-10 border-2 border-arena-gold border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Sessions table */}
            <div className="arena-card rounded-xl border border-arena-gold/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-arena-dark/60 text-arena-gold/80 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Utilizador</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">País / Cidade</th>
                      <th className="px-4 py-3">Fonte</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-arena-gold/5">
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => openDetail(s)}
                        className={`cursor-pointer hover:bg-arena-gold/5 transition-colors ${
                          s.is_suspicious ? "bg-red-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          {s.users ? (
                            <div className="flex items-center gap-2">
                              {s.users.profile_image_url && (
                                <img src={s.users.profile_image_url} alt="" className="w-6 h-6 rounded-full" />
                              )}
                              <span className="text-arena-smoke">{s.users.display_name}</span>
                            </div>
                          ) : (
                            <span className="text-arena-ash">Anónimo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-arena-ash font-mono text-xs">{s.ip_address}</td>
                        <td className="px-4 py-3 text-arena-smoke">
                          {[s.country, s.city].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs bg-arena-dark text-arena-smoke">
                            {s.referrer_source || "direct"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-arena-ash text-xs">
                          {new Date(s.created_at).toLocaleDateString("pt-PT")}{" "}
                          {new Date(s.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          {s.is_suspicious ? (
                            <span className="text-red-400 text-xs font-medium">⚠ Suspeito</span>
                          ) : (
                            <span className="text-green-400 text-xs">✓ OK</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-arena-gold/50 text-xs">Ver detalhes →</span>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-arena-ash">
                          Nenhuma sessão encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm bg-arena-dark/60 text-arena-smoke rounded disabled:opacity-30"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1.5 text-sm text-arena-ash">Página {page + 1}</span>
              <button
                disabled={sessions.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm bg-arena-dark/60 text-arena-smoke rounded disabled:opacity-30"
              >
                Seguinte →
              </button>
            </div>
          </>
        )}

        {/* ── Detail modal ───────────────────────────────────────────── */}
        {detail && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}
          >
            <div className="relative bg-[#0e0e0e] border-l border-arena-gold/15 w-full max-w-xl h-full overflow-y-auto p-6 flex flex-col gap-6">

              {/* Close */}
              <button
                onClick={() => setDetail(null)}
                className="absolute top-4 right-4 text-arena-smoke hover:text-arena-gold text-xl leading-none"
              >
                ✕
              </button>

              {/* ── Header ── */}
              <div className="flex items-center gap-4 pr-8">
                {detail.users?.profile_image_url ? (
                  <img src={detail.users.profile_image_url} alt="" className="w-14 h-14 rounded-full border border-arena-gold/20" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-arena-dark/60 border border-arena-gold/10 flex items-center justify-center text-2xl">
                    👤
                  </div>
                )}
                <div>
                  <p className="text-arena-gold text-lg font-[family-name:var(--font-ui)] leading-tight">
                    {detail.users?.display_name ?? "Anónimo"}
                  </p>
                  {detail.users?.login && (
                    <p className="text-arena-ash text-sm">@{detail.users.login}</p>
                  )}
                  {detail.user_email && (
                    <p className="text-arena-ash text-xs">{detail.user_email}</p>
                  )}
                </div>
                <div className="ml-auto">
                  {detail.is_suspicious ? (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-900/30 text-red-400 border border-red-500/20">
                      ⚠ Suspeito
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-900/20 text-green-400 border border-green-500/20">
                      ✓ OK
                    </span>
                  )}
                </div>
              </div>

              {detailLoading && (
                <div className="flex justify-center py-6">
                  <div className="animate-spin w-8 h-8 border-2 border-arena-gold border-t-transparent rounded-full" />
                </div>
              )}

              {!detailLoading && (
                <>
                  {/* ── Session + Device grid ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Session */}
                    <div className="bg-arena-dark/30 rounded-xl border border-arena-gold/10 p-4 space-y-2">
                      <p className="text-arena-gold/70 text-xs font-semibold uppercase tracking-wider mb-3">Sessão</p>
                      <InfoRow label="IP" value={<span className="font-mono">{detail.ip_address}</span>} />
                      <InfoRow label="País" value={[detail.country, detail.region].filter(Boolean).join(", ")} />
                      <InfoRow label="Cidade" value={detail.city} />
                      <InfoRow label="ISP" value={detail.isp} />
                      <InfoRow label="Coord." value={detail.latitude != null ? `${detail.latitude.toFixed(3)}, ${detail.longitude?.toFixed(3)}` : null} />
                      <InfoRow label="Fonte" value={detail.referrer_source || "direct"} />
                      {detail.referrer && <InfoRow label="Referrer" value={<span className="truncate block max-w-[140px]" title={detail.referrer}>{detail.referrer}</span>} />}
                      <InfoRow label="Criado" value={new Date(detail.created_at).toLocaleString("pt-PT")} />
                      <InfoRow label="Último" value={new Date(detail.last_seen_at).toLocaleString("pt-PT")} />
                    </div>

                    {/* Device */}
                    <div className="bg-arena-dark/30 rounded-xl border border-arena-gold/10 p-4 space-y-2">
                      <p className="text-arena-gold/70 text-xs font-semibold uppercase tracking-wider mb-3">Dispositivo</p>
                      <InfoRow label="Tipo" value={detail.device_type} />
                      <InfoRow label="Browser" value={detail.browser} />
                      <InfoRow label="Sistema" value={detail.os} />
                      <InfoRow label="Ecrã" value={detail.screen_width ? `${detail.screen_width}×${detail.screen_height}` : null} />
                      <InfoRow label="Língua" value={detail.language} />
                      <InfoRow label="Timezone" value={detail.timezone} />
                      {detail.gpu_fingerprint && (
                        <div className="pt-2 border-t border-arena-gold/10">
                          <p className="text-arena-ash text-xs mb-1">GPU</p>
                          <p className="text-arena-smoke text-xs font-mono break-all leading-relaxed">
                            {detail.gpu_fingerprint}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Fraud logs ── */}
                  {fraudLogs.length > 0 && (
                    <div className="bg-red-950/20 rounded-xl border border-red-500/20 p-4">
                      <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">
                        Registos de Fraude ({fraudLogs.length})
                      </p>
                      <div className="space-y-3">
                        {fraudLogs.map((f) => (
                          <div key={f.id} className="flex gap-3 items-start">
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-bold ${
                              f.risk_score >= 80 ? "bg-red-700/50 text-red-300" :
                              f.risk_score >= 50 ? "bg-orange-700/40 text-orange-300" :
                              "bg-yellow-700/30 text-yellow-300"
                            }`}>
                              {f.risk_score}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-arena-smoke text-xs leading-relaxed">{f.reason}</p>
                              <p className="text-arena-ash text-xs mt-0.5">{new Date(f.created_at).toLocaleString("pt-PT")}</p>
                            </div>
                            {f.resolved && <span className="text-green-400 text-xs shrink-0">✓ Resolvido</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Other sessions ── */}
                  {otherSessions.length > 0 && (
                    <div className="bg-arena-dark/20 rounded-xl border border-arena-gold/10 p-4">
                      <p className="text-arena-gold/70 text-xs font-semibold uppercase tracking-wider mb-3">
                        {detail.user_id ? `Outras sessões do utilizador (${otherSessions.length})` : `Outras sessões do mesmo IP (${otherSessions.length})`}
                      </p>
                      <div className="space-y-2">
                        {otherSessions.map((os) => (
                          <div
                            key={os.id}
                            onClick={() => openDetail(os)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-arena-gold/5 transition-colors text-xs ${os.is_suspicious ? "bg-red-900/10" : "bg-arena-dark/30"}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-arena-ash shrink-0">{os.ip_address}</span>
                              <span className="text-arena-smoke truncate">{[os.country, os.city].filter(Boolean).join(", ")}</span>
                              {os.browser && <span className="text-arena-ash hidden sm:inline">{os.browser}</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {os.is_suspicious && <span className="text-red-400">⚠</span>}
                              <span className="text-arena-ash">{new Date(os.created_at).toLocaleDateString("pt-PT")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Event timeline ── */}
                  <div>
                    <p className="text-arena-gold/70 text-xs font-semibold uppercase tracking-wider mb-3">
                      Timeline ({timeline.length} eventos)
                    </p>
                    {timeline.length === 0 ? (
                      <p className="text-arena-ash text-sm text-center py-4">Nenhum evento nesta sessão.</p>
                    ) : (
                      <div className="space-y-2">
                        {timeline.map((e) => (
                          <div
                            key={e.id}
                            className={`flex gap-3 items-start p-3 rounded-lg ${
                              e.is_suspicious ? "bg-red-900/15 border border-red-500/20" : "bg-arena-dark/30"
                            }`}
                          >
                            <span className="shrink-0 text-base leading-none mt-0.5">
                              {EVENT_ICONS[e.event_type] ?? "•"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-arena-gold text-xs font-medium uppercase">{e.event_type}</span>
                                <span className="text-arena-ash text-xs">
                                  {new Date(e.created_at).toLocaleTimeString("pt-PT")}
                                </span>
                                {e.is_suspicious && <span className="text-red-400 text-xs">⚠</span>}
                              </div>
                              {e.page_url && (
                                <p className="text-arena-smoke text-sm truncate mt-0.5">{e.page_url}</p>
                              )}
                              {Object.keys(e.metadata).length > 0 && (
                                <p className="text-arena-ash text-xs mt-1 font-mono break-all">
                                  {JSON.stringify(e.metadata)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


interface EventRow {
  id: string;
  event_type: string;
  page_url: string | null;
  is_suspicious: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

export default function UserAnalytics() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<EventRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const loadSessions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("analytics_sessions")
      .select("id, user_id, ip_address, country, city, referrer_source, is_suspicious, created_at, last_seen_at, users(display_name, login, profile_image_url)")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search) {
      query = query.or(`ip_address.ilike.%${search}%,country.ilike.%${search}%,city.ilike.%${search}%`);
    }

    const { data } = await query;
    setSessions((data as unknown as SessionRow[]) ?? []);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadTimeline = async (sessionId: string) => {
    setSelectedSession(sessionId);
    setTimelineLoading(true);
    const { data } = await supabase
      .from("analytics_events")
      .select("id, event_type, page_url, is_suspicious, created_at, metadata")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    setTimeline((data as EventRow[]) ?? []);
    setTimelineLoading(false);
  };

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Utilizadores" subtitle="Análise de sessões e utilizadores" />

        {/* Search */}
        <div className="mb-6 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Pesquisar por IP, país ou cidade..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full px-4 py-2 bg-arena-dark/80 border border-arena-gold/20 rounded-lg text-arena-smoke text-sm focus:outline-none focus:border-arena-gold/50"
          />
        </div>

        {loading ? (
          <div className="flex justify-center mt-16">
            <div className="animate-spin w-10 h-10 border-2 border-arena-gold border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Sessions table */}
            <div className="arena-card rounded-xl border border-arena-gold/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-arena-dark/60 text-arena-gold/80 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Utilizador</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">País / Cidade</th>
                      <th className="px-4 py-3">Fonte</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-arena-gold/5">
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        className={`hover:bg-arena-dark/40 transition-colors ${
                          s.is_suspicious ? "bg-red-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          {s.users ? (
                            <div className="flex items-center gap-2">
                              {s.users.profile_image_url && (
                                <img
                                  src={s.users.profile_image_url}
                                  alt=""
                                  className="w-6 h-6 rounded-full"
                                />
                              )}
                              <span className="text-arena-smoke">{s.users.display_name}</span>
                            </div>
                          ) : (
                            <span className="text-arena-ash">Anónimo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-arena-ash font-mono text-xs">{s.ip_address}</td>
                        <td className="px-4 py-3 text-arena-smoke">
                          {[s.country, s.city].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs bg-arena-dark text-arena-smoke">
                            {s.referrer_source || "direct"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-arena-ash text-xs">
                          {new Date(s.created_at).toLocaleDateString("pt-PT")}{" "}
                          {new Date(s.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          {s.is_suspicious ? (
                            <span className="text-red-400 text-xs font-medium">⚠ Suspeito</span>
                          ) : (
                            <span className="text-green-400 text-xs">✓ OK</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => loadTimeline(s.id)}
                            className="text-arena-gold/70 hover:text-arena-gold text-xs underline"
                          >
                            Ver timeline
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-arena-ash">
                          Nenhuma sessão encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm bg-arena-dark/60 text-arena-smoke rounded disabled:opacity-30"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1.5 text-sm text-arena-ash">Página {page + 1}</span>
              <button
                disabled={sessions.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm bg-arena-dark/60 text-arena-smoke rounded disabled:opacity-30"
              >
                Seguinte →
              </button>
            </div>
          </>
        )}

        {/* Timeline modal */}
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="arena-card bg-arena-black rounded-2xl border border-arena-gold/20 max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-arena-gold text-lg font-[family-name:var(--font-ui)]">
                  Timeline da Sessão
                </h3>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-arena-smoke hover:text-arena-gold text-xl"
                >
                  ✕
                </button>
              </div>
              {timelineLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-arena-gold border-t-transparent rounded-full" />
                </div>
              ) : timeline.length === 0 ? (
                <p className="text-arena-ash text-sm text-center py-8">Nenhum evento nesta sessão.</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map((e) => (
                    <div
                      key={e.id}
                      className={`flex gap-3 items-start p-3 rounded-lg ${
                        e.is_suspicious ? "bg-red-900/15 border border-red-500/20" : "bg-arena-dark/30"
                      }`}
                    >
                      <div className="shrink-0 mt-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-arena-gold" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-arena-gold text-xs font-medium uppercase">
                            {e.event_type}
                          </span>
                          <span className="text-arena-ash text-xs">
                            {new Date(e.created_at).toLocaleTimeString("pt-PT")}
                          </span>
                          {e.is_suspicious && <span className="text-red-400 text-xs">⚠</span>}
                        </div>
                        {e.page_url && (
                          <p className="text-arena-smoke text-sm truncate mt-0.5">{e.page_url}</p>
                        )}
                        {Object.keys(e.metadata).length > 0 && (
                          <p className="text-arena-ash text-xs mt-1 font-mono">
                            {JSON.stringify(e.metadata)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
