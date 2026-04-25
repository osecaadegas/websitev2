-- ============================================================
-- CRIMES — Complete schema (idempotent, run any time)
-- Covers: crimes clean_cash_pct per difficulty
--         contract_targets catalog (9 contracts)
--         player_contracts table
--         escape_cash_at_risk + escape_crypto_at_risk columns
--
-- Sources: 7, 24, 25, 26
-- ============================================================

-- ─── 1. Crimes: add clean_cash_pct ───────────────────────────────────────────

ALTER TABLE crimes ADD COLUMN IF NOT EXISTS clean_cash_pct INTEGER NOT NULL DEFAULT 30;

-- Set clean_cash_pct per difficulty (idempotent — runs on UPDATE)
UPDATE crimes SET clean_cash_pct = 30 WHERE difficulty = 'petty';
UPDATE crimes SET clean_cash_pct = 20 WHERE difficulty = 'small';
UPDATE crimes SET clean_cash_pct = 10 WHERE difficulty = 'medium';
UPDATE crimes SET clean_cash_pct =  5 WHERE difficulty = 'big';
UPDATE crimes SET clean_cash_pct =  0 WHERE difficulty = 'legendary';

-- ─── 2. Contract targets catalog ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_targets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codename        TEXT        NOT NULL UNIQUE,
  real_name       TEXT,
  description     TEXT        NOT NULL DEFAULT '',
  image_url       TEXT,
  difficulty      TEXT        NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','hard')),
  roadmap_level   INTEGER     NOT NULL DEFAULT 1,
  cash_reward     INTEGER     NOT NULL DEFAULT 0,
  xp_reward       INTEGER     NOT NULL DEFAULT 0,
  enabled         BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9 seeded contracts: 3 roadmap levels × 3 difficulties
INSERT INTO contract_targets (codename, real_name, description, difficulty, roadmap_level, cash_reward, xp_reward) VALUES
  -- Roadmap Level 1
  ('Pombo Correio',    'Filipe Moreira',    'Mensageiro de baixo escalão que transporta envelopes para o sindicato. Ninguém vai dar falta dele.', 'easy',   1,  8000,  150),
  ('Contador Nervoso', 'Paulo Henriques',   'Mantém os livros de várias operações ilegais. Sabe demasiado e está a falar com o Ministério Público.', 'medium', 1, 20000,  300),
  ('O Cobrador',       'Rui Bernardo',      'Coleta pagamentos para uma organização criminosa com brutalidade. Deixou gente hospitalizada.', 'hard',   1, 45000,  600),
  -- Roadmap Level 2
  ('Testa de Ferro',   'Sandra Azevedo',    'Serve de frente legal para múltiplas empresas criminosas. Recentemente pediu proteção à polícia.', 'easy',   2, 18000,  350),
  ('O Engenheiro',     'Marcos Dias',       'Produz documentos falsos de alta qualidade. Tem ligações a três redes diferentes de tráfico.', 'medium', 2, 40000,  600),
  ('Coronel Sombra',   'Colonel Teixeira',  'Ex-militar reconvertido em mercenário. Lidera uma célula de sicários por toda a costa.', 'hard',   2, 90000, 1200),
  -- Roadmap Level 3
  ('A Notária',        'Dra. Conceição',    'Notária que legaliza transacções criminosas há 15 anos. Está a negociar imunidade com a Interpol.', 'easy',   3, 35000,  700),
  ('Doutor Nulo',      'Dr. Afonso Costa',  'Médico que certifica mortes para seguros fraudulentos. Fatura 2 milhões por ano com este esquema.', 'medium', 3, 75000, 1200),
  ('O Arquiteto',      'Vitor Amaral',      'O cérebro por detrás de toda a rede. Nunca aparece pessoalmente. Eliminar este alvo muda tudo.', 'hard',   3,200000, 3000)
ON CONFLICT (codename) DO UPDATE SET
  description   = EXCLUDED.description,
  cash_reward   = EXCLUDED.cash_reward,
  xp_reward     = EXCLUDED.xp_reward,
  roadmap_level = EXCLUDED.roadmap_level,
  difficulty    = EXCLUDED.difficulty;

-- ─── 3. Player contracts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_contracts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  contract_id       UUID        NOT NULL REFERENCES contract_targets(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','failed','expired')),
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  cash_earned       INTEGER     DEFAULT 0,
  xp_earned         INTEGER     DEFAULT 0,
  attempts          INTEGER     NOT NULL DEFAULT 0,
  UNIQUE(player_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_player_contracts_player ON player_contracts(player_id);
CREATE INDEX IF NOT EXISTS idx_player_contracts_status ON player_contracts(status);

ALTER TABLE player_contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_contracts' AND policyname = 'Players manage own contracts') THEN
    CREATE POLICY "Players manage own contracts" ON player_contracts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 4. Escape risk columns on crime_players ─────────────────────────────────
--    How much cash/crypto a player puts at risk when attempting an escape.
--    Zero by default — set by the escape mechanic before the roll.

ALTER TABLE crime_players
  ADD COLUMN IF NOT EXISTS escape_cash_at_risk   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escape_crypto_at_risk INT NOT NULL DEFAULT 0;
