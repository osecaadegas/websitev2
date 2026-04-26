-- ============================================================
--  MISSION SYSTEM — Daily & Weekly Missions
--  Run this in the Supabase SQL editor
-- ============================================================

-- ── 1. Mission definitions (static seed data) ──────────────
CREATE TABLE IF NOT EXISTS mission_definitions (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL,  -- action|skill|economy|exploration|pvp
  system            TEXT NOT NULL,  -- drugs|businesses|contracts|pvp|casino|stocks|mixed
  difficulty        TEXT NOT NULL,  -- easy|medium|hard
  tier_min          INT  DEFAULT 1,
  tier_max          INT  DEFAULT 4,
  base_target       INT  NOT NULL,
  event_trigger     TEXT NOT NULL,
  weight            INT  DEFAULT 5,
  daily_eligible    BOOL DEFAULT true,
  weekly_eligible   BOOL DEFAULT false,
  bonus_target      INT,
  bonus_multiplier  NUMERIC(4,2) DEFAULT 1.0,
  xp_reward         INT  NOT NULL,
  cash_reward       INT  NOT NULL,
  item_reward_pool  TEXT
);

-- ── 2. Player assigned missions ─────────────────────────────
CREATE TABLE IF NOT EXISTS player_missions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        UUID NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  mission_id       TEXT NOT NULL REFERENCES mission_definitions(id),
  type             TEXT NOT NULL CHECK (type IN ('daily','weekly')),
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  progress         INT  DEFAULT 0,
  bonus_progress   INT  DEFAULT 0,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','completed','claimed')),
  completed_at     TIMESTAMPTZ,
  claimed_at       TIMESTAMPTZ,
  xp_awarded       INT  DEFAULT 0,
  cash_awarded     INT  DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_player_missions_player ON player_missions(player_id, status, type);
CREATE INDEX IF NOT EXISTS idx_player_missions_expires ON player_missions(expires_at);

-- ── 3. Login streaks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_streaks (
  player_id        UUID PRIMARY KEY REFERENCES crime_players(id) ON DELETE CASCADE,
  current_streak   INT  DEFAULT 0,
  longest_streak   INT  DEFAULT 0,
  last_login_date  DATE,
  streak_shields   INT  DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Mission progress rate-limiting ────────────────────────
-- Tracks last event times to enforce anti-exploit cooldowns
CREATE TABLE IF NOT EXISTS mission_event_locks (
  player_id        UUID NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  event_key        TEXT NOT NULL,  -- e.g. "pvp_target:uuid", "drug_sell", "casino_session"
  last_tick_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  tick_count       INT  DEFAULT 1,
  window_start     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, event_key)
);

-- ============================================================
--  SEED DATA — 50 Mission Definitions
-- ============================================================

-- DRUGS (D1–D8)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('D1', 'Primeiro Lote',        'Vende droga nas ruas.',                        'economy',     'drugs', 'easy',   1, 4,  3,  'onDrugSold',         6, true,  false, 5,  20,  500),
  ('D2', 'Distribuidor',         'Vende 8 doses numa sessão.',                   'economy',     'drugs', 'medium', 1, 4,  8,  'onDrugSold',         5, true,  false, 12, 35,  900),
  ('D3', 'Atacadista',           'Vende 20 doses hoje.',                         'economy',     'drugs', 'hard',   2, 4,  20, 'onDrugSold',         4, true,  false, 30, 60,  1800),
  ('D4', 'Produtor',             'Produz droga no porto ou no avião.',            'skill',       'drugs', 'easy',   1, 4,  2,  'onDrugProduced',     5, true,  false, 4,  20,  450),
  ('D5', 'Químico',              'Produz 6 lotes de droga.',                     'skill',       'drugs', 'medium', 2, 4,  6,  'onDrugProduced',     4, true,  false, 10, 40,  1000),
  ('D6', 'Lavador de Dinheiro',  'Lava dinheiro sujo no teu negócio.',           'economy',     'drugs', 'easy',   1, 4,  1,  'onCashLaundered',    6, true,  false, 3,  25,  600),
  ('D7', 'Limpa Notas',          'Lava dinheiro 3 vezes.',                       'economy',     'drugs', 'medium', 2, 4,  3,  'onCashLaundered',    5, true,  false, 6,  45,  1100),
  ('D8', 'Rei das Ruas',         'Vende droga 35 vezes esta semana.',            'economy',     'drugs', 'hard',   2, 4,  35, 'onDrugSold',         3, false, true,  50, 200, 5000)
ON CONFLICT (id) DO NOTHING;

