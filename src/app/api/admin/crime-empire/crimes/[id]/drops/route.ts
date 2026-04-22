import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("crime_item_drops")
    .select("id, drop_chance, item_id, items(id, name, image_url, category)")
    .eq("crime_id", id)
    .order("drop_chance", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drops: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: crime_id } = await params;
  const { item_id, drop_chance } = await req.json();

  if (!item_id || drop_chance == null) {
    return NextResponse.json({ error: "item_id e drop_chance são obrigatórios" }, { status: 400 });
  }
  if (drop_chance <= 0 || drop_chance > 1) {
    return NextResponse.json({ error: "drop_chance deve estar entre 0.01 e 1" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crime_item_drops")
    .upsert({ crime_id, item_id, drop_chance }, { onConflict: "crime_id,item_id" })
    .select("id, drop_chance, item_id, items(id, name, image_url, category)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drop: data }, { status: 201 });
}
