import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/admin/db-check — Check which tables exist in Supabase
 */
export async function GET() {
  const results: Record<string, { exists: boolean; error?: string; rowCount?: number }> = {};

  // List of tables to check
  const tables = [
    "page_settings",
    "notifications",
    "crime_players",
    "crimes",
    "player_crime_experience",
    "crime_attempts",
    "jail_records",
    "businesses",
    "player_businesses",
    "items",
    "player_inventory",
    "pvp_battles",
    "contracts",
    "brothel_workers",
    "black_market_transactions",
    "player_stats",
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        results[table] = { exists: false, error: error.message };
      } else {
        results[table] = { exists: true, rowCount: count ?? 0 };
      }
    } catch (err) {
      results[table] = { exists: false, error: String(err) };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: tables.length,
      existing: Object.values(results).filter((r) => r.exists).length,
      missing: Object.values(results).filter((r) => !r.exists).length,
    },
  });
}
