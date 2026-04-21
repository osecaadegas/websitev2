"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TWITCH_CHANNEL } from "@/lib/constants";

interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_name: string;
  creator_name: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
}

interface TwitchVideo {
  id: string;
  user_name: string;
  title: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  view_count: number;
  type: string;
  duration: string;
}

type ContentType = "clips" | "videos";

const TABS: { value: ContentType; label: string }[] = [
  { value: "clips", label: "Clips" },
  { value: "videos", label: "VODs" },
];

const REFRESH_INTERVAL = 120_000; // 2 minutes

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatVideoDuration(dur: string): string {
  // Twitch format: "1h23m45s" or "23m45s" or "45s"
  const h = dur.match(/(\d+)h/)?.[1] || "0";
  const m = dur.match(/(\d+)m/)?.[1] || "0";
  const s = dur.match(/(\d+)s/)?.[1] || "0";
  if (Number(h) > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  const months = Math.floor(days / 30);
  return `há ${months} mês${months > 1 ? "es" : ""}`;
}

function ClipCard({ clip }: { clip: TwitchClip }) {
  const [playing, setPlaying] = useState(false);
  const [hostname, setHostname] = useState("localhost");

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="group rounded-xl border border-arena-steel/30 bg-arena-charcoal/80 backdrop-blur-sm overflow-hidden hover:border-arena-gold/30 transition-all duration-300"
    >
      {/* Thumbnail / Player */}
      <div className="relative aspect-video bg-arena-dark">
        {playing ? (
          <iframe
            src={`${clip.embed_url}&parent=${hostname}&autoplay=true`}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="autoplay"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="relative w-full h-full cursor-pointer group/play"
          >
            <img
              src={clip.thumbnail_url}
              alt={clip.title}
              className="w-full h-full object-cover group-hover/play:brightness-110 transition-all duration-300"
            />
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/play:bg-black/10 transition-colors">
              <div className="w-14 h-14 rounded-full bg-arena-crimson/90 flex items-center justify-center shadow-lg group-hover/play:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            {/* Duration badge */}
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[11px] font-mono font-bold bg-black/80 text-white rounded">
              {formatDuration(Math.round(clip.duration))}
            </span>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-arena-white leading-tight line-clamp-2 mb-2 group-hover:text-arena-gold transition-colors">
          {clip.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-arena-ash">
          <span>Clipado por <span className="text-arena-smoke">{clip.creator_name}</span></span>
          <span>{timeAgo(clip.created_at)}</span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-arena-ash">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            {formatViews(clip.view_count)}
          </span>
          <a
            href={clip.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-arena-gold hover:text-arena-gold-light transition-colors ml-auto"
          >
            Ver no Twitch →
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function VideoCard({ video }: { video: TwitchVideo }) {
  const thumbnail = video.thumbnail_url
    .replace("%{width}", "440")
    .replace("%{height}", "248");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="group rounded-xl border border-arena-steel/30 bg-arena-charcoal/80 backdrop-blur-sm overflow-hidden hover:border-arena-gold/30 transition-all duration-300"
    >
      {/* Thumbnail */}
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-video bg-arena-dark"
      >
        <img
          src={thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
        />
        {/* Duration badge */}
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[11px] font-mono font-bold bg-black/80 text-white rounded">
          {formatVideoDuration(video.duration)}
        </span>
        {/* VOD label */}
        <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-arena-crimson/90 text-white rounded">
          VOD
        </span>
      </a>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-arena-white leading-tight line-clamp-2 mb-2 group-hover:text-arena-gold transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-arena-ash">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            {formatViews(video.view_count)}
          </span>
          <span>{timeAgo(video.created_at)}</span>
        </div>
        <div className="mt-2 text-right">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-arena-gold hover:text-arena-gold-light transition-colors"
          >
            Ver no Twitch →
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export function DestaquesContent() {
  const [activeTab, setActiveTab] = useState<ContentType>("clips");
  const [clips, setClips] = useState<TwitchClip[]>([]);
  const [videos, setVideos] = useState<TwitchVideo[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  const fetchContent = useCallback(async (type: ContentType) => {
    try {
      const res = await fetch(
        `/api/twitch-clips?channel=${encodeURIComponent(TWITCH_CHANNEL)}&type=${type}&limit=20`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (data.fallback) {
        setFallback(true);
      }

      if (type === "clips") {
        setClips(data.clips || []);
      } else {
        setVideos(data.videos || []);
      }

      setLastUpdated(data.lastUpdated || new Date().toISOString());
      setLoading(false);
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch {
      setLoading(false);
    }
  }, []);

  /* Fetch on tab change + periodic refresh */
  useEffect(() => {
    setLoading(true);
    fetchContent(activeTab);
    const interval = setInterval(() => fetchContent(activeTab), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [activeTab, fetchContent]);

  /* Countdown */
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : REFRESH_INTERVAL / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentItems = activeTab === "clips" ? clips : videos;

  return (
    <div>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-6">
          {/* Tabs */}
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg border transition-all duration-200 ${
                  activeTab === tab.value
                    ? "bg-arena-gold/10 text-arena-gold border-arena-gold/40"
                    : "bg-arena-charcoal/50 text-arena-ash border-arena-steel/30 hover:text-arena-smoke hover:border-arena-steel/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-sm text-arena-smoke">
              <span className="text-arena-white font-bold">{currentItems.length}</span>{" "}
              {activeTab === "clips" ? "clips" : "vídeos"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-arena-ash">
          <span>Atualiza em: {countdown}s</span>
          <button
            onClick={() => fetchContent(activeTab)}
            className="text-arena-gold hover:text-arena-gold-light transition-colors underline underline-offset-2"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Fallback notice */}
      {fallback && (
        <div className="mb-8 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-arena-smoke">
          <p className="font-semibold text-amber-400 mb-1">⚠️ Twitch API não configurada</p>
          <p className="text-xs text-arena-ash">
            Para ver os clips e VODs em tempo real, adiciona <code className="text-arena-gold">TWITCH_CLIENT_ID</code> e{" "}
            <code className="text-arena-gold">TWITCH_CLIENT_SECRET</code> ao ficheiro <code className="text-arena-gold">.env.local</code>.
            Podes obtê-los em{" "}
            <a
              href="https://dev.twitch.tv/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-arena-gold underline underline-offset-2"
            >
              dev.twitch.tv/console
            </a>.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-arena-steel/20 bg-arena-charcoal/50 overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-arena-steel/20" />
              <div className="p-4">
                <div className="h-4 w-3/4 bg-arena-steel/30 rounded mb-2" />
                <div className="h-3 w-1/2 bg-arena-steel/30 rounded mb-3" />
                <div className="h-3 w-1/3 bg-arena-steel/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content grid */}
      {!loading && currentItems.length > 0 && (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {activeTab === "clips"
              ? clips.map((clip) => <ClipCard key={clip.id} clip={clip} />)
              : videos.map((video) => <VideoCard key={video.id} video={video} />)}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && currentItems.length === 0 && !fallback && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎬</div>
          <p className="text-arena-ash text-lg">
            {activeTab === "clips"
              ? "Nenhum clip encontrado para este canal."
              : "Nenhum VOD encontrado para este canal."}
          </p>
          <p className="text-sm text-arena-ash/70 mt-2">
            Os {activeTab === "clips" ? "clips" : "vídeos"} aparecerão aqui automaticamente quando disponíveis.
          </p>
        </div>
      )}

      {/* Footer */}
      {lastUpdated && (
        <div className="mt-10 pt-6 border-t border-arena-steel/20 text-center space-y-2">
          <p className="text-xs text-arena-ash">
            Última atualização:{" "}
            {new Date(lastUpdated).toLocaleString("pt-PT", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
          <p className="text-[10px] text-arena-ash/70">
            Conteúdo atualizado automaticamente via Twitch API. Canal:{" "}
            <a
              href={`https://twitch.tv/${TWITCH_CHANNEL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-arena-gold underline underline-offset-2"
            >
              {TWITCH_CHANNEL}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
