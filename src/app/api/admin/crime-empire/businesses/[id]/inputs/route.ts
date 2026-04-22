import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("business_input_items")
    .select("id, quantity_per_hour, item_id, items(id, name, image_url, category)")
    .eq("business_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inputs: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: business_id } = await params;
  const { item_id, quantity_per_hour = 1 } = await req.json();

  if (!item_id) return NextResponse.json({ error: "item_id é obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("business_input_items")
    .upsert({ business_id, item_id, quantity_per_hour }, { onConflict: "business_id,item_id" })
    .select("id, quantity_per_hour, item_id, items(id, name, image_url, category)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ input: data }, { status: 201 });
}
