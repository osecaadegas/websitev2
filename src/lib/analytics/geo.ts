import { supabase } from "@/lib/supabase";

export interface GeoData {
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  isp: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  zip: string | null;
}

const EMPTY_GEO: GeoData = {
  country: null,
  country_code: null,
  city: null,
  region: null,
  isp: null,
  latitude: null,
  longitude: null,
  timezone: null,
  zip: null,
};

// ip-api.com supports both IPv4 and IPv6 natively.
// IPv6 loopback addresses to skip.
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

/**
 * Resolve IP → geo data. Checks cache first, then calls ip-api.com (free tier).
 * Supports IPv4 and IPv6. Falls back gracefully if lookup fails.
 */
export async function resolveGeo(ip: string): Promise<GeoData> {
  if (!ip || LOOPBACK.has(ip)) return EMPTY_GEO;

  // 1. Check cache
  const { data: cached } = await supabase
    .from("geo_cache")
    .select("country, country_code, city, region, isp, latitude, longitude, timezone, zip")
    .eq("ip_address", ip)
    .single();

  if (cached) return cached as GeoData;

  // 2. Call ip-api.com — supports IPv4 + IPv6, no API key required (45 req/min free)
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,regionName,isp,lat,lon,timezone,zip`,
      { signal: AbortSignal.timeout(4000) }
    );

    if (!res.ok) return EMPTY_GEO;

    const json = await res.json();
    if (json.status !== "success") return EMPTY_GEO;

    const geo: GeoData = {
      country: json.country || null,
      country_code: json.countryCode || null,
      city: json.city || null,
      region: json.regionName || null,
      isp: json.isp || null,
      latitude: json.lat ?? null,
      longitude: json.lon ?? null,
      timezone: json.timezone || null,
      zip: json.zip || null,
    };

    // 3. Cache the result
    await supabase.from("geo_cache").upsert({
      ip_address: ip,
      ...geo,
      cached_at: new Date().toISOString(),
    });

    return geo;
  } catch {
    return EMPTY_GEO;
  }
}

/**
 * Classify referrer URL into a source category.
 */
export function classifyReferrer(referrer: string | null): "direct" | "twitch" | "social" | "search" | "other" {
  if (!referrer) return "direct";
  const r = referrer.toLowerCase();
  if (r.includes("twitch.tv")) return "twitch";
  if (r.includes("google.") || r.includes("bing.") || r.includes("yahoo.") || r.includes("duckduckgo.")) return "search";
  if (r.includes("instagram.") || r.includes("twitter.") || r.includes("x.com") || r.includes("facebook.") || r.includes("tiktok.") || r.includes("youtube.") || r.includes("reddit.") || r.includes("discord.")) return "social";
  return "other";
}
