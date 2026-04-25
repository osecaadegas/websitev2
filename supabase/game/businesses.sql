-- ============================================================
-- BUSINESSES — Complete schema (idempotent, run any time)
-- Covers: businesses, player_businesses extensions
--         player_business_workers, player_business_events, player_business_upgrades
--         drug items + drug business types
--         launder system (cap, fee, tracking)
--         seizure system + audit log
--         correct income values, unlock levels
--
-- Sources: 6, 8, 9, 10, 11, 12, 13, 14, 15, 27
--
-- ⚠️  IMPORTANT: Run PART 1 first (enum values), then PART 2 (schema + data).
--    ALTER TYPE ... ADD VALUE cannot run in the same transaction as INSERT.
-- ============================================================

-- ════════════════════════════════════════════════════════════════
-- PART 1 — Enum values (run this block first, then commit/run again)
-- ════════════════════════════════════════════════════════════════

ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'phantom_corp';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'offshore_bank';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'clandestine_casino';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'lsd_lab';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'cartel_empire';

-- ════════════════════════════════════════════════════════════════
-- PART 2 — Schema + data (run after Part 1 has committed)
-- ════════════════════════════════════════════════════════════════

-- ─── A. Extend player_businesses ──────────────────────────────────────────────

ALTER TABLE player_businesses
  ADD COLUMN IF NOT EXISTS heat                NUMERIC     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_level    TEXT        NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS status              TEXT        NOT NULL DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS last_heat_update    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_wage_payment   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sick_workers        INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popularity          INTEGER     NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS launder_used        INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS launder_window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS laundering_amount   INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gpu_count           INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpu_count           INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ram_count           INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS computer_count      INT         NOT NULL DEFAULT 0;

-- ─── B. Extend businesses table ───────────────────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS risk_level           TEXT        NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS heat_per_hour        NUMERIC     NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tagline              TEXT,
  ADD COLUMN IF NOT EXISTS launder_cap_per_hour INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS launder_fee_percent  NUMERIC(5,2) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS drug_output_item_id  UUID        REFERENCES items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drug_output_per_hour INTEGER     NOT NULL DEFAULT 0;

-- ─── C. Worker tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_business_workers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  player_business_id  UUID        NOT NULL REFERENCES player_businesses(id) ON DELETE CASCADE,
  worker_def_id       TEXT        NOT NULL,
  name                TEXT        NOT NULL,
  skill               TEXT        NOT NULL,
  trait               TEXT        NOT NULL,
  salary              INTEGER     NOT NULL,
  production_bonus    NUMERIC     NOT NULL DEFAULT 0,
  efficiency_bonus    NUMERIC     NOT NULL DEFAULT 0,
  stealth_bonus       NUMERIC     NOT NULL DEFAULT 0,
  description         TEXT        NOT NULL DEFAULT '',
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  hired_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pbw_player_business ON player_business_workers(player_business_id);
CREATE INDEX IF NOT EXISTS idx_pbw_player          ON player_business_workers(player_id);

-- ─── D. Business events + upgrades ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_business_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  player_business_id  UUID        NOT NULL REFERENCES player_businesses(id) ON DELETE CASCADE,
  event_def_id        TEXT        NOT NULL,
  event_data          JSONB       NOT NULL DEFAULT '{}',
  is_resolved         BOOLEAN     NOT NULL DEFAULT false,
  choice_made         TEXT,
  outcome_data        JSONB,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pbe_player_business ON player_business_events(player_business_id);
CREATE INDEX IF NOT EXISTS idx_pbe_player          ON player_business_events(player_id);

CREATE TABLE IF NOT EXISTS player_business_upgrades (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  player_business_id  UUID        NOT NULL REFERENCES player_businesses(id) ON DELETE CASCADE,
  upgrade_def_id      TEXT        NOT NULL,
  purchased_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_business_id, upgrade_def_id)
);

CREATE INDEX IF NOT EXISTS idx_pbu_player_business ON player_business_upgrades(player_business_id);

-- ─── E. RLS for worker/event/upgrade tables ───────────────────────────────────

