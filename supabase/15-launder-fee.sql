-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — ADD LAUNDER FEE PERCENT TO BUSINESSES
-- launder_fee_percent: % the business keeps as fee (e.g. 20 = player gets 80%)
-- ═══════════════════════════════════════════════════════════════════════════

alter table businesses
  add column if not exists launder_fee_percent numeric(5,2) not null default 20;

-- Set sensible defaults per existing launder businesses
-- (nightclub and any others — adjust values as needed in the admin UI)
update businesses set launder_fee_percent = 15 where type = 'nightclub';
update businesses set launder_fee_percent = 20 where type = 'offshore_bank';
update businesses set launder_fee_percent = 25 where type = 'clandestine_casino';
update businesses set launder_fee_percent = 12 where type = 'phantom_corp';

-- Verify
select type, name, launder_cap_per_hour, launder_fee_percent
from businesses
where launder_cap_per_hour is not null
order by launder_fee_percent;
