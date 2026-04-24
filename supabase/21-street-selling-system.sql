-- ============================================================
-- STREET SELLING SYSTEM
-- Run after 20-brothel-last-collection.sql
-- ============================================================

-- ── Customer types (static pool — seeded below)
CREATE TABLE IF NOT EXISTS street_customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('regular', 'tourist', 'junkie', 'dealer', 'undercover')),
  budget_min      INT  NOT NULL,
  budget_max      INT  NOT NULL,
  patience        INT  NOT NULL CHECK (patience BETWEEN 1 AND 10),
  risk_tolerance  INT  NOT NULL CHECK (risk_tolerance BETWEEN 1 AND 10),
  snitch_chance   FLOAT NOT NULL DEFAULT 0 CHECK (snitch_chance BETWEEN 0 AND 1),
  preferred_quantity INT NOT NULL DEFAULT 5,
  unlock_level    INT  NOT NULL DEFAULT 1
);

-- ── Active / ended selling sessions
CREATE TABLE IF NOT EXISTS street_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  zone        TEXT NOT NULL,
  heat        INT  NOT NULL DEFAULT 0 CHECK (heat BETWEEN 0 AND 100),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'busted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_street_sessions_player ON street_sessions(player_id);

-- ── Individual deals made inside a session
CREATE TABLE IF NOT EXISTS street_deals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES street_sessions(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES street_customers(id),
  item_id       UUID REFERENCES items(id),
  offered_price INT  NOT NULL,
  agreed_price  INT,
  quantity      INT  NOT NULL,
  success       BOOLEAN NOT NULL DEFAULT false,
  snitched      BOOLEAN NOT NULL DEFAULT false,
  heat_added    INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_street_deals_session ON street_deals(session_id);

-- ── Penalty cooldown after a bust — stored on crime_players
-- (column already exists: last_street_sale_at)
-- Add a negotiation cooldown column per session customer
-- We'll just use the session + deals table to track pace.

-- ── SEED: Street customer archetypes (static pool of 25)
INSERT INTO street_customers (name, type, budget_min, budget_max, patience, risk_tolerance, snitch_chance, preferred_quantity, unlock_level) VALUES

-- REGULARS (balanced, moderate budget, low snitch)
('Carlos Sousa',    'regular', 150,  600,  6, 5, 0.05, 5, 1),
('Rui Matos',       'regular', 200,  800,  5, 5, 0.07, 8, 1),
('Diogo Ferreira',  'regular', 100,  500,  7, 6, 0.04, 4, 1),
('Nuno Cardoso',    'regular', 180,  700,  6, 4, 0.06, 6, 1),
('Tiago Correia',   'regular', 120,  450,  8, 7, 0.03, 5, 1),

-- TOURISTS (high budget, gullible, zero snitch — but zone-locked to Aeroporto/Porto)
('James Mackintosh','tourist', 800, 3000,  9, 8, 0.00, 3, 1),
('Yuki Tanaka',     'tourist', 600, 2500,  8, 8, 0.00, 2, 1),
('Marco Bianchi',   'tourist', 700, 2800,  9, 9, 0.01, 4, 1),
('Sophie Dubois',   'tourist', 900, 3500, 10, 9, 0.00, 3, 2),
('Tom Blackwood',   'tourist', 500, 2000,  7, 7, 0.01, 5, 2),

-- JUNKIES (low budget, desperate, low patience, very low snitch)
('Zé Pipas',        'junkie',  50,  300,  2, 2, 0.03, 10, 1),
('Rita da Bica',    'junkie',  30,  200,  2, 3, 0.04, 15, 1),
('Chico das Latas', 'junkie',  40,  250,  1, 2, 0.02, 12, 1),
('Manel Falhado',   'junkie',  60,  280,  3, 3, 0.05, 8,  1),
('Dina do Parque',  'junkie',  20,  150,  1, 1, 0.02, 20, 1),

-- DEALERS (high budget, savvy, willing to counter, medium snitch)
('O Bigodes',       'dealer', 1500, 8000, 4, 4, 0.15, 50, 3),
('Vasco da Grana',  'dealer', 2000,12000, 5, 3, 0.12, 80, 3),
('Senhor X',        'dealer', 1000, 6000, 3, 5, 0.18, 40, 2),
('A Cobrita',       'dealer', 1200, 7000, 4, 4, 0.14, 60, 3),
('Diogo do Norte',  'dealer', 800,  5000, 6, 6, 0.10, 30, 2),

-- UNDERCOVER COPS (appear normal, always snitch)
('Inspector Moreira','undercover', 300, 1200, 7, 6, 1.00, 5, 1),
('Agente Silveira', 'undercover', 250, 1000, 8, 7, 1.00, 3, 1),
('Sub-Inspetor Rato','undercover',400, 1500, 6, 5, 1.00, 8, 2),
('Detetive Costa',  'undercover', 200,  900, 9, 8, 1.00, 4, 2),
('Investigadora Luz','undercover',350, 1300, 7, 6, 1.00, 6, 3)

ON CONFLICT DO NOTHING;

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE street_customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE street_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE street_deals      ENABLE ROW LEVEL SECURITY;

-- street_customers: public read, no direct writes from client
CREATE POLICY "Public read street_customers"  ON street_customers  FOR SELECT USING (true);
CREATE POLICY "Service insert street_customers" ON street_customers FOR INSERT WITH CHECK (true);

-- street_sessions: full access via anon key (server-side API only)
CREATE POLICY "Public read street_sessions"   ON street_sessions   FOR SELECT USING (true);
CREATE POLICY "Public insert street_sessions" ON street_sessions   FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update street_sessions" ON street_sessions   FOR UPDATE USING (true);
CREATE POLICY "Public delete street_sessions" ON street_sessions   FOR DELETE USING (true);

-- street_deals: full access via anon key
CREATE POLICY "Public read street_deals"      ON street_deals      FOR SELECT USING (true);
CREATE POLICY "Public insert street_deals"    ON street_deals      FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update street_deals"    ON street_deals      FOR UPDATE USING (true);
