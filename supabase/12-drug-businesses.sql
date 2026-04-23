-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — DRUG BUSINESSES
-- Quinta de Cannabis + Fábrica de Pílulas → produce drug items
-- New: Laboratório de LSD, Cartel Empire
-- New items: Cannabis, Pastilhas, Frasco de Gotas, KG de Coca
--
-- ⚠️  Run Part 1 FIRST, then click Run again for Part 2.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Part 1: Add enum values ──────────────────────────────────────────────────
-- ⚠️  RUN THIS BLOCK FIRST, then click Run again for Part 2.
alter type business_type add value if not exists 'lsd_lab';
alter type business_type add value if not exists 'cartel_empire';

-- item_category 'drug' should already exist from 3-crime-empire-admin.sql
-- If not, uncomment:
-- alter type item_category add value if not exists 'drug';

-- ─── STOP HERE ─── Run Part 1 first, then run Part 2 below ──────────────────

-- ─── Part 2: Schema + data (run in a SEPARATE execution) ─────────────────────

-- Add drug output columns to businesses table
alter table businesses
  add column if not exists drug_output_item_id uuid references items(id) on delete set null,
  add column if not exists drug_output_per_hour integer not null default 0;

-- ── Insert 4 drug items ────────────────────────────────────────────────────
insert into items (name, description, category, base_price, tradeable)
values
  (
    'Cannabis',
    'Erva de alta qualidade cultivada em condições controladas. Vendida nos mercados ilegais da cidade.',
    'drug',
    150,
    true
  ),
  (
    'Pastilhas',
    'Comprimidos psicoativos produzidos em fábrica ilegal. Muito procurados nas festas da cidade.',
    'drug',
    400,
    true
  ),
  (
    'Frasco de Gotas',
    'Solução de LSD em frasco conta-gotas. Extremamente potente. Produzida em laboratório clandestino.',
    'drug',
    800,
    true
  ),
  (
    'KG de Coca',
    'Cocaína de pureza máxima processada pelo cartel. A mercadoria mais valiosa do mercado negro.',
    'drug',
    5000,
    true
  )
on conflict (name) do update
  set description = excluded.description,
      base_price  = excluded.base_price;

-- ── Update weed_farm with drug output ─────────────────────────────────────
update businesses
set
  drug_output_item_id  = (select id from items where name = 'Cannabis'),
  drug_output_per_hour = 12
where type = 'weed_farm';

-- ── Update pill_factory with drug output ──────────────────────────────────
update businesses
set
  drug_output_item_id  = (select id from items where name = 'Pastilhas'),
  drug_output_per_hour = 6
where type = 'pill_factory';

-- ── Insert LSD Lab ────────────────────────────────────────────────────────
insert into businesses (
  name, type, description,
  purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour,
  required_level, risk_level, heat_per_hour, tagline,
  drug_output_per_hour
) values (
  'Laboratório de LSD',
  'lsd_lab',
  'Laboratório de síntese ilegal de lisergida. Produz frascos de gotas de alta potência. Risco extremo.',
  200000,
  0,
  6,
  200,
  30,
  'high',
  18,
  'Síntese ilegal de lisergida em escala industrial',
  4
)
on conflict (type) do update
  set
    name                 = excluded.name,
    description          = excluded.description,
    purchase_price       = excluded.purchase_price,
    max_employees        = excluded.max_employees,
    employee_cost_per_hour = excluded.employee_cost_per_hour,
    required_level       = excluded.required_level,
    risk_level           = excluded.risk_level,
    heat_per_hour        = excluded.heat_per_hour,
    tagline              = excluded.tagline,
    drug_output_per_hour = excluded.drug_output_per_hour;

-- Set drug_output_item_id after insert (needs item to exist)
update businesses
set drug_output_item_id = (select id from items where name = 'Frasco de Gotas')
where type = 'lsd_lab';

-- ── Insert Cartel Empire ──────────────────────────────────────────────────
insert into businesses (
  name, type, description,
  purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour,
  required_level, risk_level, heat_per_hour, tagline,
  drug_output_per_hour
) values (
  'Cartel Empire',
  'cartel_empire',
  'A operação de cocaína mais sofisticada do país. Rotas de importação, processamento e distribuição próprias.',
  500000,
  0,
  6,
  300,
  50,
  'high',
  25,
  'A operação de cocaína mais sofisticada do país',
  2
)
on conflict (type) do update
  set
    name                 = excluded.name,
    description          = excluded.description,
    purchase_price       = excluded.purchase_price,
    max_employees        = excluded.max_employees,
    employee_cost_per_hour = excluded.employee_cost_per_hour,
    required_level       = excluded.required_level,
    risk_level           = excluded.risk_level,
    heat_per_hour        = excluded.heat_per_hour,
    tagline              = excluded.tagline,
    drug_output_per_hour = excluded.drug_output_per_hour;

update businesses
set drug_output_item_id = (select id from items where name = 'KG de Coca')
where type = 'cartel_empire';

-- ── Verify ────────────────────────────────────────────────────────────────
select
  b.name, b.type, b.required_level, b.drug_output_per_hour,
  i.name as drug_item
from businesses b
left join items i on i.id = b.drug_output_item_id
where b.type in ('weed_farm','pill_factory','lsd_lab','cartel_empire')
order by b.required_level;
