import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("brothel_worker_defs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ def: data });
}

const EDITABLE = [
  "name", "slug", "description", "rarity", "hire_price", "hire_uses_crypto",
  "earnings_per_hour", "traits", "stat_attractiveness", "stat_stamina",
  "stat_mood", "stat_charisma", "sort_order", "enabled",
] as const;

export async function PUT(req: NextRequest, { params }: Params) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("brothel_worker_defs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "update", "worker_def", id, data.name, updates);
  return NextResponse.json({ def: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await supabase
    .from("brothel_worker_defs")
    .select("name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("brothel_worker_defs")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "delete", "worker_def", id, existing?.name ?? id, {});
  return NextResponse.json({ ok: true });
}
