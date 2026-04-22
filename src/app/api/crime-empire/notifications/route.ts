import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ── GET — fetch unread notifications for the current player ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ notifications: [] });

  const { data: notifications } = await supabase
    .from("player_notifications")
    .select("id, type, title, message, data, created_at, read")
    .eq("player_id", player.id)
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ notifications: notifications || [] });
}

/* ── POST — mark one or all notifications as read ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { notificationId } = body;

  if (notificationId) {
    // Mark specific notification as read
    await supabase
      .from("player_notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("player_id", player.id);
  } else {
    // Mark all as read
    await supabase
      .from("player_notifications")
      .update({ read: true })
      .eq("player_id", player.id)
      .eq("read", false);
  }

  return NextResponse.json({ success: true });
}
