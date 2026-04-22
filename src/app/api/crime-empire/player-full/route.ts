import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Fetch all extra data in parallel
  const [statsRes, businessRes, equippedRes, sharesRes] = await Promise.all([
    supabase
      .from("player_stats")
      .select("total_crimes_attempted, total_crimes_succeeded, pvp_wins, pvp_losses, contracts_completed, times_jailed")
      .eq("player_id", player.id)
      .single(),

    supabase
      .from("player_businesses")
      .select("id, employees, businesses(name)")
      .eq("player_id", player.id)
      .eq("active", true),

    supabase
      .from("player_inventory")
      .select("id")
      .eq("player_id", player.id)
      .eq("equipped", true),

    supabase
      .from("stock_positions")
      .select("display_symbol, display_name, quantity, bought_price, dirty_cash_invested")
      .eq("player_id", player.id),
  ]);

  const stats = statsRes.data;
  const businesses = businessRes.data ?? [];
  const equippedItems = equippedRes.data ?? [];
  const shares = sharesRes.data ?? [];

  const totalWorkers = businesses.reduce((sum, b) => sum + (b.employees ?? 0), 0);

  return NextResponse.json({
    player,
    extended: {
      total_crimes_attempted: stats?.total_crimes_attempted ?? 0,
      total_crimes_succeeded: stats?.total_crimes_succeeded ?? 0,
      pvp_wins: stats?.pvp_wins ?? 0,
      pvp_losses: stats?.pvp_losses ?? 0,
      contracts_completed: stats?.contracts_completed ?? 0,
      times_jailed: stats?.times_jailed ?? 0,
      businesses_owned: businesses.length,
      total_workers: totalWorkers,
      equipped_items: equippedItems.length,
      shares,
    },
  });
}
