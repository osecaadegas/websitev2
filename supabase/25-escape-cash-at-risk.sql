-- ============================================================
-- 25 — Add escape_cash_at_risk to crime_players
-- ============================================================
-- Tracks the dirty_cash at risk during a gambling police raid.
-- Set by gambling API routes when arrest is triggered.
-- Read by escape-attempt route to deduct cash on outcome:
--   escaped: lose 50% of cash_at_risk
--   arrested: lose 100% of cash_at_risk
-- ============================================================

ALTER TABLE crime_players
  ADD COLUMN IF NOT EXISTS escape_cash_at_risk INT NOT NULL DEFAULT 0;
