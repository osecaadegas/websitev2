"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  device_type: string | null;
  browser: string | null;
  os: string | null;
  screen_width: number | null;
  screen_height: number | null;
  language: string | null;
  timezone: string | null;
  user_email: string | null;
  gpu_fingerprint: string | null;
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
  resolved: boolean;
  created_at: string;
}

const PAGE_SIZE = 25;

const SESSION_SELECT = [
  "id",
  "user_id",
  "ip_address",
  "country",
  "city",
  "region",
  "isp",
  "referrer",
  "referrer_source",
  "is_suspicious",
  "created_at",
  "last_seen_at",
  "device_type",
  "browser",
  "os",
  "screen_width",
  "screen_height",
  "language",
  "timezone",
  "user_email",
  "gpu_fingerprint",
  "latitude",
  "longitude",
  "users(display_name, login, profile_image_url)",
].join(", ");

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
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

  const [detail, setDetail] = useState<SessionRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timeline, setTimeline] = useState<EventRow[]>([]);
  const [fraudLogs, setFraudLogs] = useState<FraudLogRow[]>([]);

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
    setSessions((data as SessionRow[]) ?? []);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const openDetail = async (session: SessionRow) => {
    setDetail(session);
    setDetailLoading(true);
    setTimeline([]);
    setFraudLogs([]);

    const [eventsRes, fraudRes] = await Promise.allSettled([
      supabase
        .from("analytics_events")
        .select("id, event_type, page_url, is_suspicious, created_at, metadata")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("fraud_logs")
        .select("id, reason, risk_score, resolved, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false }),
    ]);

    if (eventsRes.status === "fulfilled") {
      setTimeline((eventsRes.value.data as EventRow[]) ?? []);
    }
    if (fraudRes.status === "fulfilled") {
      setFraudLogs((fraudRes.value.data as FraudLogRow[]) ?? []);
    }

    setDetailLoading(false);
  };

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Utilizadores" subtitle="Análise de sessões e utilizadores" />

        <div className="mb-6 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Pesquisar por IP, país ou cidade..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full px-4 py-2 bg-arena-dark/80 border border-arena-gold/20 rounded-lg text-arena-smoke text-sm focus:outline-none focus:border-arena-gold/50"
          />
        </div>

        {loading ? (
          <div className="flex justify-center mt-16">
            <div className="animate-spin w-10 h-10 border-2 border-arena-gold border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
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
                          {new Date(s.created_at).toLocaleDateString("pt-PT")} {" "}
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
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(s);
                            }}
                            className="text-arena-gold/70 hover:text-arena-gold text-xs underline"
                          >
                            Ver detalhes
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

        {detail && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.currentTarget === e.target) setDetail(null);
            }}
          >
            <div className="arena-card bg-arena-black rounded-2xl border border-arena-gold/20 max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-arena-gold text-lg font-[family-name:var(--font-ui)]">Detalhes do Utilizador</h3>
                <button onClick={() => setDetail(null)} className="text-arena-smoke hover:text-arena-gold text-xl">
                  ✕
                </button>
              </div>

              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-arena-gold border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-arena-dark/30 rounded-xl border border-arena-gold/10 p-4 space-y-2">
                      <p className="text-arena-gold/70 text-xs font-semibold uppercase tracking-wider mb-3">Utilizador / Sessão</p>
                      <InfoRow label="Nome" value={detail.users?.display_name ?? "Anónimo"} />
                      <InfoRow label="Login" value={detail.users?.login ? `@${detail.users.login}` : null} />
                      <InfoRow label="Email" value={detail.user_email} />
                      <InfoRow label="IP" value={<span className="font-mono">{detail.ip_address}</span>} />
                      <InfoRow label="Local" value={[detail.country, detail.city].filter(Boolean).join(", ")} />
                      <InfoRow label="ISP" value={detail.isp} />
                      <InfoRow label="Criado" value={new Date(detail.created_at).toLocaleString("pt-PT")} />
                      <InfoRow label="Último" value={new Date(detail.last_seen_at).toLocaleString("pt-PT")} />
                    </div>

                    <div className="bg-arena-dark/30 rounded-xl border border-arena-gold/10 p-4 space-y-2">
                      <p className="text-arena-gold/70 text-xs font-semibold uppercase tracking-wider mb-3">Dispositivo</p>
                      <InfoRow label="Tipo" value={detail.device_type} />
                      <InfoRow label="Browser" value={detail.browser} />
                      <InfoRow label="Sistema" value={detail.os} />
                      <InfoRow
                        label="Ecrã"
                        value={detail.screen_width && detail.screen_height ? `${detail.screen_width}x${detail.screen_height}` : null}
                      />
                      <InfoRow label="Língua" value={detail.language} />
                      <InfoRow label="Timezone" value={detail.timezone} />
                      <InfoRow label="GPU" value={detail.gpu_fingerprint} />
                    </div>
                  </div>

                  {fraudLogs.length > 0 && (
                    <div className="bg-red-950/20 rounded-xl border border-red-500/20 p-4">
                      <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">
                        Registos de Fraude ({fraudLogs.length})
                      </p>
                      <div className="space-y-3">
                        {fraudLogs.map((f) => (
                          <div key={f.id} className="text-sm">
                            <p className="text-arena-smoke">{f.reason}</p>
                            <p className="text-arena-ash text-xs mt-1">
                              Score: {f.risk_score} • {new Date(f.created_at).toLocaleString("pt-PT")}
                              {f.resolved ? " • Resolvido" : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                            className={`p-3 rounded-lg ${
                              e.is_suspicious ? "bg-red-900/15 border border-red-500/20" : "bg-arena-dark/30"
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-arena-gold text-xs font-medium uppercase">{e.event_type}</span>
                              <span className="text-arena-ash text-xs">
                                {new Date(e.created_at).toLocaleTimeString("pt-PT")}
                              </span>
                              {e.is_suspicious && <span className="text-red-400 text-xs">⚠</span>}
                            </div>
                            {e.page_url && <p className="text-arena-smoke text-sm mt-1">{e.page_url}</p>}
                            {Object.keys(e.metadata || {}).length > 0 && (
                              <p className="text-arena-ash text-xs mt-1 font-mono break-all">{JSON.stringify(e.metadata)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
