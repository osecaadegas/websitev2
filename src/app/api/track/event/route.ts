import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { resolveGeo, classifyReferrer } from "@/lib/analytics/geo";
import { detectFraud } from "@/lib/analytics/fraud";

/**
 * POST /api/track/event — Track a user event (click, pageview, conversion, etc.)
 *
 * Body: {
 *   event_type: "pageview" | "click" | "offer_click" | "external_link" | "conversion" | "button_click",
 *   page_url: string,
 *   offer_id?: string,
 *   metadata?: Record<string, unknown>
 * }
 *
 * Server automatically captures: IP, session, geo, timestamp
 * Runs fraud detection before storing.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_type, page_url, offer_id, metadata = {} } = body;

    // Validate event_type
    const validTypes = ["pageview", "click", "offer_click", "external_link", "conversion", "button_click"];
    if (!event_type || !validTypes.includes(event_type)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }

    // Get IP from headers (Vercel/CF/nginx)
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      headerStore.get("cf-connecting-ip") ||
      "unknown";

    // Get or create session
    const cookieStore = await cookies();
    let sessionToken = cookieStore.get("arena_session")?.value;
    const referrer = headerStore.get("referer") || null;

    // Resolve geo data
    const geo = await resolveGeo(ip);

    // Get user_id if logged in
    let userId: string | null = null;
    const sessionCookie = cookieStore.get("twitch_session")?.value;
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie);
        if (session.id) {
          const { data: user } = await supabase
            .from("users")
            .select("id")
            .eq("twitch_id", session.id)
            .single();
          userId = user?.id || null;
        }
      } catch {
        // ignore parse errors
      }
    }

    // Ensure session exists in DB
    let sessionId: string | null = null;

    if (sessionToken) {
      const { data: existingSession } = await supabase
        .from("analytics_sessions")
        .select("id")
        .eq("session_token", sessionToken)
        .single();

      if (existingSession) {
        sessionId = existingSession.id;
        // Update last_seen and link user if newly logged in
        const updateData: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
        if (userId) updateData.user_id = userId;
        await supabase.from("analytics_sessions").update(updateData).eq("id", sessionId);
      }
    }

    if (!sessionId) {
      // Create new session
      sessionToken = crypto.randomUUID();
      const referrerSource = classifyReferrer(referrer);

      const { data: newSession } = await supabase
        .from("analytics_sessions")
        .insert({
          session_token: sessionToken,
          user_id: userId,
          ip_address: ip,
          user_agent: headerStore.get("user-agent") || null,
          country: geo.country,
          city: geo.city,
          region: geo.region,
          isp: geo.isp,
          referrer,
          referrer_source: referrerSource,
        })
        .select("id")
        .single();

      sessionId = newSession?.id || null;
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    // Run fraud detection
    const fraud = await detectFraud({
      sessionId,
      ipAddress: ip,
      userId,
      offerId: offer_id || null,
      eventType: event_type,
    });

    // Store event
    await supabase.from("analytics_events").insert({
      session_id: sessionId,
      user_id: userId,
      event_type,
      page_url: page_url || null,
      offer_id: offer_id || null,
      metadata,
      ip_address: ip,
      country: geo.country,
      city: geo.city,
      is_suspicious: fraud.isSuspicious,
    });

    // If suspicious, mark session too
    if (fraud.isSuspicious) {
      await supabase
        .from("analytics_sessions")
        .update({ is_suspicious: true })
        .eq("id", sessionId);
    }

    // Set session cookie if new
    const response = NextResponse.json({
      ok: true,
      suspicious: fraud.isSuspicious,
    });

    if (!cookieStore.get("arena_session")?.value && sessionToken) {
      response.cookies.set("arena_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400 * 30, // 30 days
        path: "/",
      });
    }

    return response;
  } catch (err) {
    console.error("[track/event] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
