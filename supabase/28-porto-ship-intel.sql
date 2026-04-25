-- ============================================================
-- 28 — Porto ship intel / reveal system
-- ============================================================
-- Players can pay 1000 crypto to the captain to reveal the
-- drug type and exact arrival time of the next (preview) ship.
-- Without paying, they can see: ship name, class, arrival day,
-- capacity — but drug type and exact hour are hidden.
-- ============================================================

-- Track who has paid to reveal each preview ship's info
CREATE TABLE IF NOT EXISTS porto_ship_intel (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id    uuid        NOT NULL REFERENCES porto_ships(id) ON DELETE CASCADE,
  player_id  uuid        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ship_id, player_id)
);

CREATE INDEX IF NOT EXISTS porto_ship_intel_ship_idx
  ON porto_ship_intel(ship_id);

CREATE INDEX IF NOT EXISTS porto_ship_intel_player_idx
  ON porto_ship_intel(player_id);
