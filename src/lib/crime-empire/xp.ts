import { supabase } from "@/lib/supabase";
import { getXPMultiplier } from "@/lib/crime-empire/system-settings";

/* ──────────────────────────────────────────────────────────────
 * XP CURVE v2  —  smooth power curve, no bands, no cliffs.
 *
 *   xpForLevel(L) = floor(60 * L^1.85)
 *
 * Total XP to L120 ≈ 19.06M. Designed against a global 120k XP/h
 * cap (see HOURLY_CAP) so even full-cap play needs ~14 days minimum.
 *
 * Anti-exploit: per-source hourly buckets + diminishing returns
 * past 70% in <30 min + global hourly ceiling. State stored in
 * crime_players.xp_buckets (JSONB).
 * ──────────────────────────────────────────────────────────────*/

const XP_CURVE_BASE = 60;
const XP_CURVE_EXPONENT = 1.85;

/** XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  const L = Math.max(1, level);
  return Math.max(10, Math.floor(XP_CURVE_BASE * Math.pow(L, XP_CURVE_EXPONENT)));
}

/* ── Anti-exploit configuration ──────────────────────────────── */

export type XPSource =
  | "crime"
  | "street"
  | "contract"
  | "hitman"
  | "pvp"
  | "mission"
  | "brothel"
  | "business"
  | "casino"
  | "passive";

const HOURLY_CAP: Record<XPSource, number> = {
  crime:    60_000,
  street:   35_000,
  contract: 20_000,
  hitman:   12_000,
  pvp:       8_000,
  mission:  30_000,
  brothel:  12_000,
  business: 18_000,
  casino:      600, // hard ceiling — casino is entertainment, not progression
  passive:   1_500,
};

const GLOBAL_HOURLY_CAP = 120_000;
const WINDOW_MS = 3_600_000;

type Bucket = { window_start: string; spent: number };
type BucketMap = Record<string, Bucket>;

function rollBucket(b: Bucket | undefined, now: number): Bucket {
  if (!b || now - new Date(b.window_start).getTime() >= WINDOW_MS) {
    return { window_start: new Date(now).toISOString(), spent: 0 };
  }
  return b;
}

/**
 * Grants XP to a player.
 *
 * @param source Anti-exploit category. Defaults to "crime" so legacy call
 *               sites compile, but every site should pass an explicit source.
 * @returns { granted, capped } — `granted` is the actual XP added after
 *          caps and diminishing returns; `capped` is true when the request
 *          was reduced.
 */
export async function grantXP(
  playerId: string,
  xpEarned: number,
  source: XPSource = "crime",
): Promise<{ granted: number; capped: boolean }> {
  if (xpEarned <= 0) return { granted: 0, capped: false };

  const multiplier = await getXPMultiplier();

  const { data: p } = await supabase
    .from("crime_players")
    .select("xp, level, xp_to_next_level, xp_buckets")
    .eq("id", playerId)
    .single();
  if (!p) return { granted: 0, capped: false };

  const now = Date.now();
  const buckets: BucketMap = ((p as any).xp_buckets ?? {}) as BucketMap;

  const srcBucket = rollBucket(buckets[source], now);
  const globalBucket = rollBucket(buckets.__global__, now);

  const remainingSrc    = Math.max(0, HOURLY_CAP[source]     - srcBucket.spent);
  const remainingGlobal = Math.max(0, GLOBAL_HOURLY_CAP      - globalBucket.spent);

  // Apply admin multiplier first.
  let granted = Math.round(xpEarned * multiplier);
  granted = Math.min(granted, remainingSrc, remainingGlobal);

  // Diminishing returns: past 70% of source bucket in <30 min → 50% pay-out.
  const minutesIn = (now - new Date(srcBucket.window_start).getTime()) / 60_000;
  if (minutesIn < 30 && srcBucket.spent / HOURLY_CAP[source] > 0.7) {
    granted = Math.floor(granted * 0.5);
  }

  if (granted <= 0) {
    // Persist updated buckets so windows roll correctly even on full caps.
    buckets[source] = srcBucket;
    buckets.__global__ = globalBucket;
    await supabase.from("crime_players").update({ xp_buckets: buckets }).eq("id", playerId);
    return { granted: 0, capped: true };
  }

  srcBucket.spent    += granted;
  globalBucket.spent += granted;
  buckets[source]    = srcBucket;
  buckets.__global__ = globalBucket;

  let newXP = p.xp + granted;
  let newLevel = p.level;
  let threshold = xpForLevel(newLevel);

  while (newXP >= threshold) {
    newXP -= threshold;
    newLevel++;
    threshold = xpForLevel(newLevel);
  }

  await supabase
    .from("crime_players")
    .update({
      xp: newXP,
      level: newLevel,
      xp_to_next_level: threshold,
      xp_buckets: buckets,
    })
    .eq("id", playerId);

  return { granted, capped: granted < Math.round(xpEarned * multiplier) };
}
