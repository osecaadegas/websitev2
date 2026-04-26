import { supabase } from "@/lib/supabase";
import { getXPMultiplier } from "@/lib/crime-empire/system-settings";

/* ──────────────────────────────────────────────────────────────
 * XP CURVE — piecewise scaling tuned for ~40h to prestige (L120).
 *
 *   Hook       L1–15      base 60   × 1.15  (fast onboarding)
 *   Climb      L16–40     × 1.07            (steady growth)
 *   Plateau    L41–70     × 1.045           (anti mid-game wall)
 *   Late       L71–100    × 1.05            (slower, still meaningful)
 *   Endgame    L101–120   × 1.055           (prestige push)
 *
 * Mid-game "Second Wind" catch-up: any XP earned while between
 * L40 and L70 is multiplied by 1.20 on top of the global setting.
 * ──────────────────────────────────────────────────────────────*/

const XP_CURVE_BASE = 60;

/** XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  let v = XP_CURVE_BASE;
  const stop = Math.max(1, level);
  for (let L = 2; L <= stop; L++) {
    if (L <= 15)        v *= 1.15;
    else if (L <= 40)   v *= 1.07;
    else if (L <= 70)   v *= 1.045;
    else if (L <= 100)  v *= 1.05;
    else                v *= 1.055;
  }
  return Math.max(10, Math.floor(v));
}

/** Mid-game "Second Wind" multiplier (rubberband, soft-applied). */
function midGameBoost(level: number): number {
  if (level >= 40 && level <= 70) return 1.20;
  return 1.0;
}

/**
 * Grants XP to a player.
 * - Applies the global `xp_multiplier` admin setting.
 * - Applies a Mid-Game Boost (L40–L70) to soften the historical wall.
 * - Recalculates threshold on every individual level-up to avoid skipping.
 */
export async function grantXP(playerId: string, xpEarned: number): Promise<void> {
  if (xpEarned <= 0) return;

  const multiplier = await getXPMultiplier();

  const { data: p } = await supabase
    .from("crime_players")
    .select("xp, level, xp_to_next_level")
    .eq("id", playerId)
    .single();
  if (!p) return;

  const boost = midGameBoost(p.level);
  const scaled = Math.round(xpEarned * multiplier * boost);
  if (scaled <= 0) return;

  let newXP = p.xp + scaled;
  let newLevel = p.level;
  // Recompute threshold from the new curve so old DB rows self-heal on next gain.
  let threshold = xpForLevel(newLevel);

  while (newXP >= threshold) {
    newXP -= threshold;
    newLevel++;
    threshold = xpForLevel(newLevel);
  }

  await supabase
    .from("crime_players")
    .update({ xp: newXP, level: newLevel, xp_to_next_level: threshold })
    .eq("id", playerId);
}
