import { supabase } from "@/lib/supabase";

export interface GeoData {
  country: string | null;
  city: string | null;
  region: string | null;
  isp: string | null;
}

const EMPTY_GEO: GeoData = { country: null, city: null, region: null, isp: null };

/**
 * Resolve IP → geo data. Checks cache first, then calls ip-api.com (free tier).
 * Falls back gracefully if lookup fails.
 */
export async function resolveGeo(ip: string): Promise<GeoData> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return EMPTY_GEO;

  // 1. Check cache
  const { data: cached } = await supabase
    .from("geo_cache")
    .select("country, city, region, isp")
    .eq("ip_address", ip)
    .single();

  if (cached) return cached as GeoData;

  // 2. Call ip-api.com (free, no key needed, 45 req/min)
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,regionName,isp`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return EMPTY_GEO;

    const json = await res.json();
    if (json.status !== "success") return EMPTY_GEO;

    const geo: GeoData = {
      country: json.country || null,
      city: json.city || null,
      region: json.regionName || null,
      isp: json.isp || null,
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
