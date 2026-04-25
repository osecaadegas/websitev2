-- ═══════════════════════════════════════════════════════════════
-- CRIME EMPIRE — Porto Ships (Dynamic Ship Events)
-- Run AFTER 21-street-selling-system.sql
-- Safe to run multiple times
--
-- Separate from the weekly porto_boats system.
-- Ships are dynamically generated events with a specific drug,
-- global capacity, and a countdown timer. All players compete
-- to fill the ship before it departs.
-- ═══════════════════════════════════════════════════════════════

-- ── Ships ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS porto_ships (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  drug_type          TEXT        NOT NULL,       -- matches items.name (e.g. "Cocaína")
  drug_item_id       UUID,                       -- FK to items.id (nullable for flexibility)
  capacity_total     INT         NOT NULL,       -- total grams the ship can carry
  capacity_filled    INT         NOT NULL DEFAULT 0,
  price_per_unit     INT         NOT NULL,       -- dirty cash reward per gram delivered
  arrival_time       TIMESTAMPTZ NOT NULL,       -- when the ship docks
  departure_time     TIMESTAMPTZ NOT NULL,       -- latest departure (auto-departs at this time)
  departed_at        TIMESTAMPTZ,               -- actual departure (set when departed)
  status             TEXT        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'docked', 'departed')),
  ship_class         TEXT        NOT NULL DEFAULT 'normal'
    CHECK (ship_class IN ('normal', 'high_demand', 'risky')),
  origin_country     TEXT,
  inspection_chance  INT         NOT NULL DEFAULT 5,  -- % chance of seizure per delivery
  max_delivery       INT         NOT NULL DEFAULT 5000, -- max grams per single delivery action
  top_bonus_pct      INT         NOT NULL DEFAULT 25, -- extra % payout for top contributor
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_porto_ships_status   ON porto_ships(status);
CREATE INDEX IF NOT EXISTS idx_porto_ships_departure ON porto_ships(departure_time);
ALTER TABLE porto_ships DISABLE ROW LEVEL SECURITY;

-- ── Ship Contributions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS porto_ship_contributions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id     UUID        NOT NULL REFERENCES porto_ships(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  quantity    INT         NOT NULL CHECK (quantity > 0),
  earned      INT         NOT NULL DEFAULT 0,    -- dirty cash granted
  top_bonus   INT         NOT NULL DEFAULT 0,    -- bonus cash (for top contributor)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_porto_ship_contributions_ship   ON porto_ship_contributions(ship_id);
CREATE INDEX IF NOT EXISTS idx_porto_ship_contributions_player ON porto_ship_contributions(player_id);
ALTER TABLE porto_ship_contributions DISABLE ROW LEVEL SECURITY;

-- ── Port Activity Feed ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS porto_activity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id     UUID        REFERENCES porto_ships(id) ON DELETE SET NULL,
  player_id   UUID        REFERENCES crime_players(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,   -- 'delivery', 'ship_docked', 'ship_departed', 'inspection_fail'
  message     TEXT        NOT NULL,
  quantity    INT,
  earned      INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_porto_activity_created ON porto_activity(created_at DESC);
ALTER TABLE porto_activity DISABLE ROW LEVEL SECURITY;

-- ── Seed: insert first ship (docked now, departing in 8 hours) ───────────────
-- Only insert if no active ships exist
DO $$
DECLARE
  cocaine_id UUID;
  drug_name  TEXT;
  drug_price INT;
BEGIN
  -- Get cocaine item id (or highest-value drug)
  SELECT id, name, base_price INTO cocaine_id, drug_name, drug_price
  FROM items
  WHERE category = 'drug'
  ORDER BY (LOWER(name) LIKE '%coca%')::int DESC, base_price DESC
  LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM porto_ships WHERE status IN ('scheduled', 'docked')) THEN
    INSERT INTO porto_ships (
      name, drug_type, drug_item_id, capacity_total, price_per_unit,
      arrival_time, departure_time, status, ship_class,
      origin_country, inspection_chance, max_delivery, top_bonus_pct
    ) VALUES (
      'Ocean Reaper',
      COALESCE(drug_name, 'Cocaína'),
      cocaine_id,
      35000,
      COALESCE(FLOOR(drug_price * 1.8), 180),
      NOW(),
      NOW() + INTERVAL '8 hours',
      'docked',
      'high_demand',
      'Colômbia',
      8,
      5000,
      30
    );
  END IF;
END $$;
