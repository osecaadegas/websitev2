-- ============================================================
-- HALL OF VICTORIES — Complete schema (idempotent, run any time)
-- Covers: user_clips, clip_honors, bruta_do_mes
--         increment/decrement functions
--         RLS policies
--
-- Source: hall-of-victories.sql
-- ============================================================

-- ─── 1. Clips table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_clips (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  twitch_id   TEXT        NOT NULL,
  username    TEXT        NOT NULL,
  avatar_url  TEXT,
  title       TEXT        NOT NULL DEFAULT 'Vitória',
  description TEXT,
  url         TEXT        NOT NULL,
  provider    TEXT,
  embed_type  TEXT        NOT NULL CHECK (embed_type IN ('video','iframe','link')),
  embed_url   TEXT        NOT NULL,
  honors      INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_clips_twitch_id_idx  ON user_clips(twitch_id);
CREATE INDEX IF NOT EXISTS user_clips_created_at_idx ON user_clips(created_at DESC);
CREATE INDEX IF NOT EXISTS user_clips_honors_idx     ON user_clips(honors DESC);

-- ─── 2. Honor ledger (prevents double-voting) ────────────────────────────────

CREATE TABLE IF NOT EXISTS clip_honors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id         UUID        NOT NULL REFERENCES user_clips(id) ON DELETE CASCADE,
  user_twitch_id  TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, user_twitch_id)
);

CREATE INDEX IF NOT EXISTS clip_honors_clip_id_idx ON clip_honors(clip_id);

-- ─── 3. RLS policies ─────────────────────────────────────────────────────────

ALTER TABLE user_clips  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_honors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_clips'  AND policyname = 'Public read user_clips') THEN
    CREATE POLICY "Public read user_clips"    ON user_clips  FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_clips'  AND policyname = 'Service insert user_clips') THEN
    CREATE POLICY "Service insert user_clips" ON user_clips  FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clip_honors' AND policyname = 'Public read clip_honors') THEN
    CREATE POLICY "Public read clip_honors"   ON clip_honors FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clip_honors' AND policyname = 'Service insert clip_honors') THEN
    CREATE POLICY "Service insert clip_honors" ON clip_honors FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clip_honors' AND policyname = 'Service delete clip_honors') THEN
    CREATE POLICY "Service delete clip_honors" ON clip_honors FOR DELETE USING (true);
  END IF;
END $$;

-- ─── 4. Atomic increment / decrement functions ───────────────────────────────

CREATE OR REPLACE FUNCTION increment_clip_honors(clip_id_arg UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE user_clips SET honors = honors + 1 WHERE id = clip_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_clip_honors(clip_id_arg UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE user_clips SET honors = GREATEST(0, honors - 1) WHERE id = clip_id_arg;
$$;

-- ─── 5. Bruta do Mês (admin-curated featured win) ────────────────────────────

CREATE TABLE IF NOT EXISTS bruta_do_mes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  month_label TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  url         TEXT        NOT NULL,
  provider    TEXT,
  embed_type  TEXT        NOT NULL CHECK (embed_type IN ('video','iframe','link')),
  embed_url   TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bruta_do_mes_is_active_idx  ON bruta_do_mes(is_active);
CREATE INDEX IF NOT EXISTS bruta_do_mes_created_at_idx ON bruta_do_mes(created_at DESC);

ALTER TABLE bruta_do_mes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bruta_do_mes' AND policyname = 'Public read bruta_do_mes') THEN
    CREATE POLICY "Public read bruta_do_mes"   ON bruta_do_mes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bruta_do_mes' AND policyname = 'Service insert bruta_do_mes') THEN
    CREATE POLICY "Service insert bruta_do_mes" ON bruta_do_mes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bruta_do_mes' AND policyname = 'Service update bruta_do_mes') THEN
    CREATE POLICY "Service update bruta_do_mes" ON bruta_do_mes FOR UPDATE USING (true);
  END IF;
END $$;
