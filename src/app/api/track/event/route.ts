import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { resolveGeo, classifyReferrer } from "@/lib/analytics/geo";
import { detectFraud } from "@/lib/analytics/fraud";
import { parseUserAgent } from "@/lib/analytics/device";

/**
 * POST /api/track/event — Track a user event (click, pageview, conversion, etc.)
 *
 * Body: {
 *   event_type: "pageview" | "click" | "offer_click" | "external_link" | "conversion" | "button_click",
 *   page_url: string,
 *   offer_id?: string,
 *   metadata?: Record<string, unknown>,
 *   screen_width?: number,
 *   screen_height?: number,
 *   timezone?: string,   // client IANA timezone (e.g. "Europe/Lisbon")
 *   language?: string,   // browser language (e.g. "pt-PT")
 * }
 *
 * Server automatically captures: IP (v4+v6), session, geo (country/city/lat/lon/zip/timezone),
 * device type, browser, OS, Accept-Language, user_agent, referrer.
 * For logged-in users: links user_id + email.
 * Runs fraud detection before storing.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      event_type,
      page_url,
      offer_id,
      metadata = {},
      screen_width,
      screen_height,
      timezone: clientTimezone,
      language: clientLanguage,
      gpu_fingerprint,
      gpu_renderer,
      device_fingerprint,
      connection_type,
    } = body;

    // Validate event_type
    const validTypes = ["pageview", "click", "offer_click", "external_link", "conversion", "button_click"];
    if (!event_type || !validTypes.includes(event_type)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }

    const headerStore = await headers();

    // ── IP extraction (IPv4 + IPv6) ───────────────────────────────────────────
    // cf-connecting-ip is the most trustworthy when behind Cloudflare.
    // x-forwarded-for is standard for most other proxies (take first non-private hop).
    const ip =
      headerStore.get("cf-connecting-ip")?.trim() ||
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip")?.trim() ||
      "unknown";

    // Split IPv4 / IPv6 for separate storage
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /:/;
    let ip_v4: string | null = null;
    let ip_v6: string | null = null;
    if (ipv4Regex.test(ip)) {
      ip_v4 = ip;
      const cfv6 = headerStore.get("cf-connecting-ipv6")?.trim();
      if (cfv6 && ipv6Regex.test(cfv6)) ip_v6 = cfv6;
    } else if (ipv6Regex.test(ip)) {
      ip_v6 = ip;
      // Try to find an IPv4 in the forwarded chain
      const forwarded = headerStore.get("x-forwarded-for");
      if (forwarded) {
        ip_v4 = forwarded.split(",").map((s) => s.trim()).find((s) => ipv4Regex.test(s)) || null;
      }
    }

    // ── Accept-Language ───────────────────────────────────────────────────────
    // Use client-reported language first (most accurate), fall back to header.
    const acceptLanguage = headerStore.get("accept-language") || null;
    const language =
      clientLanguage ||
      (acceptLanguage ? acceptLanguage.split(",")[0]?.split(";")[0]?.trim() : null) ||
      null;

    // ── User-agent & device parsing ───────────────────────────────────────────
    const userAgent = headerStore.get("user-agent") || null;
    const device = parseUserAgent(userAgent);

    const referrer = headerStore.get("referer") || null;

    // ── Geo lookup (supports IPv4 + IPv6 via ip-api.com) ─────────────────────
    const geo = await resolveGeo(ip);

    // Prefer IP-derived timezone if client didn't send one
    const timezone = clientTimezone || geo.timezone || null;

    // ── Identify logged-in user ───────────────────────────────────────────────
    let userId: string | null = null;
    let userEmail: string | null = null;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("twitch_session")?.value;
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie);
        if (session.id) {
          const { data: user } = await supabase
            .from("users")
            .select("id, email")
            .eq("twitch_id", session.id)
            .single();
          userId = user?.id || null;
          userEmail = user?.email || null;
        }
      } catch {
        // ignore parse errors
      }
    }

    // ── Session management ────────────────────────────────────────────────────
    let sessionToken = cookieStore.get("arena_session")?.value;
    let sessionId: string | null = null;

    if (sessionToken) {
      const { data: existingSession } = await supabase
        .from("analytics_sessions")
        .select("id")
        .eq("session_token", sessionToken)
        .single();

      if (existingSession) {
        sessionId = existingSession.id;

        // Update last_seen and backfill any enrichment that was missing
        const updateData: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
        if (userId) updateData.user_id = userId;
        if (userEmail) updateData.user_email = userEmail;
        if (gpu_fingerprint && typeof gpu_fingerprint === "string") updateData.gpu_fingerprint = gpu_fingerprint;
        if (gpu_renderer && typeof gpu_renderer === "string") updateData.gpu_renderer = gpu_renderer;
        if (device_fingerprint && typeof device_fingerprint === "string") updateData.device_fingerprint = device_fingerprint;
        if (connection_type && typeof connection_type === "string") updateData.connection_type = connection_type;
        if (ip_v4) updateData.ip_v4 = ip_v4;
        if (ip_v6) updateData.ip_v6 = ip_v6;

        await supabase.from("analytics_sessions").update(updateData).eq("id", sessionId);
      }
    }

    if (!sessionId) {
      // Create new session with full enrichment
      sessionToken = crypto.randomUUID();
      const referrerSource = classifyReferrer(referrer);

      const { data: newSession } = await supabase
        .from("analytics_sessions")
        .insert({
          session_token: sessionToken,
          user_id: userId,
          user_email: userEmail,
          ip_address: ip,
          user_agent: userAgent,
          // Device
          device_type: device.device_type,
          browser: device.browser,
          os: device.os,
          // Screen (client-reported)
          screen_width: typeof screen_width === "number" ? screen_width : null,
          screen_height: typeof screen_height === "number" ? screen_height : null,
          // Locale
          language,
          timezone,
          // GPU fingerprint
          gpu_fingerprint: (gpu_fingerprint && typeof gpu_fingerprint === "string") ? gpu_fingerprint : null,
          // GPU renderer string (human-readable, e.g. "NVIDIA GeForce RTX 3080")
          gpu_renderer: (gpu_renderer && typeof gpu_renderer === "string") ? gpu_renderer : null,
          // Device fingerprint (canvas + screen + touch, survives cookie clearing)
          device_fingerprint: (device_fingerprint && typeof device_fingerprint === "string") ? device_fingerprint : null,
          // Network connection type (wifi/cellular/ethernet)
          connection_type: (connection_type && typeof connection_type === "string") ? connection_type : null,
          // Geo
          country: geo.country,
          country_code: geo.country_code,
          city: geo.city,
          region: geo.region,
          isp: geo.isp,
          latitude: geo.latitude,
          longitude: geo.longitude,
          zip: geo.zip,
          // IPv4/IPv6 split
          ip_v4,
          ip_v6,
          // Referrer
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

    // ── Fraud detection ───────────────────────────────────────────────────────
    const fraud = await detectFraud({
      sessionId,
      ipAddress: ip,
      userId,
      offerId: offer_id || null,
      eventType: event_type,
      isp: geo.isp || null,
      gpuFingerprint: (gpu_fingerprint && typeof gpu_fingerprint === "string") ? gpu_fingerprint : null,
      deviceFingerprint: (device_fingerprint && typeof device_fingerprint === "string") ? device_fingerprint : null,
    });

    // ── Store event ───────────────────────────────────────────────────────────
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

    // Mark session suspicious if detected
    if (fraud.isSuspicious) {
      await supabase
        .from("analytics_sessions")
        .update({ is_suspicious: true })
        .eq("id", sessionId);
    }

    // ── Return + set session cookie ───────────────────────────────────────────
    const response = NextResponse.json({ ok: true, suspicious: fraud.isSuspicious });

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
