import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getCasinoFee(level: number): number {
  if (level < 10) return 0;
  if (level < 25) return 500;
  if (level < 50) return 1500;
  return 3000;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, dirty_cash, crypto, username")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const { data: history } = await supabase
    .from("gambling_history")
    .select("game_type, bet_amount, payout, profit, created_at")
    .eq("player_id", player.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    player: {
      level: player.level,
      dirty_cash: player.dirty_cash,
      crypto: player.crypto,
      username: player.username,
    },
    casinoFee: getCasinoFee(player.level),
    history: history || [],
  });
}
