import { supabase } from "@/lib/supabase";
import { getXPMultiplier } from "@/lib/crime-empire/system-settings";

/**
 * Grants XP to a player.
 * - Applies the global `xp_multiplier` admin setting.
 * - Correctly recalculates the threshold on every individual level-up,
 *   preventing level-skipping when a large XP reward spans multiple levels.
 */
export async function grantXP(playerId: string, xpEarned: number): Promise<void> {
  if (xpEarned <= 0) return;

  const multiplier = await getXPMultiplier();
  const scaled = Math.round(xpEarned * multiplier);
  if (scaled <= 0) return;

  const { data: p } = await supabase
    .from("crime_players")
    .select("xp, level, xp_to_next_level")
    .eq("id", playerId)
    .single();
  if (!p) return;

  let newXP = p.xp + scaled;
  let newLevel = p.level;
  let threshold = p.xp_to_next_level;

  while (newXP >= threshold) {
    newXP -= threshold;
    newLevel++;
    threshold = Math.floor(100 * Math.pow(1.25, newLevel - 1));
  }

  await supabase
    .from("crime_players")
    .update({ xp: newXP, level: newLevel, xp_to_next_level: threshold })
    .eq("id", playerId);
}
