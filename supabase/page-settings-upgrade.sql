-- ── page_settings upgrade ─────────────────────────────────────────
-- Adds hero text controls, mobile image, visibility & access fields
-- Run once in the Supabase SQL Editor

-- Hero text controls (home page only)
ALTER TABLE page_settings
  ADD COLUMN IF NOT EXISTS hero_title             text,
  ADD COLUMN IF NOT EXISTS hero_description       text,
  ADD COLUMN IF NOT EXISTS hero_title_size        numeric(5,2)  NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS hero_description_size  numeric(5,2)  NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS hero_text_align        text          NOT NULL DEFAULT 'left'
    CHECK (hero_text_align IN ('left','center','right')),
  ADD COLUMN IF NOT EXISTS hero_position_x        integer       NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS hero_position_y        integer       NOT NULL DEFAULT 32,
  ADD COLUMN IF NOT EXISTS hero_max_width         integer       NOT NULL DEFAULT 768;

-- Mobile-specific background image and position
ALTER TABLE page_settings
  ADD COLUMN IF NOT EXISTS mobile_background_image  text,
  ADD COLUMN IF NOT EXISTS mobile_bg_position_x     integer  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS mobile_bg_position_y     integer  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS mobile_bg_zoom           integer  NOT NULL DEFAULT 100;

-- Page visibility & access control
ALTER TABLE page_settings
  ADD COLUMN IF NOT EXISTS is_active  boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_role   text     NOT NULL DEFAULT 'viewer'
    CHECK (min_role IN ('viewer','moderador','configurador','admin'));
