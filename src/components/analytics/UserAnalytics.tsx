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
  referrer_source: string | null;
  is_suspicious: boolean;
  created_at: string;
  last_seen_at: string;
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
