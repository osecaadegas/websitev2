-- ============================================================
-- 30 — Porto Ships: add "preview" to status CHECK constraint
-- ============================================================
-- The route uses status = 'preview' for upcoming ships that
-- players can pay to reveal. The original CHECK constraint
-- only had ('scheduled', 'docked', 'departed'), which caused
-- all preview ship inserts to fail silently.
-- ============================================================

-- Drop the old check constraint and recreate with "preview"
ALTER TABLE porto_ships
  DROP CONSTRAINT IF EXISTS porto_ships_status_check;

ALTER TABLE porto_ships
  ADD CONSTRAINT porto_ships_status_check
    CHECK (status IN ('scheduled', 'docked', 'departed', 'preview'));

-- Bootstrap: if there are no active ships right now, insert one immediately
-- (mirrors the generateNextShip() logic for isFirstEver = true)
DO $$
DECLARE
  drug_id    UUID;
  drug_name  TEXT;
  drug_price INT;
BEGIN
  -- Only run if no active ships exist
  IF NOT EXISTS (
    SELECT 1 FROM porto_ships WHERE status IN ('scheduled', 'docked')
  ) THEN
    -- Pick the highest-value drug (prefer cocaine)
    SELECT id, name, base_price
      INTO drug_id, drug_name, drug_price
      FROM items
     WHERE category = 'drug'
     ORDER BY (LOWER(name) LIKE '%coca%')::int DESC, base_price DESC
     LIMIT 1;

    IF drug_id IS NOT NULL THEN
      INSERT INTO porto_ships (
        name, drug_type, drug_item_id,
        capacity_total, price_per_unit,
        arrival_time, departure_time,
        status, ship_class,
        origin_country, inspection_chance,
        max_delivery, top_bonus_pct
      ) VALUES (
        'Porto Negro',
        drug_name,
        drug_id,
        30000,
        FLOOR(drug_price * 1.8),
        NOW(),
        NOW() + INTERVAL '8 hours',
        'docked',
        'high_demand',
        'Colômbia',
        3,
        5000,
        30
      );
    END IF;
  END IF;
END $$;
