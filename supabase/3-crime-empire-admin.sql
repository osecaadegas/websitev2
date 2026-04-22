-- ============================================================
-- CRIME EMPIRE - Admin System Schema
-- Run AFTER 2-crime-empire-idempotent.sql
-- Safe to run multiple times
-- ============================================================

-- ─── Audit / Admin Logs ──────────────────────────────────────
create table if not exists ce_admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  admin_username text not null,
  action text not null,           -- create | update | delete | player_action | system
  entity_type text not null,      -- item | crime | business | player | shop | system
  entity_id text,
  entity_name text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ce_admin_logs_time     on ce_admin_logs(created_at desc);
create index if not exists idx_ce_admin_logs_admin    on ce_admin_logs(admin_id);
create index if not exists idx_ce_admin_logs_entity   on ce_admin_logs(entity_type, entity_id);

-- ─── Global System Settings (key/value) ──────────────────────
create table if not exists ce_system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into ce_system_settings (key, value) values
  ('police_intensity',   '0'),
  ('maintenance_mode',   'false'),
  ('crime_multiplier',   '1.0'),
  ('income_multiplier',  '1.0'),
  ('xp_multiplier',      '1.0')
on conflict (key) do nothing;

-- ─── Shop Listings (rotation / stock control) ─────────────────
create table if not exists ce_shop_listings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  price_override integer,                 -- null = use item base_price
  stock integer,                          -- null = infinite
  rotation_type text not null default 'permanent'
    check (rotation_type in ('permanent', 'daily', 'weekly')),
  rotation_ends_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_id)
);

-- ─── Add missing columns to existing tables ──────────────────
-- Addiction (0-100) on crime_players
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_name = 'crime_players' and column_name = 'addiction') then
    alter table crime_players add column addiction integer not null default 0
      check (addiction >= 0 and addiction <= 100);
  end if;
end $$;

-- Rarity on items
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_name = 'items' and column_name = 'rarity') then
    alter table items add column rarity text not null default 'common'
      check (rarity in ('common', 'rare', 'epic', 'legendary'));
  end if;
end $$;

-- ─── Crime Item Drops ────────────────────────────────────────
-- Which items can drop when a crime succeeds, and at what %
create table if not exists crime_item_drops (
  id uuid primary key default gen_random_uuid(),
  crime_id uuid not null references crimes(id) on delete cascade,
  item_id  uuid not null references items(id)  on delete cascade,
  drop_chance numeric not null default 0.1
    check (drop_chance > 0 and drop_chance <= 1),
  unique(crime_id, item_id)
);

create index if not exists idx_crime_item_drops_crime on crime_item_drops(crime_id);

-- ─── RLS: admin tables are server-side only (no client exposure) 
alter table ce_admin_logs       disable row level security;
alter table ce_system_settings  disable row level security;
alter table ce_shop_listings    disable row level security;
alter table crime_item_drops    disable row level security;
