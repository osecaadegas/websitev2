-- ═══════════════════════════════════════════════════════════
-- ANALYTICS ENRICHMENT MIGRATION
-- Adds: device_type, browser, os, language, screen dimensions,
--       timezone, user_email, precise geo (lat/lon/zip/country_code)
-- Run this once against your Supabase project.
-- ═══════════════════════════════════════════════════════════

-- ── analytics_sessions ──────────────────────────────────────
alter table analytics_sessions
  add column if not exists device_type   text,
  add column if not exists browser       text,
  add column if not exists os            text,
  add column if not exists language      text,
  add column if not exists screen_width  integer,
  add column if not exists screen_height integer,
  add column if not exists timezone      text,
  add column if not exists user_email    text,
  add column if not exists country_code  text,
  add column if not exists latitude      double precision,
  add column if not exists longitude     double precision,
  add column if not exists zip           text;

-- Useful indexes for dashboard queries
create index if not exists idx_analytics_sessions_device   on analytics_sessions(device_type);
create index if not exists idx_analytics_sessions_browser  on analytics_sessions(browser);
create index if not exists idx_analytics_sessions_os       on analytics_sessions(os);
create index if not exists idx_analytics_sessions_language on analytics_sessions(language);

-- ── geo_cache ────────────────────────────────────────────────
alter table geo_cache
  add column if not exists country_code text,
  add column if not exists latitude     double precision,
  add column if not exists longitude    double precision,
  add column if not exists timezone     text,
  add column if not exists zip          text;
