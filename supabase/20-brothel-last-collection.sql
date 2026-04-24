-- ============================================================
-- 20 — Add last_collection column to player_brothels
-- ============================================================
-- The collect action in the API writes to this column but it
-- was never added to the table in prior migrations.

ALTER TABLE player_brothels
  ADD COLUMN IF NOT EXISTS last_collection TIMESTAMPTZ DEFAULT NULL;