ALTER TABLE player_business_workers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_business_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_business_upgrades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_business_workers'  AND policyname = 'Players manage own biz workers')  THEN
    CREATE POLICY "Players manage own biz workers"  ON player_business_workers  FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_business_events'   AND policyname = 'Players manage own biz events')    THEN
    CREATE POLICY "Players manage own biz events"   ON player_business_events   FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_business_upgrades' AND policyname = 'Players manage own biz upgrades')  THEN
    CREATE POLICY "Players manage own biz upgrades" ON player_business_upgrades FOR ALL USING (true); END IF;
END $$;

-- ─── F. Dirty money item ──────────────────────────────────────────────────────

ALTER TABLE items ADD COLUMN IF NOT EXISTS item_code TEXT UNIQUE;

INSERT INTO items (name, description, category, base_price, tradeable, item_code)
VALUES (
  'Dinheiro Sujo',
  'Dinheiro obtido em actividades ilegais. Leva-o a uma lavandaria para o converter em dinheiro limpo.',
  'material', 0, false, 'dirty_money'
)
ON CONFLICT (item_code) DO NOTHING;

-- ─── G. Drug items ────────────────────────────────────────────────────────────

INSERT INTO items (name, description, category, base_price, tradeable) VALUES
  ('Cannabis',        'Erva de alta qualidade cultivada em condições controladas. Vendida nos mercados ilegais da cidade.',       'drug', 150,  true),
  ('Pastilhas',       'Comprimidos psicoativos produzidos em fábrica ilegal. Muito procurados nas festas da cidade.',             'drug', 400,  true),
  ('Frasco de Gotas', 'Solução de LSD em frasco conta-gotas. Extremamente potente. Produzida em laboratório clandestino.',        'drug', 800,  true),
  ('KG de Coca',      'Cocaína de pureza máxima processada pelo cartel. A mercadoria mais valiosa do mercado negro.',              'drug', 5000, true)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      base_price  = EXCLUDED.base_price;

-- ─── H. Upsert all 12 businesses ──────────────────────────────────────────────

INSERT INTO businesses (
  name, type, description,
  purchase_price, base_income_per_hour, max_employees, employee_cost_per_hour,
  required_level, risk_level, heat_per_hour, tagline,
  launder_cap_per_hour, launder_fee_percent, drug_output_per_hour, enabled
) VALUES
  -- Drug businesses
  ('Quinta de Cannabis',    'weed_farm',         'Cultiva e vende cannabis de alta qualidade.',                                                           50000,     500, 4,  80,   5, 'medium',  8, 'Cultiva e vende cannabis de alta qualidade',               0,  20, 12, true),
  ('Fábrica de Pílulas',    'pill_factory',       'Produz pílulas ilegais em escala industrial.',                                                         120000,   1200, 6, 120,  12, 'high',   13, 'Produz pílulas ilegais em escala industrial',              0,  20,  6, true),
  ('Laboratório de LSD',    'lsd_lab',            'Laboratório de síntese ilegal de lisergida. Produz frascos de gotas de alta potência. Risco extremo.', 200000,      0, 6, 200,  68, 'high',   18, 'Síntese ilegal de lisergida em escala industrial',          0,  20,  4, true),
  ('Cartel Empire',         'cartel_empire',      'A operação de cocaína mais sofisticada do país. Rotas de importação, processamento e distribuição.',    500000,      0, 6, 300, 100, 'high',   25, 'A operação de cocaína mais sofisticada do país',            0,  20,  2, true),
  -- Mixed income businesses
  ('Mineração Crypto',      'crypto_mining',      'Minera criptomoedas com rigs ilegais.',                                                                150000,   2000, 4, 100,  25, 'low',     3, 'Minera criptomoedas com rigs ilegais',                     0,  20,  0, true),
  ('Escritório de Fraude',  'scam_office',        'Operações de fraude digital em grande escala.',                                                         90000,   1500, 4,  90,  18, 'medium',  7, 'Operações de fraude digital em grande escala',              0,  20,  0, true),
  ('Chop Shop',             'chop_shop',          'Desmonta carros roubados e lava dinheiro.',                                                            200000,   2500, 5, 130,  32, 'high',   15, 'Desmonta carros roubados e lava dinheiro',               5000,  20,  0, true),
  ('Nightclub',             'nightclub',          'A fachada perfeita para lavar dinheiro.',                                                              300000,   5000, 6, 150,  40, 'low',     2, 'A fachada perfeita para lavar dinheiro',                    0,  15,  0, true),
  ('Lab. de Contrafação',   'counterfeit_lab',    'Produz notas e documentos falsos de alta qualidade.',                                                   75000,   3000, 6, 150,  50, 'high',   14, 'Produz dinheiro e documentos falsos',                      0,  20,  0, true),
  -- Launder businesses
  ('Corporação Fantasma',   'phantom_corp',       'Rede de empresas-fantasma espalhadas por paraísos fiscais.',                                           150000,   8000, 6, 200,  60, 'medium',  8, 'Empresas-fantasma para esconder fortunas',              20000,  12,  0, true),
  ('Banco Offshore',        'offshore_bank',      'Banco privado em jurisdição offshore. Wire transfers instantâneas.',                                    300000,  15000, 6, 300,  75, 'medium',  6, 'Movimenta fortunas através das fronteiras',             35000,  20,  0, true),
  ('Casino Clandestino',    'clandestine_casino', 'Casino ilegal de alto perfil. Chips trocam dinheiro sujo por fichas legítimas.',                       500000,  25000, 7, 250,  85, 'high',   18, 'O lugar onde o dinheiro sujo entra e sai limpo',        50000,  25,  0, true)
