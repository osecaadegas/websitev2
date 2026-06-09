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
  isp?: string | null;
  gpuFingerprint?: string | null;
  deviceFingerprint?: string | null;
}): Promise<FraudCheckResult> {
  const config = await getConfig();
  const reasons: string[] = [];
  let riskScore = 0;

  const maxClicksPer10s        = config["max_clicks_per_10s"]                ?? 10;
  const maxSameOfferPerHour    = config["max_same_offer_clicks_per_hour"]    ?? 5;
  const maxSessionsPerIpPerHour= config["max_sessions_per_ip_per_hour"]     ?? 10;
  const maxUsersPerIp24h       = config["max_users_per_ip_24h"]              ?? 3;
  const maxUsersPerGpu7d       = config["max_users_per_gpu_7d"]              ?? 2;
  const maxUsersPerDevice7d    = config["max_users_per_device_7d"]           ?? 2;
  const maxOfferSessionsPerIp24h = config["max_offer_sessions_per_ip_24h"]  ?? 2;

  // ── 1. Too many clicks in 10 seconds from this session ───────────────────
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

  // ── 2. Repeated clicks on same offer ─────────────────────────────────────
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

  // ── 3. Multiple sessions from same IP ────────────────────────────────────
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

  // ── 4. Bot-like: events with zero pageviews ───────────────────────────────
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

  // ── 5. Multiple distinct logged-in users from same IP in 24h ─────────────
  // NOTE: runs even for anonymous sessions — detects when anon + logged-in share IP
  {
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: ipUsers } = await supabase
      .from("analytics_sessions")
      .select("user_id")
      .eq("ip_address", params.ipAddress)
      .not("user_id", "is", null)
      .gte("created_at", oneDayAgo);

    const distinctIpUsers = new Set((ipUsers ?? []).map((r) => r.user_id));
    if (params.userId) distinctIpUsers.add(params.userId);

    if (distinctIpUsers.size >= maxUsersPerIp24h) {
      reasons.push(`Multi-account IP: ${distinctIpUsers.size} distinct users from IP ${params.ipAddress} in 24h (threshold: ${maxUsersPerIp24h})`);
      riskScore += 35;
    }
  }

  // ── 6. Multiple users on same GPU fingerprint in 7 days ──────────────────
  if (params.gpuFingerprint) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: gpuUsers } = await supabase
      .from("analytics_sessions")
      .select("user_id")
      .eq("gpu_fingerprint", params.gpuFingerprint)
      .not("user_id", "is", null)
      .gte("created_at", sevenDaysAgo);

    const distinctGpuUsers = new Set((gpuUsers ?? []).map((r) => r.user_id));
    if (params.userId) distinctGpuUsers.add(params.userId);

    if (distinctGpuUsers.size >= maxUsersPerGpu7d) {
      reasons.push(`Multi-account GPU: ${distinctGpuUsers.size} distinct users on same GPU in 7 days (threshold: ${maxUsersPerGpu7d})`);
      riskScore += 40;
    }
  }

  // ── 7. Same device fingerprint, multiple accounts clicking /ofertas ───────
  if (params.deviceFingerprint && params.eventType === "offer_click") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: deviceSessions } = await supabase
      .from("analytics_sessions")
      .select("user_id")
      .eq("device_fingerprint", params.deviceFingerprint)
      .not("user_id", "is", null)
      .gte("created_at", sevenDaysAgo);

    const distinctDeviceUsers = new Set((deviceSessions ?? []).map((r) => r.user_id));
    if (params.userId) distinctDeviceUsers.add(params.userId);

    if (distinctDeviceUsers.size >= maxUsersPerDevice7d) {
      reasons.push(`Mobile multi-account: ${distinctDeviceUsers.size} distinct accounts used same device to click /ofertas in 7 days (threshold: ${maxUsersPerDevice7d})`);
      riskScore += 55;
    }
  }

  // ── 8. Same IP, multiple sessions clicking offers in 24h ─────────────────
  // KEY CHECK: catches the same-household multi-device affiliate abuse scenario.
  if (params.eventType === "offer_click") {
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: sameIpOfferClicks } = await supabase
      .from("analytics_events")
      .select("session_id")
      .eq("event_type", "offer_click")
      .eq("ip_address", params.ipAddress)
      .gte("created_at", oneDayAgo);

    const distinctOfferSessions = new Set([
      ...(sameIpOfferClicks ?? []).map((r) => r.session_id),
      params.sessionId,
    ]);

    if (distinctOfferSessions.size > maxOfferSessionsPerIp24h) {
      reasons.push(`Multi-session IP offer abuse: ${distinctOfferSessions.size} distinct sessions from IP ${params.ipAddress} clicked offers in 24h (threshold: ${maxOfferSessionsPerIp24h})`);
      riskScore += 50;
    }
  }

  // ── 9. VPN / Proxy / Datacenter ISP detection ────────────────────────────
  if (params.isp) {
    const vpnKeywords = [
      "vpn", "proxy", "tor ", "cloudflare", "amazon", "digitalocean",
      "linode", "ovh", "hetzner", "vultr", "datacenter", "hosting",
      " vps", "azure", "google cloud", "oracle cloud", "ibm cloud",
      "datacamp", "m247", "quadranet", "psychz", "serverius",
    ];
    const ispLower = params.isp.toLowerCase();
    if (vpnKeywords.some((k) => ispLower.includes(k))) {
      reasons.push(`Suspicious ISP: "${params.isp}" matches VPN/datacenter pattern`);
      riskScore += 20;
    }
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
