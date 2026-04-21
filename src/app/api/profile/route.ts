import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

/** GET /api/profile — return full profile for the logged-in user */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let session: { id: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("twitch_id, login, display_name, profile_image_url, email, se_username, discord_username, role, created_at")
    .eq("twitch_id", session.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}

/** PATCH /api/profile — update editable profile fields */
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let session: { id: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, string> = {};

  // Only allow updating se_username and discord_username
  if (typeof body.se_username === "string") {
    updates.se_username = body.se_username.trim().slice(0, 50);
  }
  if (typeof body.discord_username === "string") {
    updates.discord_username = body.discord_username.trim().slice(0, 50);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("twitch_id", session.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
