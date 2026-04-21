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

/* ── GET — fetch all scheduled streams ─────────────────────── */
export async function GET() {
  const { data, error } = await supabase
    .from("scheduled_streams")
    .select("*")
    .order("stream_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ streams: data ?? [] });
}

/* ── POST — create stream ──────────────────────────────────── */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { title, description, stream_date, start_time, end_time, categories, casino, is_special } = body;

  if (!title || !stream_date || !start_time) {
    return NextResponse.json({ error: "Title, stream_date and start_time are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scheduled_streams")
    .insert({
      title,
      description: description || "",
      stream_date,
      start_time,
      end_time: end_time || null,
      categories: Array.isArray(categories) && categories.length > 0 ? categories : ["Slots"],
      casino: casino || null,
      is_special: is_special || false,
      is_cancelled: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stream: data });
}

/* ── PUT — update stream ───────────────────────────────────── */
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await supabase
    .from("scheduled_streams")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stream: data });
}

/* ── DELETE — delete stream ────────────────────────────────── */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("scheduled_streams").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
