-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — BUSINESS CLEANUP
-- Removes all businesses that have no code definition, deduplicates by type,
-- and sets correct required_level for a smooth unlock progression.
-- ⚠️  This will also delete any player_businesses linked to invalid types.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Delete player data for businesses with invalid types ─────────────────
-- (cascades through player_business_workers, player_business_events, player_business_upgrades)
delete from player_businesses
where business_id in (
  select id from businesses
  where type not in (
    'weed_farm', 'pill_factory', 'lsd_lab', 'cartel_empire',
    'crypto_mining', 'scam_office', 'chop_shop', 'counterfeit_lab',
    'nightclub', 'phantom_corp', 'offshore_bank', 'clandestine_casino'
  )
);

-- ─── 2. Delete businesses with invalid/unsupported types ─────────────────────
delete from businesses
where type not in (
  'weed_farm', 'pill_factory', 'lsd_lab', 'cartel_empire',
  'crypto_mining', 'scam_office', 'chop_shop', 'counterfeit_lab',
  'nightclub', 'phantom_corp', 'offshore_bank', 'clandestine_casino'
);

-- ─── 3. Deduplicate — keep only the latest row per type ──────────────────────
-- (In case the same type was inserted twice by different migrations)
delete from businesses
where id not in (
  select distinct on (type) id
  from businesses
  order by type, created_at desc nulls last, id desc
);

-- ─── 4. Set correct required_level for all 12 businesses ─────────────────────
update businesses set required_level =  5  where type = 'weed_farm';
update businesses set required_level = 10  where type = 'pill_factory';
update businesses set required_level = 12  where type = 'scam_office';
update businesses set required_level = 15  where type = 'crypto_mining';
update businesses set required_level = 18  where type = 'chop_shop';
update businesses set required_level = 20  where type = 'nightclub';
update businesses set required_level = 22  where type = 'counterfeit_lab';
update businesses set required_level = 25  where type = 'phantom_corp';
update businesses set required_level = 30  where type = 'lsd_lab';
update businesses set required_level = 35  where type = 'offshore_bank';
update businesses set required_level = 45  where type = 'clandestine_casino';
update businesses set required_level = 50  where type = 'cartel_empire';

-- ─── 5. Ensure all 12 businesses are enabled ─────────────────────────────────
update businesses set enabled = true
where type in (
  'weed_farm', 'pill_factory', 'lsd_lab', 'cartel_empire',
  'crypto_mining', 'scam_office', 'chop_shop', 'counterfeit_lab',
  'nightclub', 'phantom_corp', 'offshore_bank', 'clandestine_casino'
);

-- ─── 6. Verify — should show exactly 12 rows ─────────────────────────────────
select
  type,
  name,
  required_level,
  purchase_price,
  enabled
from businesses
order by required_level;
