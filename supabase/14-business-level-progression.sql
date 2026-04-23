-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — EXTEND UNLOCK LEVELS TO 100
-- Scatters the 12 businesses across levels 5–100
-- ═══════════════════════════════════════════════════════════════════════════

update businesses set required_level =   5  where type = 'weed_farm';
update businesses set required_level =  12  where type = 'pill_factory';
update businesses set required_level =  18  where type = 'scam_office';
update businesses set required_level =  25  where type = 'crypto_mining';
update businesses set required_level =  32  where type = 'chop_shop';
update businesses set required_level =  40  where type = 'nightclub';
update businesses set required_level =  50  where type = 'counterfeit_lab';
update businesses set required_level =  60  where type = 'phantom_corp';
update businesses set required_level =  68  where type = 'lsd_lab';
update businesses set required_level =  75  where type = 'offshore_bank';
update businesses set required_level =  85  where type = 'clandestine_casino';
update businesses set required_level = 100  where type = 'cartel_empire';

-- Verify
select type, name, required_level
from businesses
order by required_level;