ON CONFLICT (type) DO UPDATE SET
  name                  = EXCLUDED.name,
  description           = EXCLUDED.description,
  purchase_price        = EXCLUDED.purchase_price,
  base_income_per_hour  = EXCLUDED.base_income_per_hour,
  max_employees         = EXCLUDED.max_employees,
  employee_cost_per_hour = EXCLUDED.employee_cost_per_hour,
  required_level        = EXCLUDED.required_level,
  risk_level            = EXCLUDED.risk_level,
  heat_per_hour         = EXCLUDED.heat_per_hour,
  tagline               = EXCLUDED.tagline,
  launder_cap_per_hour  = EXCLUDED.launder_cap_per_hour,
  launder_fee_percent   = EXCLUDED.launder_fee_percent,
  drug_output_per_hour  = EXCLUDED.drug_output_per_hour,
  enabled               = EXCLUDED.enabled;

-- ─── I. Link drug output items to businesses ──────────────────────────────────

UPDATE businesses SET drug_output_item_id = (SELECT id FROM items WHERE name = 'Cannabis')        WHERE type = 'weed_farm';
UPDATE businesses SET drug_output_item_id = (SELECT id FROM items WHERE name = 'Pastilhas')       WHERE type = 'pill_factory';
UPDATE businesses SET drug_output_item_id = (SELECT id FROM items WHERE name = 'Frasco de Gotas') WHERE type = 'lsd_lab';
UPDATE businesses SET drug_output_item_id = (SELECT id FROM items WHERE name = 'KG de Coca')      WHERE type = 'cartel_empire';

-- ─── J. Seizure audit log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_seizure_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  player_business_id  UUID        NOT NULL REFERENCES player_businesses(id) ON DELETE CASCADE,
  business_type       TEXT        NOT NULL,
  seized              JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_seizure_log_player_id_idx  ON business_seizure_log(player_id);
CREATE INDEX IF NOT EXISTS business_seizure_log_created_at_idx ON business_seizure_log(created_at DESC);

-- ─── K. Sync existing dirty_cash → dirty_money inventory ─────────────────────

INSERT INTO player_inventory (player_id, item_id, quantity)
SELECT p.id, i.id, p.dirty_cash
FROM   crime_players p
JOIN   items i ON i.item_code = 'dirty_money'
WHERE  p.dirty_cash > 0
ON CONFLICT (player_id, item_id) DO UPDATE
  SET quantity = EXCLUDED.quantity;

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT type, name, required_level, base_income_per_hour, launder_cap_per_hour, drug_output_per_hour
-- FROM businesses ORDER BY required_level;
