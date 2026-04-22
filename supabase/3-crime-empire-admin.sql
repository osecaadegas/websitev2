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

-- ─── Extend item_category enum with drug ────────────────────
-- Must run before any insert of drug items
do $$ begin
  alter type item_category add value if not exists 'drug';
exception when others then null;
end $$;

-- ─── Add required_level to items (for shop level gating) ────
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_name = 'items' and column_name = 'required_level') then
    alter table items add column required_level integer not null default 1
      check (required_level >= 1);
  end if;
end $$;

-- ─── Notification system ─────────────────────────────────────
create table if not exists player_notifications (
  id          uuid        primary key default gen_random_uuid(),
  player_id   uuid        not null references crime_players(id) on delete cascade,
  type        text        not null, -- 'pvp_attacked' | 'worker_event' | 'jail_released' | 'general'
  title       text        not null,
  message     text        not null,
  read        boolean     not null default false,
  data        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_player_notifications_player on player_notifications(player_id, read, created_at desc);
alter table player_notifications disable row level security;

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
  min_quantity integer not null default 1 check (min_quantity >= 1),
  max_quantity integer not null default 1 check (max_quantity >= 1),
  unique(crime_id, item_id)
);

-- Add quantity columns to existing crime_item_drops if they don't exist
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'crime_item_drops' and column_name = 'min_quantity') then
    alter table crime_item_drops add column min_quantity integer not null default 1 check (min_quantity >= 1);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'crime_item_drops' and column_name = 'max_quantity') then
    alter table crime_item_drops add column max_quantity integer not null default 1 check (max_quantity >= 1);
  end if;
end $$;

create index if not exists idx_crime_item_drops_crime on crime_item_drops(crime_id);

-- ─── Business Input Items (what a business consumes to run) ──
create table if not exists business_input_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  quantity_per_hour numeric not null default 1 check (quantity_per_hour > 0),
  unique(business_id, item_id)
);
create index if not exists idx_biz_input_items_biz on business_input_items(business_id);
alter table business_input_items disable row level security;

-- ─── Business Output Items (what a business can produce) ─────
create table if not exists business_output_items (
  id uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  item_id      uuid not null references items(id) on delete cascade,
  quantity_per_hour numeric not null default 1 check (quantity_per_hour > 0),
  drop_chance  numeric not null default 1.0 check (drop_chance > 0 and drop_chance <= 1),
  unique(business_id, item_id)
);
create index if not exists idx_biz_output_items_biz on business_output_items(business_id);
alter table business_output_items disable row level security;

-- ─── RLS: admin tables are server-side only (no client exposure) 
alter table ce_admin_logs       disable row level security;
alter table ce_system_settings  disable row level security;
alter table ce_shop_listings    disable row level security;
alter table crime_item_drops    disable row level security;

-- ─── Brothel collection timestamp (separate from last_login) ─
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_name = 'crime_players' and column_name = 'last_brothel_collect_at') then
    alter table crime_players add column last_brothel_collect_at timestamptz;
  end if;
end $$;
