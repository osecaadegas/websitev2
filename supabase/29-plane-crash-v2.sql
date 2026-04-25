-- ============================================================
-- 29 — Plane Crash v2: Battleship minigame system
-- ============================================================
-- Replaces the old buy_info/scrape flow with a full
-- 10x10 grid search minigame paid in crypto.
-- Old tables (plane_crashes, plane_crash_players) are kept
-- but a new crash_sessions table drives the minigame.
-- ============================================================

-- Add wreck geometry + loot_seed to plane_crashes
ALTER TABLE plane_crashes
  ADD COLUMN IF NOT EXISTS wreck_segments  jsonb  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_segments  int    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loot_seed       int    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_cost      int    NOT NULL DEFAULT 125000;

-- Per-player minigame session
CREATE TABLE IF NOT EXISTS crash_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  crash_id        uuid        NOT NULL REFERENCES plane_crashes(id) ON DELETE CASCADE,
  shots_left      int         NOT NULL DEFAULT 10,
  hits            int         NOT NULL DEFAULT 0,
  misses          int         NOT NULL DEFAULT 0,
  heat_level      int         NOT NULL DEFAULT 0,
  revealed_tiles  jsonb       NOT NULL DEFAULT '{}',
  completed       boolean     NOT NULL DEFAULT false,
  extracted       boolean     NOT NULL DEFAULT false,
  final_coverage  numeric(5,2),
  loot_received   jsonb,
  raid_triggered  boolean     NOT NULL DEFAULT false,
  intel_hint      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, crash_id)
);

CREATE INDEX IF NOT EXISTS crash_sessions_player_idx ON crash_sessions(player_id);
CREATE INDEX IF NOT EXISTS crash_sessions_crash_idx  ON crash_sessions(crash_id);

-- Loot log for audit
CREATE TABLE IF NOT EXISTS crash_loot_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  crash_id   uuid        NOT NULL REFERENCES plane_crashes(id) ON DELETE CASCADE,
  hits       int         NOT NULL DEFAULT 0,
  coverage   numeric(5,2),
  loot       jsonb       NOT NULL DEFAULT '{}',
  raid_triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
