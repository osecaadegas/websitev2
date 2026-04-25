-- ============================================================
-- ADMIN — Complete schema (idempotent, run any time)
-- Covers: ce_admin_logs (audit trail)
--         ce_system_settings (global key/value config)
--         ce_shop_listings (item rotation / stock control)
--         crime_item_drops (loot table per crime)
--         business_input_items / business_output_items
--         player_notifications (in-game notification feed)
--         item extensions: item_code, required_level, rarity
--         crime_players extensions: addiction, last_brothel_collect_at
--
-- Source: 3-crime-empire-admin.sql
-- ============================================================

-- ─── 1. Audit / admin logs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ce_admin_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        TEXT        NOT NULL,
  admin_username  TEXT        NOT NULL,
  action          TEXT        NOT NULL,   -- create | update | delete | player_action | system
  entity_type     TEXT        NOT NULL,   -- item | crime | business | player | shop | system
  entity_id       TEXT,
  entity_name     TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ce_admin_logs_time   ON ce_admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ce_admin_logs_admin  ON ce_admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_ce_admin_logs_entity ON ce_admin_logs(entity_type, entity_id);

ALTER TABLE ce_admin_logs DISABLE ROW LEVEL SECURITY;

-- ─── 2. Global system settings (key / value) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS ce_system_settings (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);

INSERT INTO ce_system_settings (key, value) VALUES
  ('police_intensity',  '0'),
  ('maintenance_mode',  'false'),
  ('crime_multiplier',  '1.0'),
  ('income_multiplier', '1.0'),
  ('xp_multiplier',     '1.0')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE ce_system_settings DISABLE ROW LEVEL SECURITY;

-- ─── 3. Shop listings (rotation / stock control) ─────────────────────────────

CREATE TABLE IF NOT EXISTS ce_shop_listings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price_override   INTEGER,                  -- null = use item base_price
  stock            INTEGER,                  -- null = infinite
  rotation_type    TEXT        NOT NULL DEFAULT 'permanent'
    CHECK (rotation_type IN ('permanent','daily','weekly')),
  rotation_ends_at TIMESTAMPTZ,
  enabled          BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id)
);

ALTER TABLE ce_shop_listings DISABLE ROW LEVEL SECURITY;

-- ─── 4. Extend item_category enum ────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE item_category ADD VALUE IF NOT EXISTS 'drug';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── 5. Extend items table ───────────────────────────────────────────────────

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS required_level INTEGER NOT NULL DEFAULT 1
    CHECK (required_level >= 1),
  ADD COLUMN IF NOT EXISTS rarity TEXT NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common','rare','epic','legendary'));

-- ─── 6. Player notifications ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL, -- 'pvp_attacked' | 'worker_event' | 'jail_released' | 'general'
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  read        BOOLEAN     NOT NULL DEFAULT false,
  data        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_notifications_player
  ON player_notifications(player_id, read, created_at DESC);

ALTER TABLE player_notifications DISABLE ROW LEVEL SECURITY;

-- ─── 7. Crime item drops (loot table) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crime_item_drops (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  crime_id      UUID    NOT NULL REFERENCES crimes(id)  ON DELETE CASCADE,
  item_id       UUID    NOT NULL REFERENCES items(id)   ON DELETE CASCADE,
  drop_chance   NUMERIC NOT NULL DEFAULT 0.1
    CHECK (drop_chance > 0 AND drop_chance <= 1),
  min_quantity  INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  max_quantity  INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity >= 1),
  UNIQUE(crime_id, item_id)
);

ALTER TABLE crime_item_drops
  ADD COLUMN IF NOT EXISTS min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  ADD COLUMN IF NOT EXISTS max_quantity INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity >= 1);

CREATE INDEX IF NOT EXISTS idx_crime_item_drops_crime ON crime_item_drops(crime_id);

ALTER TABLE crime_item_drops DISABLE ROW LEVEL SECURITY;

-- ─── 8. Business input / output items ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_input_items (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id             UUID    NOT NULL REFERENCES items(id)      ON DELETE CASCADE,
  quantity_per_hour   NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_per_hour > 0),
  UNIQUE(business_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_biz_input_items_biz ON business_input_items(business_id);
ALTER TABLE business_input_items DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS business_output_items (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id             UUID    NOT NULL REFERENCES items(id)      ON DELETE CASCADE,
  quantity_per_hour   NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_per_hour > 0),
  drop_chance         NUMERIC NOT NULL DEFAULT 1.0 CHECK (drop_chance > 0 AND drop_chance <= 1),
  UNIQUE(business_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_biz_output_items_biz ON business_output_items(business_id);
ALTER TABLE business_output_items DISABLE ROW LEVEL SECURITY;

-- ─── 9. Extend crime_players ─────────────────────────────────────────────────

ALTER TABLE crime_players
  ADD COLUMN IF NOT EXISTS addiction              INTEGER NOT NULL DEFAULT 0
    CHECK (addiction >= 0 AND addiction <= 100),
  ADD COLUMN IF NOT EXISTS last_brothel_collect_at TIMESTAMPTZ;
