import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

const EDITABLE = [
  "name","description","category","rarity","power_bonus","intelligence_bonus",
  "charisma_bonus","hp_bonus","stamina_restore","base_price","tradeable",
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase.from("items").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  return NextResponse.json({ item: data });
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

  const { data, error } = await supabase.from("items").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "update", "item", id, data.name, updates);
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: item } = await supabase.from("items").select("name").eq("id", id).single();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "delete", "item", id, item?.name);
  return NextResponse.json({ success: true });
}
