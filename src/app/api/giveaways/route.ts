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
    return session as { id: string; role: string; login: string };
  } catch {
    return null;
  }
}

/* ── GET — list giveaways (with participant counts) ────────── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabase
        .from("giveaways")
        .select("*")
        .eq("id", id)
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });

      const { data: participants } = await supabase
        .from("giveaway_participants")
        .select("*")
        .eq("giveaway_id", id)
        .order("tickets", { ascending: false });

      const { data: winners } = await supabase
        .from("giveaway_winners")
        .select("*")
        .eq("giveaway_id", id);

      return NextResponse.json({
        giveaway: data,
        participants: participants ?? [],
        winners: winners ?? [],
      });
    }

    let query = supabase.from("giveaways").select("*").order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true).eq("is_ended", false);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get participant counts for each giveaway
    const giveawayIds = (data ?? []).map((g: { id: string }) => g.id);
    let counts: { giveaway_id: string; tickets: number }[] = [];
    if (giveawayIds.length > 0) {
      const { data: countData } = await supabase
        .from("giveaway_participants")
        .select("giveaway_id, tickets")
        .in("giveaway_id", giveawayIds);
      counts = countData ?? [];
    }

    const countMap: Record<string, { participants: number; total_tickets: number }> = {};
    for (const row of counts) {
      if (!countMap[row.giveaway_id]) countMap[row.giveaway_id] = { participants: 0, total_tickets: 0 };
      countMap[row.giveaway_id].participants++;
      countMap[row.giveaway_id].total_tickets += row.tickets;
    }

    const giveaways = (data ?? []).map((g: Record<string, unknown>) => ({
      ...g,
      participant_count: countMap[g.id as string]?.participants ?? 0,
      total_tickets: countMap[g.id as string]?.total_tickets ?? 0,
    }));

    return NextResponse.json({ giveaways });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/* ── POST — create giveaway ────────────────────────────────── */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, mode, ticket_cost, max_entries_per_user, prize, prize_image, scheduled_end, chat_command, require_live } = body;

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("giveaways")
    .insert({
      title,
      description: description || "",
      mode: mode || "single",
      ticket_cost: ticket_cost || 0,
      max_entries_per_user: max_entries_per_user || null,
      prize: prize || "",
      prize_image: prize_image || null,
      scheduled_end: scheduled_end || null,
      chat_command: chat_command || "!enter",
      require_live: require_live !== false,
      created_by: admin.login,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ giveaway: data }, { status: 201 });
}

/* ── PUT — update giveaway (start/pause/end/edit) ──────────── */
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, action, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Handle special actions
  if (action === "start") {
    const now = new Date();
    const { data: giveaway } = await supabase.from("giveaways").select("scheduled_end, duration_seconds").eq("id", id).single();
    
    let endTime: Date;
    if (giveaway?.scheduled_end) {
      endTime = new Date(giveaway.scheduled_end);
    } else {
      endTime = new Date(now.getTime() + (giveaway?.duration_seconds ?? 300) * 1000);
    }

    const { data, error } = await supabase
      .from("giveaways")
      .update({ is_active: true, is_ended: false, start_time: now.toISOString(), end_time: endTime.toISOString(), updated_at: now.toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ giveaway: data });
  }

  if (action === "pause") {
    const { data, error } = await supabase
      .from("giveaways")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ giveaway: data });
  }

  if (action === "end") {
    const { data, error } = await supabase
      .from("giveaways")
      .update({ is_active: false, is_ended: true, end_time: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ giveaway: data });
  }

  if (action === "reset") {
    // Reset: clear participants + winners, reopen
    await supabase.from("giveaway_participants").delete().eq("giveaway_id", id);
    await supabase.from("giveaway_winners").delete().eq("giveaway_id", id);
    const { data, error } = await supabase
      .from("giveaways")
      .update({ is_active: false, is_ended: false, start_time: null, end_time: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ giveaway: data });
  }

  // General field update
  const { data, error } = await supabase
    .from("giveaways")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ giveaway: data });
}

/* ── DELETE — remove giveaway ──────────────────────────────── */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabase.from("giveaways").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
