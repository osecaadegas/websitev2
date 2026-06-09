-- ═══════════════════════════════════════════════════════════
-- ADD payment_methods COLUMN TO casino_offers
-- ═══════════════════════════════════════════════════════════

alter table casino_offers
  add column if not exists payment_methods text[] not null default '{}';
