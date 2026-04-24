-- ============================================================
-- 18 — Add slug column to brothel_workers for image linking
-- ============================================================

ALTER TABLE brothel_workers
  ADD COLUMN IF NOT EXISTS slug TEXT; -- matches /images/hooker/{slug}.jpg
