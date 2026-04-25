-- ============================================================
-- GAME FUNCTIONS — Shared DB functions & triggers
-- Covers: clip honor helpers (also in hall-of-victories.sql —
--         kept here for reference / standalone re-run)
--         Placeholder stubs for future pg_cron jobs
--
-- Note: All functions use CREATE OR REPLACE — safe to re-run.
-- ============================================================

-- ─── 1. Hall of Victories: atomic honor counter ──────────────────────────────

CREATE OR REPLACE FUNCTION increment_clip_honors(clip_id_arg UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE user_clips SET honors = honors + 1 WHERE id = clip_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_clip_honors(clip_id_arg UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE user_clips SET honors = GREATEST(0, honors - 1) WHERE id = clip_id_arg;
$$;

-- ─── 2. Porto Ships: auto-advance preview → docked ───────────────────────────
-- Called from app logic or via pg_cron when arrival_time is reached.

CREATE OR REPLACE FUNCTION tick_porto_ships()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE porto_ships
  SET status = 'docked'
  WHERE status = 'preview'
    AND arrival_time <= now();
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ─── 3. Plane Crash: expire old sessions ─────────────────────────────────────
-- Marks crash_sessions as 'expired' if created more than 24 hours ago and not done.

CREATE OR REPLACE FUNCTION expire_crash_sessions()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE crash_sessions
  SET status = 'expired'
  WHERE status = 'active'
    AND created_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ─── 4. Utility: updated_at auto-touch trigger ───────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach to tables that have an updated_at column (no-op if trigger exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_page_settings_updated_at') THEN
    CREATE TRIGGER trg_page_settings_updated_at
      BEFORE UPDATE ON page_settings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ce_shop_listings_updated_at') THEN
    CREATE TRIGGER trg_ce_shop_listings_updated_at
      BEFORE UPDATE ON ce_shop_listings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── 5. pg_cron stubs (enable pg_cron extension first in Supabase dashboard) ─
-- Uncomment after enabling the pg_cron extension under Database → Extensions.

/*
-- Tick porto ships every 5 minutes
SELECT cron.schedule('tick-porto-ships', '*/5 * * * *', $$ SELECT tick_porto_ships(); $$);

-- Expire old crash sessions once per hour
SELECT cron.schedule('expire-crash-sessions', '0 * * * *', $$ SELECT expire_crash_sessions(); $$);
*/
