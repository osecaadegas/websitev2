-- ============================================================
-- CRIME EMPIRE - Complete Game Database Schema (IDEMPOTENT)
-- Run AFTER 1-secahub-schema.sql
-- Safe to run multiple times
-- ============================================================

-- Drop existing policies first to avoid conflicts
do $$ 
declare
  r record;
begin
  for r in (select policyname, tablename from pg_policies where schemaname = 'public' and policyname like '%crime%' or policyname like '%Players%') loop
    execute 'drop policy if exists "' || r.policyname || '" on ' || r.tablename;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════

do $$ begin
  create type player_class as enum ('thief','hooligan','businessman','hitman','scammer','brute','dealer','pimp');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type crime_difficulty as enum ('petty','small','medium','big','legendary');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type business_type as enum ('weed_farm','pill_factory','crypto_mining','scam_office','chop_shop','counterfeit_lab','nightclub','casino');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type item_category as enum ('weapon','armor','consumable','material','special');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type contract_difficulty as enum ('easy','medium','hard');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type worker_status as enum ('healthy','sick','leaving');
exception when duplicate_object then null;
end $$;

-- ═══════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════

create table if not exists crime_players (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  username text not null,
  display_name text,
  avatar_url text,
  class player_class not null,
  level integer not null default 1,
  xp integer not null default 0,
  xp_to_next_level integer not null default 100,
  hp integer not null default 100,
  max_hp integer not null default 100,
  respect integer not null default 0,
  power integer not null default 10,
  intelligence integer not null default 10,
  charisma integer not null default 10,
  dirty_cash numeric not null default 1000,
  cash numeric not null default 500,
  vcash numeric not null default 0,
  stamina integer not null default 100,
  max_stamina integer not null default 100,
  last_stamina_update timestamptz not null default now(),
  in_jail boolean not null default false,
  jail_release_at timestamptz,
  boost_expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  last_login timestamptz not null default now()
);

create table if not exists crimes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  difficulty crime_difficulty not null,
  required_level integer not null default 1,
  required_power integer not null default 0,
  required_intelligence integer not null default 0,
  base_success_rate numeric not null default 0.5 check (base_success_rate >= 0 and base_success_rate <= 1),
  jail_risk numeric not null default 0.1 check (jail_risk >= 0 and jail_risk <= 1),
  stamina_cost integer not null default 10,
  min_dirty_cash integer not null default 100,
  max_dirty_cash integer not null default 500,
  xp_reward integer not null default 50,
  respect_reward integer not null default 5,
  cooldown_minutes integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists player_crime_experience (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  crime_id uuid not null references crimes(id) on delete cascade,
  attempts integer not null default 0,
  successes integer not null default 0,
  bonus_success_rate numeric not null default 0 check (bonus_success_rate <= 0.3),
  last_attempt timestamptz,
  unique(player_id, crime_id)
);

