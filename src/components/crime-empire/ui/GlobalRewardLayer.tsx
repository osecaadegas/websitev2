"use client";

import { useCallback, useEffect, useState } from "react";
import { RewardPop, type RewardItem } from "@/components/crime-empire/ui/RewardPop";

export interface CeRewardDetail {
  kind: RewardItem["kind"];
  text: string;
  /** CSS units, default 50% */
  x?: string;
  /** CSS units, default 35% (mid-upper viewport) */
  y?: string;
}

/**
 * Mount once in the game shell. Listens for `window` event `ce:reward`
 * and renders rising callouts above the gameplay surface.
 *
 * Fire from anywhere via the helper below or directly:
 *   window.dispatchEvent(new CustomEvent("ce:reward", { detail: { kind: "xp", text: "+120 XP" } }));
 */
export function GlobalRewardLayer() {
  const [items, setItems] = useState<RewardItem[]>([]);

  const onReward = useCallback((e: Event) => {
    const detail = (e as CustomEvent<CeRewardDetail>).detail;
    if (!detail) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // jitter the X so multiple bursts spread out
    const baseX = detail.x ?? "50%";
    setItems((prev) => [
      ...prev,
      {
        id,
        kind: detail.kind,
        text: detail.text,
        x: baseX === "50%" ? `${45 + Math.random() * 10}%` : baseX,
        y: detail.y ?? "35vh",
      },
    ]);
  }, []);

  useEffect(() => {
    window.addEventListener("ce:reward", onReward);
    return () => window.removeEventListener("ce:reward", onReward);
  }, [onReward]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <RewardPop
        items={items}
        onDone={(id) => setItems((p) => p.filter((r) => r.id !== id))}
      />
    </div>
  );
}

/** Fire a reward callout from anywhere (client only). */
export function pushReward(kind: RewardItem["kind"], text: string, opts?: { x?: string; y?: string }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CeRewardDetail>("ce:reward", {
      detail: { kind, text, x: opts?.x, y: opts?.y },
    }),
  );
}
