-- ═══════════════════════════════════════════════════════════
-- ADD is_exclusive COLUMN TO casino_offers
-- Fixes 400 Bad Request when creating/editing parcerias
-- ═══════════════════════════════════════════════════════════

alter table casino_offers
  add column if not exists is_exclusive boolean not null default true;
