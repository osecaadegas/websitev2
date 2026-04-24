-- ============================================================
-- 17 — Brothel Living Management System
-- Adds traits, stats, supplies, upgrades, events to brothels
-- ============================================================

-- 1. Expand brothel_workers with full stat model
ALTER TABLE brothel_workers
  ADD COLUMN IF NOT EXISTS attractiveness   INTEGER     NOT NULL DEFAULT 50,   -- 0-100, drives client rate
  ADD COLUMN IF NOT EXISTS stamina          INTEGER     NOT NULL DEFAULT 100,  -- 0-100, depletes each cycle
  ADD COLUMN IF NOT EXISTS mood             INTEGER     NOT NULL DEFAULT 70,   -- 0-100, affects price multiplier
  ADD COLUMN IF NOT EXISTS happiness        INTEGER     NOT NULL DEFAULT 70,   -- 0-100
  ADD COLUMN IF NOT EXISTS trait_1          TEXT,
  ADD COLUMN IF NOT EXISTS trait_2          TEXT,
  ADD COLUMN IF NOT EXISTS player_brothel_id UUID REFERENCES player_brothels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_room    INTEGER     DEFAULT NULL,          -- room slot 1-N
  ADD COLUMN IF NOT EXISTS last_worked_at   TIMESTAMPTZ DEFAULT NULL;

-- 2. Expand player_brothels with live state
ALTER TABLE player_brothels
  ADD COLUMN IF NOT EXISTS supply_drinks    INTEGER     NOT NULL DEFAULT 100,  -- 0-100
  ADD COLUMN IF NOT EXISTS supply_hygiene   INTEGER     NOT NULL DEFAULT 100,  -- 0-100
  ADD COLUMN IF NOT EXISTS supply_security  INTEGER     NOT NULL DEFAULT 100,  -- 0-100
  ADD COLUMN IF NOT EXISTS client_satisfaction INTEGER  NOT NULL DEFAULT 75,   -- 0-100
  ADD COLUMN IF NOT EXISTS heat_level       INTEGER     NOT NULL DEFAULT 0,    -- 0-100 (police attention)
  ADD COLUMN IF NOT EXISTS upgrade_vip_rooms    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_lighting     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_security     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_marketing    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_earned     BIGINT      NOT NULL DEFAULT 0;

-- 3. Brothel events log
CREATE TABLE IF NOT EXISTS brothel_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  player_brothel_id UUID      NOT NULL REFERENCES player_brothels(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,   -- 'vip_client','worker_unhappy','police','supply_low','bonus'
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  choices         JSONB,                  -- [{label, action, reward}]
  resolved        BOOLEAN     NOT NULL DEFAULT false,
  resolved_choice TEXT,
  reward_cash     INTEGER     DEFAULT 0,
  reward_xp       INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE brothel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players manage own events" ON brothel_events USING (true) WITH CHECK (true);

-- 4. Populate worker traits randomly (for existing workers)
UPDATE brothel_workers SET
  attractiveness = 40 + floor(random() * 50)::int,
  stamina        = 60 + floor(random() * 40)::int,
  mood           = 50 + floor(random() * 50)::int,
  happiness      = 50 + floor(random() * 50)::int,
  trait_1        = (ARRAY['Charmosa','Discreta','Ambiciosa','Extrovertida','Reservada','Elegante','Carismática'])[floor(random()*7)::int + 1],
  trait_2        = (ARRAY['Preguiçosa','Cara','Eficiente','Simpática','Teimosa','Criativa','Confiável'])[floor(random()*7)::int + 1]
WHERE trait_1 IS NULL;
