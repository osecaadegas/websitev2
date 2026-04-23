-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — CRIMES CLEAN CASH SPLIT
-- Adds clean_cash_pct to crimes so low-tier crimes yield a % of clean money.
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add column ────────────────────────────────────────────────────────────
alter table crimes
  add column if not exists clean_cash_pct integer not null default 0;

-- ─── 2. Seed: easy crimes give 20% clean, medium give 10%, hard+ give 0% ─────
update crimes set clean_cash_pct = 20 where difficulty in ('facil', 'easy');
update crimes set clean_cash_pct = 10 where difficulty in ('medio', 'medium');
update crimes set clean_cash_pct = 0  where difficulty in ('dificil', 'hard', 'expert', 'elite');

-- Also cap by required_level as a safety net (anything level 1-2 should be easy)
update crimes set clean_cash_pct = 20 where required_level <= 2 and clean_cash_pct = 0;
