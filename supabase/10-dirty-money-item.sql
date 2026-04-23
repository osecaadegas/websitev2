-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — DIRTY MONEY AS ITEM + LAUNDER CAP SYSTEM
-- Dirty cash becomes an inventory item ("Dinheiro Sujo") so launder businesses
-- physically consume it. Each launder business has an hourly throughput cap
-- that increases with hired workers.
-- Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add item_code column for system items ─────────────────────────────────
alter table items add column if not exists item_code text unique;

-- ─── 2. Seed the Dirty Money item ────────────────────────────────────────────
insert into items (name, description, category, base_price, tradeable, item_code)
values (
  'Dinheiro Sujo',
  'Dinheiro obtido em actividades ilegais. Leva-o a uma lavandaria para o converter em dinheiro limpo.',
  'material',
  0,
  false,
  'dirty_money'
)
on conflict (item_code) do nothing;

-- ─── 3. Add launder_cap_per_hour to businesses ───────────────────────────────
alter table businesses
  add column if not exists launder_cap_per_hour integer not null default 0;

-- Set cap for launder businesses
update businesses set launder_cap_per_hour = 5000  where type = 'chop_shop';
-- Future businesses (20 000/hr when added):
-- update businesses set launder_cap_per_hour = 20000 where type = 'offshore_bank';
-- update businesses set launder_cap_per_hour = 35000 where type = 'shell_company';

-- ─── 4. Add launder tracking to player_businesses ────────────────────────────
alter table player_businesses
  add column if not exists launder_used         integer     not null default 0,
  add column if not exists launder_window_start timestamptz not null default now();

-- ─── 5. Sync existing dirty_cash → dirty_money inventory ─────────────────────
-- Players who already have dirty_cash get the matching inventory item seeded.
insert into player_inventory (player_id, item_id, quantity)
select p.id, i.id, p.dirty_cash
from   crime_players p
join   items i on i.item_code = 'dirty_money'
where  p.dirty_cash > 0
on conflict (player_id, item_id) do update
  set quantity = excluded.quantity;

-- Verify:
select type, name, launder_cap_per_hour from businesses order by launder_cap_per_hour desc;
