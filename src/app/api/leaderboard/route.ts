import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/* ── Auth helper ──────────────────────────────────────────── */
async function requireAdmin() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as { id: string; role: string };
    if (session.role !== "admin" && session.role !== "configurador") return null;
    return session;
  } catch {
    return null;
  }
}

/* ── GET — Public: fetch years list + entries for a year ── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const listYears = searchParams.get("list") === "true";

  // List all years
  if (listYears) {
    const { data, error } = await supabase
      .from("leaderboard_years")
      .select("*")
      .order("year", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ years: data });
  }

  // Get entries for a specific year (or active year)
  let yearId: string | null = null;

  if (yearParam) {
    const { data: yr } = await supabase
      .from("leaderboard_years")
      .select("*")
      .eq("year", parseInt(yearParam))
      .maybeSingle();
    if (!yr) return NextResponse.json({ error: "Year not found" }, { status: 404 });
    yearId = yr.id;
    const { data: entries } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("year_id", yr.id)
      .order("month", { ascending: true });
    return NextResponse.json({ year: yr, entries: entries ?? [] });
  }

  // Default: get active year
  const { data: activeYear } = await supabase
    .from("leaderboard_years")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (!activeYear) {
    return NextResponse.json({ year: null, entries: [] });
  }

  const { data: entries } = await supabase
    .from("leaderboard_entries")
    .select("*")
    .eq("year_id", activeYear.id)
    .order("month", { ascending: true });

  return NextResponse.json({ year: activeYear, entries: entries ?? [] });
}

/* ── POST — Admin: create year / update entry / clone year ─ */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const action = body.action as string;

  // ── Create a new year with 12 empty months ──
  if (action === "create_year") {
    const year = body.year as number;
    if (!year || year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    // Check if year exists
    const { data: existing } = await supabase
      .from("leaderboard_years")
      .select("id")
      .eq("year", year)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Year already exists" }, { status: 409 });
    }

    const { data: newYear, error: yearError } = await supabase
      .from("leaderboard_years")
      .insert({ year, is_active: false, is_locked: false })
      .select()
      .single();
    if (yearError) return NextResponse.json({ error: yearError.message }, { status: 500 });

    // Generate 12 empty months
    const months = Array.from({ length: 12 }, (_, i) => ({
      year_id: newYear.id,
      month: i + 1,
      winner_name: "",
    }));
    const { error: entriesError } = await supabase.from("leaderboard_entries").insert(months);
    if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

    const { data: entries } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("year_id", newYear.id)
      .order("month", { ascending: true });

    return NextResponse.json({ year: newYear, entries }, { status: 201 });
  }

  // ── Set active year ──
  if (action === "set_active") {
    const yearId = body.year_id as string;
    // Deactivate all
    await supabase.from("leaderboard_years").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    // Activate selected
    const { data, error } = await supabase
      .from("leaderboard_years")
      .update({ is_active: true })
      .eq("id", yearId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ year: data });
  }

  // ── Toggle lock ──
  if (action === "toggle_lock") {
    const yearId = body.year_id as string;
    const { data: yr } = await supabase
      .from("leaderboard_years")
      .select("is_locked")
      .eq("id", yearId)
      .single();
    if (!yr) return NextResponse.json({ error: "Year not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("leaderboard_years")
      .update({ is_locked: !yr.is_locked })
      .eq("id", yearId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ year: data });
  }

  // ── Update entry (winner) ──
  if (action === "update_entry") {
    const entryId = body.entry_id as string;
    const winnerName = (body.winner_name as string) ?? "";
    const winnerAvatar = (body.winner_avatar as string) || null;

    const { data, error } = await supabase
      .from("leaderboard_entries")
      .update({ winner_name: winnerName, winner_avatar: winnerAvatar, updated_at: new Date().toISOString() })
      .eq("id", entryId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  }

  // ── Clone year ──
  if (action === "clone_year") {
    const sourceYearId = body.source_year_id as string;
    const targetYear = body.target_year as number;

    if (!targetYear || targetYear < 2020 || targetYear > 2100) {
      return NextResponse.json({ error: "Invalid target year" }, { status: 400 });
    }

    // Check target doesn't exist
    const { data: existing } = await supabase
      .from("leaderboard_years")
      .select("id")
      .eq("year", targetYear)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Target year already exists" }, { status: 409 });
    }

    // Get source entries
    const { data: sourceEntries } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("year_id", sourceYearId)
      .order("month", { ascending: true });

    // Create new year
    const { data: newYear, error: yearError } = await supabase
      .from("leaderboard_years")
      .insert({ year: targetYear, is_active: false, is_locked: false })
      .select()
      .single();
    if (yearError) return NextResponse.json({ error: yearError.message }, { status: 500 });

    // Clone entries
    const clonedEntries = (sourceEntries ?? []).map((e) => ({
      year_id: newYear.id,
      month: e.month,
      winner_name: e.winner_name,
      winner_avatar: e.winner_avatar,
    }));
    if (clonedEntries.length > 0) {
      await supabase.from("leaderboard_entries").insert(clonedEntries);
    }

    const { data: entries } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("year_id", newYear.id)
      .order("month", { ascending: true });

    return NextResponse.json({ year: newYear, entries }, { status: 201 });
  }

  // ── Delete year ──
  if (action === "delete_year") {
    const yearId = body.year_id as string;
    const { error } = await supabase.from("leaderboard_years").delete().eq("id", yearId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
