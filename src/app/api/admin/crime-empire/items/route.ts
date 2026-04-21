import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q        = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const rarity   = searchParams.get("rarity") || "";
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit    = 50;
  const offset   = (page - 1) * limit;

  let query = supabase
    .from("items")
    .select("*", { count: "exact" })
    .order("base_price", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q)        query = query.ilike("name", `%${q}%`);
  if (category) query = query.eq("category", category);
  if (rarity)   query = query.eq("rarity", rarity);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [], total: count || 0, page, limit });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, description, category, rarity = "common",
    power_bonus = 0, intelligence_bonus = 0, charisma_bonus = 0,
    hp_bonus = 0, stamina_restore = 0, base_price, tradeable = true,
  } = body;

  if (!name || !category || base_price == null) {
    return NextResponse.json({ error: "name, category e base_price são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items")
    .insert({ name, description, category, rarity, power_bonus, intelligence_bonus, charisma_bonus, hp_bonus, stamina_restore, base_price, tradeable })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "create", "item", data.id, data.name, { category, rarity, base_price });
  return NextResponse.json({ item: data }, { status: 201 });
}
