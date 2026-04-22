import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

const EDITABLE = [
  "name","description","difficulty","required_level","required_power","required_intelligence",
  "base_success_rate","jail_risk","stamina_cost","min_dirty_cash","max_dirty_cash",
  "xp_reward","respect_reward","cooldown_minutes","enabled",
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase.from("crimes").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Crime não encontrado" }, { status: 404 });
  return NextResponse.json({ crime: data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await supabase.from("crimes").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "update", "crime", id, data.name, updates);
  return NextResponse.json({ crime: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: crime } = await supabase.from("crimes").select("name").eq("id", id).single();
  const { error } = await supabase.from("crimes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "delete", "crime", id, crime?.name);
  return NextResponse.json({ success: true });
}
