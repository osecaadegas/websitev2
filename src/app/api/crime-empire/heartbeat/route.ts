import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { grantXP } from "@/lib/crime-empire/xp";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * POST /api/crime-empire/heartbeat
 *
 * Passive XP tick for active players. Grants 30 + 2×level XP per call,
 * routed through the 'passive' bucket which caps at 1500 XP/h. The
 * bucket effectively limits this to ~5–10 ticks/hour regardless of how
 * often the client polls — no extra server-side throttling needed.
 *
 * Intended cadence: client calls once every ~10 minutes while active.
 */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const xp = 30 + 2 * (player.level ?? 1);
  const result = await grantXP(player.id, xp, "passive");

  return NextResponse.json({ success: true, xp_granted: result.granted, capped: result.capped });
}
