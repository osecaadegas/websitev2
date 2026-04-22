import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Run all queries in parallel for performance
  const [
    businessesRes,
    brothelRes,
    crimeAttemptsRes,
    jailRes,
    pvpRes,
    inventoryRes,
    gamblingRes,
    statsRes,
  ] = await Promise.all([
    // Player-owned businesses with business details
    supabase
      .from("player_businesses")
      .select("id, employees, max_employees, upgrade_level, income_multiplier, active, last_collection, purchased_at, business:businesses(name, type, base_income_per_hour, employee_cost_per_hour)")
      .eq("player_id", id)
      .order("purchased_at", { ascending: false }),

    // Brothel workers
    supabase
      .from("brothel_workers")
      .select("id, name, status, income_per_hour, charisma_bonus, intelligence_bonus, respect_bonus, hired_at")
      .eq("player_id", id)
      .order("hired_at", { ascending: false }),

    // Crime attempts (last 50 + aggregate)
    supabase
      .from("crime_attempts")
      .select("id, success, went_to_jail, dirty_cash_earned, xp_earned, respect_earned, created_at, crime:crimes(name, difficulty)")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(50),

    // Jail records
    supabase
      .from("jail_records")
      .select("id, jail_time_minutes, release_at, released_early, release_method, amount_paid, created_at, crime:crimes(name)")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(30),

    // PvP history (as attacker or defender)
    supabase
      .from("pvp_battles")
      .select("id, attacker_id, defender_id, attacker_power, defender_power, winner_id, dirty_cash_stolen, respect_gained, xp_gained, created_at, attacker:crime_players!pvp_battles_attacker_id_fkey(username, avatar_url), defender:crime_players!pvp_battles_defender_id_fkey(username, avatar_url)")
      .or(`attacker_id.eq.${id},defender_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(30),

    // Full inventory
    supabase
      .from("player_inventory")
      .select("id, quantity, durability, equipped, acquired_at, item:items(id, name, category, rarity, image_url, base_price, power_bonus, intelligence_bonus, charisma_bonus)")
      .eq("player_id", id)
      .order("acquired_at", { ascending: false }),

    // Gambling history (last 50 + aggregate)
    supabase
      .from("gambling_history")
      .select("id, game_type, bet_amount, payout, profit, created_at")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(50),

    // Aggregate crime stats
    supabase
      .from("player_stats")
      .select("*")
      .eq("player_id", id)
      .maybeSingle(),
  ]);

  // Gambling aggregates
  const gamblingRows = gamblingRes.data || [];
  const gamblingAgg = {
    total_bets: gamblingRows.length,
    total_wagered: gamblingRows.reduce((s, r) => s + Number(r.bet_amount), 0),
    total_profit: gamblingRows.reduce((s, r) => s + Number(r.profit), 0),
    by_game: {} as Record<string, { count: number; profit: number; wagered: number }>,
  };
  for (const row of gamblingRows) {
    if (!gamblingAgg.by_game[row.game_type]) gamblingAgg.by_game[row.game_type] = { count: 0, profit: 0, wagered: 0 };
    gamblingAgg.by_game[row.game_type].count++;
    gamblingAgg.by_game[row.game_type].profit += Number(row.profit);
    gamblingAgg.by_game[row.game_type].wagered += Number(row.bet_amount);
  }

  // Crime aggregates
  const crimeRows = crimeAttemptsRes.data || [];
  const totalCrimes = crimeRows.length;
  const successCrimes = crimeRows.filter(r => r.success).length;
  const jailFromCrimes = crimeRows.filter(r => r.went_to_jail).length;

  // Business income per hour
  const bizRows = businessesRes.data || [];
  const incomePerHour = bizRows.reduce((s, b) => {
    const biz = b.business as any;
    if (!biz || !b.active) return s;
    const gross = (biz.base_income_per_hour * b.income_multiplier * b.upgrade_level);
    const workers = b.employees * (biz.employee_cost_per_hour || 0);
    return s + gross - workers;
  }, 0);

  // Bribe stats from jail_records
  const jailRows = jailRes.data || [];
  const totalJails = jailRows.length;
  const bribesAttempted = jailRows.filter(r => r.release_method === "bribe").length;
  const bribesSuccess = jailRows.filter(r => r.release_method === "bribe" && r.released_early).length;

  // PvP aggregates
  const pvpRows = pvpRes.data || [];
  const pvpWins = pvpRows.filter(r => r.winner_id === id).length;
  const pvpLosses = pvpRows.filter(r => r.winner_id !== id).length;

  return NextResponse.json({
    businesses: bizRows,
    brothel: brothelRes.data || [],
    crime_attempts: crimeRows,
    jail_records: jailRows,
    pvp_history: pvpRows,
    inventory: inventoryRes.data || [],
    gambling_history: gamblingRows,
    player_stats: statsRes.data,
    summary: {
      income_per_hour: Math.round(incomePerHour),
      total_crimes: totalCrimes,
      crimes_success: successCrimes,
      crimes_failed: totalCrimes - successCrimes,
      times_jailed: totalJails,
      bribes_attempted: bribesAttempted,
      bribes_success: bribesSuccess,
      pvp_wins: pvpWins,
      pvp_losses: pvpLosses,
      pvp_total: pvpRows.length,
      jail_from_crimes: jailFromCrimes,
      gambling: gamblingAgg,
    },
  });
}
