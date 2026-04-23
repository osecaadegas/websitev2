-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — CRIMES CLEAN CASH SPLIT
-- Adds clean_cash_pct to crimes so low-tier crimes yield a % of clean money.
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add column ────────────────────────────────────────────────────────────
alter table crimes
  add column if not exists clean_cash_pct integer not null default 0;

-- ─── 2. Seed: petty/small give 30/20% clean, medium 10%, big/legendary 0% ────
update crimes set clean_cash_pct = 30 where difficulty = 'petty';
update crimes set clean_cash_pct = 20 where difficulty = 'small';
update crimes set clean_cash_pct = 10 where difficulty = 'medium';
update crimes set clean_cash_pct = 0  where difficulty in ('big', 'legendary');

-- Also cap by required_level as a safety net (anything level 1-2 should be petty)
update crimes set clean_cash_pct = 30 where required_level <= 2 and clean_cash_pct = 0;
