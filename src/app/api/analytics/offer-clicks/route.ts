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

/* ── GET — fetch offer click events with details ───────────── */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "30d";
  const offerId = searchParams.get("offer_id") || null;
  const search = searchParams.get("search") || null;
  const suspicious = searchParams.get("suspicious") || null;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Build query for events with session details
  let query = supabase
    .from("analytics_events")
    .select(`
      id,
      offer_id,
      metadata,
      is_suspicious,
      created_at,
      ip_address,
      country,
      city,
      session_id,
      analytics_sessions!inner (
        id,
        ip_address,
        user_agent,
        country,
        city,
        region,
        isp,
        referrer,
        referrer_source,
        is_suspicious,
        user_id,
        users (
          display_name,
          login,
          profile_image_url
        )
      ),
      casino_offers (
        name,
        slug
      )
    `, { count: "exact" })
    .eq("event_type", "offer_click")
    .not("offer_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (offerId) query = query.eq("offer_id", offerId);
  if (suspicious === "true") query = query.eq("is_suspicious", true);
  if (suspicious === "false") query = query.eq("is_suspicious", false);

  const { data: events, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get all offers for filter dropdown
  const { data: allOffers } = await supabase
    .from("casino_offers")
    .select("id, name, slug")
    .order("name");

  // If search filter, filter in memory (user display name / login)
  let filtered = events ?? [];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((e: Record<string, unknown>) => {
      const session = e.analytics_sessions as Record<string, unknown> | null;
      const user = session?.users as Record<string, unknown> | null;
      const offer = e.casino_offers as Record<string, unknown> | null;
      const meta = e.metadata as Record<string, unknown> | null;
      return (
        (user?.display_name as string)?.toLowerCase().includes(q) ||
        (user?.login as string)?.toLowerCase().includes(q) ||
        (offer?.name as string)?.toLowerCase().includes(q) ||
        (meta?.offer_name as string)?.toLowerCase().includes(q) ||
        (session?.ip_address as string)?.includes(q) ||
        (session?.country as string)?.toLowerCase().includes(q) ||
        (session?.city as string)?.toLowerCase().includes(q)
      );
    });
  }

  return NextResponse.json({
    events: filtered,
    total: count ?? 0,
    page,
    limit,
    offers: allOffers ?? [],
  });
}
