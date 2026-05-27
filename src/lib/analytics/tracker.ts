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
 * Collect client-side enrichment data (screen, timezone, language).
 * Only called in browser context.
 */
function getClientEnrichment(): Pick<EventPayload, "screen_width" | "screen_height" | "timezone" | "language" | "gpu_fingerprint"> {
  return {
    screen_width: window.screen?.width ?? undefined,
    screen_height: window.screen?.height ?? undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? undefined,
    language: navigator.language ?? undefined,
    gpu_fingerprint: getGpuFingerprint(),
  };
}

/**
 * Track a custom event.
 * Respects GDPR consent — does nothing if analytics not accepted.
 */
export function trackEvent(
  type: string,
  metadata?: Record<string, unknown>,
  offerId?: string
) {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  queue.push({
    event_type: type,
    page_url: window.location.pathname,
    offer_id: offerId,
    metadata,
  });

  scheduleFlush();
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
