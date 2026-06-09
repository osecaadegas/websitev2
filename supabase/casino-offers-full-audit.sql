-- Full audit migration for casino_offers
-- Adds: max_withdrawal, live_support, total_games, languages,
--       game_providers, welcome_bonus_stages, vip_program, details
-- Run this in the Supabase SQL Editor

ALTER TABLE casino_offers
  ADD COLUMN IF NOT EXISTS max_withdrawal   text,
  ADD COLUMN IF NOT EXISTS live_support     text,
  ADD COLUMN IF NOT EXISTS total_games      text,
  ADD COLUMN IF NOT EXISTS languages        text,
  ADD COLUMN IF NOT EXISTS game_providers   text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS welcome_bonus_stages jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS vip_program      text,
  ADD COLUMN IF NOT EXISTS details          text;

-- Backfill safe defaults
UPDATE casino_offers
SET
  game_providers         = COALESCE(game_providers, '{}'),
  welcome_bonus_stages   = COALESCE(welcome_bonus_stages, '[]')
WHERE game_providers IS NULL OR welcome_bonus_stages IS NULL;
