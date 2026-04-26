import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { getPlayerMissions, updateLoginStreak } from "@/lib/crime-empire/missions";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Update login streak (idempotent for same-day calls)
  const streak = await updateLoginStreak(player.id);

  const { daily, weekly } = await getPlayerMissions(player.id);

  return NextResponse.json({
    daily,
    weekly,
    streak,
    player: { id: player.id, level: player.level },
  });
}
