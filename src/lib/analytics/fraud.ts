import { supabase } from "@/lib/supabase";

interface FraudCheckResult {
  isSuspicious: boolean;
  riskScore: number;
  reasons: string[];
}

/**
 * Load fraud detection thresholds from DB (cached in-memory for 5 min).
 */
let configCache: Record<string, number> | null = null;
let configCachedAt = 0;

async function getConfig(): Promise<Record<string, number>> {
  if (configCache && Date.now() - configCachedAt < 300_000) return configCache;

  const { data } = await supabase.from("fraud_config").select("key, value");
  const config: Record<string, number> = {};
  for (const row of data ?? []) config[row.key] = row.value;

  configCache = config;
  configCachedAt = Date.now();
  return config;
}

/**
 * Run fraud detection checks against a session/event.
 */
export async function detectFraud(params: {
  sessionId: string;
  ipAddress: string;
  userId?: string | null;
  offerId?: string | null;
  eventType: string;
}): Promise<FraudCheckResult> {
  const config = await getConfig();
  const reasons: string[] = [];
  let riskScore = 0;

  const maxClicksPer10s = config["max_clicks_per_10s"] ?? 10;
  const maxSameOfferPerHour = config["max_same_offer_clicks_per_hour"] ?? 5;
  const maxSessionsPerIpPerHour = config["max_sessions_per_ip_per_hour"] ?? 10;

  // 1. Too many clicks in 10 seconds from this session
  if (params.eventType !== "pageview") {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const { count: recentClicks } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("session_id", params.sessionId)
      .neq("event_type", "pageview")
      .gte("created_at", tenSecondsAgo);

    if ((recentClicks ?? 0) >= maxClicksPer10s) {
      reasons.push(`High frequency: ${recentClicks} clicks in 10s (threshold: ${maxClicksPer10s})`);
      riskScore += 40;
    }
  }

  // 2. Repeated clicks on same offer
  if (params.offerId) {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count: offerClicks } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("session_id", params.sessionId)
      .eq("offer_id", params.offerId)
      .gte("created_at", oneHourAgo);

    if ((offerClicks ?? 0) >= maxSameOfferPerHour) {
      reasons.push(`Repeated offer clicks: ${offerClicks} on same offer in 1h (threshold: ${maxSameOfferPerHour})`);
      riskScore += 30;
    }
  }

  // 3. Multiple sessions from same IP
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: ipSessions } = await supabase
    .from("analytics_sessions")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", params.ipAddress)
    .gte("created_at", oneHourAgo);

  if ((ipSessions ?? 0) >= maxSessionsPerIpPerHour) {
    reasons.push(`IP flood: ${ipSessions} sessions from same IP in 1h (threshold: ${maxSessionsPerIpPerHour})`);
    riskScore += 25;
  }

  // 4. Abnormal behavior: many clicks but no pageviews
  const { count: totalEvents } = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", params.sessionId);

  const { count: pageviews } = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", params.sessionId)
    .eq("event_type", "pageview");

  if ((totalEvents ?? 0) > 5 && (pageviews ?? 0) === 0) {
    reasons.push(`No pageviews with ${totalEvents} events — bot-like behavior`);
    riskScore += 20;
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);
  const threshold = config["risk_threshold_flag"] ?? 50;
  const isSuspicious = riskScore >= threshold;

  // Log if suspicious
  if (isSuspicious) {
    await supabase.from("fraud_logs").insert({
      session_id: params.sessionId,
      user_id: params.userId || null,
      ip_address: params.ipAddress,
      reason: reasons.join("; "),
      risk_score: riskScore,
      metadata: { event_type: params.eventType, offer_id: params.offerId },
    });
  }

  return { isSuspicious, riskScore, reasons };
}
