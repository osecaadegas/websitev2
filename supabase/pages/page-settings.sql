-- ============================================================
-- PAGE SETTINGS & NOTIFICATIONS — Complete schema (idempotent, run any time)
-- Covers: page_settings table + 23 default page rows
--         notifications table with RLS
--
-- Source: page-settings-and-notifications.sql
-- ============================================================

-- ─── 1. Page settings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS page_settings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug       TEXT        UNIQUE NOT NULL,
  page_name       TEXT        NOT NULL,
  background_image TEXT,
  hero_image      TEXT,
  effect          TEXT        DEFAULT 'none'
    CHECK (effect IN ('none','snow','rain','thunder','fireflies','embers')),
  effect_intensity NUMERIC    DEFAULT 1   CHECK (effect_intensity  BETWEEN 0 AND 2),
  overlay_opacity  NUMERIC    DEFAULT 0.6 CHECK (overlay_opacity   BETWEEN 0 AND 1),
  bg_brightness    NUMERIC    DEFAULT 0.35 CHECK (bg_brightness    BETWEEN 0 AND 2),
  bg_saturation    NUMERIC    DEFAULT 0.7  CHECK (bg_saturation    BETWEEN 0 AND 2),
  bg_contrast      NUMERIC    DEFAULT 0.95 CHECK (bg_contrast      BETWEEN 0 AND 2),
  bg_position_x    NUMERIC    DEFAULT 50   CHECK (bg_position_x    BETWEEN 0 AND 100),
  bg_position_y    NUMERIC    DEFAULT 50   CHECK (bg_position_y    BETWEEN 0 AND 100),
  bg_zoom          NUMERIC    DEFAULT 100  CHECK (bg_zoom          BETWEEN 50 AND 200),
  bg_color         TEXT       DEFAULT '#000000',
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Default page rows (no-op if already inserted)
INSERT INTO page_settings (page_slug, page_name) VALUES
  ('home',                     'Home'),
  ('jogos',                    'Jogos'),
  ('comunidade',               'Comunidade'),
  ('daily-session',            'Sessão do Dia'),
  ('adivinha-o-resultado',     'Adivinha o Resultado'),
  ('moderador',                'Moderador'),
  ('hall-of-victories',        'Bruta do Mês'),
  ('perfil',                   'Perfil'),
  ('politica-de-privacidade',  'Política de Privacidade'),
  ('politica-de-cookies',      'Política de Cookies'),
  ('termos-e-condicoes',       'Termos e Condições'),
  ('sobre',                    'Sobre'),
  ('ofertas',                  'Ofertas'),
  ('live',                     'Live'),
  ('stream',                   'Stream'),
  ('loja',                     'Loja'),
  ('calendario',               'Calendário'),
  ('bonus-hunt',               'Bonus Hunt'),
  ('giveaways',                'Giveaways'),
  ('destaques',                'Destaques'),
  ('roda-diaria',              'Roda Diária'),
  ('liga-dos-secas',           'Liga dos Secas'),
  ('admin',                    'Admin')
ON CONFLICT (page_slug) DO NOTHING;

ALTER TABLE page_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'page_settings' AND policyname = 'Public read access') THEN
    CREATE POLICY "Public read access" ON page_settings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'page_settings' AND policyname = 'Admins can update') THEN
    CREATE POLICY "Admins can update"  ON page_settings FOR UPDATE USING (true);
  END IF;
END $$;

-- ─── 2. Notifications ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_twitch_id  TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  type            TEXT        DEFAULT 'info'
    CHECK (type IN ('info','success','warning','error')),
  read            BOOLEAN     DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_twitch_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can read own notifications') THEN
    CREATE POLICY "Users can read own notifications"  ON notifications FOR SELECT USING (true);
    CREATE POLICY "System can insert notifications"   ON notifications FOR INSERT WITH CHECK (true);
    CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (true);
  END IF;
END $$;
