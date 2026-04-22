import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q          = searchParams.get("q") || "";
  const difficulty = searchParams.get("difficulty") || "";
  const page       = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit      = 50;
  const offset     = (page - 1) * limit;

  let query = supabase
    .from("crimes")
    .select("*", { count: "exact" })
    .order("required_level", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q)          query = query.ilike("name", `%${q}%`);
  if (difficulty) query = query.eq("difficulty", difficulty);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ crimes: data || [], total: count || 0, page, limit });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, description, difficulty, required_level = 1, required_power = 0,
    required_intelligence = 0, base_success_rate, jail_risk = 0.1,
    stamina_cost = 10, min_dirty_cash, max_dirty_cash, xp_reward = 50,
    respect_reward = 5, cooldown_minutes = 0,
  } = body;

  if (!name || !difficulty || base_success_rate == null || min_dirty_cash == null || max_dirty_cash == null) {
    return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crimes")
    .insert({ name, description, difficulty, required_level, required_power, required_intelligence, base_success_rate, jail_risk, stamina_cost, min_dirty_cash, max_dirty_cash, xp_reward, respect_reward, cooldown_minutes, enabled: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "create", "crime", data.id, data.name, { difficulty, base_success_rate });
  return NextResponse.json({ crime: data }, { status: 201 });
}
