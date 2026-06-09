"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useTwitchStatus } from "@/hooks/useTwitchStatus";
import { TWITCH_CHANNEL } from "@/lib/constants";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Twitch?: any;
    _twitchScriptLoaded?: boolean;
  }
}

interface TwitchClip {
  id: string;
  embed_url: string;
  title: string;
  creator_name: string;
  view_count: number;
}

/**
 * STREAMER HUB — Live Twitch embed + chat side by side.
 * When offline, plays a random clip from the channel.
 */
export function StreamerHub() {
  const { isLive, loading } = useTwitchStatus(TWITCH_CHANNEL);
  const [hostname, setHostname] = useState("localhost");
  const [clips, setClips] = useState<TwitchClip[]>([]);
  const [activeClip, setActiveClip] = useState<TwitchClip | null>(null);
  const liveContainerRef = useRef<HTMLDivElement>(null);
  const twitchEmbedRef = useRef<any>(null);

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  // Fetch clips when we detect offline
  useEffect(() => {
    if (loading || isLive) return;

    async function fetchClips() {
      try {
        const res = await fetch(
          `/api/twitch-clips?channel=${encodeURIComponent(TWITCH_CHANNEL)}&limit=20`
        );
        const data = await res.json();
        const fetched: TwitchClip[] = data.clips ?? [];
        if (fetched.length > 0) {
          setClips(fetched);
          setActiveClip(fetched[Math.floor(Math.random() * fetched.length)]);
        }
      } catch {
        /* silently fail — player stays on channel page */
      }
    }

    fetchClips();
  }, [loading, isLive]);

  const shuffleClip = useCallback(() => {
    if (clips.length < 2) return;
    let next: TwitchClip;
    do {
      next = clips[Math.floor(Math.random() * clips.length)];
    } while (next.id === activeClip?.id);
    setActiveClip(next);
  }, [clips, activeClip]);

  const goNextClip = useCallback(() => {
    if (clips.length < 2 || !activeClip) return;
    const idx = clips.findIndex((c) => c.id === activeClip.id);
    setActiveClip(clips[(idx + 1) % clips.length]);
  }, [clips, activeClip]);

  const goPrevClip = useCallback(() => {
    if (clips.length < 2 || !activeClip) return;
    const idx = clips.findIndex((c) => c.id === activeClip.id);
    setActiveClip(clips[(idx - 1 + clips.length) % clips.length]);
  }, [clips, activeClip]);

  /* ── Twitch JS Embed with quality control ─────────────────── */
  useEffect(() => {
    if (!isLive || loading || !hostname || hostname === "localhost") return;
    const container = liveContainerRef.current;
    if (!container) return;

    function initEmbed() {
      if (!window.Twitch || !container) return;
      // Destroy previous embed if any
      container.innerHTML = "";
      twitchEmbedRef.current = null;

      const embed = new window.Twitch.Embed(container, {
        channel: TWITCH_CHANNEL,
        width: "100%",
        height: "100%",
        layout: "video",
        autoplay: true,
        theme: "dark",
        parent: [hostname],
      });

      embed.addEventListener(window.Twitch.Embed.VIDEO_READY, () => {
        const player = embed.getPlayer();
        try {
          const qualities: Array<{ name: string }> = player.getQualities();
          const preferred =
            qualities.find((q) => /^1080/.test(q.name)) ||
            qualities.find((q) => /^720/.test(q.name));
          if (preferred) player.setQuality(preferred.name);
        } catch {
          // getQualities may not be available yet; player stays on auto
        }
      });

      twitchEmbedRef.current = embed;
    }

    if (window.Twitch) {
      initEmbed();
    } else if (!window._twitchScriptLoaded) {
      window._twitchScriptLoaded = true;
      const script = document.createElement("script");
      script.src = "https://player.twitch.tv/js/embed/v1.js";
      script.onload = initEmbed;
      document.head.appendChild(script);
    } else {
      // Script tag already injected but not yet loaded — poll until ready
      const poll = setInterval(() => {
        if (window.Twitch) { clearInterval(poll); initEmbed(); }
      }, 100);
      return () => clearInterval(poll);
    }

    return () => {
      if (container) container.innerHTML = "";
      twitchEmbedRef.current = null;
    };
  }, [isLive, loading, hostname]);

  return (
    <section
      id="stream"
      className="relative py-12 px-4 sm:px-6 lg:px-8 min-h-screen"
    >
      <div className="relative max-w-[1400px] mx-auto">
        {/* Status indicator */}
        <ScrollReveal>
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div
              className={`w-2.5 h-2.5 rounded-full ${
                isLive ? "bg-green-500" : "bg-arena-ash"
              }`}
              animate={isLive ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="gladiator-label text-sm">
              {loading ? (
                <span className="text-arena-smoke">A verificar...</span>
              ) : isLive ? (
                <span className="text-green-400 arena-glow">EM DIRETO</span>
              ) : (
                <span className="text-arena-ash">OFFLINE</span>
              )}
            </span>
          </div>
        </ScrollReveal>

        {/* Stream + Chat side by side (chat hidden when offline) */}
        <ScrollReveal delay={0.1}>
          <div className={`grid grid-cols-1 gap-4 ${isLive ? "lg:grid-cols-[1fr_380px]" : "max-w-5xl mx-auto"}`}>
            {/* Stream / Clip player */}
            <div className="relative w-full aspect-video bg-arena-black rounded-2xl overflow-hidden arena-border-crimson metal-frame-glow shadow-2xl shadow-black/60">
              {/* Live: Twitch JS Embed (quality-controlled) */}
              {isLive && !loading && (
                <div
                  ref={liveContainerRef}
                  className="absolute inset-0 w-full h-full z-10"
                />
              )}
              {/* Loading state: fallback iframe while status resolves */}
              {loading && (
                <iframe
                  src={`https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${hostname}`}
                  className="absolute inset-0 w-full h-full z-10"
                  allowFullScreen
                  title={`${TWITCH_CHANNEL} live stream`}
                />
              )}

              {!isLive && !loading && activeClip && (
                <>
                  <iframe
                    key={activeClip.id}
                    src={`https://clips.twitch.tv/embed?clip=${activeClip.id}&parent=${hostname}&autoplay=true&muted=false`}
                    className="absolute inset-0 w-full h-full z-10"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title={activeClip.title}
                  />
                  <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {activeClip.title}
                      </p>
                      <p className="text-arena-smoke text-xs">
                        Clipped by {activeClip.creator_name} · {activeClip.view_count.toLocaleString()} views
                      </p>
                    </div>
                  </div>
                </>
              )}

              {!isLive && !loading && !activeClip && (
                <iframe
                  src={`https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${hostname}`}
                  className="absolute inset-0 w-full h-full z-10"
                  allowFullScreen
                  title={`${TWITCH_CHANNEL} channel`}
                />
              )}
            </div>

            {/* Prev / Next clip buttons */}
            {!isLive && !loading && activeClip && clips.length > 1 && (
              <div className="flex items-center justify-between mt-3 lg:col-span-1" style={{ gridColumn: "1" }}>
                <button
                  onClick={goPrevClip}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg border border-arena-gold/30 bg-arena-gold/10 hover:bg-arena-gold/20 text-arena-gold font-[family-name:var(--font-display)] text-sm tracking-wider transition-all duration-300 hover:border-arena-gold/50 hover:shadow-[0_0_12px_rgba(212,168,67,0.15)]"
                  aria-label="Clip anterior"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  CLIP ANTERIOR
                </button>
                <button
                  onClick={goNextClip}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg border border-arena-gold/30 bg-arena-gold/10 hover:bg-arena-gold/20 text-arena-gold font-[family-name:var(--font-display)] text-sm tracking-wider transition-all duration-300 hover:border-arena-gold/50 hover:shadow-[0_0_12px_rgba(212,168,67,0.15)]"
                  aria-label="Próximo clip"
                >
                  PRÓXIMO CLIP
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            {/* Chat — only visible when live */}
            {isLive && (
            <div className="relative bg-arena-black rounded-2xl overflow-hidden arena-border-crimson metal-frame-glow shadow-2xl shadow-black/60 min-h-[400px] lg:min-h-0 flex flex-col">
              {/* Emblem header — overlays Twitch's "Stream Chat" bar */}
              <div className="relative z-20 flex items-center justify-center gap-2 py-0 bg-gradient-to-b from-arena-charcoal to-arena-dark border-b border-white/5">
                <img
                  src="/images/BrutoEmblem.png"
                  alt="SECAADEGAS"
                  className="w-28 h-28 object-contain"
                />
                <span className="gladiator-label text-arena-gold text-sm font-bold arena-glow">
                  Arena Chat
                </span>
              </div>

              {/* Chat iframe — starts behind the header to hide Twitch's native bar */}
              <div className="relative flex-1 overflow-hidden" style={{ marginTop: "-40px" }}>
                <iframe
                  src={`https://www.twitch.tv/embed/${TWITCH_CHANNEL}/chat?parent=${hostname}&darkpopout`}
                  className="absolute inset-0 w-full h-full z-10"
                  title="Twitch chat"
                />
              </div>
            </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
