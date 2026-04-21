import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/* ── Auth helper ───────────────────────────────────────────── */
async function requireAdmin() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.role !== "admin" && session.role !== "configurador") return null;
    return session as { id: string; role: string };
  } catch {
    return null;
  }
}

/* ── GET — fetch all segments + config ─────────────────────── */
export async function GET() {
  const { data: segments, error: segErr } = await supabase
    .from("wheel_segments")
    .select("*")
    .order("sort_order", { ascending: true });

  if (segErr) return NextResponse.json({ error: segErr.message }, { status: 500 });

  const { data: config, error: cfgErr } = await supabase
    .from("wheel_config")
    .select("*");

  if (cfgErr) return NextResponse.json({ error: cfgErr.message }, { status: 500 });

  return NextResponse.json({ segments: segments ?? [], config: config ?? [] });
}

/* ── POST — create segment ─────────────────────────────────── */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { label, icon, color, glow_color, tier, reward_type, reward_value, weight, is_active, sort_order } = body;

  if (!label || !reward_type) {
    return NextResponse.json({ error: "Label and reward_type are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("wheel_segments")
    .insert({
      label,
      icon: icon ?? "🎁",
      color: color ?? "#d4a843",
      glow_color: glow_color ?? "rgba(212,168,67,0.5)",
      tier: tier ?? "common",
      reward_type,
      reward_value: reward_value ?? 0,
      weight: weight ?? 10,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segment: data }, { status: 201 });
}

/* ── PUT — update segment or config ────────────────────────── */
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();

  // If updating config
  if (body.config) {
    const entries = body.config as { key: string; value: string }[];
    for (const entry of entries) {
      const { error } = await supabase
        .from("wheel_config")
        .update({ value: entry.value, updated_at: new Date().toISOString() })
        .eq("key", entry.key);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Updating a segment
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Segment id is required" }, { status: 400 });

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("wheel_segments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segment: data });
}

/* ── DELETE — delete segment ───────────────────────────────── */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Segment id is required" }, { status: 400 });

  const { error } = await supabase.from("wheel_segments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
