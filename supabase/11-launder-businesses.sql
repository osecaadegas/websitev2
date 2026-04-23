-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — 3 NEW LAUNDER BUSINESSES
-- Corporação Fantasma | Banco Offshore | Casino Clandestino
-- Run in Supabase SQL Editor AFTER 10-dirty-money-item.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add new enum values ───────────────────────────────────────────────────
-- ⚠️  RUN THIS BLOCK FIRST, then click Run again for Part 2 below.
-- PostgreSQL requires new enum values to be committed before they can be used.
alter type business_type add value if not exists 'phantom_corp';
alter type business_type add value if not exists 'clandestine_casino';
-- 'offshore_bank' already exists in the enum from a previous migration

-- ─── STOP HERE ─── Run the statements above first, then run Part 2 below ─────

-- ─── 2. Seed the businesses ───────────────────────────────────────────────────
-- ⚠️  Run this block in a SEPARATE execution after Part 1 has committed.
insert into businesses (
  name, type, description,
  purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour,
  required_level, risk_level, heat_per_hour, tagline,
  launder_cap_per_hour
) values
  -- Corporação Fantasma: tier-2 launder, 20 000/hr base cap
  (
    'Corporação Fantasma',
    'phantom_corp',
    'Uma rede de empresas-fantasma espalhadas por paraísos fiscais. Transforma grandes fortunas em rendimentos "legítimos".',
    150000,
    8000,
    6,
    200,
    25,
    'medium',
    8,
    'Empresas-fantasma para esconder fortunas',
    20000
  ),
  -- Banco Offshore: tier-3 launder, 35 000/hr base cap
  (
    'Banco Offshore',
    'offshore_bank',
    'Banco privado em jurisdição offshore. Wire transfers instantâneas. O método mais discreto para mover fortunas.',
    300000,
    15000,
    6,
    300,
    35,
    'medium',
    6,
    'Movimenta fortunas através das fronteiras',
    35000
  ),
  -- Casino Clandestino: tier-4 launder, 50 000/hr base cap
  (
    'Casino Clandestino',
    'clandestine_casino',
    'Casino ilegal de alto perfil. Chips trocam dinheiro sujo por fichas que voltam como "ganhos" legitimados.',
    500000,
    25000,
    7,
    250,
    45,
    'high',
    18,
    'O lugar onde o dinheiro sujo entra e sai limpo',
    50000
  )
on conflict (type) do update
  set
    name                 = excluded.name,
    description          = excluded.description,
    purchase_price       = excluded.purchase_price,
    base_income_per_hour = excluded.base_income_per_hour,
    max_employees        = excluded.max_employees,
    employee_cost_per_hour = excluded.employee_cost_per_hour,
    required_level       = excluded.required_level,
    risk_level           = excluded.risk_level,
    heat_per_hour        = excluded.heat_per_hour,
    tagline              = excluded.tagline,
    launder_cap_per_hour = excluded.launder_cap_per_hour;

-- Verify:
select name, type, purchase_price, required_level, launder_cap_per_hour
from businesses
where type in ('phantom_corp', 'offshore_bank', 'clandestine_casino')
order by required_level;
