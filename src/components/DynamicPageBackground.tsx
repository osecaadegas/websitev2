"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, memo } from "react";
import { PageEffects } from "@/components/PageEffects";
import { supabase } from "@/lib/supabase";
import type { PageSetting } from "@/hooks/usePageSettings";

/**
 * Renders a fixed background image + visual effect overlay
 * based on the current page's admin-configured settings.
 * Uses Supabase Realtime so admin changes appear instantly.
 */
function DynamicPageBackgroundInner() {
  const pathname = usePathname();
  const [allSettings, setAllSettings] = useState<PageSetting[]>([]);
  const [loaded, setLoaded] = useState(false);

  const slug = pathname === "/" ? "home" : pathname.replace(/^\//, "").split("/")[0];

  // Initial fetch + Supabase Realtime subscription
  useEffect(() => {
    let cancelled = false;

    // Initial fetch via API (seeds missing pages)
    fetch("/api/page-settings")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setAllSettings(data.settings ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {});

    // Realtime: listen for any UPDATE on page_settings
    const channel = supabase
      .channel("page-settings-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "page_settings" },
        (payload) => {
          const updated = payload.new as PageSetting;
          setAllSettings((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const settings = loaded ? (allSettings.find((s) => s.page_slug === slug) ?? null) : null;

  // Only use admin-configured settings
  const bgImage = settings?.background_image || null;
  const overlayOpacity = settings?.overlay_opacity ?? 0.6;
  const bgBrightness = settings?.bg_brightness ?? 0.35;
  const bgSaturation = settings?.bg_saturation ?? 0.7;
  const bgContrast = settings?.bg_contrast ?? 0.95;
  const bgPosX = settings?.bg_position_x ?? 50;
  const bgPosY = settings?.bg_position_y ?? 50;
  const bgZoom = settings?.bg_zoom ?? 100;
  const bgColor = settings?.bg_color ?? "#000000";
  const effect = settings?.effect ?? "none";
  const effectIntensity = settings?.effect_intensity ?? 1;

  // Home page: hero section handles its own image, but we still render effects
  const isHome = slug === "home";
  const hasBg = !isHome && !!bgImage;
  const hasEffect = effect !== "none";
  if (!hasBg && !hasEffect) return null;

  return (
    <>
      {/* Fixed background image */}
      {hasBg && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${bgImage}')`,
              backgroundSize: `${bgZoom}%`,
              backgroundPosition: `${bgPosX}% ${bgPosY}%`,
              backgroundRepeat: "no-repeat",
              filter: `brightness(${bgBrightness}) saturate(${bgSaturation}) contrast(${bgContrast})`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
          />
        </div>
      )}

      {/* Fixed effect overlay — z-[15] so effects render ABOVE page content (z-10) but below sidebar (z-40) and navbar (z-50) */}
      {hasEffect && (
        <div className="fixed inset-0 z-[15] pointer-events-none">
          <PageEffects
            effect={effect}
            intensity={effectIntensity}
          />
        </div>
      )}
    </>
  );
}

export const DynamicPageBackground = memo(DynamicPageBackgroundInner);
