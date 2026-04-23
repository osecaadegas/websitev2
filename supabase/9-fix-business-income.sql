-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — FIX business base_income_per_hour
-- Resets the correct income values for all seeded businesses.
-- Run this in Supabase SQL Editor if income shows as $0/hr.
-- ═══════════════════════════════════════════════════════════════════════════

update businesses set base_income_per_hour = 500   where type = 'weed_farm';
update businesses set base_income_per_hour = 1200  where type = 'pill_factory';
update businesses set base_income_per_hour = 2000  where type = 'crypto_mining';
update businesses set base_income_per_hour = 1500  where type = 'scam_office';
update businesses set base_income_per_hour = 5000  where type = 'nightclub';
update businesses set base_income_per_hour = 2500  where type = 'chop_shop';
update businesses set base_income_per_hour = 3000  where type = 'counterfeit_lab';

-- Verify after running:
select type, name, base_income_per_hour from businesses order by base_income_per_hour;
