import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all player brothels, join crime_players for username
  const { data: brothels, error } = await supabase
    .from("player_brothels")
    .select(`
      id,
      player_id,
      brothel_type_id,
      supply_drinks,
      supply_hygiene,
      supply_security,
      client_satisfaction,
      heat_level,
      upgrade_vip_rooms,
      upgrade_lighting,
      upgrade_security,
      upgrade_marketing,
      total_earned,
      last_collection,
      max_employees,
      created_at,
      crime_players (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each brothel, fetch worker count
  const brothelIds = (brothels || []).map((b) => b.id);
  let workerCounts: Record<string, number> = {};

  if (brothelIds.length > 0) {
    const { data: workers } = await supabase
      .from("brothel_workers")
      .select("player_brothel_id")
      .in("player_brothel_id", brothelIds);

    if (workers) {
      for (const w of workers) {
        workerCounts[w.player_brothel_id] = (workerCounts[w.player_brothel_id] || 0) + 1;
      }
    }
  }

  const result = (brothels || []).map((b) => ({
    ...b,
    worker_count: workerCounts[b.id] || 0,
  }));

  return NextResponse.json({ brothels: result });
}
