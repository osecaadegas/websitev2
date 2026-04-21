import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

/** GET /api/rewards — list all active rewards (public) or all rewards (admin) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  let query = supabase.from("rewards").select("*").order("sort_order", { ascending: true });

  if (!all) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: "Failed to fetch rewards", details: error.message }, { status: 500 });
  return NextResponse.json({ rewards: data ?? [] });
}

/** POST /api/rewards — create a new reward (admin only) */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let session: { id: string; role: string };
  try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid session" }, { status: 401 }); }

  if (session.role !== "admin" && session.role !== "configurador") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { error } = await supabase.from("rewards").insert({
    title: body.title,
    description: body.description || "",
    image: body.image || null,
    cost: body.cost || 0,
    type: body.type || "custom",
    tier: body.tier || "common",
    stock: body.stock ?? null,
    cooldown: body.cooldown ?? null,
    vip_only: body.vip_only || false,
    vip_level_required: body.vip_level_required ?? null,
    active: body.active ?? true,
    sort_order: body.sort_order || 0,
  });

  if (error) return NextResponse.json({ error: "Failed to create reward", details: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** PATCH /api/rewards — update a reward (admin only) */
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let session: { id: string; role: string };
  try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid session" }, { status: 401 }); }

  if (session.role !== "admin" && session.role !== "configurador") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Missing reward id" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowedFields = ["title", "description", "image", "cost", "type", "tier", "stock", "cooldown", "vip_only", "vip_level_required", "active", "sort_order"];
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  const { error } = await supabase.from("rewards").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Failed to update reward", details: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/rewards — delete a reward (admin only) */
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let session: { id: string; role: string };
  try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid session" }, { status: 401 }); }

  if (session.role !== "admin" && session.role !== "configurador") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Missing reward id" }, { status: 400 });

  const { error } = await supabase.from("rewards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete reward", details: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
