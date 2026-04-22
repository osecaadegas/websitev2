import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q       = searchParams.get("q") || "";
  const enabled = searchParams.get("enabled");
  const page    = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit   = 50;
  const offset  = (page - 1) * limit;

  let query = supabase
    .from("businesses")
    .select("*", { count: "exact" })
    .order("required_level", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q)              query = query.ilike("name", `%${q}%`);
  if (enabled !== "") query = query.eq("enabled", enabled === "true");

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ businesses: data || [], total: count || 0, page, limit });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, type, description, purchase_price, base_income_per_hour,
    max_employees = 5, employee_cost_per_hour = 0, required_level = 1,
    required_items = [], raid_risk = 0.05,
  } = body;

  if (!name || !type || purchase_price == null || base_income_per_hour == null) {
    return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({ name, type, description, purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour, required_level, required_items, raid_risk, enabled: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "create", "business", data.id, data.name, { type, purchase_price });
  return NextResponse.json({ business: data }, { status: 201 });
}
