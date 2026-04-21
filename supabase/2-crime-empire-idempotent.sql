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
  create type business_type as enum ('weed_farm','pill_factory','crypto_mining','scam_office','chop_shop','counterfeit_lab','nightclub','casino','weapon_smuggling','car_chop_shop','fight_club','identity_ring','cyber_network','diamond_smuggling','offshore_bank','arms_dealing','drug_cartel','empire_hq');
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
  prestige_level integer not null default 0,
  total_levels_earned integer not null default 0,
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
  last_wage_payment timestamptz not null default now(),
  purchased_at timestamptz not null default now(),
  unique(player_id, business_id)
);

create table if not exists business_item_production (
  id uuid primary key default gen_random_uuid(),
  player_business_id uuid not null references player_businesses(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  quantity_produced integer not null default 0,
  last_production timestamptz not null default now(),
  unique(player_business_id, item_id)
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
  times_prestiged integer not null default 0,
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

create table if not exists prestige_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references crime_players(id) on delete cascade,
  old_level integer not null,
  prestige_level integer not null,
  respect_at_prestige integer not null,
  dirty_cash_at_prestige numeric not null,
  cash_at_prestige numeric not null,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════
-- CONSTRAINTS (ensure they exist for idempotency)
-- ═══════════════════════════════════════════════════════════

do $$ begin
  alter table crimes add constraint crimes_name_unique unique (name);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table businesses add constraint businesses_type_unique unique (type);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table items add constraint items_name_unique unique (name);
exception when duplicate_object then null;
end $$;

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

create index if not exists idx_crime_players_user_id on crime_players(user_id);
create index if not exists idx_crime_players_level on crime_players(level desc);
create index if not exists idx_crime_players_prestige on crime_players(prestige_level desc, level desc);
create index if not exists idx_player_crime_exp on player_crime_experience(player_id);
create index if not exists idx_crime_attempts_player on crime_attempts(player_id, created_at desc);
create index if not exists idx_jail_records_player on jail_records(player_id);
create index if not exists idx_player_businesses on player_businesses(player_id);
create index if not exists idx_player_inventory on player_inventory(player_id);
create index if not exists idx_pvp_attacker on pvp_battles(attacker_id, created_at desc);
create index if not exists idx_pvp_defender on pvp_battles(defender_id, created_at desc);
create index if not exists idx_contract_attempts_player on contract_attempts(player_id);
create index if not exists idx_brothel_workers_player on brothel_workers(player_id);
create index if not exists idx_prestige_history_player on prestige_history(player_id, created_at desc);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA - COMPREHENSIVE CRIME PROGRESSION (Level 1-100)
-- ═══════════════════════════════════════════════════════════

insert into crimes (name, description, difficulty, required_level, base_success_rate, jail_risk, stamina_cost, min_dirty_cash, max_dirty_cash, xp_reward, respect_reward) values
  -- PETTY CRIMES (Level 1-10) - Street Level
  ('Roubar Carteira', 'Rouba a carteira de um turista distraído', 'petty', 1, 0.85, 0.05, 5, 50, 150, 10, 1),
  ('Vandalizar Propriedade', 'Danifica propriedade privada', 'petty', 1, 0.90, 0.03, 3, 30, 100, 8, 1),
  ('Roubar Bicicleta', 'Rouba uma bicicleta desbloqueada', 'petty', 2, 0.80, 0.08, 5, 80, 200, 15, 1),
  ('Assaltar Loja', 'Assalta uma loja de conveniência', 'petty', 3, 0.70, 0.15, 10, 200, 500, 25, 3),
  ('Roubar Telemóvel', 'Rouba um telemóvel de um desprevenido', 'petty', 4, 0.75, 0.12, 8, 150, 400, 20, 2),
  ('Grafitti Ilegal', 'Faz grafitti em edifícios públicos', 'petty', 5, 0.85, 0.05, 5, 50, 150, 18, 2),
  ('Roubar em Parquímetro', 'Arromba e rouba dinheiro de parquímetros', 'petty', 6, 0.70, 0.15, 10, 200, 600, 30, 3),
  ('Burlar Transporte Público', 'Revende passes de transporte falsos', 'petty', 8, 0.80, 0.10, 8, 180, 450, 35, 3),
  ('Roubar Caixa de Correio', 'Rouba encomendas de caixas de correio', 'petty', 10, 0.75, 0.12, 10, 250, 700, 45, 4),
  
  -- SMALL CRIMES (Level 12-25) - Organized Street Crime
  ('Roubar Carro', 'Rouba um carro estacionado', 'small', 12, 0.65, 0.20, 15, 500, 1200, 60, 5),
  ('Assaltar Farmácia', 'Rouba medicamentos controlados de uma farmácia', 'small', 14, 0.60, 0.25, 18, 800, 2000, 80, 6),
  ('Fraude de Cartão', 'Clona e usa cartões de crédito', 'small', 16, 0.65, 0.22, 15, 1000, 2500, 100, 7),
  ('Roubar Scooter', 'Rouba e vende scooters elétricas', 'small', 18, 0.70, 0.18, 12, 600, 1500, 90, 6),
  ('Assalto ao Correio', 'Rouba encomendas valiosas de uma carrinha do correio', 'small', 20, 0.60, 0.28, 20, 1500, 3500, 120, 8),
  ('Contrabando Menor', 'Transporta mercadoria ilegal pela fronteira', 'small', 22, 0.65, 0.24, 18, 1200, 3000, 110, 7),
  ('Assaltar Posto Gasolina', 'Assalta um posto de gasolina à noite', 'small', 24, 0.58, 0.30, 22, 2000, 4500, 140, 9),
  
  -- MEDIUM CRIMES (Level 28-50) - Professional Criminal
  ('Assaltar Casa de Luxo', 'Invade uma casa de luxo e rouba objetos de valor', 'medium', 28, 0.55, 0.32, 25, 3000, 7000, 180, 12),
  ('Roubar Camião de Carga', 'Intercepta e rouba um camião com mercadoria', 'medium', 30, 0.50, 0.35, 28, 4000, 9000, 220, 15),
  ('Fraude Empresarial', 'Executa esquema de fraude em empresas', 'medium', 32, 0.60, 0.28, 22, 3500, 8000, 200, 13),
  ('Assaltar Joalharia', 'Assalta uma joalharia durante o dia', 'medium', 35, 0.48, 0.38, 30, 8000, 18000, 300, 20),
  ('Roubo de Identidade', 'Rouba identidades e vende informações', 'medium', 38, 0.65, 0.25, 20, 3000, 7500, 240, 16),
  ('Assaltar Armazém', 'Rouba mercadoria de um armazém comercial', 'medium', 40, 0.55, 0.32, 25, 5000, 12000, 280, 18),
  ('Sequestro Relâmpago', 'Sequestro rápido para resgate baixo', 'medium', 42, 0.45, 0.42, 35, 10000, 22000, 350, 22),
  ('Extorsão Empresarial', 'Extorque dinheiro de pequenos empresários', 'medium', 45, 0.60, 0.30, 25, 6000, 14000, 320, 20),
  ('Assaltar Banco Pequeno', 'Rouba um banco de bairro', 'medium', 48, 0.42, 0.45, 40, 15000, 35000, 450, 28),
  ('Contrabando de Armas', 'Transporta armas ilegais', 'medium', 50, 0.50, 0.38, 30, 8000, 20000, 400, 25),
  
  -- BIG CRIMES (Level 52-75) - Major Criminal Operations
  ('Assaltar Banco Regional', 'Rouba um grande banco regional', 'big', 52, 0.40, 0.48, 45, 25000, 55000, 600, 35),
  ('Roubar Carro Blindado', 'Intercepta e rouba carro de transporte de valores', 'big', 55, 0.38, 0.50, 50, 35000, 75000, 750, 42),
  ('Tráfico Internacional', 'Organiza rede de tráfico internacional', 'big', 58, 0.45, 0.45, 40, 30000, 65000, 700, 40),
  ('Assaltar Museu', 'Rouba obras de arte de um museu', 'big', 60, 0.35, 0.52, 55, 50000, 110000, 900, 50),
  ('Hacking Corporativo', 'Invade sistemas de grande corporação', 'big', 62, 0.50, 0.40, 35, 40000, 85000, 800, 45),
  ('Sequestro VIP', 'Sequestra pessoa de alto perfil', 'big', 65, 0.32, 0.55, 60, 80000, 180000, 1100, 60),
  ('Assaltar Cofre do Banco', 'Invade e rouba o cofre principal de um banco', 'big', 68, 0.30, 0.58, 65, 100000, 220000, 1300, 70),
  ('Fraude de Seguros', 'Executa grande esquema de fraude de seguros', 'big', 70, 0.48, 0.42, 40, 50000, 120000, 1000, 55),
  ('Roubar Galeria de Arte', 'Rouba peças raras de galeria de arte', 'big', 72, 0.35, 0.52, 55, 90000, 200000, 1200, 65),
  ('Assaltar Casa de Leilões', 'Rouba durante leilão de itens valiosos', 'big', 75, 0.33, 0.54, 58, 110000, 240000, 1400, 75),
  
  -- LEGENDARY CRIMES (Level 78-100+) - Elite Criminal Mastermind
  ('Heist do Casino', 'Rouba o casino mais protegido da cidade', 'legendary', 78, 0.28, 0.60, 70, 150000, 350000, 1800, 90),
  ('Assaltar Banco Central', 'O maior assalto a banco - Banco Central', 'legendary', 80, 0.25, 0.62, 75, 200000, 450000, 2200, 110),
  ('Roubar Diamantes', 'Rouba coleção de diamantes raros', 'legendary', 82, 0.30, 0.58, 65, 180000, 400000, 2000, 100),
  ('Cyber Attack Massivo', 'Ataque informático a instituições financeiras', 'legendary', 85, 0.35, 0.55, 60, 160000, 380000, 2100, 105),
  ('Assaltar Depósito Federal', 'Rouba reservas de ouro do depósito federal', 'legendary', 88, 0.22, 0.65, 80, 300000, 650000, 2800, 140),
  ('Roubar Aeroporto', 'Assalta carga de alto valor no aeroporto', 'legendary', 90, 0.28, 0.60, 70, 220000, 500000, 2400, 120),
  ('Manipulação Bolsa', 'Manipula mercado de ações para lucro massivo', 'legendary', 92, 0.32, 0.56, 65, 200000, 480000, 2300, 115),
  ('Assaltar Navio de Carga', 'Pirataria moderna - rouba navio com carga valiosa', 'legendary', 95, 0.25, 0.62, 75, 280000, 620000, 2700, 135),
  ('Roubar Comboio Blindado', 'Assalta comboio de transporte de valores', 'legendary', 98, 0.23, 0.64, 78, 320000, 700000, 3000, 150),
  ('Mega Heist Internacional', 'O crime definitivo - operação multinacional', 'legendary', 100, 0.20, 0.68, 85, 400000, 900000, 3500, 180),
  
  -- ULTRA LEGENDARY (Level 100+) - Endgame Content
  ('Roubar Reserva Nacional', 'Infiltra e rouba da reserva nacional de ouro', 'legendary', 105, 0.18, 0.70, 90, 500000, 1100000, 4200, 220),
  ('Operação Fantasma', 'Crime perfeito que nunca será descoberto', 'legendary', 110, 0.15, 0.72, 95, 600000, 1300000, 5000, 260),
  ('Controlar a Cidade', 'Domina completamente o submundo da cidade', 'legendary', 120, 0.12, 0.75, 100, 800000, 1800000, 7000, 350)
on conflict (name) do nothing;

insert into businesses (name, type, description, purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour, required_level) values
  ('Quinta de Cannabis', 'weed_farm', 'Produz cannabis que podes vender. +1g por hora, +0.5g por worker.', 10000, 0, 5, 50, 5),
  ('Fábrica de Pílulas', 'pill_factory', 'Produz pílulas ilegais. +2 pílulas por hora, +1 por worker.', 25000, 0, 8, 75, 10),
  ('Escritório de Scams', 'scam_office', 'Executa esquemas de fraude online. $400/h base, +$150/h por worker.', 35000, 400, 10, 60, 12),
  ('Mining de Crypto', 'crypto_mining', 'Minera criptomoedas. $500/h base, +$200/h por worker.', 50000, 500, 3, 100, 15),
  ('Lavandaria de Dinheiro', 'chop_shop', 'Converte dinheiro sujo em limpo. 60% taxa base, +3% por worker. Requer workers.', 75000, 0, 10, 120, 18),
  ('Nightclub', 'nightclub', 'Club noturno para lavagem de dinheiro. $800/h base, +$300/h por worker.', 100000, 800, 15, 150, 20),
  ('Lab Contrafação', 'counterfeit_lab', 'Produz notas falsas. +$2000 por ciclo, +$800 por worker.', 120000, 2000, 6, 200, 25),
  ('Casino Clandestino', 'casino', 'Casino ilegal. $1500/h base, +$500/h por worker.', 250000, 1500, 20, 250, 30),
  ('Contrabando de Armas', 'weapon_smuggling', 'Contrabandeia armas pela fronteira. +2 armas/h, +1 por worker.', 350000, 0, 12, 300, 35),
  ('Desmanche de Carros', 'car_chop_shop', 'Desmonta carros roubados. $2000/h base, +$800/h por worker.', 450000, 2000, 10, 350, 40),
  ('Clube de Luta', 'fight_club', 'Organiza lutas ilegais. $2500/h base, +$900/h por worker.', 600000, 2500, 15, 400, 45),
  ('Rede de Roubo de Identidades', 'identity_ring', 'Rouba e vende identidades. $3000/h base, +$1000/h por worker.', 800000, 3000, 12, 450, 50),
  ('Rede de Cibercrime', 'cyber_network', 'Operações de hacking em massa. $3500/h base, +$1200/h por worker.', 1000000, 3500, 8, 500, 55),
  ('Contrabando de Diamantes', 'diamond_smuggling', 'Contrabandeia diamantes. +1 diamante/2h, +0.5 por worker.', 1500000, 0, 10, 600, 60),
  ('Banco Offshore', 'offshore_bank', 'Lava dinheiro internacional. 70% taxa base, +2% por worker.', 2000000, 0, 15, 700, 65),
  ('Tráfico de Armas Pesadas', 'arms_dealing', 'Vende armas militares. $5000/h base, +$1500/h por worker.', 2500000, 5000, 12, 800, 70),
  ('Cartel de Drogas', 'drug_cartel', 'Operação internacional de drogas. $6000/h base, +$2000/h por worker.', 3500000, 6000, 20, 1000, 75),
  ('QG do Império', 'empire_hq', 'Controla todo o submundo. $10000/h base, +$3000/h por worker. Bónus global +10%.', 5000000, 10000, 25, 1500, 80)
on conflict (type) do update set
  description = excluded.description,
  base_income_per_hour = excluded.base_income_per_hour,
  employee_cost_per_hour = excluded.employee_cost_per_hour,
  purchase_price = excluded.purchase_price,
  max_employees = excluded.max_employees,
  required_level = excluded.required_level;

-- Add drug items for businesses to produce
insert into items (name, description, category, base_price) values
  ('Cannabis (1g)', 'Grama de cannabis de alta qualidade', 'material', 50),
  ('Pílulas Ilegais', 'Pílulas controladas', 'material', 100),
  ('Notas Falsas ($1000)', 'Dinheiro contrafacto', 'material', 800),
  ('Arma Ilegal', 'Arma contrabandeada', 'weapon', 2000),
  ('Peças de Carro Roubadas', 'Componentes de veículos desmanchados', 'material', 1500),
  ('Diamante Contrabandeado', 'Diamante roubado de alto valor', 'material', 5000)
on conflict (name) do nothing;

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
alter table business_item_production enable row level security;
alter table player_inventory enable row level security;
alter table pvp_battles enable row level security;
alter table contract_attempts enable row level security;
alter table brothel_workers enable row level security;
alter table black_market_transactions enable row level security;
alter table player_stats enable row level security;
alter table prestige_history enable row level security;
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
create policy "Players manage business production" on business_item_production for all using (true);
create policy "Players manage inventory" on player_inventory for all using (true);
create policy "Players read pvp" on pvp_battles for select using (true);
create policy "Players insert pvp" on pvp_battles for insert with check (true);
create policy "Players manage contracts" on contract_attempts for all using (true);
create policy "Players manage brothel" on brothel_workers for all using (true);
create policy "Players manage black market" on black_market_transactions for all using (true);
create policy "Players read stats" on player_stats for select using (true);
create policy "Players update stats" on player_stats for update using (true);
create policy "Players insert stats" on player_stats for insert with check (true);
create policy "Players read prestige history" on prestige_history for select using (true);
create policy "Players insert prestige history" on prestige_history for insert with check (true);

select 'Crime Empire schema created successfully!' as status;
