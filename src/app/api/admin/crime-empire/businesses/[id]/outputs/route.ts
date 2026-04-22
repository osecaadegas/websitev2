import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("business_output_items")
    .select("id, quantity_per_hour, drop_chance, item_id, items(id, name, image_url, category)")
    .eq("business_id", id)
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outputs: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: business_id } = await params;
  const { item_id, quantity_per_hour = 1, drop_chance = 1.0 } = await req.json();

  if (!item_id) return NextResponse.json({ error: "item_id é obrigatório" }, { status: 400 });
  if (drop_chance <= 0 || drop_chance > 1) {
    return NextResponse.json({ error: "drop_chance deve estar entre 0.01 e 1" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("business_output_items")
    .upsert({ business_id, item_id, quantity_per_hour, drop_chance }, { onConflict: "business_id,item_id" })
    .select("id, quantity_per_hour, drop_chance, item_id, items(id, name, image_url, category)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ output: data }, { status: 201 });
}
