-- ============================================================
-- XP CURVE REBALANCE — one-time heal of crime_players thresholds
-- Safe to re-run. Recomputes xp_to_next_level using the new
-- piecewise curve defined in src/lib/crime-empire/xp.ts.
--
--   Hook       L1–15      base 60   × 1.15
--   Climb      L16–40                × 1.07
--   Plateau    L41–70                × 1.045
--   Late       L71–100               × 1.05
--   Endgame    L101–120              × 1.055
-- ============================================================

CREATE OR REPLACE FUNCTION ce_xp_for_level(p_level INTEGER)
RETURNS BIGINT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v DOUBLE PRECISION := 60.0;
  L INTEGER;
BEGIN
  IF p_level <= 1 THEN
    RETURN GREATEST(10, FLOOR(v))::BIGINT;
  END IF;
  FOR L IN 2..p_level LOOP
    IF L <= 15 THEN       v := v * 1.15;
    ELSIF L <= 40 THEN    v := v * 1.07;
    ELSIF L <= 70 THEN    v := v * 1.045;
    ELSIF L <= 100 THEN   v := v * 1.05;
    ELSE                  v := v * 1.055;
    END IF;
  END LOOP;
  RETURN GREATEST(10, FLOOR(v))::BIGINT;
END $$;

-- Heal every player so the new curve takes effect immediately.
UPDATE crime_players
SET xp_to_next_level = ce_xp_for_level(level)::INTEGER;

-- Sanity check (run manually):
-- SELECT level, ce_xp_for_level(level) AS new_threshold
-- FROM generate_series(1, 120) AS level
-- ORDER BY level;
