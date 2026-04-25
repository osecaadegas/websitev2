import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Active sessions
  const { data: activeSessions } = await supabase
    .from("street_sessions")
    .select("id, player_id, zone, heat, started_at, crime_players(username)")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(20);

  // Recent deals (last 50)
  const { data: recentDeals } = await supabase
    .from("street_deals")
    .select("id, session_id, agreed_price, quantity, success, snitched, heat_added, created_at, street_sessions(zone, crime_players(username)), items(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  // Summary stats: total deals today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayDeals } = await supabase
    .from("street_deals")
    .select("success, snitched, agreed_price, quantity")
    .gte("created_at", today.toISOString());

  const successful = (todayDeals || []).filter((d: any) => d.success);
  const snitched = (todayDeals || []).filter((d: any) => d.snitched);
  const totalRevenue = successful.reduce(
    (sum: number, d: any) => sum + (d.agreed_price ?? 0) * (d.quantity ?? 0),
    0
  );

  // Zone breakdown (all time)
  const { data: zoneStats } = await supabase
    .from("street_deals")
    .select("street_sessions(zone), success")
    .eq("success", true);

  const zoneBreakdown: Record<string, number> = {};
  for (const row of zoneStats || []) {
    const zone = (row as any).street_sessions?.zone ?? "unknown";
    zoneBreakdown[zone] = (zoneBreakdown[zone] ?? 0) + 1;
  }

  // Street settings
  const { data: settingsRows } = await supabase
    .from("ce_system_settings")
    .select("key, value")
    .in("key", ["street_qty_min", "street_qty_max", "street_heat_mult", "street_budget_mult", "street_enabled"]);

  const settings: Record<string, string> = {};
  for (const row of settingsRows || []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({
    activeSessions: activeSessions || [],
    recentDeals: recentDeals || [],
    today: {
      total: (todayDeals || []).length,
      successful: successful.length,
      snitched: snitched.length,
      revenue: totalRevenue,
    },
    zoneBreakdown,
    settings,
  });
}
