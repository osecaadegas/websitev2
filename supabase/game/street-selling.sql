-- ============================================================
-- STREET SELLING — Complete schema (idempotent, run any time)
-- Covers: street_customers catalog (25 NPCs)
--         street_sessions, street_deals
--         RLS policies
--
-- Source: 21-street-selling.sql
-- ============================================================

-- ─── 1. Street customers catalog ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS street_customers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  archetype       TEXT        NOT NULL,
  dialogue        TEXT        NOT NULL,
  offer_mod       NUMERIC     NOT NULL DEFAULT 1.0,
  patience        INTEGER     NOT NULL DEFAULT 3,
  suspicion       INTEGER     NOT NULL DEFAULT 1,
  is_cop          BOOLEAN     NOT NULL DEFAULT false,
  enabled         BOOLEAN     NOT NULL DEFAULT true
);

ALTER TABLE street_customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'street_customers' AND policyname = 'Public read street_customers') THEN
    CREATE POLICY "Public read street_customers" ON street_customers FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO street_customers (name, archetype, dialogue, offer_mod, patience, suspicion, is_cop) VALUES
  ('Carlos Fumador',       'regular',     'Precisas do habitual, meu?',                                          1.0,  4, 1, false),
  ('Miúda do Bairro',      'regular',     'Tenho o dinheiro, mas tá contado...',                                 0.9,  3, 1, false),
  ('Zé do Canto',          'regular',     'Sempre aqui, sempre a precisar...',                                   0.85, 3, 1, false),
  ('Dani Habitual',        'regular',     'Não me faças perder tempo.',                                          0.95, 4, 1, false),
  ('Gonçalo das Tabacarias','regular',    'Certo, vamos lá a isso.',                                             1.0,  4, 1, false),
  ('Turista Confuso',      'tourist',     'Ouvi dizer que aqui... vendes... coisas?',                            1.2,  2, 2, false),
  ('Tim de Berlim',        'tourist',     'In my city this costs nothing, ja?',                                  1.15, 2, 2, false),
  ('Casal de Férias',      'tourist',     'É para experiência... somos adultos.',                                1.25, 2, 2, false),
  ('Backpacker Australiano','tourist',    'Mate, how much for a little something?',                              1.1,  2, 2, false),
  ('Influencer Alemão',    'tourist',     'Preciso de conteúdo autêntico para o meu canal.',                     1.3,  2, 2, false),
  ('Miúdo Desesperado',    'junkie',      'Já não durmo há dois dias, pelo amor de Deus...',                     0.8,  5, 1, false),
  ('Velhinha Tremida',     'junkie',      'Só uma vez, prometo...',                                              0.75, 4, 1, false),
  ('Ex-Bancário',          'junkie',      'Tenho mais em casa, vou buscar...',                                   0.7,  5, 1, false),
  ('Pitita do Porto',      'junkie',      'Não durmo sem isso já.',                                              0.7,  5, 1, false),
  ('Skin da Mouraria',     'junkie',      'Sete anos limpo... uma não faz mal.',                                 0.65, 4, 1, false),
  ('Miguel Fornecedor',    'dealer',      'Posso revender. Split cinquenta-cinquenta?',                          0.6,  3, 2, false),
  ('Tuki das Olaias',      'dealer',      'Preciso de atacado. Pagas o quê por quilo?',                          0.55, 3, 2, false),
  ('Bruno Business',       'dealer',      'Tens volume? Conheço gente interessada.',                             0.65, 3, 2, false),
  ('Rui Fardas',           'dealer',      'Os meus clientes são seletos. Qualidade primeiro.',                   0.7,  3, 2, false),
  ('Vanessa Distribuidora','dealer',      'Trabalho toda a linha do Tejo. Preço por caixote.',                   0.6,  3, 2, false),
  ('Agente Torres',        'cop',         'Não te mexas. Mãos onde eu as veja.',                                 0.0,  1, 5, true),
  ('Inspetora Margarida',  'cop',         'Acabei de observar uma transação ilegal. Vira-te para a parede.',     0.0,  1, 5, true),
  ('PSP Fardado',          'cop',         'Parado! Identifique-se!',                                             0.0,  1, 5, true),
  ('ASAE Encoberto',       'cop',         'ASAE. Acompanhe-me, por favor.',                                      0.0,  1, 5, true),
  ('Policia de Transito',  'cop',         'Documento e o que tem nos bolsos.',                                   0.0,  1, 5, true)
ON CONFLICT (name) DO UPDATE SET
  dialogue   = EXCLUDED.dialogue,
  offer_mod  = EXCLUDED.offer_mod,
  patience   = EXCLUDED.patience,
  suspicion  = EXCLUDED.suspicion,
  is_cop     = EXCLUDED.is_cop,
  enabled    = EXCLUDED.enabled;

-- ─── 2. Street sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS street_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  heat_gained     INTEGER     NOT NULL DEFAULT 0,
  total_earnings  INTEGER     NOT NULL DEFAULT 0,
  deals_count     INTEGER     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','ended','busted'))
);

CREATE INDEX IF NOT EXISTS idx_street_sessions_player ON street_sessions(player_id);

ALTER TABLE street_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'street_sessions' AND policyname = 'Players manage own street sessions') THEN
    CREATE POLICY "Players manage own street sessions" ON street_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 3. Street deals log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS street_deals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES street_sessions(id) ON DELETE CASCADE,
  player_id       UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  customer_id     UUID        REFERENCES street_customers(id) ON DELETE SET NULL,
  item_id         UUID        REFERENCES items(id) ON DELETE SET NULL,
  quantity        INTEGER     NOT NULL DEFAULT 1,
  price_per_unit  INTEGER     NOT NULL,
  total_price     INTEGER     NOT NULL,
  outcome         TEXT        NOT NULL DEFAULT 'sold'
    CHECK (outcome IN ('sold','refused','busted','escaped')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_street_deals_session ON street_deals(session_id);
CREATE INDEX IF NOT EXISTS idx_street_deals_player  ON street_deals(player_id);

ALTER TABLE street_deals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'street_deals' AND policyname = 'Players manage own street deals') THEN
    CREATE POLICY "Players manage own street deals" ON street_deals FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
