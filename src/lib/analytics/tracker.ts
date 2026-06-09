"use client";

const STORAGE_KEY = "arena_cookie_consent";
const QUEUE_KEY = "__arena_track_queue";

type EventPayload = {
  event_type: string;
  page_url: string;
  offer_id?: string;
  metadata?: Record<string, unknown>;
  // Client-side enrichment (captured once and sent on first pageview/event)
  screen_width?: number;
  screen_height?: number;
  timezone?: string;
  language?: string;
  gpu_fingerprint?: string;
  device_fingerprint?: string;
};

let queue: EventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Check if user has opted in to analytics tracking.
 */
function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const consent = JSON.parse(raw);
    return consent.analytics === true;
  } catch {
    return false;
  }
}

/**
 * Flush queued events to the server in a single batch.
 */
async function flush() {
  if (queue.length === 0) return;
  const batch = [...queue];
  queue = [];

  // Send each event — server handles session/IP automatically
  for (const event of batch) {
    try {
      await fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true,
      });
    } catch {
      // Silently fail — do not block UI
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 2000); // Batch events every 2 seconds
}

/**
 * Read WebGL GPU renderer string for device fingerprinting.
 * Returns null if WebGL is unavailable or blocked (privacy mode).
 */
function getGpuFingerprint(): string | undefined {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return undefined;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return undefined;
    const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    return `${vendor}::${renderer}`;
  } catch {
    return undefined;
  }
}

/**
 * Generate a stable canvas fingerprint string.
 * Draws text + shapes and hashes the pixel data — highly stable across sessions
 * on the same device/browser, even after cookie clearing.
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 30);
    ctx.fillStyle = "#069";
    ctx.font = "11pt Arial";
    ctx.fillText("SecaHub👾🎰", 2, 20);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.font = "18pt Arial";
    ctx.fillText("SecaHub👾🎰", 4, 26);
    return canvas.toDataURL().slice(-80); // last 80 chars are the unique part
  } catch {
    return "";
  }
}

/**
 * Generate or retrieve a persistent device fingerprint stored in localStorage.
 * Combines canvas, screen, touch, pixel ratio and platform signals.
 * Survives cookie clearing — tied to the device/browser profile.
 */
const DEVICE_FP_KEY = "__arena_dfp";

function getDeviceFingerprint(): string {
  try {
    const existing = localStorage.getItem(DEVICE_FP_KEY);
    if (existing) return existing;

    const components = [
      getCanvasFingerprint(),
      String(window.screen.width),
      String(window.screen.height),
      String(window.screen.colorDepth),
      String(window.devicePixelRatio ?? 1),
      String(navigator.maxTouchPoints ?? 0),
      navigator.platform ?? "",
      navigator.hardwareConcurrency != null ? String(navigator.hardwareConcurrency) : "",
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    ].join("|");

    // Simple djb2-style hash to a hex string
    let hash = 5381;
    for (let i = 0; i < components.length; i++) {
      hash = ((hash << 5) + hash) ^ components.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    const fp = (hash >>> 0).toString(16).padStart(8, "0");
    localStorage.setItem(DEVICE_FP_KEY, fp);
    return fp;
  } catch {
    return "";
  }
}

/**
 * Collect client-side enrichment data (screen, timezone, language).
 * Only called in browser context.
 */
function getClientEnrichment(): Pick<EventPayload, "screen_width" | "screen_height" | "timezone" | "language" | "gpu_fingerprint" | "device_fingerprint"> {
  return {
    screen_width: window.screen?.width ?? undefined,
    screen_height: window.screen?.height ?? undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? undefined,
    language: navigator.language ?? undefined,
    gpu_fingerprint: getGpuFingerprint(),
    device_fingerprint: getDeviceFingerprint() || undefined,
  };
}

/**
 * Track a custom event.
 * Offer clicks are always tracked (affiliate legitimate interest).
 * All other events respect GDPR consent.
 */
export function trackEvent(
  type: string,
  metadata?: Record<string, unknown>,
  offerId?: string
) {
  if (typeof window === "undefined") return;
  // Offer clicks are always tracked — affiliate revenue depends on it.
  // All other events require analytics consent.
  if (type !== "offer_click" && !hasAnalyticsConsent()) return;

  queue.push({
    event_type: type,
    page_url: window.location.pathname,
    offer_id: offerId,
    metadata,
    // Include full enrichment so session gets populated even on first offer click
    ...getClientEnrichment(),
  });

  // Offer clicks flush immediately — don't delay affiliate tracking
  if (type === "offer_click") {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Track a page view. Call this in layout/page components.
 */
export function trackPageView() {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  // Avoid duplicate pageview on same URL within 500ms (React strict mode / fast nav)
  const now = Date.now();
  const lastKey = `__arena_last_pv`;
  const lastVal = sessionStorage.getItem(lastKey);
  if (lastVal) {
    const [lastUrl, lastTime] = lastVal.split("|");
    if (lastUrl === window.location.pathname && now - Number(lastTime) < 500) return;
  }
  sessionStorage.setItem(lastKey, `${window.location.pathname}|${now}`);

  queue.push({
    event_type: "pageview",
    page_url: window.location.pathname,
    ...getClientEnrichment(),
  });

  scheduleFlush();
}

/**
 * Track an offer click.
 */
export function trackOfferClick(offerId: string, offerName?: string) {
  trackEvent("offer_click", { offer_name: offerName }, offerId);
}

/**
 * Track an external link redirect.
 */
export function trackExternalLink(url: string, label?: string) {
  trackEvent("external_link", { url, label });
}

/**
 * Track a button click.
 */
export function trackButtonClick(buttonId: string, label?: string) {
  trackEvent("button_click", { button_id: buttonId, label });
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (queue.length > 0) {
      // Use sendBeacon for reliable delivery on unload
      for (const event of queue) {
        try {
          navigator.sendBeacon(
            "/api/track/event",
            new Blob([JSON.stringify(event)], { type: "application/json" })
          );
        } catch {
          // ignore
        }
      }
      queue = [];
    }
  });
}
