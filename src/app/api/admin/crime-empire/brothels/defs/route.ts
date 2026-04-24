import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("brothel_worker_defs")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ defs: data || [] });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    id, slug, name, description, rarity, hire_price, hire_uses_crypto,
    earnings_per_hour, traits, stat_attractiveness, stat_stamina,
    stat_mood, stat_charisma, sort_order, enabled,
  } = body;

  if (!id || !slug || !name || !rarity)
    return NextResponse.json({ error: "id, slug, name and rarity are required" }, { status: 400 });

  const { data, error } = await supabase
    .from("brothel_worker_defs")
    .insert({
      id, slug, name,
      description: description ?? "",
      rarity,
      hire_price: hire_price ?? 10000,
      hire_uses_crypto: hire_uses_crypto ?? false,
      earnings_per_hour: earnings_per_hour ?? 300,
      traits: traits ?? [],
      stat_attractiveness: stat_attractiveness ?? 50,
      stat_stamina: stat_stamina ?? 50,
      stat_mood: stat_mood ?? 50,
      stat_charisma: stat_charisma ?? 50,
      sort_order: sort_order ?? 0,
      enabled: enabled ?? true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "create", "worker_def", id, name, { slug, rarity, hire_price });
  return NextResponse.json({ def: data });
}
