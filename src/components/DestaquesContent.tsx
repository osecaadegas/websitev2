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
      className="group rounded-2xl bg-gradient-to-br from-[#121212] to-[#161616] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 20px rgba(255,106,0,0.2), 0 15px 40px rgba(0,0,0,0.7)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)';
      }}
    >
      {/* Thumbnail / Player */}
      <div className="relative aspect-video bg-black">
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
              <div className="w-16 h-16 rounded-full bg-[#ff6a00] flex items-center justify-center shadow-lg group-hover/play:scale-110 transition-all duration-200"
                style={{
                  boxShadow: '0 0 20px rgba(255,106,0,0.4), 0 8px 24px rgba(0,0,0,0.6)',
                }}
              >
                <svg className="w-7 h-7 text-[#0a0a0a] ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            {/* Duration badge */}
            <span className="absolute bottom-3 right-3 px-2.5 py-1 text-xs font-bold bg-black/90 text-white rounded-full backdrop-blur-sm">
              {formatDuration(Math.round(clip.duration))}
            </span>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 mb-3 group-hover:text-[#ff6a00] transition-colors">
          {clip.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-[#888888] mb-2">
          <span>Clipado por <span className="text-white font-semibold">{clip.creator_name}</span></span>
          <span>{timeAgo(clip.created_at)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-[#888888]">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            <span className="font-semibold">{formatViews(clip.view_count)}</span>
          </span>
          <a
            href={clip.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff6a00] hover:text-[#ff8533] transition-colors font-semibold"
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
      className="group rounded-2xl bg-gradient-to-br from-[#121212] to-[#161616] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 20px rgba(255,106,0,0.2), 0 15px 40px rgba(0,0,0,0.7)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)';
      }}
    >
      {/* Thumbnail */}
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-video bg-black"
      >
        <img
          src={thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
        />
        {/* Duration badge */}
        <span className="absolute bottom-3 right-3 px-2.5 py-1 text-xs font-bold bg-black/90 text-white rounded-full backdrop-blur-sm">
          {formatVideoDuration(video.duration)}
        </span>
        {/* VOD label */}
        <span className="absolute top-3 left-3 px-3 py-1 text-xs font-bold uppercase tracking-wide bg-[#ff6a00]/90 text-white rounded-full backdrop-blur-sm">
          VOD
        </span>
      </a>

      {/* Info */}
      <div className="p-5">
        <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 mb-3 group-hover:text-[#ff6a00] transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-[#888888]">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            <span className="font-semibold">{formatViews(video.view_count)}</span>
          </span>
          <span className="text-[#888888]">{timeAgo(video.created_at)}</span>
        </div>
        <div className="mt-3 text-right">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff6a00] hover:text-[#ff8533] transition-colors text-xs font-semibold"
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
                className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all duration-200 ${
                  activeTab === tab.value
                    ? "bg-[#ff6a00]/10 text-[#ff6a00] shadow-[0_0_16px_rgba(255,106,0,0.15)]"
                    : "bg-[#161616] text-[#888888] hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#ff6a00] animate-pulse shadow-[0_0_8px_rgba(255,106,0,0.6)]" />
            <span className="text-sm text-[#888888]">
              <span className="text-white font-bold">{currentItems.length}</span>{" "}
              {activeTab === "clips" ? "clips" : "vídeos"}
            </span>
          </div>
        </div>

        {lastUpdated && (
          <div className="text-xs text-[#888888]">
            Última atualização: {new Date(lastUpdated).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
            <span className="mx-2">•</span>
            Próxima: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      {/* Fallback notice */}
      {fallback && (
        <div className="mb-8 p-4 rounded-2xl border border-[#ff6a00]/20 bg-[#ff6a00]/10">
          <p className="font-semibold text-[#ff6a00] mb-1 text-sm">⚠️ Twitch API não configurada</p>
          <p className="text-xs text-[#888888]">
            Para ver os clips e VODs em tempo real, adiciona <code className="text-[#ff6a00] bg-[#ff6a00]/10 px-1.5 py-0.5 rounded">TWITCH_CLIENT_ID</code> e{" "}
            <code className="text-[#ff6a00] bg-[#ff6a00]/10 px-1.5 py-0.5 rounded">TWITCH_CLIENT_SECRET</code> ao ficheiro <code className="text-[#ff6a00] bg-[#ff6a00]/10 px-1.5 py-0.5 rounded">.env.local</code>.
            Podes obtê-los em{" "}
            <a
              href="https://dev.twitch.tv/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ff6a00] underline underline-offset-2 hover:text-[#ff8533]"
            >
              dev.twitch.tv/console
            </a>.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-80 bg-gradient-to-br from-[#121212] to-[#161616] rounded-2xl animate-pulse"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)',
              }}
            />
          ))}
        </div>
      )}

      {/* Content grid */}
      {!loading && currentItems.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "clips"
              ? clips.map((clip) => <ClipCard key={clip.id} clip={clip} />)
              : videos.map((video) => <VideoCard key={video.id} video={video} />)}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Empty state */}
      {!loading && currentItems.length === 0 && !fallback && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎬</div>
          <p className="text-[#888888] text-lg">
            {activeTab === "clips"
              ? "Nenhum clip encontrado para este canal."
              : "Nenhum VOD encontrado para este canal."}
          </p>
          <p className="text-sm text-[#666666] mt-2">
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
