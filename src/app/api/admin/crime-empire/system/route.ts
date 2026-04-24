import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("ce_system_settings")
    .select("*")
    .order("key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten key/value map for easy consumption
  const settings: Record<string, unknown> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ settings, rows: data || [] });
}

export async function PUT(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { key, value } = body;

  const ALLOWED_KEYS = ["police_intensity", "maintenance_mode", "crime_multiplier", "income_multiplier", "xp_multiplier", "street_qty_min", "street_qty_max"];
  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: "Chave inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ce_system_settings")
    .update({ value, updated_at: new Date().toISOString(), updated_by: admin.login })
    .eq("key", key)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "system", "system", null, key, { key, value });
  return NextResponse.json({ setting: data });
}
