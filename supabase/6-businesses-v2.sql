-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — BUSINESSES V2 MIGRATION
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend player_businesses ─────────────────────────────────────────────
alter table player_businesses
  add column if not exists heat            numeric       not null default 0,
  add column if not exists production_level text          not null default 'normal',
  add column if not exists status          text          not null default 'running',
  add column if not exists last_heat_update timestamptz   not null default now(),
  add column if not exists last_wage_payment timestamptz  not null default now(),
  add column if not exists sick_workers    integer       not null default 0,
  add column if not exists popularity      integer       not null default 50;

-- ─── 2. Extend businesses table ──────────────────────────────────────────────
alter table businesses
  add column if not exists risk_level    text    not null default 'medium',
  add column if not exists heat_per_hour numeric not null default 5,
  add column if not exists tagline       text;

-- Seed risk/heat data for existing businesses
update businesses set risk_level = 'medium', heat_per_hour = 8,  tagline = 'Cultiva e vende cannabis de alta qualidade'    where type = 'weed_farm';
update businesses set risk_level = 'high',   heat_per_hour = 13, tagline = 'Produz pílulas ilegais em escala industrial'   where type = 'pill_factory';
update businesses set risk_level = 'low',    heat_per_hour = 3,  tagline = 'Minera criptomoedas com rigs ilegais'          where type = 'crypto_mining';
update businesses set risk_level = 'medium', heat_per_hour = 7,  tagline = 'Operações de fraude digital em grande escala'  where type = 'scam_office';
update businesses set risk_level = 'high',   heat_per_hour = 15, tagline = 'Desmonta carros roubados e lava dinheiro'      where type = 'chop_shop';
update businesses set risk_level = 'low',    heat_per_hour = 2,  tagline = 'A fachada perfeita para lavar dinheiro'        where type = 'nightclub';
update businesses set risk_level = 'high',   heat_per_hour = 14, tagline = 'Produz dinheiro e documentos falsos'           where type = 'counterfeit_lab';

-- Upsert counterfeit_lab if not seeded
insert into businesses (name, type, description, purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour, required_level, risk_level, heat_per_hour, tagline)
values ('Lab. de Contrafação', 'counterfeit_lab', 'Produz notas e documentos falsos de alta qualidade', 75000, 3000, 6, 150, 18, 'high', 14, 'Produz dinheiro e documentos falsos')
on conflict (type) do nothing;

-- ─── 3. Individual hired workers ─────────────────────────────────────────────
create table if not exists player_business_workers (
  id                  uuid        primary key default gen_random_uuid(),
  player_id           uuid        not null references crime_players(id) on delete cascade,
  player_business_id  uuid        not null references player_businesses(id) on delete cascade,
  worker_def_id       text        not null,
  name                text        not null,
  skill               text        not null,
  trait               text        not null,
  salary              integer     not null,
  production_bonus    numeric     not null default 0,
  efficiency_bonus    numeric     not null default 0,
  stealth_bonus       numeric     not null default 0,
  description         text        not null default '',
  is_active           boolean     not null default true,
  hired_at            timestamptz not null default now()
);

create index if not exists idx_pbw_player_business on player_business_workers(player_business_id);
create index if not exists idx_pbw_player          on player_business_workers(player_id);

-- ─── 4. Active events ────────────────────────────────────────────────────────
create table if not exists player_business_events (
  id                  uuid        primary key default gen_random_uuid(),
  player_id           uuid        not null references crime_players(id) on delete cascade,
  player_business_id  uuid        not null references player_businesses(id) on delete cascade,
  event_def_id        text        not null,
  event_data          jsonb       not null default '{}',
  is_resolved         boolean     not null default false,
  choice_made         text,
  outcome_data        jsonb,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_pbe_player_business on player_business_events(player_business_id);
create index if not exists idx_pbe_player          on player_business_events(player_id);

-- ─── 5. Purchased upgrades ───────────────────────────────────────────────────
create table if not exists player_business_upgrades (
  id                  uuid        primary key default gen_random_uuid(),
  player_id           uuid        not null references crime_players(id) on delete cascade,
  player_business_id  uuid        not null references player_businesses(id) on delete cascade,
  upgrade_def_id      text        not null,
  purchased_at        timestamptz not null default now(),
  unique(player_business_id, upgrade_def_id)
);

create index if not exists idx_pbu_player_business on player_business_upgrades(player_business_id);

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────
alter table player_business_workers  enable row level security;
alter table player_business_events   enable row level security;
alter table player_business_upgrades enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'player_business_workers'  and policyname = 'Players manage own biz workers')  then
    create policy "Players manage own biz workers"  on player_business_workers  for all using (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'player_business_events'   and policyname = 'Players manage own biz events')    then
    create policy "Players manage own biz events"   on player_business_events   for all using (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'player_business_upgrades' and policyname = 'Players manage own biz upgrades')  then
    create policy "Players manage own biz upgrades" on player_business_upgrades for all using (true); end if;
end $$;
