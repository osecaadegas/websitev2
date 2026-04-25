-- ============================================================
-- ACIDENTE DE AVIÃO — Complete schema (idempotent, run any time)
-- Covers: plane_crashes, plane_crash_players (original system)
--         wreck_segments / loot_seed / entry_cost (v2 columns)
--         crash_sessions (battleship minigame)
--         crash_loot_log (audit trail)
-- Sources: 4-plane-crash.sql, 29-plane-crash-v2.sql
-- ============================================================

-- ─── 1. Plane Crash Events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plane_crashes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number      INTEGER     NOT NULL,
  week_year        INTEGER     NOT NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  active_until     TIMESTAMPTZ NOT NULL,
  location_name    TEXT        NOT NULL,
  info_cost        INTEGER     NOT NULL DEFAULT 1000,
  loot             JSONB       NOT NULL DEFAULT '[]',
  total_loot_value INTEGER     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'expired')),
  -- v2: wreck geometry + minigame fields
  wreck_segments   JSONB       NOT NULL DEFAULT '[]',
  total_segments   INT         NOT NULL DEFAULT 0,
  loot_seed        INT         NOT NULL DEFAULT 0,
  entry_cost       INT         NOT NULL DEFAULT 125000,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plane_crashes_week   ON plane_crashes(week_number, week_year);
CREATE INDEX IF NOT EXISTS idx_plane_crashes_status ON plane_crashes(status);
CREATE INDEX IF NOT EXISTS idx_plane_crashes_sched  ON plane_crashes(scheduled_at);
ALTER TABLE plane_crashes DISABLE ROW LEVEL SECURITY;

-- Add v2 columns in case table already exists without them
ALTER TABLE plane_crashes
  ADD COLUMN IF NOT EXISTS wreck_segments  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_segments  INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loot_seed       INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_cost      INT   NOT NULL DEFAULT 125000;

-- ─── 2. Legacy Player Interactions ───────────────────────────────────────────
-- Kept for backwards compatibility; minigame now uses crash_sessions

CREATE TABLE IF NOT EXISTS plane_crash_players (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  crash_id          UUID        NOT NULL REFERENCES plane_crashes(id) ON DELETE CASCADE,
  player_id         UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  info_purchased    BOOLEAN     NOT NULL DEFAULT false,
  info_purchased_at TIMESTAMPTZ,
  scraped           BOOLEAN     NOT NULL DEFAULT false,
  scraped_at        TIMESTAMPTZ,
  items_received    JSONB,
  UNIQUE(crash_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_pcp_player ON plane_crash_players(player_id);
CREATE INDEX IF NOT EXISTS idx_pcp_crash  ON plane_crash_players(crash_id);
ALTER TABLE plane_crash_players DISABLE ROW LEVEL SECURITY;

-- ─── 3. Battleship Minigame Session ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crash_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  crash_id        UUID        NOT NULL REFERENCES plane_crashes(id) ON DELETE CASCADE,
  shots_left      INT         NOT NULL DEFAULT 10,
  hits            INT         NOT NULL DEFAULT 0,
  misses          INT         NOT NULL DEFAULT 0,
  heat_level      INT         NOT NULL DEFAULT 0,
  revealed_tiles  JSONB       NOT NULL DEFAULT '{}',
  completed       BOOLEAN     NOT NULL DEFAULT false,
  extracted       BOOLEAN     NOT NULL DEFAULT false,
  final_coverage  NUMERIC(5,2),
  loot_received   JSONB,
  raid_triggered  BOOLEAN     NOT NULL DEFAULT false,
  intel_hint      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, crash_id)
);

CREATE INDEX IF NOT EXISTS crash_sessions_player_idx ON crash_sessions(player_id);
CREATE INDEX IF NOT EXISTS crash_sessions_crash_idx  ON crash_sessions(crash_id);
ALTER TABLE crash_sessions DISABLE ROW LEVEL SECURITY;

-- ─── 4. Loot Audit Log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crash_loot_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  crash_id       UUID        NOT NULL REFERENCES plane_crashes(id) ON DELETE CASCADE,
  hits           INT         NOT NULL DEFAULT 0,
  coverage       NUMERIC(5,2),
  loot           JSONB       NOT NULL DEFAULT '{}',
  raid_triggered BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crash_loot_log_player_idx ON crash_loot_log(player_id);
CREATE INDEX IF NOT EXISTS crash_loot_log_crash_idx  ON crash_loot_log(crash_id);
ALTER TABLE crash_loot_log DISABLE ROW LEVEL SECURITY;
