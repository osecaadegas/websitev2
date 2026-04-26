"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export type RewardKind = "xp" | "cash" | "gold" | "damage";

export interface RewardItem {
  id: string;
  kind: RewardKind;
  text: string;
  /** anchor X relative to parent (default 50%) */
  x?: string;
  /** anchor Y relative to parent (default 0%) */
  y?: string;
}

interface RewardPopProps {
  items: RewardItem[];
  onDone?: (id: string) => void;
}

/**
 * Renders floating reward callouts (XP, cash, gold, damage) that rise and fade.
 * Mount once near the top of an interactive container, then push items as the
 * player earns rewards. Items auto-dismiss after the CSS animation completes.
 *
 * @example
 *   const [rewards, setRewards] = useState<RewardItem[]>([]);
 *   const onSuccess = (xp: number, cash: number) => {
 *     setRewards(prev => [
 *       ...prev,
 *       { id: crypto.randomUUID(), kind: "xp", text: `+${xp} XP` },
 *       { id: crypto.randomUUID(), kind: "cash", text: `+$${cash}` },
 *     ]);
 *   };
 *   <div className="relative">
 *     <RewardPop items={rewards} onDone={(id) => setRewards(p => p.filter(r => r.id !== id))} />
 *     ...
 *   </div>
 */
export function RewardPop({ items, onDone }: RewardPopProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[100] overflow-visible">
      <AnimatePresence>
        {items.map((it) => (
          <Pop key={it.id} item={it} onDone={onDone} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Pop({ item, onDone }: { item: RewardItem; onDone?: (id: string) => void }) {
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(false);
      onDone?.(item.id);
    }, 950);
    return () => clearTimeout(t);
  }, [item.id, onDone]);

  if (!mounted) return null;

  return (
    <motion.span
      className={`ce-reward-pop ce-reward-pop--${item.kind}`}
      style={{ left: item.x ?? "50%", top: item.y ?? "0%" }}
      initial={false}
    >
      {item.text}
    </motion.span>
  );
}
