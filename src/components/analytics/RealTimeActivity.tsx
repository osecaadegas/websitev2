"use client";

import { useEffect, useState, useRef } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supabase } from "@/lib/supabase";

interface LiveEvent {
  id: string;
  event_type: string;
  page_url: string | null;
  is_suspicious: boolean;
  created_at: string;
  country: string | null;
  city: string | null;
  session_id: string;
}

interface LiveSession {
  id: string;
  ip_address: string;
  country: string | null;
  city: string | null;
  is_suspicious: boolean;
  last_seen_at: string;
}

const EVENT_ICONS: Record<string, string> = {
  pageview: "👁",
  click: "🖱",
  offer_click: "🎰",
  external_link: "🔗",
  conversion: "🏆",
  button_click: "👆",
};

export default function RealTimeActivity() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [activeSessions, setActiveSessions] = useState<LiveSession[]>([]);
  const [eventsPerMinute, setEventsPerMinute] = useState(0);
  const eventCountRef = useRef(0);

  // Load initial recent events and active sessions
  useEffect(() => {
    async function loadInitial() {
      const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();

      const { data: recentEvents } = await supabase
        .from("analytics_events")
        .select("id, event_type, page_url, is_suspicious, created_at, country, city, session_id")
        .gte("created_at", fiveMinAgo)
        .order("created_at", { ascending: false })
        .limit(50);

      setEvents((recentEvents as LiveEvent[]) ?? []);

      const { data: sessions } = await supabase
        .from("analytics_sessions")
        .select("id, ip_address, country, city, is_suspicious, last_seen_at")
        .gte("last_seen_at", fiveMinAgo)
        .order("last_seen_at", { ascending: false })
        .limit(30);

      setActiveSessions((sessions as LiveSession[]) ?? []);
    }

    loadInitial();
  }, []);

  // Subscribe to realtime events
  useEffect(() => {
    const channel = supabase
      .channel("realtime-analytics")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "analytics_events" },
        (payload) => {
          const newEvent = payload.new as LiveEvent;
          setEvents((prev) => [newEvent, ...prev].slice(0, 100));
          eventCountRef.current++;
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "analytics_sessions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setActiveSessions((prev) => [payload.new as LiveSession, ...prev].slice(0, 30));
          } else if (payload.eventType === "UPDATE") {
            setActiveSessions((prev) =>
              prev.map((s) => (s.id === (payload.new as LiveSession).id ? (payload.new as LiveSession) : s))
            );
          }
        }
      )
      .subscribe();

    // Events per minute counter
    const interval = setInterval(() => {
      setEventsPerMinute(eventCountRef.current);
      eventCountRef.current = 0;
    }, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();
  const activeCount = activeSessions.filter((s) => s.last_seen_at >= fiveMinAgo).length;

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Tempo Real" subtitle="Atividade ao vivo na plataforma" />

        {/* Live stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="arena-card p-4 rounded-xl border border-arena-gold/10 text-center">
            <p className="text-arena-smoke text-xs uppercase">Sessões Ativas</p>
            <p className="text-3xl font-bold text-green-400 mt-1 font-[family-name:var(--font-ui)]">
              {activeCount}
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400/70 text-xs">ao vivo</span>
            </div>
          </div>
          <div className="arena-card p-4 rounded-xl border border-arena-gold/10 text-center">
            <p className="text-arena-smoke text-xs uppercase">Eventos / min</p>
            <p className="text-3xl font-bold text-arena-gold mt-1 font-[family-name:var(--font-ui)]">
              {eventsPerMinute}
            </p>
          </div>
          <div className="arena-card p-4 rounded-xl border border-arena-gold/10 text-center">
            <p className="text-arena-smoke text-xs uppercase">Eventos Recentes</p>
            <p className="text-3xl font-bold text-arena-gold mt-1 font-[family-name:var(--font-ui)]">
              {events.length}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Live Event Feed */}
          <div className="lg:col-span-2 arena-card rounded-xl border border-arena-gold/10 p-5 max-h-[600px] overflow-y-auto">
            <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4 sticky top-0 bg-arena-black/90 pb-2">
              Feed de Eventos
            </h3>
            {events.length === 0 ? (
              <p className="text-arena-ash text-sm text-center py-8">À espera de eventos...</p>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg text-sm ${
                      e.is_suspicious
                        ? "bg-red-900/15 border border-red-500/20"
                        : "bg-arena-dark/20 hover:bg-arena-dark/40"
                    } transition-colors`}
                  >
                    <span className="text-lg shrink-0">
                      {EVENT_ICONS[e.event_type] ?? "📌"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-arena-gold text-xs font-medium uppercase">
                          {e.event_type}
                        </span>
                        {e.country && (
                          <span className="text-arena-ash text-xs">
                            {[e.country, e.city].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {e.is_suspicious && <span className="text-red-400 text-xs font-medium">⚠ SUSPEITO</span>}
                      </div>
                      {e.page_url && (
                        <p className="text-arena-smoke text-xs truncate mt-0.5">{e.page_url}</p>
                      )}
                    </div>
                    <span className="text-arena-ash text-xs shrink-0">
                      {new Date(e.created_at).toLocaleTimeString("pt-PT")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Sessions */}
          <div className="arena-card rounded-xl border border-arena-gold/10 p-5 max-h-[600px] overflow-y-auto">
            <h3 className="text-arena-gold font-[family-name:var(--font-ui)] text-lg mb-4 sticky top-0 bg-arena-black/90 pb-2">
              Sessões Ativas
            </h3>
            {activeSessions.length === 0 ? (
              <p className="text-arena-ash text-sm text-center py-8">Nenhuma sessão ativa.</p>
            ) : (
              <div className="space-y-2">
                {activeSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`p-2.5 rounded-lg text-sm ${
                      s.is_suspicious ? "bg-red-900/15" : "bg-arena-dark/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-arena-smoke font-mono text-xs">{s.ip_address}</span>
                      {s.is_suspicious ? (
                        <span className="text-red-400 text-xs">⚠</span>
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                      )}
                    </div>
                    <p className="text-arena-ash text-xs mt-1">
                      {[s.country, s.city].filter(Boolean).join(", ") || "Localização desconhecida"}
                    </p>
                    <p className="text-arena-ash/60 text-xs mt-0.5">
                      Visto: {new Date(s.last_seen_at).toLocaleTimeString("pt-PT")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
