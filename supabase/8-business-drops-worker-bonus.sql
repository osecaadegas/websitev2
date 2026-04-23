-- ═══════════════════════════════════════════════════════════════════════════
-- CRIME EMPIRE — BUSINESS DROPS WORKER BONUS
-- Adds worker_drop_bonus_per_worker to business_output_items so each hired
-- worker increases the drop chance by this amount (e.g. 0.02 = +2%/worker).
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

alter table business_output_items
  add column if not exists worker_drop_bonus_per_worker numeric not null default 0
    check (worker_drop_bonus_per_worker >= 0 and worker_drop_bonus_per_worker <= 1);
