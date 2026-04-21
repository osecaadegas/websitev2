"use client";

import { useState, useEffect } from "react";

export function SEOverlay() {
  const [channelId, setChannelId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/streamelements?endpoint=channel")
      .then((r) => r.json())
      .then((d) => setChannelId(d.channelId || null))
      .catch(() => setChannelId(null));
  }, []);

  if (!channelId) return null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span className="text-arena-gold">🎬</span> Stream Overlay
        </h3>
        <p className="text-xs text-white/40 mt-1">
          Overlay em tempo real do StreamElements
        </p>
      </div>
      <div className="aspect-video w-full">
        <iframe
          src={`https://streamelements.com/overlay/${channelId}`}
          className="h-full w-full border-0"
          allow="autoplay"
          title="StreamElements Overlay"
        />
      </div>
    </div>
  );
}