-- BUSINESSES (B1–B6)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('B1', 'Cobrador',        'Cobra lucros do teu negócio.',                   'economy', 'businesses', 'easy',   1, 4, 1,  'onBusinessCollected', 7, true,  false, 3,  20,  400),
  ('B2', 'Empresário',      'Cobra lucros 4 vezes.',                          'economy', 'businesses', 'medium', 1, 4, 4,  'onBusinessCollected', 5, true,  false, 6,  40,  900),
  ('B3', 'Investidor',      'Faz upgrade a um negócio.',                      'skill',   'businesses', 'medium', 2, 4, 1,  'onBusinessUpgraded',  4, true,  false, 2,  50,  1200),
  ('B4', 'Empregador',      'Contrata um funcionário.',                       'skill',   'businesses', 'easy',   1, 4, 1,  'onWorkerHired',       4, true,  false, 2,  25,  500),
  ('B5', 'CEO',             'Cobra lucros de 3 negócios diferentes.',         'economy', 'businesses', 'hard',   2, 4, 3,  'onBusinessCollected', 3, true,  false, 5,  70,  2000),
  ('B6', 'Magnata',         'Cobra lucros 20 vezes esta semana.',             'economy', 'businesses', 'hard',   2, 4, 20, 'onBusinessCollected', 3, false, true,  30, 180, 4500)
ON CONFLICT (id) DO NOTHING;

-- CONTRACTS (C1–C7)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('C1', 'Primeiro Contrato',   'Completa um contrato com sucesso.',             'action', 'contracts', 'easy',   1, 4, 1, 'onContractCompleted', 7, true,  false, 2,  25,  500),
  ('C2', 'Assassino',           'Completa 3 contratos.',                         'action', 'contracts', 'medium', 1, 4, 3, 'onContractCompleted', 5, true,  false, 5,  50,  1200),
  ('C3', 'Profissional',        'Completa 7 contratos sem falhar.',              'skill',  'contracts', 'hard',   2, 4, 7, 'onContractCompleted', 3, true,  false, 10, 80,  2200),
  ('C4', 'Sobrevivente',        'Falha um contrato e sobrevive.',                'skill',  'contracts', 'easy',   1, 4, 1, 'onContractFailed',    4, true,  false, 2,  20,  300),
  ('C5', 'Tenaz',               'Completa contratos difíceis 3 vezes.',          'action', 'contracts', 'hard',   2, 4, 3, 'onContractCompleted', 3, true,  false, 5,  75,  2000),
  ('C6', 'Exterminador',        'Completa 15 contratos esta semana.',            'action', 'contracts', 'hard',   2, 4, 15,'onContractCompleted', 3, false, true,  20, 220, 5500),
  ('C7', 'Sem Arranhões',       'Completa 5 contratos sem falhar esta semana.',  'skill',  'contracts', 'medium', 2, 4, 5, 'onContractCompleted', 4, false, true,  10, 160, 3800)
ON CONFLICT (id) DO NOTHING;

-- PvP (P1–P7)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('P1', 'Provocador',          'Ataca outro jogador.',                          'pvp', 'pvp', 'easy',   1, 4, 1, 'onPvPAttack', 6, true,  false, 2,  25,  600),
  ('P2', 'Vitorioso',           'Vence um combate PvP.',                         'pvp', 'pvp', 'medium', 1, 4, 1, 'onPvPWin',   6, true,  false, 3,  45,  1100),
  ('P3', 'Dominador',           'Vence 5 combates PvP.',                         'pvp', 'pvp', 'hard',   2, 4, 5, 'onPvPWin',   4, true,  false, 8,  80,  2200),
  ('P4', 'Gladiador',           'Participa em 3 combates (vitória ou derrota).', 'pvp', 'pvp', 'easy',   1, 4, 3, 'onPvPAttack',5, true,  false, 5,  35,  800),
  ('P5', 'Defensor',            'Defende com sucesso (vence como defensor).',    'pvp', 'pvp', 'medium', 1, 4, 1, 'onPvPDefend',4, true,  false, 2,  50,  1200),
  ('P6', 'Campeão da Semana',   'Vence 12 combates PvP esta semana.',            'pvp', 'pvp', 'hard',   2, 4, 12,'onPvPWin',   3, false, true,  20, 250, 6000),
  ('P7', 'Berserker',           'Ataca 20 jogadores diferentes esta semana.',    'pvp', 'pvp', 'hard',   2, 4, 20,'onPvPAttack',3, false, true,  30, 200, 5000)
ON CONFLICT (id) DO NOTHING;

