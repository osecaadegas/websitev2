import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getAdminUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!["admin", "configurador"].includes(session.role)) return null;
    return session;
  } catch { return null; }
}

/* ── GET — list all contract targets ── */
export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from("contract_targets")
    .select("*", { count: "exact" })
    .order("roadmap_level", { ascending: true })
    .order("difficulty", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contracts: data || [], total: count ?? 0 });
}

/* ── POST — create contract ── */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("contract_targets")
    .insert({
      name: body.name,
      description: body.description ?? "",
      roadmap_level: body.roadmap_level,
      difficulty: body.difficulty,
      required_level: body.required_level ?? 1,
      stamina_cost: body.stamina_cost ?? 20,
      base_success_rate: body.base_success_rate ?? 0.5,
      hitman_bonus: body.hitman_bonus ?? 0.15,
      arrest_chance: body.arrest_chance ?? 0.3,
      hitman_arrest_reduction: body.hitman_arrest_reduction ?? 0.5,
      min_cash: body.min_cash ?? 500,
      max_cash: body.max_cash ?? 2000,
      respect_reward: body.respect_reward ?? 50,
      enabled: body.enabled ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

/* ── PUT — update contract ── */
export async function PUT(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("contract_targets")
    .update(rest)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

/* ── DELETE — remove contract ── */
export async function DELETE(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("contract_targets")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
