-- ═══════════════════════════════════════════════════════════════
-- CRIME EMPIRE — Acidente de Avião (Plane Crash Events)
-- Run AFTER 3-crime-empire-admin.sql
-- Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════

-- Plane crash events (3 per week, random schedule)
create table if not exists plane_crashes (
  id               uuid        primary key default gen_random_uuid(),
  week_number      integer     not null,
  week_year        integer     not null,
  scheduled_at     timestamptz not null,
  active_until     timestamptz not null,   -- 6h scrape window after crash
  location_name    text        not null,
  info_cost        integer     not null default 1000,   -- dirty_cash to buy intel
  loot             jsonb       not null default '[]',   -- [{item_id, item_name, quantity, unit_value, category, rarity, image_url}]
  total_loot_value integer     not null default 0,
  status           text        not null default 'upcoming'
    check (status in ('upcoming', 'active', 'expired')),
  created_at       timestamptz not null default now()
);

create index if not exists idx_plane_crashes_week   on plane_crashes(week_number, week_year);
create index if not exists idx_plane_crashes_status on plane_crashes(status);
create index if not exists idx_plane_crashes_sched  on plane_crashes(scheduled_at);
alter table plane_crashes disable row level security;

-- Player interactions per crash event
create table if not exists plane_crash_players (
  id                uuid        primary key default gen_random_uuid(),
  crash_id          uuid        not null references plane_crashes(id) on delete cascade,
  player_id         uuid        not null references crime_players(id) on delete cascade,
  info_purchased    boolean     not null default false,
  info_purchased_at timestamptz,
  scraped           boolean     not null default false,
  scraped_at        timestamptz,
  items_received    jsonb,
  unique(crash_id, player_id)
);

create index if not exists idx_pcp_player on plane_crash_players(player_id);
create index if not exists idx_pcp_crash  on plane_crash_players(crash_id);
alter table plane_crash_players disable row level security;
