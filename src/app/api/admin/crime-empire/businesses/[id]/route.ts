import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

const EDITABLE = [
  "name","description","purchase_price","base_income_per_hour","max_employees",
  "employee_cost_per_hour","required_level","required_items","raid_risk","enabled",
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase.from("businesses").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  return NextResponse.json({ business: data });
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

  const { data, error } = await supabase.from("businesses").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "update", "business", id, data.name, updates);
  return NextResponse.json({ business: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: biz } = await supabase.from("businesses").select("name").eq("id", id).single();
  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "delete", "business", id, biz?.name);
  return NextResponse.json({ success: true });
}
