-- ============================================================
-- BROTHEL TIER-2 INCOME UPGRADES (idempotent)
-- Adds 6 boolean upgrade columns that boost income but do NOT
-- add worker slots. Used by /api/crime-empire/brothels collect.
-- ============================================================

ALTER TABLE player_brothels
  ADD COLUMN IF NOT EXISTS upgrade_premium_drinks         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_luxury_decor           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_private_lounge         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_celebrity_endorsement  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_high_class_clientele   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_signature_brand        BOOLEAN NOT NULL DEFAULT false;

-- Sanity report (run manually):
-- SELECT id, brothel_type_id,
--   upgrade_lighting, upgrade_marketing, upgrade_security, upgrade_vip_rooms,
--   upgrade_premium_drinks, upgrade_luxury_decor, upgrade_private_lounge,
--   upgrade_celebrity_endorsement, upgrade_high_class_clientele, upgrade_signature_brand
-- FROM player_brothels;
