-- ============================================================
-- 16 — Brothels as a Separate Category
-- Moves brothels out of businesses/player_businesses into
-- dedicated brothel_types and player_brothels tables.
-- ============================================================

-- 1. Static brothel type definitions
CREATE TABLE IF NOT EXISTS brothel_types (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  type           TEXT        NOT NULL UNIQUE,
  description    TEXT,
  purchase_price INTEGER     NOT NULL DEFAULT 0,
  base_income_per_hour INTEGER NOT NULL DEFAULT 0,
  max_employees  INTEGER     NOT NULL DEFAULT 5,
  required_level INTEGER     NOT NULL DEFAULT 1,
  uses_crypto    BOOLEAN     NOT NULL DEFAULT false,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  enabled        BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Populate from existing businesses table
INSERT INTO brothel_types (name, type, description, purchase_price, base_income_per_hour, max_employees, required_level, uses_crypto, sort_order)
SELECT
  name,
  type::TEXT,
  description,
  purchase_price,
  base_income_per_hour,
  max_employees,
  required_level,
  (type::TEXT IN ('brothel_luxury', 'brothel_exclusive', 'brothel_empire')) AS uses_crypto,
  CASE type::TEXT
    WHEN 'brothel_basic'     THEN 1
    WHEN 'brothel_upgraded'  THEN 2
    WHEN 'brothel_luxury'    THEN 3
    WHEN 'brothel_exclusive' THEN 4
    WHEN 'brothel_empire'    THEN 5
    ELSE 0
  END AS sort_order
FROM businesses
WHERE type::TEXT IN ('brothel_basic', 'brothel_upgraded', 'brothel_luxury', 'brothel_exclusive', 'brothel_empire')
ON CONFLICT (type) DO NOTHING;

-- 2b. Direct seed (fallback if businesses table had no brothel rows)
INSERT INTO brothel_types (name, type, description, purchase_price, base_income_per_hour, max_employees, required_level, uses_crypto, sort_order, enabled)
VALUES
  ('Casa de Massagens',    'brothel_basic',     'Um pequeno estabelecimento no centro da cidade.',                 50000,    500,   3,  15,  false, 1, true),
  ('Clube Noturno',        'brothel_upgraded',  'Instalações maiores e mais discretas.',                         150000,  1200,   8,  30, false, 2, true),
  ('Salão Privado',        'brothel_luxury',    'Clientela VIP apenas. Aceita crypto.',                          500000,  3000,  14,  50, true,  3, true),
  ('Mansão das Sombras',   'brothel_exclusive', 'Operação de alto nível. Aceita crypto.',                       1000000,  6000,  20,  75, true,  4, true),
  ('O Império',            'brothel_empire',    'O maior e mais lucrativo estabelecimento da cidade. Aceita crypto.', 5000000, 15000, 40, 100, true, 5, true)
ON CONFLICT (type) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;
CREATE TABLE IF NOT EXISTS player_brothels (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  brothel_type_id UUID        NOT NULL REFERENCES brothel_types(id) ON DELETE CASCADE,
  max_employees   INTEGER     NOT NULL DEFAULT 5,
  purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, brothel_type_id)
);

-- 4. Migrate existing player_businesses brothel rows
INSERT INTO player_brothels (player_id, brothel_type_id, max_employees, purchased_at)
SELECT
  pb.player_id,
  bt.id,
  pb.max_employees,
  pb.purchased_at
FROM player_businesses pb
JOIN businesses b ON b.id = pb.business_id
JOIN brothel_types bt ON bt.type = b.type::TEXT
WHERE b.type::TEXT IN ('brothel_basic', 'brothel_upgraded', 'brothel_luxury', 'brothel_exclusive', 'brothel_empire')
ON CONFLICT (player_id, brothel_type_id) DO NOTHING;

-- 5. RLS
ALTER TABLE brothel_types  ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_brothels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read brothel_types"
  ON brothel_types FOR SELECT USING (true);

CREATE POLICY "Players can read own brothels"
  ON player_brothels FOR SELECT USING (true);

CREATE POLICY "Players can insert own brothels"
  ON player_brothels FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update own brothels"
  ON player_brothels FOR UPDATE USING (true);

CREATE POLICY "Players can delete own brothels"
  ON player_brothels FOR DELETE USING (true);

-- 6. (Optional) Remove brothels from businesses tables once confirmed.
--    Run manually after verifying player_brothels data is correct:
--
-- DELETE FROM player_businesses
--   WHERE business_id IN (SELECT id FROM businesses WHERE type LIKE 'brothel%');
-- DELETE FROM businesses WHERE type LIKE 'brothel%';
