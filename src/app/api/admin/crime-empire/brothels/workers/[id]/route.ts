import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const WORKER_EDITABLE = [
  "name", "status", "income_per_hour", "attractiveness", "stamina",
  "mood", "happiness", "charisma_bonus", "trait_1", "trait_2", "slug",
] as const;

export async function PUT(req: NextRequest, { params }: Params) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  for (const key of WORKER_EDITABLE) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });

  const { data, error } = await supabase
    .from("brothel_workers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "update", "brothel_worker", id, data.name, updates);
  return NextResponse.json({ worker: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await supabase
    .from("brothel_workers")
    .select("name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("brothel_workers")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "fire", "brothel_worker", id, existing?.name ?? id, {});
  return NextResponse.json({ ok: true });
}
