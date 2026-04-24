-- ============================================================
-- BROTHEL DIAGNOSTICS — Run in Supabase SQL Editor
-- ============================================================

-- 1. Overview of all owned brothels + upgrade state
SELECT
  pb.id                                     AS brothel_id,
  cp.username,
  bt.name                                   AS brothel_name,
  bt.base_income_per_hour,
  pb.max_employees,
  pb.supply_drinks,
  pb.supply_hygiene,
  pb.supply_security,
  pb.client_satisfaction,
  pb.heat_level,
  pb.upgrade_vip_rooms,
  pb.upgrade_lighting,
  pb.upgrade_security,
  pb.upgrade_marketing,
  pb.total_earned,
  pb.purchased_at,
  COUNT(bw.id)                              AS worker_count
FROM player_brothels pb
JOIN crime_players cp  ON cp.id = pb.player_id
JOIN brothel_types  bt ON bt.id = pb.brothel_type_id
LEFT JOIN brothel_workers bw ON bw.player_brothel_id = pb.id
GROUP BY pb.id, cp.username, bt.name, bt.base_income_per_hour
ORDER BY cp.username;

-- 2. All workers + their status and income
SELECT
  bw.id,
  cp.username,
  bw.name                                   AS worker_name,
  bw.slug,
  bw.status,                                -- should be 'healthy'
  bw.income_per_hour,
  bw.happiness,
  bw.attractiveness,
  bw.stamina,
  bw.mood,
  bw.trait_1,
  bw.trait_2,
  bw.player_brothel_id,
  bw.hired_at
FROM brothel_workers bw
JOIN crime_players cp ON cp.id = bw.player_id
ORDER BY cp.username, bw.hired_at;

-- 3. Player cash / dirty_cash balances
SELECT
  cp.username,
  cp.cash,
  cp.dirty_cash,
  cp.crypto,
  cp.level,
  cp.class,
  cp.last_brothel_collect_at
FROM crime_players cp
ORDER BY cp.username;

-- 4. Simulated income for current state (what collect would pay right now)
SELECT
  cp.username,
  bt.name                                   AS brothel_name,
  COUNT(bw.id)                              AS healthy_workers,
  SUM(bw.income_per_hour)                   AS raw_income_per_hour,
  pb.supply_drinks,
  pb.supply_hygiene,
  pb.client_satisfaction,
  ROUND(
    SUM(bw.income_per_hour)
    * (0.7 + pb.supply_drinks  / 100.0 * 0.3)
    * (0.7 + pb.supply_hygiene / 100.0 * 0.3)
    * (pb.client_satisfaction  / 100.0)
  )                                         AS effective_income_per_hour,
  pb.purchased_at,
  ROUND(
    EXTRACT(EPOCH FROM (NOW() - pb.purchased_at)) / 3600.0,
    2
  )                                         AS hours_since_purchased,
  ROUND(
    SUM(bw.income_per_hour)
    * (0.7 + pb.supply_drinks  / 100.0 * 0.3)
    * (0.7 + pb.supply_hygiene / 100.0 * 0.3)
    * (pb.client_satisfaction  / 100.0)
    * LEAST(
        EXTRACT(EPOCH FROM (NOW() - pb.purchased_at)) / 3600.0,
        24
      )
  )                                         AS estimated_collect_now
FROM player_brothels pb
JOIN crime_players cp ON cp.id = pb.player_id
JOIN brothel_types  bt ON bt.id = pb.brothel_type_id
JOIN brothel_workers bw ON bw.player_brothel_id = pb.id AND bw.status = 'healthy'
GROUP BY pb.id, cp.username, bt.name, pb.supply_drinks, pb.supply_hygiene, pb.client_satisfaction, pb.purchased_at
ORDER BY cp.username;
