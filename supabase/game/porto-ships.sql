-- ============================================================
-- PORTO — Complete schema (idempotent, run any time)
-- Covers: porto_boats, porto_cargo (weekly boat system)
--         porto_ships, porto_ship_contributions, porto_activity (dynamic ship events)
--         porto_ship_intel (paid intel reveal)
--         CHECK constraint fix + bootstrap first ship
-- Sources: 5-porto.sql, 22-porto-ships.sql, 28-porto-ship-intel.sql,
--          30-porto-ships-preview-status.sql
-- ============================================================

-- ─── 1. Weekly Boat System ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS porto_boats (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number      INTEGER     NOT NULL,
  week_year        INTEGER     NOT NULL,
  boat_name        TEXT        NOT NULL,
  destination      TEXT        NOT NULL,
  docks_at         TIMESTAMPTZ NOT NULL,
  departs_by       TIMESTAMPTZ NOT NULL,
  departs_at       TIMESTAMPTZ,
  payment_at       TIMESTAMPTZ,
  max_cargo        INTEGER     NOT NULL,
  current_cargo    INTEGER     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'docked', 'departed', 'paid')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_porto_boats_week   ON porto_boats(week_number, week_year);
CREATE INDEX IF NOT EXISTS idx_porto_boats_status ON porto_boats(status);
CREATE INDEX IF NOT EXISTS idx_porto_boats_docks  ON porto_boats(docks_at);
ALTER TABLE porto_boats DISABLE ROW LEVEL SECURITY;

-- Per-player cargo loaded onto each boat
CREATE TABLE IF NOT EXISTS porto_cargo (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id          UUID        NOT NULL REFERENCES porto_boats(id) ON DELETE CASCADE,
  player_id        UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  item_id          UUID        NOT NULL,
  item_name        TEXT        NOT NULL,
  image_url        TEXT,
  quantity         INTEGER     NOT NULL CHECK (quantity > 0),
  unit_value       INTEGER     NOT NULL,
  payout           INTEGER     NOT NULL,
  paid             BOOLEAN     NOT NULL DEFAULT false,
  loaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(boat_id, player_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_porto_cargo_player ON porto_cargo(player_id);
CREATE INDEX IF NOT EXISTS idx_porto_cargo_boat   ON porto_cargo(boat_id);
ALTER TABLE porto_cargo DISABLE ROW LEVEL SECURITY;

-- ─── 2. Dynamic Ship Events ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS porto_ships (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  drug_type          TEXT        NOT NULL,
  drug_item_id       UUID,
  capacity_total     INT         NOT NULL,
  capacity_filled    INT         NOT NULL DEFAULT 0,
  price_per_unit     INT         NOT NULL,
  arrival_time       TIMESTAMPTZ NOT NULL,
  departure_time     TIMESTAMPTZ NOT NULL,
  departed_at        TIMESTAMPTZ,
  status             TEXT        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'docked', 'departed', 'preview')),
  ship_class         TEXT        NOT NULL DEFAULT 'normal'
    CHECK (ship_class IN ('normal', 'high_demand', 'risky')),
  origin_country     TEXT,
  inspection_chance  INT         NOT NULL DEFAULT 5,
  max_delivery       INT         NOT NULL DEFAULT 5000,
  top_bonus_pct      INT         NOT NULL DEFAULT 25,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_porto_ships_status    ON porto_ships(status);
CREATE INDEX IF NOT EXISTS idx_porto_ships_departure ON porto_ships(departure_time);
ALTER TABLE porto_ships DISABLE ROW LEVEL SECURITY;

-- Fix CHECK constraint in case it was created without 'preview' (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'porto_ships_status_check'
  ) THEN
    ALTER TABLE porto_ships DROP CONSTRAINT porto_ships_status_check;
  END IF;
END $$;

ALTER TABLE porto_ships
  ADD CONSTRAINT porto_ships_status_check
    CHECK (status IN ('scheduled', 'docked', 'departed', 'preview'));

-- Ship contributions (deliveries by players)
CREATE TABLE IF NOT EXISTS porto_ship_contributions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id     UUID        NOT NULL REFERENCES porto_ships(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  quantity    INT         NOT NULL CHECK (quantity > 0),
  earned      INT         NOT NULL DEFAULT 0,
  top_bonus   INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_porto_ship_contributions_ship   ON porto_ship_contributions(ship_id);
CREATE INDEX IF NOT EXISTS idx_porto_ship_contributions_player ON porto_ship_contributions(player_id);
ALTER TABLE porto_ship_contributions DISABLE ROW LEVEL SECURITY;

-- Port activity feed
CREATE TABLE IF NOT EXISTS porto_activity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id     UUID        REFERENCES porto_ships(id) ON DELETE SET NULL,
  player_id   UUID        REFERENCES crime_players(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  quantity    INT,
  earned      INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_porto_activity_created ON porto_activity(created_at DESC);
ALTER TABLE porto_activity DISABLE ROW LEVEL SECURITY;

-- ─── 3. Intel / Reveal System ─────────────────────────────────────────────────
-- Players pay 1,000 crypto to reveal drug type + exact arrival time of preview ships

CREATE TABLE IF NOT EXISTS porto_ship_intel (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id    UUID        NOT NULL REFERENCES porto_ships(id) ON DELETE CASCADE,
  player_id  UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ship_id, player_id)
);

CREATE INDEX IF NOT EXISTS porto_ship_intel_ship_idx   ON porto_ship_intel(ship_id);
CREATE INDEX IF NOT EXISTS porto_ship_intel_player_idx ON porto_ship_intel(player_id);

-- ─── 4. Bootstrap: insert first docked ship if none exist ────────────────────

DO $$
DECLARE
  drug_id    UUID;
  drug_name  TEXT;
  drug_price INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM porto_ships WHERE status IN ('scheduled', 'docked')
  ) THEN
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
