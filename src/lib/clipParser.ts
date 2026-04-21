/**
 * clipParser.ts
 * Safely parses any URL into an embed descriptor.
 * NEVER throws — always returns a valid EmbedResult.
 * NEVER hardcodes casino providers — only generic detection rules.
 */

export type EmbedType = "video" | "iframe" | "link";

export interface EmbedResult {
  type: EmbedType;
  embedUrl: string;
}

/** Allowed URL schemes */
const SAFE_SCHEMES = ["https:", "http:"];

/** Direct video file extensions */
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v"];

/** Returns true if the path ends with a known video extension (ignoring query) */
function isDirectVideo(url: URL): boolean {
  const path = url.pathname.toLowerCase().split("?")[0];
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Attempt to convert a YouTube watch URL into a standard embed URL.
 * Handles all known YouTube URL shapes:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://youtube.com/shorts/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID  (already embedded)
 *   https://m.youtube.com/watch?v=VIDEO_ID
 */
function parseYouTube(url: URL): EmbedResult | null {
  const { hostname, pathname, searchParams } = url;
  const isYT =
    hostname === "www.youtube.com" ||
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtu.be" ||
    hostname === "www.youtu.be";

  if (!isYT) return null;

  let videoId: string | null = null;

  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    // https://youtu.be/VIDEO_ID
    videoId = pathname.replace(/^\//, "").split("/")[0] || null;
  } else if (pathname.startsWith("/shorts/")) {
    // https://youtube.com/shorts/VIDEO_ID
    videoId = pathname.split("/shorts/")[1]?.split("/")[0] || null;
  } else if (pathname.startsWith("/embed/")) {
    // Already embedded
    videoId = pathname.split("/embed/")[1]?.split("/")[0] || null;
  } else {
    // Standard /watch?v=
    videoId = searchParams.get("v");
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) return null;

  return {
    type: "iframe",
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
  };
}

/**
 * Validates that a URL string is structurally safe to use.
 * Blocks javascript:, data:, vbscript: and any other exotic schemes.
 */
function safeParseUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!SAFE_SCHEMES.includes(url.protocol)) return null;
  // Block IP-only URLs (potential SSRF) — allow localhost only in dev
  const ip4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
  if (ip4 && url.hostname !== "127.0.0.1") return null;
  return url;
}

/**
 * Main parser entry point.
 * Accepts any string, returns a safe EmbedResult.
 * Falls back to { type: "link", embedUrl: original } for unknown URLs.
 */
export function parseClipUrl(raw: string): EmbedResult {
  const url = safeParseUrl(raw);

  // Unparseable or unsafe → link fallback
  if (!url) {
    return { type: "link", embedUrl: "#" };
  }

  // 1. YouTube
  const yt = parseYouTube(url);
  if (yt) return yt;

  // 2. Direct video files
  if (isDirectVideo(url)) {
    return { type: "video", embedUrl: url.href };
  }

  // 3. Everything else → safe link fallback (no iframes for unknown domains)
  return { type: "link", embedUrl: url.href };
}

/**
 * Strips leading/trailing whitespace and truncates to max safe length.
 * Use for all user-supplied text fields before storing.
 */
export function sanitizeText(value: unknown, maxLen = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}
