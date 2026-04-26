import { supabase } from "@/lib/supabase";

/**
 * Grants respect to a player. Centralized so future tweaks (caps,
 * multipliers, anti-exploit) live in one place.
 */
export async function grantRespect(playerId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const { data: p } = await supabase
    .from("crime_players")
    .select("respect")
    .eq("id", playerId)
    .single();
  if (!p) return;
  await supabase
    .from("crime_players")
    .update({ respect: (p.respect ?? 0) + Math.floor(amount) })
    .eq("id", playerId);
}
