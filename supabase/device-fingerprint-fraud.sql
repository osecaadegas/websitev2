-- ═══════════════════════════════════════════════════════════
-- DEVICE FINGERPRINT FRAUD DETECTION MIGRATION
-- Adds: device_fingerprint column to analytics_sessions
--       fraud_config entry for mobile multi-account threshold
-- Detects: same physical device (mobile/desktop) used across
--          multiple accounts to click /ofertas links
-- ═══════════════════════════════════════════════════════════

-- ── analytics_sessions ──────────────────────────────────────
alter table analytics_sessions
  add column if not exists device_fingerprint text;

-- Index for fast lookup during fraud checks
create index if not exists idx_analytics_sessions_device_fp
  on analytics_sessions(device_fingerprint)
  where device_fingerprint is not null;

-- ── fraud_config threshold ───────────────────────────────────
insert into fraud_config (key, value, description) values
  ('max_users_per_device_7d', 2, 'Max distinct accounts allowed from same device fingerprint clicking /ofertas in 7 days')
on conflict (key) do nothing;
