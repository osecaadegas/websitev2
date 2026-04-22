import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q    = searchParams.get("q") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("ce_shop_listings")
    .select("*, item:items(id, name, category, rarity, base_price)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) query = query.ilike("items.name", `%${q}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the nested item join into flat fields the UI expects
  const listings = (data || []).map((row: any) => ({
    ...row,
    item_name:       row.item?.name       ?? "",
    item_category:   row.item?.category   ?? "",
    item_rarity:     row.item?.rarity     ?? "common",
    item_base_price: row.item?.base_price ?? 0,
  }));

  return NextResponse.json({ listings, total: count || 0, page, limit });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { item_id, price_override, stock, rotation_type = "permanent", rotation_ends_at } = body;

  if (!item_id) return NextResponse.json({ error: "item_id obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("ce_shop_listings")
    .insert({ item_id, price_override: price_override ?? null, stock: stock ?? null, rotation_type, rotation_ends_at: rotation_ends_at ?? null, enabled: true })
    .select("*, item:items(id, name, category)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "create", "shop", data.id, (data.item as any)?.name, { price_override, stock, rotation_type });
  return NextResponse.json({ listing: data }, { status: 201 });
}
