-- ============================================================
-- XP CURVE REBALANCE v2 — Power Curve + Anti-Exploit Buckets
-- ============================================================
-- Replaces the v1 piecewise curve with a single power formula:
--     xp_to_next(L) = max(10, floor(60 × L^1.85))
-- Total XP to L120 ≈ 19.06M (smooth, no walls or cliffs).
-- Also adds the `xp_buckets` JSONB column used by grantXP() in
-- src/lib/crime-empire/xp.ts to enforce per-source + global
-- hourly XP caps and detect farming patterns.
--
-- Safe to re-run (idempotent).
-- ============================================================

-- 1. Anti-exploit bucket storage ------------------------------
ALTER TABLE crime_players
  ADD COLUMN IF NOT EXISTS xp_buckets JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Replace the curve function -------------------------------
CREATE OR REPLACE FUNCTION ce_xp_for_level(p_level INTEGER)
RETURNS BIGINT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN GREATEST(10, FLOOR(60 * POWER(GREATEST(1, p_level), 1.85)))::BIGINT;
END $$;

-- 3. Heal every player's xp_to_next_level using the new curve --
UPDATE crime_players
SET xp_to_next_level = ce_xp_for_level(level)::INTEGER;

-- Sanity check (run manually):
-- SELECT level, ce_xp_for_level(level) AS new_threshold
-- FROM generate_series(1, 120, 10) AS level
-- ORDER BY level;