create table if not exists crime_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  crime_id uuid not null references crimes(id) on delete cascade,
  success boolean not null,
  went_to_jail boolean not null default false,
  dirty_cash_earned integer not null default 0,
  xp_earned integer not null default 0,
  respect_earned integer not null default 0,
  success_rate_used numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists jail_records (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  crime_id uuid references crimes(id),
  jail_time_minutes integer not null,
  release_at timestamptz not null,
  released_early boolean not null default false,
  release_method text,
  amount_paid integer,
  created_at timestamptz not null default now()
);

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type business_type not null unique,
  description text not null,
  purchase_price integer not null,
  base_income_per_hour integer not null,
  max_employees integer not null default 5,
  employee_cost_per_hour integer not null,
  required_level integer not null default 1,
  required_items jsonb not null default '[]',
  raid_risk numeric not null default 0.05,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists player_businesses (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  employees integer not null default 0,
  max_employees integer not null default 5,
  upgrade_level integer not null default 1,
  income_multiplier numeric not null default 1.0,
  active boolean not null default true,
  last_collection timestamptz not null default now(),
  purchased_at timestamptz not null default now(),
  unique(player_id, business_id)
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  category item_category not null,
  power_bonus integer not null default 0,
  intelligence_bonus integer not null default 0,
  charisma_bonus integer not null default 0,
  hp_bonus integer not null default 0,
  stamina_restore integer not null default 0,
  success_rate_bonus numeric not null default 0,
  has_durability boolean not null default false,
  max_durability integer,
  base_price integer not null default 100,
  tradeable boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists player_inventory (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  quantity integer not null default 1,
  durability integer,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  unique(player_id, item_id)
);

create table if not exists pvp_battles (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references crime_players(id) on delete cascade,
  defender_id uuid not null references crime_players(id) on delete cascade,
  attacker_power integer not null,
  attacker_respect integer not null,
  attacker_pvp_score numeric not null,
  defender_power integer not null,
  defender_respect integer not null,
  defender_pvp_score numeric not null,
  winner_id uuid not null references crime_players(id),
  dirty_cash_stolen integer not null default 0,
  respect_gained integer not null default 0,
  xp_gained integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  target_name text not null,
  target_description text not null,
  difficulty contract_difficulty not null,
  required_level integer not null default 1,
  required_power integer not null default 0,
  success_rate numeric not null default 0.5,
  stamina_cost integer not null default 15,
  cash_reward integer not null,
  xp_reward integer not null,
  respect_reward integer not null,
  power_reward integer not null default 0,
  daily_limit integer not null default 1,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists contract_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  success boolean not null,
  cash_earned integer not null default 0,
  xp_earned integer not null default 0,
  respect_earned integer not null default 0,
  power_gained integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists brothel_workers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  name text not null,
  status worker_status not null default 'healthy',
  income_per_hour integer not null default 100,
  charisma_bonus integer not null default 1,
  intelligence_bonus integer not null default 1,
  respect_bonus integer not null default 1,
  next_event_at timestamptz,
  hired_at timestamptz not null default now()
);

create table if not exists black_market_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('buy', 'sell')),
  quantity integer not null,
  price_per_unit integer not null,
  total_amount integer not null,
  caught boolean not null default false,
  jail_time_minutes integer,
  created_at timestamptz not null default now()
);

