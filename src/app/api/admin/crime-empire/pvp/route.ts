import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 40;
  const offset = (page - 1) * limit;

  const [battlesRes, settingsRes, totalRes] = await Promise.all([
    supabase
      .from("pvp_battles")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase.from("pvp_settings").select("*").eq("id", 1).single(),
    supabase.from("pvp_battles").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    battles: battlesRes.data ?? [],
    settings: settingsRes.data ?? {
      pvp_enabled: true,
      cooldown_minutes: 10,
      min_loot_percent: 5,
      max_loot_percent: 20,
      hp_after_loss_percent: 10,
    },
    total: totalRes.count ?? 0,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "update_settings") {
    const { pvp_enabled, cooldown_minutes, min_loot_percent, max_loot_percent, hp_after_loss_percent } = body;
    const { error } = await supabase.from("pvp_settings").upsert({
      id: 1,
      pvp_enabled: Boolean(pvp_enabled),
      cooldown_minutes: Math.max(0, parseInt(cooldown_minutes) || 10),
      min_loot_percent: Math.min(50, Math.max(1, parseFloat(min_loot_percent) || 5)),
      max_loot_percent: Math.min(90, Math.max(1, parseFloat(max_loot_percent) || 20)),
      hp_after_loss_percent: Math.min(50, Math.max(1, parseFloat(hp_after_loss_percent) || 10)),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete_battle") {
    const { battleId } = body;
    if (!battleId) return NextResponse.json({ error: "Battle ID required" }, { status: 400 });
    await supabase.from("pvp_battles").delete().eq("id", battleId);
    return NextResponse.json({ success: true });
  }

  if (action === "clear_all_battles") {
    await supabase.from("pvp_battles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return NextResponse.json({ success: true });
  }

  if (action === "clear_chat") {
    await supabase.from("pvp_chat").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
