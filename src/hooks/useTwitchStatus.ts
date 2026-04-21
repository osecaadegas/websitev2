"use client";

import { useEffect, useState } from "react";

/**
 * Checks if a Twitch channel is currently live using the
 * browser-friendly oEmbed endpoint (no API key needed).
 * Falls back to offline after timeout or error.
 */
export function useTwitchStatus(channel: string) {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channel) return;

    let cancelled = false;

    async function check() {
      try {
        // Simple ping — if the embed page resolves we assume potentially live.
        // For production, replace with Twitch Helix API using server route.
        const response = await fetch(
          `/api/twitch-status?channel=${encodeURIComponent(channel)}`
        );
        if (!cancelled) {
          const data = await response.json();
          setIsLive(data.is_live ?? false);
        }
      } catch {
        if (!cancelled) setIsLive(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();
    const interval = setInterval(check, 60_000); // poll every 60s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [channel]);

  return { isLive, loading };
}