-- CASINO (K1–K7)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('K1', 'Apostador',           'Joga no casino.',                               'action', 'casino', 'easy',   1, 4, 1, 'onCasinoPlay',       7, true,  false, 3,  20,  400),
  ('K2', 'Sortudo',             'Vence no casino.',                              'action', 'casino', 'medium', 1, 4, 1, 'onCasinoWin',        6, true,  false, 3,  40,  1000),
  ('K3', 'Sesão Longa',         'Completa uma sessão de casino.',                'action', 'casino', 'easy',   1, 4, 1, 'onCasinoSessionEnd', 5, true,  false, 2,  25,  500),
  ('K4', 'Habitual',            'Joga no casino 5 vezes.',                       'action', 'casino', 'medium', 1, 4, 5, 'onCasinoPlay',       5, true,  false, 8,  45,  1100),
  ('K5', 'Viciado',             'Vence no casino 3 vezes.',                      'action', 'casino', 'hard',   2, 4, 3, 'onCasinoWin',        4, true,  false, 5,  65,  1800),
  ('K6', 'Rei do Casino',       'Joga no casino 25 vezes esta semana.',          'action', 'casino', 'hard',   2, 4, 25,'onCasinoPlay',       3, false, true,  40, 190, 4500),
  ('K7', 'Grande Vencedor',     'Vence no casino 15 vezes esta semana.',         'action', 'casino', 'hard',   2, 4, 15,'onCasinoWin',        3, false, true,  25, 220, 5500)
ON CONFLICT (id) DO NOTHING;

-- STOCKS (ST1–ST6)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('ST1', 'Investidor Iniciante', 'Compra ações no mercado.',                    'economy', 'stocks', 'easy',   1, 4, 1, 'onStockBought', 5, true,  false, 2,  20,  400),
  ('ST2', 'Day Trader',           'Vende ações no mercado.',                     'economy', 'stocks', 'easy',   1, 4, 1, 'onStockSold',   5, true,  false, 2,  20,  400),
  ('ST3', 'Analista',             'Compra e vende ações 3 vezes cada.',          'economy', 'stocks', 'medium', 2, 4, 3, 'onStockBought', 4, true,  false, 5,  45,  1100),
  ('ST4', 'Especulador',          'Compra 5 lotes de ações diferentes.',         'economy', 'stocks', 'medium', 2, 4, 5, 'onStockBought', 4, true,  false, 8,  50,  1200),
  ('ST5', 'Operador de Mercado',  'Realiza 10 operações no mercado esta semana.','economy', 'stocks', 'hard',   2, 4, 10,'onStockBought', 3, false, true,  15, 170, 4000),
  ('ST6', 'Lobo de Wall Street',  'Vende 8 posições esta semana.',               'economy', 'stocks', 'hard',   2, 4, 8, 'onStockSold',   3, false, true,  12, 160, 3800)
ON CONFLICT (id) DO NOTHING;

-- WEEKLY CHAIN MISSIONS (CH1–CH5)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('CH1', 'O Grande Plano',    'Completa contratos E vende droga (5 de cada).',   'action',  'mixed', 'hard', 2, 4, 5, 'onContractCompleted', 4, false, true, 8, 280, 7000),
  ('CH2', 'Império Criminal',  'Cobra 5 negócios E vence 3 combates PvP.',        'economy', 'mixed', 'hard', 2, 4, 5, 'onBusinessCollected', 4, false, true, 8, 260, 6500),
  ('CH3', 'Multitasking',      'Joga no casino, vende droga e faz contrato.',     'action',  'mixed', 'medium',2, 4,1, 'onCasinoPlay',        4, false, true, 2, 200, 5000),
  ('CH4', 'Tudo de Uma',       'Executa acções em 4 sistemas diferentes.',        'action',  'mixed', 'hard', 3, 4, 4, 'onAnySystem',         3, false, true, 6, 300, 8000),
  ('CH5', 'Rei do Crime',      'Lidera o leaderboard PvP ou por nível.',          'pvp',     'mixed', 'hard', 3, 4, 1, 'onLeaderboardUpdate', 3, false, true, 1, 350, 9000)
ON CONFLICT (id) DO NOTHING;

-- HIDDEN MISSIONS (H1–H4)
INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty, tier_min, tier_max, base_target, event_trigger, weight, daily_eligible, weekly_eligible, bonus_target, xp_reward, cash_reward)
VALUES
  ('H1', '???', 'Missão oculta — descobre como desbloquear.',   'action', 'mixed', 'hard', 2, 4, 3, 'onContractFailed',   2, false, true, 5, 300, 8000),
  ('H2', '???', 'Missão oculta — descobre como desbloquear.',   'pvp',    'pvp',   'hard', 3, 4, 5, 'onPvPWin',          2, false, true, 8, 320, 8500),
  ('H3', '???', 'Missão oculta — descobre como desbloquear.',   'action', 'mixed', 'hard', 2, 4, 1, 'onCashLaundered',   2, false, true, 2, 280, 7500),
  ('H4', '???', 'Missão oculta — descobre como desbloquear.',   'action', 'mixed', 'hard', 3, 4, 1, 'onLeaderboardUpdate',2,false, true, 1, 400, 10000)
ON CONFLICT (id) DO NOTHING;

-- ── Indexes for performance ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mission_defs_triggers ON mission_definitions(event_trigger);
CREATE INDEX IF NOT EXISTS idx_mission_defs_eligible ON mission_definitions(daily_eligible, weekly_eligible);
CREATE INDEX IF NOT EXISTS idx_mission_event_locks_player ON mission_event_locks(player_id, last_tick_at);
