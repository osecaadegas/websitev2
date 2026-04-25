import { supabase } from "@/lib/supabase";

/**
 * Returns a multiplier derived from the `police_intensity` system setting.
 *   0  → 0× (police completely off)
 *  50  → 1× (default / neutral)
 * 100  → 2× (maximum pressure)
 *
 * Used by crimes, businesses, brothels, and street routes.
 */
export async function getPoliceMultiplier(): Promise<number> {
  const { data } = await supabase
    .from("ce_system_settings")
    .select("value")
    .eq("key", "police_intensity")
    .single();
  const intensity = Number(data?.value ?? 50);
  return Math.min(2, Math.max(0, intensity / 50));
}

/**
 * Returns the global XP multiplier from the `xp_multiplier` system setting.
 * Default is 1.0 (no bonus). Admins can raise it to e.g. 2.0 for XP events.
 */
export async function getXPMultiplier(): Promise<number> {
  const { data } = await supabase
    .from("ce_system_settings")
    .select("value")
    .eq("key", "xp_multiplier")
    .single();
  const mult = Number(data?.value ?? 1.0);
  return Math.max(0, mult);
}
