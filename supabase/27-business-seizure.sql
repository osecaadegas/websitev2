-- ============================================================
-- 27 — Business police seizure system
-- ============================================================
-- Adds fields required for type-specific asset seizure when
-- a player is arrested during a business raid:
--
--   drug / illegal  → pending production (accumulated_income) seized
--   launder         → laundering_amount seized
--   crypto_farm     → hardware (gpu/cpu/ram/computer) seized
--
-- Also creates business_seizure_log for audit trail.
-- ============================================================

-- Laundering: tracks dirty cash currently being processed
-- (field ready for future time-based laundering; currently 0)
ALTER TABLE player_businesses
  ADD COLUMN IF NOT EXISTS laundering_amount INT NOT NULL DEFAULT 0;

-- Crypto mining hardware inventory
ALTER TABLE player_businesses
  ADD COLUMN IF NOT EXISTS gpu_count INT NOT NULL DEFAULT 0;

ALTER TABLE player_businesses
  ADD COLUMN IF NOT EXISTS cpu_count INT NOT NULL DEFAULT 0;

ALTER TABLE player_businesses
  ADD COLUMN IF NOT EXISTS ram_count INT NOT NULL DEFAULT 0;

ALTER TABLE player_businesses
  ADD COLUMN IF NOT EXISTS computer_count INT NOT NULL DEFAULT 0;

-- Seizure audit log
CREATE TABLE IF NOT EXISTS business_seizure_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           uuid        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  player_business_id  uuid        NOT NULL REFERENCES player_businesses(id) ON DELETE CASCADE,
  business_type       text        NOT NULL,
  seized              jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_seizure_log_player_id_idx
  ON business_seizure_log(player_id);

CREATE INDEX IF NOT EXISTS business_seizure_log_created_at_idx
  ON business_seizure_log(created_at DESC);
