import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/track/gdpr?action=delete&user_id=xxx
 * GET /api/track/gdpr?action=delete&ip=xxx
 * GET /api/track/gdpr?action=export&user_id=xxx
 *
 * GDPR data management endpoint.
 * Requires admin role (checked via twitch_session cookie).
 */
export async function POST(request: Request) {
  try {
    // Auth check — admin only
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("twitch_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let role = "viewer";
    try {
      role = JSON.parse(sessionCookie).role || "viewer";
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (role !== "admin" && role !== "configurador") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, user_id, ip } = body;

    if (action === "delete") {
      if (user_id) {
        await supabase.rpc("delete_user_analytics", { target_user_id: user_id });
        return NextResponse.json({ ok: true, deleted: "user", user_id });
      }
      if (ip) {
        await supabase.rpc("delete_ip_analytics", { target_ip: ip });
        return NextResponse.json({ ok: true, deleted: "ip", ip });
      }
      return NextResponse.json({ error: "Provide user_id or ip" }, { status: 400 });
    }

    if (action === "export") {
      if (!user_id) {
        return NextResponse.json({ error: "Provide user_id" }, { status: 400 });
      }

      const { data: sessions } = await supabase
        .from("analytics_sessions")
        .select("*")
        .eq("user_id", user_id);

      const { data: events } = await supabase
        .from("analytics_events")
        .select("*")
        .eq("user_id", user_id);

      return NextResponse.json({ sessions: sessions ?? [], events: events ?? [] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[track/gdpr] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
