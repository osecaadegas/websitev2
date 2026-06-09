"use client";

import { useEffect, useState } from "react";

export interface PageSetting {
  id: string;
  page_slug: string;
  page_name: string;
  background_image: string | null;
  hero_image: string | null;
  hero_title: string | null;
  hero_description: string | null;
  hero_title_size: number;
  hero_description_size: number;
  hero_text_align: "left" | "center" | "right";
  hero_position_x: number;
  hero_position_y: number;
  hero_max_width: number;
  effect: "none" | "snow" | "rain" | "thunder" | "fireflies" | "embers";
  effect_intensity: number;
  overlay_opacity: number;
  bg_brightness: number;
  bg_saturation: number;
  bg_contrast: number;
  bg_position_x: number;
  bg_position_y: number;
  bg_zoom: number;
  bg_color: string;
  mobile_background_image: string | null;
  mobile_bg_position_x: number;
  mobile_bg_position_y: number;
  mobile_bg_zoom: number;
  is_active: boolean;
  min_role: "viewer" | "moderador" | "configurador" | "admin";
  updated_at: string;
}

const cache = new Map<string, { data: PageSetting; ts: number }>();
const CACHE_TTL = 30_000; // 30 seconds — matches DynamicPageBackground poll rate

export function usePageSettings(slug: string) {
  const cached = cache.get(slug);
  const isStale = !cached || Date.now() - cached.ts > CACHE_TTL;
  const [settings, setSettings] = useState<PageSetting | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!isStale && cached) {
      setSettings(cached.data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch("/api/page-settings")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const all: PageSetting[] = data.settings ?? [];
        const now = Date.now();
        for (const s of all) cache.set(s.page_slug, { data: s, ts: now });
        setSettings(all.find((s) => s.page_slug === slug) ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, isStale, cached]);

  return { settings, loading };
}
