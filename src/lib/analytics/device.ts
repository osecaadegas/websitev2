export interface DeviceInfo {
  device_type: "mobile" | "tablet" | "desktop" | "bot";
  browser: string;
  os: string;
}

/**
 * Lightweight user-agent parser — no external deps.
 * Covers 95%+ of real-world traffic patterns.
 */
export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { device_type: "desktop", browser: "unknown", os: "unknown" };

  // Bots / crawlers — check before device detection so they don't pollute stats
  if (
    /bot|crawler|spider|slurp|bingpreview|mediapartners|adsbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|skype|discord|applebot|googlebot|baiduspider|yandex|sogou|exabot|ia_archiver/i.test(
      ua
    )
  ) {
    return { device_type: "bot", browser: "bot", os: "bot" };
  }

  const s = ua.toLowerCase();

  // ── Device type ─────────────────────────────────────────
  let device_type: DeviceInfo["device_type"] = "desktop";
  if (/ipad|tablet|(android(?!.*mobile))|playbook|silk|kindle/i.test(ua)) {
    device_type = "tablet";
  } else if (
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|bb\d|meego|webos|opera mini|opera mobi|iemobile|wpdesktop/i.test(
      ua
    )
  ) {
    device_type = "mobile";
  }

  // ── Operating system ────────────────────────────────────
  let os = "other";
  if (/windows nt/i.test(ua)) os = "windows";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "ios";
  else if (/android/i.test(ua)) os = "android";
  else if (/macintosh|mac os x/i.test(ua)) os = "macos";
  else if (/chromeos|cros/i.test(s)) os = "chromeos";
  else if (/linux/i.test(ua)) os = "linux";

  // ── Browser ─────────────────────────────────────────────
  // Order matters: Edge contains "chrome", Samsung contains "safari", etc.
  let browser = "other";
  if (/edg\//i.test(ua)) browser = "edge";
  else if (/opr\/|opera/i.test(ua)) browser = "opera";
  else if (/samsungbrowser/i.test(ua)) browser = "samsung";
  else if (/ucbrowser/i.test(ua)) browser = "ucbrowser";
  else if (/fxios\//i.test(ua)) browser = "firefox"; // Firefox iOS
  else if (/firefox\/|gecko.*rv:/i.test(ua) && !/webkit/i.test(ua)) browser = "firefox";
  else if (/chrome\/|chromium\//i.test(ua) && !/opr\//i.test(ua)) browser = "chrome";
  else if (/safari\//i.test(ua) && !/chrome|chromium/i.test(ua)) browser = "safari";
  else if (/msie|trident/i.test(ua)) browser = "ie";

  return { device_type, browser, os };
}
