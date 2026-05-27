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

alter table analytics_sessions
  add column if not exists gpu_fingerprint text;

-- Useful indexes for dashboard queries
create index if not exists idx_analytics_sessions_device   on analytics_sessions(device_type);
create index if not exists idx_analytics_sessions_browser  on analytics_sessions(browser);
create index if not exists idx_analytics_sessions_os       on analytics_sessions(os);
create index if not exists idx_analytics_sessions_language on analytics_sessions(language);
create index if not exists idx_analytics_sessions_gpu      on analytics_sessions(gpu_fingerprint) where gpu_fingerprint is not null;

-- New fraud_config thresholds (idempotent)
insert into fraud_config (key, value, description) values
  ('max_users_per_ip_24h', 3, 'Max distinct logged-in users from same IP in 24 hours'),
  ('max_users_per_gpu_7d', 2, 'Max distinct logged-in users sharing same GPU fingerprint in 7 days')
on conflict (key) do nothing;

-- ── geo_cache ────────────────────────────────────────────────
alter table geo_cache
  add column if not exists country_code text,
  add column if not exists latitude     double precision,
  add column if not exists longitude    double precision,
  add column if not exists timezone     text,
  add column if not exists zip          text;
