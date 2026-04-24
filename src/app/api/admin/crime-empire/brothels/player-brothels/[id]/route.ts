import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: brothel, error }, { data: workers }] = await Promise.all([
    supabase
      .from("player_brothels")
      .select("*, crime_players(id, username, display_name, avatar_url)")
      .eq("id", id)
      .single(),
    supabase
      .from("brothel_workers")
      .select("*")
      .eq("player_brothel_id", id)
      .order("name"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ brothel, workers: workers || [] });
}

const BROTHEL_EDITABLE = [
  "supply_drinks", "supply_hygiene", "supply_security",
  "client_satisfaction", "heat_level",
  "upgrade_vip_rooms", "upgrade_lighting", "upgrade_security", "upgrade_marketing",
  "max_employees",
] as const;

export async function PUT(req: NextRequest, { params }: Params) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  for (const key of BROTHEL_EDITABLE) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });

  const { data, error } = await supabase
    .from("player_brothels")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "update", "player_brothel", id, id, updates);
  return NextResponse.json({ brothel: data });
}