create table if not exists player_stats (
  player_id uuid primary key references crime_players(id) on delete cascade,
  total_crimes_attempted integer not null default 0,
  total_crimes_succeeded integer not null default 0,
  times_jailed integer not null default 0,
  pvp_wins integer not null default 0,
  pvp_losses integer not null default 0,
  contracts_completed integer not null default 0,
  total_dirty_cash_earned numeric not null default 0,
  total_cash_earned numeric not null default 0,
  total_spent numeric not null default 0,
  businesses_owned integer not null default 0,
  total_business_income numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

create index if not exists idx_crime_players_user_id on crime_players(user_id);
create index if not exists idx_crime_players_level on crime_players(level desc);
create index if not exists idx_player_crime_exp on player_crime_experience(player_id);
create index if not exists idx_crime_attempts_player on crime_attempts(player_id, created_at desc);
create index if not exists idx_jail_records_player on jail_records(player_id);
create index if not exists idx_player_businesses on player_businesses(player_id);
create index if not exists idx_player_inventory on player_inventory(player_id);
create index if not exists idx_pvp_attacker on pvp_battles(attacker_id, created_at desc);
create index if not exists idx_pvp_defender on pvp_battles(defender_id, created_at desc);
create index if not exists idx_contract_attempts_player on contract_attempts(player_id);
create index if not exists idx_brothel_workers_player on brothel_workers(player_id);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════

insert into crimes (name, description, difficulty, required_level, base_success_rate, jail_risk, stamina_cost, min_dirty_cash, max_dirty_cash, xp_reward, respect_reward) values
  ('Roubar Carteira', 'Rouba a carteira de um turista distraído', 'petty', 1, 0.85, 0.05, 5, 50, 150, 10, 1),
  ('Assaltar Loja', 'Assalta uma loja de conveniência', 'small', 2, 0.70, 0.15, 10, 200, 500, 25, 3),
  ('Roubar Carro', 'Rouba um carro estacionado', 'small', 3, 0.65, 0.20, 15, 500, 1200, 40, 5),
  ('Assaltar Casa', 'Invade uma casa e rouba objetos de valor', 'medium', 5, 0.55, 0.25, 20, 1000, 2500, 75, 8),
  ('Assaltar Banco', 'Rouba um banco com uma equipa', 'big', 10, 0.40, 0.40, 30, 5000, 15000, 200, 20),
  ('Roubar Joalharia', 'Assalta uma joalharia de luxo', 'big', 15, 0.35, 0.45, 35, 10000, 25000, 350, 30),
  ('Heist do Casino', 'O maior assalto - rouba um casino', 'legendary', 25, 0.25, 0.55, 50, 50000, 150000, 1000, 100)
on conflict (name) do nothing;

insert into businesses (name, type, description, purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour, required_level) values
  ('Quinta de Cannabis', 'weed_farm', 'Produz e vende cannabis', 10000, 500, 5, 50, 5),
  ('Fábrica de Pílulas', 'pill_factory', 'Produz pílulas ilegais', 25000, 1200, 8, 100, 10),
  ('Mining de Crypto', 'crypto_mining', 'Minera criptomoedas', 50000, 2000, 3, 150, 15),
  ('Escritório de Scams', 'scam_office', 'Executa esquemas de fraude online', 35000, 1500, 10, 80, 12),
  ('Nightclub', 'nightclub', 'Club noturno para lavagem de dinheiro', 100000, 5000, 15, 200, 20)
on conflict (type) do nothing;

insert into items (name, description, category, power_bonus, intelligence_bonus, charisma_bonus, base_price) values
  ('Pistola', 'Arma básica', 'weapon', 5, 0, 0, 1000),
  ('Colete à Prova de Bala', 'Proteção básica', 'armor', 0, 0, 0, 2000),
  ('Laptop Hackeado', 'Aumenta inteligência', 'special', 0, 10, 0, 3000),
  ('Fato de Luxo', 'Aumenta carisma', 'special', 0, 0, 10, 5000)
on conflict (name) do nothing;

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

alter table crime_players enable row level security;
alter table player_crime_experience enable row level security;
alter table crime_attempts enable row level security;
alter table jail_records enable row level security;
alter table player_businesses enable row level security;
alter table player_inventory enable row level security;
alter table pvp_battles enable row level security;
alter table contract_attempts enable row level security;
alter table brothel_workers enable row level security;
alter table black_market_transactions enable row level security;
alter table player_stats enable row level security;
alter table crimes enable row level security;
alter table businesses enable row level security;
alter table items enable row level security;
alter table contracts enable row level security;

create policy "Public read crimes" on crimes for select using (true);
create policy "Public read businesses" on businesses for select using (true);
create policy "Public read items" on items for select using (true);
create policy "Public read contracts" on contracts for select using (true);
create policy "Players read own data" on crime_players for select using (true);
create policy "Players insert own data" on crime_players for insert with check (true);
create policy "Players update own data" on crime_players for update using (true);
create policy "Players manage own experience" on player_crime_experience for all using (true);
create policy "Players manage own attempts" on crime_attempts for all using (true);
create policy "Players read jail records" on jail_records for select using (true);
create policy "Players insert jail records" on jail_records for insert with check (true);
create policy "Players manage businesses" on player_businesses for all using (true);
create policy "Players manage inventory" on player_inventory for all using (true);
create policy "Players read pvp" on pvp_battles for select using (true);
create policy "Players insert pvp" on pvp_battles for insert with check (true);
create policy "Players manage contracts" on contract_attempts for all using (true);
create policy "Players manage brothel" on brothel_workers for all using (true);
create policy "Players manage black market" on black_market_transactions for all using (true);
create policy "Players read stats" on player_stats for select using (true);
create policy "Players update stats" on player_stats for update using (true);
create policy "Players insert stats" on player_stats for insert with check (true);

select 'Crime Empire schema created successfully!' as status;
