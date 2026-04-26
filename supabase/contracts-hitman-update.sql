-- ============================================================
-- CONTRACTS + HITMAN UPDATE  (idempotent)
-- 1. Add image column to contract_targets + set slugs
-- 2. Update required_level for existing contracts
-- 3. Add levels 4 & 5 contracts
-- 4. Create hitman_contracts table
-- ============================================================

-- ─── 1. Add missing columns ──────────────────────────────────
ALTER TABLE contract_targets ADD COLUMN IF NOT EXISTS image     TEXT;
ALTER TABLE contract_targets ADD COLUMN IF NOT EXISTS xp_reward INTEGER NOT NULL DEFAULT 0;

-- Set image slugs for Level 1
UPDATE contract_targets SET image = 'thief'             WHERE name = 'Pombo Correio';
UPDATE contract_targets SET image = 'random1'           WHERE name = 'Contador Nervoso';
UPDATE contract_targets SET image = 'brute'             WHERE name = 'O Cobrador';
-- Level 2
UPDATE contract_targets SET image = 'rich'              WHERE name = 'Testa de Ferro';
UPDATE contract_targets SET image = 'constructionworker' WHERE name = 'O Engenheiro';
UPDATE contract_targets SET image = 'cop'               WHERE name = 'Coronel Sombra';
-- Level 3
UPDATE contract_targets SET image = 'priest'            WHERE name = 'A Notária';
UPDATE contract_targets SET image = 'doctorkiller'      WHERE name = 'Doutor Nulo';
UPDATE contract_targets SET image = 'mafiaboss'         WHERE name = 'O Arquiteto';

-- ─── 2. Update required_level for existing contracts ─────────
-- Level 1 (beginner)
UPDATE contract_targets SET required_level = 1 WHERE name = 'Pombo Correio';
UPDATE contract_targets SET required_level = 1 WHERE name = 'Contador Nervoso';
UPDATE contract_targets SET required_level = 2 WHERE name = 'O Cobrador';
-- Level 2 (mid tier)
UPDATE contract_targets SET required_level = 5  WHERE name = 'Testa de Ferro';
UPDATE contract_targets SET required_level = 8  WHERE name = 'O Engenheiro';
UPDATE contract_targets SET required_level = 12 WHERE name = 'Coronel Sombra';
-- Level 3 (advanced)
UPDATE contract_targets SET required_level = 16 WHERE name = 'A Notária';
UPDATE contract_targets SET required_level = 20 WHERE name = 'Doutor Nulo';
UPDATE contract_targets SET required_level = 25 WHERE name = 'O Arquiteto';

-- ─── 3. Ensure unique constraint on name ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_targets_name_key'
      AND conrelid = 'contract_targets'::regclass
  ) THEN
    ALTER TABLE contract_targets ADD CONSTRAINT contract_targets_name_key UNIQUE (name);
  END IF;
END $$;

-- ─── 4. Level 4 contracts (Elite) ────────────────────────────
INSERT INTO contract_targets
  (name, description, difficulty, roadmap_level, required_level,
   stamina_cost, base_success_rate, hitman_bonus, arrest_chance,
   hitman_arrest_reduction, min_cash, max_cash, respect_reward,
   xp_reward, image, enabled)
VALUES
  ('O Infiltrado',
   'Agente duplo plantado dentro de uma organização rival. Sabe demasiado sobre os nossos canais de distribuição.',
   'easy', 4, 18,
   35, 0.45, 0.12, 0.35, 0.50,
   80000, 160000, 280, 2000,
   'dealer', true),

  ('A Executiva Sombra',
   'Diretora financeira de uma multinacional que branqueia dinheiro de três cartéis. Tem segurança privada permanente.',
   'medium', 4, 22,
   45, 0.35, 0.12, 0.42, 0.48,
   190000, 400000, 550, 3800,
   'rich', true),

  ('O Hacker Fantasma',
   'Desconhecido. Sem rosto, sem rasto. Infiltrou-se nos sistemas de todas as forças policiais do país.',
   'hard', 4, 30,
   55, 0.25, 0.10, 0.52, 0.45,
   450000, 950000, 900, 6500,
   'hacker', true)
ON CONFLICT (name) DO UPDATE SET
  description   = EXCLUDED.description,
  required_level = EXCLUDED.required_level,
  min_cash      = EXCLUDED.min_cash,
  max_cash      = EXCLUDED.max_cash,
  xp_reward     = EXCLUDED.xp_reward,
  roadmap_level = EXCLUDED.roadmap_level,
  difficulty    = EXCLUDED.difficulty,
  image         = EXCLUDED.image;

-- ─── 5. Level 5 contracts (Endgame) ──────────────────────────
INSERT INTO contract_targets
  (name, description, difficulty, roadmap_level, required_level,
   stamina_cost, base_success_rate, hitman_bonus, arrest_chance,
   hitman_arrest_reduction, min_cash, max_cash, respect_reward,
   xp_reward, image, enabled)
VALUES
  ('O Conselheiro',
   'Assessor político com ligações diretas ao crime organizado. Protegido por imunidade parlamentar e guardas armados.',
   'easy', 5, 35,
   45, 0.40, 0.10, 0.42, 0.45,
   220000, 440000, 500, 4500,
   'random1', true),

  ('O Diretor',
   'Coordena dezasseis organizações criminosas a partir de uma sala sem janelas. Nunca foi fotografado.',
   'medium', 5, 45,
   55, 0.28, 0.10, 0.52, 0.42,
   550000, 1100000, 950, 8000,
   'mafiaboss', true),

  ('A Sombra',
   'Nome real desconhecido. Lenda nas ruas. Diz-se que já ordenou a morte de doze juízes. O contrato mais perigoso que existe.',
   'hard', 5, 55,
   65, 0.18, 0.08, 0.62, 0.38,
   1300000, 3000000, 1800, 14000,
   'cop', true)
ON CONFLICT (name) DO UPDATE SET
  description   = EXCLUDED.description,
  required_level = EXCLUDED.required_level,
  min_cash      = EXCLUDED.min_cash,
  max_cash      = EXCLUDED.max_cash,
  xp_reward     = EXCLUDED.xp_reward,
  roadmap_level = EXCLUDED.roadmap_level,
  difficulty    = EXCLUDED.difficulty,
  image         = EXCLUDED.image;

-- ─── 6. hitman_contracts table ────────────────────────────────
CREATE TABLE IF NOT EXISTS hitman_contracts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id        UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  target_id           UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  target_username     TEXT        NOT NULL,
  target_display_name TEXT        NOT NULL,
  target_level        INTEGER     NOT NULL DEFAULT 1,
  reward_cash         INTEGER     NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','completed','failed','cancelled')),
  executed_by         UUID        REFERENCES crime_players(id),
  executed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  message             TEXT
);

CREATE INDEX IF NOT EXISTS idx_hitman_contracts_status     ON hitman_contracts(status);
CREATE INDEX IF NOT EXISTS idx_hitman_contracts_target     ON hitman_contracts(target_id);
CREATE INDEX IF NOT EXISTS idx_hitman_contracts_requester  ON hitman_contracts(requester_id);
CREATE INDEX IF NOT EXISTS idx_hitman_contracts_expires    ON hitman_contracts(expires_at);

ALTER TABLE hitman_contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hitman_contracts'
      AND policyname = 'Allow all hitman contract access'
  ) THEN
    CREATE POLICY "Allow all hitman contract access"
      ON hitman_contracts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
