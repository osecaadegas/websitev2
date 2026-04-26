-- ============================================================
-- Monthly Missions Migration
-- Run this in Supabase SQL Editor after missions.sql
-- ============================================================

-- 1. Add crypto_reward column to mission_definitions
ALTER TABLE mission_definitions
  ADD COLUMN IF NOT EXISTS crypto_reward INT NOT NULL DEFAULT 0;

-- 2. Add monthly_eligible column to mission_definitions
ALTER TABLE mission_definitions
  ADD COLUMN IF NOT EXISTS monthly_eligible BOOL NOT NULL DEFAULT false;

-- 3. Add crypto_awarded column to player_missions
ALTER TABLE player_missions
  ADD COLUMN IF NOT EXISTS crypto_awarded INT NOT NULL DEFAULT 0;

-- 4. Update type CHECK constraint to include 'monthly'
ALTER TABLE player_missions
  DROP CONSTRAINT IF EXISTS player_missions_type_check;
ALTER TABLE player_missions
  ADD CONSTRAINT player_missions_type_check
  CHECK (type IN ('daily', 'weekly', 'monthly'));

-- ============================================================
-- 5. Seed monthly mission definitions
-- ============================================================
-- base_target values are for tier 1 (levels 1-10).
-- At runtime they are scaled by tier multiplier (up to ×5.5 at tier 4).
-- Rewards: high XP, large cash, AND a crypto (💎) drop.
-- ============================================================

INSERT INTO mission_definitions
  (id, name, description, category, system, difficulty,
   tier_min, tier_max, base_target, event_trigger, weight,
   daily_eligible, weekly_eligible, monthly_eligible,
   bonus_target, xp_reward, cash_reward, crypto_reward)
VALUES
  -- MO1 — drug empire monthly grind
  ('MO1',
   'Barão das Ruas',
   'Vende droga 50 vezes este mês. O crime não descansa.',
   'economy', 'drugs', 'hard',
   1, 4, 50, 'onDrugSold', 3,
   false, false, true,
   75, 600, 50000, 100),

  -- MO2 — business empire monthly grind
  ('MO2',
   'Tycoon Criminal',
   'Cobra os lucros dos teus negócios 30 vezes este mês.',
   'economy', 'businesses', 'hard',
   1, 4, 30, 'onBusinessCollected', 3,
   false, false, true,
   45, 700, 60000, 120),

  -- MO3 — contracts monthly grind
  ('MO3',
   'O Profissional',
   'Completa 25 contratos este mês. Sangue frio, resultados.',
   'action', 'contracts', 'hard',
   1, 4, 25, 'onContractCompleted', 3,
   false, false, true,
   38, 800, 75000, 150),

  -- MO4 — PvP monthly grind
  ('MO4',
   'Rei da Guerra',
   'Vence 20 combates PvP este mês. Domina os teus rivais.',
   'pvp', 'pvp', 'hard',
   1, 4, 20, 'onPvPWin', 3,
   false, false, true,
   30, 900, 90000, 200),

  -- MO5 — casino monthly grind
  ('MO5',
   'Magnata do Casino',
   'Joga no casino 60 vezes este mês. A sorte favorece os audazes.',
   'action', 'casino', 'hard',
   1, 4, 60, 'onCasinoPlay', 3,
   false, false, true,
   90, 700, 65000, 130),

  -- MO6 — prestige monthly challenge (high rewards)
  ('MO6',
   'El Padrino',
   'Lava dinheiro sujo 20 vezes este mês. O verdadeiro chefe apaga todos os rastos.',
   'skill', 'drugs', 'hard',
   2, 4, 20, 'onCashLaundered', 2,
   false, false, true,
   30, 1500, 150000, 500)

ON CONFLICT (id) DO NOTHING;
