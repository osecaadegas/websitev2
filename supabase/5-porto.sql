-- ═══════════════════════════════════════════════════════════════
-- CRIME EMPIRE — Porto (Boat Smuggling)
-- Run AFTER 4-plane-crash.sql
-- Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════

-- Boats that dock weekly to smuggle drugs out for clean cash
create table if not exists porto_boats (
  id               uuid        primary key default gen_random_uuid(),
  week_number      integer     not null,
  week_year        integer     not null,
  boat_name        text        not null,
  destination      text        not null,
  docks_at         timestamptz not null,       -- when the boat arrives and starts accepting cargo
  departs_by       timestamptz not null,       -- max time the boat stays docked (auto-departs after this)
  departs_at       timestamptz,                -- actual departure time (when full or departs_by reached)
  payment_at       timestamptz,                -- departs_at + 72h (3 days) — when players get clean cash
  max_cargo        integer     not null,       -- total drug units the boat can carry (shared across all players)
  current_cargo    integer     not null default 0,
  status           text        not null default 'upcoming'
    check (status in ('upcoming', 'docked', 'departed', 'paid')),
  created_at       timestamptz not null default now()
);

create index if not exists idx_porto_boats_week   on porto_boats(week_number, week_year);
create index if not exists idx_porto_boats_status on porto_boats(status);
create index if not exists idx_porto_boats_docks  on porto_boats(docks_at);
alter table porto_boats disable row level security;

-- Per-player cargo loaded onto each boat
create table if not exists porto_cargo (
  id               uuid        primary key default gen_random_uuid(),
  boat_id          uuid        not null references porto_boats(id) on delete cascade,
  player_id        uuid        not null references crime_players(id) on delete cascade,
  item_id          uuid        not null,
  item_name        text        not null,
  image_url        text,
  quantity         integer     not null check (quantity > 0),
  unit_value       integer     not null,       -- base_price at load time (street value per unit)
  payout           integer     not null,       -- floor(quantity * unit_value * 0.70) — clean cash to receive
  paid             boolean     not null default false,
  loaded_at        timestamptz not null default now(),
  unique(boat_id, player_id, item_id)          -- one row per drug type per player per boat
);

create index if not exists idx_porto_cargo_player on porto_cargo(player_id);
create index if not exists idx_porto_cargo_boat   on porto_cargo(boat_id);
alter table porto_cargo disable row level security;
