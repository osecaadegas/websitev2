"use client";

import { useState } from "react";

export type EmbedType = "video" | "iframe" | "link";

interface EmbedRendererProps {
  type: EmbedType;
  embedUrl: string;
  title: string;
}

/* ── Extract YouTube video ID from an embed URL ───────────── */
function extractYTId(embedUrl: string): string | null {
  return embedUrl.match(/\/embed\/([a-zA-Z0-9_-]{8,15})/)?.[1] ?? null;
}

/* ── YouTube — thumbnail facade + lazy iframe ─────────────── */
function IframeEmbed({ src, title }: { src: string; title: string }) {
  const [active, setActive] = useState(false);
  const videoId = extractYTId(src);
  const thumb   = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null;

  if (!active && thumb) {
    return (
      <div
        className="win-embed__thumb"
        role="button"
        tabIndex={0}
        aria-label={`Reproduzir ${title}`}
        onClick={() => setActive(true)}
        onKeyDown={(e) => e.key === "Enter" && setActive(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={title}
          className="win-embed__thumb-img"
          loading="lazy"
          decoding="async"
        />
        <div className="win-embed__play-btn" aria-hidden="true">
          <svg viewBox="0 0 36 36" fill="currentColor">
            <circle cx="18" cy="18" r="18" className="win-embed__play-bg" />
            <path d="M14 11l14 7-14 7V11z" className="win-embed__play-arrow" />
          </svg>
        </div>
        <div className="win-embed__thumb-overlay" aria-hidden="true" />
      </div>
    );
  }

  /* Active — load iframe (with autoplay if user clicked thumbnail) */
  const activeSrc = active && !src.includes("autoplay")
    ? `${src}&autoplay=1`
    : src;

  return (
    <div className="win-embed__iframe-wrap">
      <iframe
        className="win-embed__iframe"
        src={activeSrc}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
    </div>
  );
}

/* ── Direct video file ────────────────────────────────────── */
function VideoEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div className="win-embed__iframe-wrap">
      <video
        className="win-embed__video"
        controls
        preload="metadata"
        aria-label={title}
        playsInline
      >
        <source src={src} />
        <a href={src} target="_blank" rel="noopener noreferrer" className="win-embed__ext-link">
          Ver vídeo
        </a>
      </video>
    </div>
  );
}

/* ── Link fallback ────────────────────────────────────────── */
function LinkFallback({ href, title }: { href: string; title: string }) {
  return (
    <div className="win-embed__link-fallback">
      <svg className="win-embed__link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M13 10H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        <path d="M8 10V6a4 4 0 0 1 8 0v1" />
        <path d="M18 2l4 4-4 4M22 6H13" />
      </svg>
      <p className="win-embed__link-label">{title}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="win-embed__cta"
      >
        Abrir Replay
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </a>
    </div>
  );
}

export default function EmbedRenderer({ type, embedUrl, title }: EmbedRendererProps) {
  if (type === "video")  return <VideoEmbed  src={embedUrl} title={title} />;
  if (type === "iframe") return <IframeEmbed src={embedUrl} title={title} />;
  return <LinkFallback href={embedUrl} title={title} />;
}
