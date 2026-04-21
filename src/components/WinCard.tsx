"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import EmbedRenderer from "./EmbedRenderer";
import type { EmbedType } from "./EmbedRenderer";

export interface WinClip {
  id: string;
  twitch_id: string;
  username: string;
  avatar_url: string | null;
  title: string;
  description: string | null;
  url: string;
  provider: string | null;
  embed_type: EmbedType;
  embed_url: string;
  honors: number;
  created_at: string;
}

interface WinCardProps {
  clip: WinClip;
  currentUserId: string | null;
  onHonor: (id: string) => void;
  honored: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
}

/* Detect payout "€12500" or "12500€" patterns */
function parsePayout(s: string): string | null {
  const t = s.trim();
  if (/^\d+(\.\d+)?€$/.test(t)) return t;
  if (/^€\d+(\.\d+)?$/.test(t)) return t;
  return null;
}

/* Detect multiplier "2000x" pattern */
function parseMultiplier(s: string): string | null {
  const t = s.trim();
  return /^\d+(\.\d+)?x$/i.test(t) ? t : null;
}

export default function WinCard({ clip, currentUserId, onHonor, honored }: WinCardProps) {
  const [localHonors, setLocalHonors] = useState(clip.honors);
  const [localHonored, setLocalHonored] = useState(honored);
  const [loading, setLoading] = useState(false);

  const handleHonor = async () => {
    if (!currentUserId || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/user-clips/${clip.id}/honor`, { method: "POST" });
      if (res.ok) {
        const { honored: newHonored } = await res.json();
        setLocalHonored(newHonored);
        setLocalHonors((n) => n + (newHonored ? 1 : -1));
        onHonor(clip.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const payout     = clip.title       ? parsePayout(clip.title)           : null;
  const multiplier = clip.description ? parseMultiplier(clip.description) : null;
  /* Fall back to plain text display if not stat-format */
  const textTitle = !payout       ? clip.title                 : null;
  const textDesc  = !multiplier   ? (clip.description ?? null) : null;

  return (
    <motion.article
      className="win-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      layout
    >
      {/* ── Media ───────────────────────────────────── */}
      <div className="win-card__media">
        {clip.provider && (
          <span className="win-card__provider-badge">{clip.provider}</span>
        )}
        <EmbedRenderer type={clip.embed_type} embedUrl={clip.embed_url} title={clip.title} />
      </div>

      {/* ── Body ────────────────────────────────────── */}
      <div className="win-card__body">
        {/* User row */}
        <div className="win-card__user-row">
          <div className="win-card__avatar">
            {clip.avatar_url ? (
              <Image
                src={clip.avatar_url}
                alt={clip.username}
                width={32}
                height={32}
                className="win-card__avatar-img"
                unoptimized
              />
            ) : (
              <div className="win-card__avatar-placeholder" aria-hidden="true" />
            )}
          </div>
          <span className="win-card__username">{clip.username}</span>
          <span className="win-card__dot" aria-hidden="true">·</span>
          <span className="win-card__date">{formatDate(clip.created_at)}</span>
        </div>

        {/* Stats (payout + multiplier) */}
        {(payout || multiplier) && (
          <div className="win-card__stats">
            {payout && (
              <div className="win-card__stat">
                <span className="win-card__stat-label">Payout</span>
                <span className="win-card__stat-value">{payout}</span>
              </div>
            )}
            {payout && multiplier && <div className="win-card__stat-divider" aria-hidden="true" />}
            {multiplier && (
              <div className="win-card__stat">
                <span className="win-card__stat-label">Multiplier</span>
                <span className="win-card__stat-value win-card__stat-value--multiplier">{multiplier}</span>
              </div>
            )}
          </div>
        )}

        {/* Fallback plain-text title/description for legacy entries */}
        {textTitle && <h3 className="win-card__title">{textTitle}</h3>}
        {textDesc  && <p  className="win-card__description">{textDesc}</p>}

        {/* Honor */}
        <div className="win-card__footer">
          <button
            className={`win-card__honor-btn${localHonored ? " win-card__honor-btn--active" : ""}`}
            onClick={handleHonor}
            disabled={!currentUserId || loading}
            aria-label={localHonored ? "Remover Honra" : "Dar Honra"}
            title={!currentUserId ? "Faz login para dar honra" : undefined}
          >
            <svg
              className="win-card__honor-icon"
              viewBox="0 0 24 24"
              fill={localHonored ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span className="win-card__honor-count">{localHonors}</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
