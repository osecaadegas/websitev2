-- ═══════════════════════════════════════════════════════════════
-- ANTI-FRAUD ENRICHMENT — casino-level security upgrade
-- Run this in Supabase SQL Editor (Project: qwyljysblsqzubclodyc)
-- ═══════════════════════════════════════════════════════════════

-- ── New columns on analytics_sessions ──────────────────────────

-- Human-readable GPU renderer string (e.g. "NVIDIA GeForce RTX 3080")
alter table analytics_sessions
  add column if not exists gpu_renderer text;

-- Network connection type reported by the browser (wifi/cellular/4g/etc.)
alter table analytics_sessions
  add column if not exists connection_type text;

-- IPv4 address (split from primary ip_address for dual-stack detection)
alter table analytics_sessions
  add column if not exists ip_v4 text;

-- IPv6 address (from cf-connecting-ipv6 header when available)
alter table analytics_sessions
  add column if not exists ip_v6 text;

-- ── Indexes for fraud detection queries ────────────────────────

-- Speed up multi-session IP offer-abuse check (check #8)
create index if not exists idx_analytics_events_ip_offer_click
  on analytics_events (ip_address, event_type, created_at)
  where event_type = 'offer_click';

-- Speed up IPv4/IPv6 lookup
create index if not exists idx_analytics_sessions_ip_v4
  on analytics_sessions (ip_v4) where ip_v4 is not null;

create index if not exists idx_analytics_sessions_ip_v6
  on analytics_sessions (ip_v6) where ip_v6 is not null;

-- ── Fraud config — new thresholds ──────────────────────────────

-- Maximum distinct sessions from the same IP clicking offers in 24h
-- before flagging as multi-device abuse (default: 2)
insert into fraud_config (key, value, description)
values (
  'max_offer_sessions_per_ip_24h',
  2,
  'Max distinct sessions from same IP clicking /ofertas in 24h before flagging'
)
on conflict (key) do nothing;

-- ── Backfill ip_v4 from existing ip_address values ─────────────
-- (safe: only sets ip_v4 where ip_address looks like IPv4)
update analytics_sessions
set ip_v4 = ip_address
where ip_v4 is null
  and ip_address ~ '^(\d{1,3}\.){3}\d{1,3}$';
