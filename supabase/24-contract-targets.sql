-- ============================================================
-- 24 — contract_targets + player_contracts
-- ============================================================
-- The contracts system uses contract_targets and player_contracts
-- tables. These were never created via a migration file.
-- The old 2-crime-empire.sql has a "contracts" table with a
-- completely different schema — this is the new redesigned schema.
-- ============================================================

-- Contract difficulty enum (may already exist from old schema)
DO $$ BEGIN
  CREATE TYPE contract_difficulty_v2 AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── contract_targets ────────────────────────────────────────
-- Admin-managed list of contracts / hit targets
CREATE TABLE IF NOT EXISTS contract_targets (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL,
  description            TEXT        NOT NULL DEFAULT '',
  roadmap_level          INTEGER     NOT NULL DEFAULT 1,  -- progression phase (1, 2, 3…)
  difficulty             TEXT        NOT NULL DEFAULT 'easy'
                           CHECK (difficulty IN ('easy', 'medium', 'hard')),
  required_level         INTEGER     NOT NULL DEFAULT 1,  -- player level required
  stamina_cost           INTEGER     NOT NULL DEFAULT 20,
  base_success_rate      NUMERIC     NOT NULL DEFAULT 0.5
                           CHECK (base_success_rate >= 0 AND base_success_rate <= 1),
  hitman_bonus           NUMERIC     NOT NULL DEFAULT 0.15, -- extra success % for hitman class
  arrest_chance          NUMERIC     NOT NULL DEFAULT 0.3
                           CHECK (arrest_chance >= 0 AND arrest_chance <= 1),
  hitman_arrest_reduction NUMERIC    NOT NULL DEFAULT 0.5,  -- fraction reduction for hitman
  min_cash               INTEGER     NOT NULL DEFAULT 500,
  max_cash               INTEGER     NOT NULL DEFAULT 2000,
  respect_reward         INTEGER     NOT NULL DEFAULT 50,
  image                  TEXT,                             -- image slug (optional)
  enabled                BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_targets_roadmap
  ON contract_targets(roadmap_level, difficulty);
CREATE INDEX IF NOT EXISTS idx_contract_targets_enabled
  ON contract_targets(enabled);

-- ─── player_contracts ────────────────────────────────────────
-- Per-player attempt/completion records
CREATE TABLE IF NOT EXISTS player_contracts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  contract_id    UUID        NOT NULL REFERENCES contract_targets(id) ON DELETE CASCADE,
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'failed')),
  cash_reward    INTEGER     NOT NULL DEFAULT 0,
  respect_reward INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_contracts_player
  ON player_contracts(player_id, status);
CREATE INDEX IF NOT EXISTS idx_player_contracts_contract
  ON player_contracts(contract_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE contract_targets  DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_contracts  DISABLE ROW LEVEL SECURITY;

-- ─── Seed — 3 roadmap levels × 3 difficulties ───────────────
-- Level 1 — beginner targets
INSERT INTO contract_targets
  (name, description, roadmap_level, difficulty, required_level, stamina_cost,
   base_success_rate, hitman_bonus, arrest_chance, hitman_arrest_reduction,
   min_cash, max_cash, respect_reward, enabled)
VALUES
  ('Informador Corrupto', 'Um informador que traiu demasiadas pessoas. Trabalho simples para quem sabe o que faz.', 1, 'easy',   1,  15, 0.70, 0.15, 0.20, 0.50,  800,  2000,  40, TRUE),
  ('Traficante Local',    'Controla um bairro mas perdeu o apoio dos superiores. Está isolado.',                     1, 'medium', 3,  20, 0.55, 0.15, 0.30, 0.50, 1500,  4000,  80, TRUE),
  ('Empresário Sujo',     'Branqueamento de capitais em grande escala. Guarda-costas profissionais incluídos.',      1, 'hard',   5,  25, 0.40, 0.15, 0.40, 0.50, 3000,  8000, 150, TRUE),

-- Level 2 — mid-tier
  ('Detetive Corrupto',   'Policia que aceita subornos mas quer mais. Conhece demasiados segredos.',                 2, 'easy',  10, 20, 0.65, 0.15, 0.25, 0.50,  3000,  7000, 100, TRUE),
  ('Chefe de Segurança',  'Gere uma rede de extorsão nos bairros do porto. Rodeado de homens.',                      2, 'medium',15, 28, 0.50, 0.15, 0.35, 0.50,  6000, 15000, 200, TRUE),
  ('Senador Corrompido',  'Político com ligações ao crime organizado. Escolta pesada, agenda pública.',              2, 'hard',  20, 35, 0.35, 0.15, 0.45, 0.50, 12000, 28000, 350, TRUE),

-- Level 3 — endgame
  ('General do Cartel',  'Lidera operações de tráfico internacionais. O alvo mais protegido da lista.',              3, 'easy',  30, 30, 0.60, 0.15, 0.30, 0.50, 10000, 22000, 250, TRUE),
  ('Ministro das Sombras','Controla contratos do governo via intermediários. Nunca aparece publicamente.',           3, 'medium',40, 40, 0.45, 0.15, 0.40, 0.50, 20000, 45000, 500, TRUE),
  ('O Arquiteto',        'Identidade desconhecida. Responsável por metade do crime organizado do país.',             3, 'hard',  50, 50, 0.30, 0.15, 0.55, 0.50, 40000, 90000, 900, TRUE)
ON CONFLICT DO NOTHING;
