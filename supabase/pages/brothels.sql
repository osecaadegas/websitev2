-- ============================================================
-- BROTHELS — Complete schema (idempotent, run any time)
-- Covers: brothel_types, player_brothels
--         brothel_workers stats, traits, slug, assignments
--         brothel_worker_defs catalog (36 workers)
--         brothel_events log
--         last_collection, required_level columns
--
-- Sources: 16, 17, 18, 19, 20, 23
-- ============================================================

-- ─── 1. Brothel type definitions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brothel_types (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  type                  TEXT        NOT NULL UNIQUE,
  description           TEXT,
  purchase_price        INTEGER     NOT NULL DEFAULT 0,
  base_income_per_hour  INTEGER     NOT NULL DEFAULT 0,
  max_employees         INTEGER     NOT NULL DEFAULT 5,
  required_level        INTEGER     NOT NULL DEFAULT 1,
  uses_crypto           BOOLEAN     NOT NULL DEFAULT false,
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  enabled               BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO brothel_types (name, type, description, purchase_price, base_income_per_hour, max_employees, required_level, uses_crypto, sort_order, enabled)
VALUES
  ('Casa de Massagens',  'brothel_basic',     'Um pequeno estabelecimento no centro da cidade.',                    50000,    500,  3,  15, false, 1, true),
  ('Clube Noturno',      'brothel_upgraded',  'Instalações maiores e mais discretas.',                            150000,   1200,  8,  30, false, 2, true),
  ('Salão Privado',      'brothel_luxury',    'Clientela VIP apenas. Aceita crypto.',                             500000,   3000, 14,  50, true,  3, true),
  ('Mansão das Sombras', 'brothel_exclusive', 'Operação de alto nível. Aceita crypto.',                          1000000,   6000, 20,  75, true,  4, true),
  ('O Império',          'brothel_empire',    'O maior e mais lucrativo estabelecimento da cidade. Aceita crypto.', 5000000, 15000, 40, 100, true,  5, true)
ON CONFLICT (type) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

ALTER TABLE brothel_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brothel_types' AND policyname = 'Anyone can read brothel_types') THEN
    CREATE POLICY "Anyone can read brothel_types" ON brothel_types FOR SELECT USING (true);
  END IF;
END $$;

-- ─── 2. Player-owned brothels ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_brothels (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id            UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  brothel_type_id      UUID        NOT NULL REFERENCES brothel_types(id) ON DELETE CASCADE,
  max_employees        INTEGER     NOT NULL DEFAULT 5,
  purchased_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- live state (from 17-brothel-management-system.sql)
  supply_drinks        INTEGER     NOT NULL DEFAULT 100,
  supply_hygiene       INTEGER     NOT NULL DEFAULT 100,
  supply_security      INTEGER     NOT NULL DEFAULT 100,
  client_satisfaction  INTEGER     NOT NULL DEFAULT 75,
  heat_level           INTEGER     NOT NULL DEFAULT 0,
  upgrade_vip_rooms    BOOLEAN     NOT NULL DEFAULT false,
  upgrade_lighting     BOOLEAN     NOT NULL DEFAULT false,
  upgrade_security     BOOLEAN     NOT NULL DEFAULT false,
  upgrade_marketing    BOOLEAN     NOT NULL DEFAULT false,
  total_earned         BIGINT      NOT NULL DEFAULT 0,
  last_collection      TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(player_id, brothel_type_id)
);

-- Add columns if table already exists without them
ALTER TABLE player_brothels
  ADD COLUMN IF NOT EXISTS supply_drinks        INTEGER     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS supply_hygiene       INTEGER     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS supply_security      INTEGER     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS client_satisfaction  INTEGER     NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS heat_level           INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upgrade_vip_rooms    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_lighting     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_security     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upgrade_marketing    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_earned         BIGINT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_collection      TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE player_brothels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_brothels' AND policyname = 'Players can read own brothels') THEN
    CREATE POLICY "Players can read own brothels"   ON player_brothels FOR SELECT USING (true);
    CREATE POLICY "Players can insert own brothels" ON player_brothels FOR INSERT WITH CHECK (true);
    CREATE POLICY "Players can update own brothels" ON player_brothels FOR UPDATE USING (true);
    CREATE POLICY "Players can delete own brothels" ON player_brothels FOR DELETE USING (true);
  END IF;
END $$;

-- Migrate existing player_businesses brothel rows (no-op if already migrated)
INSERT INTO player_brothels (player_id, brothel_type_id, max_employees, purchased_at)
SELECT pb.player_id, bt.id, pb.max_employees, pb.purchased_at
FROM   player_businesses pb
JOIN   businesses b  ON b.id = pb.business_id
JOIN   brothel_types bt ON bt.type = b.type::TEXT
WHERE  b.type::TEXT IN ('brothel_basic','brothel_upgraded','brothel_luxury','brothel_exclusive','brothel_empire')
ON CONFLICT (player_id, brothel_type_id) DO NOTHING;

-- ─── 3. Worker stat/trait columns ─────────────────────────────────────────────

ALTER TABLE brothel_workers
  ADD COLUMN IF NOT EXISTS attractiveness     INTEGER     NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS stamina            INTEGER     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS mood               INTEGER     NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS happiness          INTEGER     NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS trait_1            TEXT,
  ADD COLUMN IF NOT EXISTS trait_2            TEXT,
  ADD COLUMN IF NOT EXISTS player_brothel_id  UUID REFERENCES player_brothels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_room      INTEGER     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_worked_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS slug               TEXT;

-- Populate traits for existing workers that have none
UPDATE brothel_workers SET
  attractiveness = 40 + floor(random() * 50)::int,
  stamina        = 60 + floor(random() * 40)::int,
  mood           = 50 + floor(random() * 50)::int,
  happiness      = 50 + floor(random() * 50)::int,
  trait_1 = (ARRAY['Charmosa','Discreta','Ambiciosa','Extrovertida','Reservada','Elegante','Carismática'])[floor(random()*7)::int + 1],
  trait_2 = (ARRAY['Preguiçosa','Cara','Eficiente','Simpática','Teimosa','Criativa','Confiável'])[floor(random()*7)::int + 1]
WHERE trait_1 IS NULL;

-- ─── 4. Brothel events log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brothel_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         UUID        NOT NULL REFERENCES crime_players(id) ON DELETE CASCADE,
  player_brothel_id UUID        NOT NULL REFERENCES player_brothels(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  description       TEXT        NOT NULL,
  choices           JSONB,
  resolved          BOOLEAN     NOT NULL DEFAULT false,
  resolved_choice   TEXT,
  reward_cash       INTEGER     DEFAULT 0,
  reward_xp         INTEGER     DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE brothel_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brothel_events' AND policyname = 'Players manage own events') THEN
    CREATE POLICY "Players manage own events" ON brothel_events USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 5. Worker definitions catalog (36 workers) ──────────────────────────────

CREATE TABLE IF NOT EXISTS brothel_worker_defs (
  id                  TEXT        PRIMARY KEY,
  slug                TEXT        NOT NULL UNIQUE,
  name                TEXT        NOT NULL,
  description         TEXT        NOT NULL DEFAULT '',
  rarity              TEXT        NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common','rare','elite')),
  hire_price          INTEGER     NOT NULL DEFAULT 10000,
  hire_uses_crypto    BOOLEAN     NOT NULL DEFAULT FALSE,
  earnings_per_hour   INTEGER     NOT NULL DEFAULT 300,
  traits              TEXT[]      NOT NULL DEFAULT '{}',
  stat_attractiveness INTEGER     NOT NULL DEFAULT 50,
  stat_stamina        INTEGER     NOT NULL DEFAULT 50,
  stat_mood           INTEGER     NOT NULL DEFAULT 50,
  stat_charisma       INTEGER     NOT NULL DEFAULT 50,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  enabled             BOOLEAN     NOT NULL DEFAULT TRUE,
  required_level      INT         NOT NULL DEFAULT 1,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO brothel_worker_defs (id,slug,name,description,rarity,hire_price,hire_uses_crypto,earnings_per_hour,traits,stat_attractiveness,stat_stamina,stat_mood,stat_charisma,sort_order,enabled,required_level) VALUES
('instagram_model','instagram_model','Kylie','100k seguidores. Cada visita ao teu estabelecimento vale mais do que parece. Os clientes pagam só para dizer que a conhecem.','elite',100000,TRUE,520,ARRAY['Influencer','Premium','Famosa'],96,68,90,95,1,TRUE,103),
('sra_perfeita','sra_perfeita','Perfeita','O nome não é coincidência. Raro existir outra igual no mercado. Quem a conhece não consegue descrever — apenas recomendar.','elite',120000,TRUE,550,ARRAY['Perfeita','Única','Lendária'],97,85,92,98,2,TRUE,106),
('modelo_russa','modelo_russa','Katya','Ex-modelo de Moscovo. A elegância russa tem um preço — e vale cada cêntimo. Chegou há seis meses e já tem lista de espera.','elite',80000,FALSE,460,ARRAY['Elegante','Premium','Gelada'],93,75,82,89,3,TRUE,97),
('grandes_assets','grandes_assets','Valentina','Não precisa de apresentação. A fama precede-a. Os clientes de alto valor pedem especificamente por ela.','elite',75000,FALSE,450,ARRAY['Carismática','Premium','Notória'],94,78,86,92,4,TRUE,94),
('enfermeira_da_twitch','enfermeira_da_twitch','Nurse','Famosa na internet, agora disponível ao vivo. Os fãs pagam premium só para a ver. O teu negócio nunca teve tanta atenção.','elite',90000,TRUE,500,ARRAY['Famosa','Online','Carismática'],92,70,88,96,5,TRUE,100),
('brazileira','brazileira','Yasmin','O calor do Brasil num estabelecimento do norte. Traz alegria aonde quer que vá. Clientes voltam sempre — e trazem amigos.','elite',65000,FALSE,420,ARRAY['Extrovertida','Carismática','Radiante'],90,82,90,91,6,TRUE,85),
('neguinha_cara','neguinha_cara','Luxara','Cobra o que quer. E os clientes pagam sem questionar. Tem uma presença que nenhum dinheiro consegue ensinar.','elite',70000,FALSE,430,ARRAY['Premium','Confiante','Intimidante'],91,78,85,90,7,TRUE,88),
('princessa','princessa','Isabella','Trata-se como realeza. Os clientes também a tratam. Há um protocolo para marcar com ela — e os clientes adoram isso.','elite',72000,FALSE,440,ARRAY['Elegante','Exigente','Real'],89,68,84,88,8,TRUE,91),
('gotica_tetus2','gotica_tetus2','Lilith','Há uma lista de espera apenas para falar com ela. Não trabalha para todos — escolhe os seus clientes. E isso vale ouro.','elite',58000,FALSE,380,ARRAY['Lendária','Misteriosa','Seletiva'],88,76,72,87,9,TRUE,82),
('acrobata_flexivel','acrobata_flexivel','Jade','A flexibilidade dela é lendária nos bastidores. Os clientes pagam extra só para a ver chegar. Cada sessão é uma performance.','elite',55000,FALSE,380,ARRAY['Flexível','Artista','Memorável'],88,92,80,83,10,TRUE,79),
('ruiva_safada','ruiva_safada','Scarlett','A ruiva que toda a gente conhece. Temperamento próprio, resultados garantidos. Uma sessão com ela e os clientes contam a história.','rare',32000,FALSE,295,ARRAY['Picante','Impulsiva','Irresistível'],85,78,70,82,11,TRUE,70),
('asian_rabbit','asian_rabbit','Mei','Tem um sorriso que vale ouro. Vinda de longe, com uma história para contar. Os clientes ficam fascinados antes mesmo de a conhecer.','rare',35000,FALSE,310,ARRAY['Misteriosa','Discreta','Exótica'],84,78,82,80,12,TRUE,73),
('chinoca_striper','chinoca_striper','Xiao','Treinada nos melhores clubes de Macau. Sabe como fazer um espetáculo que os clientes não esquecem tão facilmente.','rare',30000,FALSE,300,ARRAY['Elegante','Performista','Disciplinada'],86,80,76,81,13,TRUE,67),
('russa_safadad','russa_safadad','Vika','Não deixa ninguém indiferente. Alta energia, altos rendimentos. Tem uma reputação que antecede qualquer apresentação.','rare',36000,FALSE,310,ARRAY['Energética','Atrevida','Imparável'],86,82,74,84,14,TRUE,76),
('19anos_estudante_direito','19anos_estudante_direito','Sofia','Estudante de direito que precisava de um extra. Sabe como negociar qualquer coisa. Inteligente, ambiciosa e sem escrúpulos.','rare',28000,FALSE,280,ARRAY['Inteligente','Ambiciosa','Persuasiva'],82,65,78,79,15,TRUE,61),
('russa','russa','Nadia','A frieza russa esconde um fogo interior. Os clientes voltam para descobrir mais. Nunca diz mais do que o necessário.','rare',28000,FALSE,280,ARRAY['Misteriosa','Reservada','Intensa'],82,76,68,77,16,TRUE,64),
('estudante_europea','estudante_europea','Elena','De Praga para cá. Tem a classe europeia que os clientes de alto valor procuram. Fala três línguas e usa isso a seu favor.','rare',27000,FALSE,285,ARRAY['Elegante','Culta','Ambiciosa'],83,72,79,78,17,TRUE,58),
('gotica_tets','gotica_tets','Morgana','A escuridão atrai. Os clientes que a procuram nunca mais querem outra. Tem um nicho muito específico — e muito fiel.','rare',26000,FALSE,265,ARRAY['Misteriosa','Única','Nicho'],79,74,65,76,18,TRUE,55),
('acrobata','acrobata','Luna','Ex-ginasta que trocou os holofotes por algo mais lucrativo. A resistência física dela é incomparável. Nunca se queixa.','rare',22000,FALSE,260,ARRAY['Flexível','Resistente','Atlética'],75,95,72,71,19,TRUE,43),
('lider_claque','lider_claque','Raquel','Lidera multidões. O teu negócio nunca esteve tão animado. Sabe criar uma atmosfera que os clientes pagam para respirar.','rare',23000,FALSE,275,ARRAY['Extrovertida','Motivadora','Animada'],77,85,88,82,20,TRUE,46),
('preta_pau','preta_pau','Ebony','Profissional de alto calibre. Sabe exatamente o que vale no mercado e não aceita menos do que isso. Experiência garantida.','rare',25000,FALSE,270,ARRAY['Profissional','Direta','Confiante'],80,80,78,78,21,TRUE,52),
('tia_cascais3','tia_cascais3','Leonor','A mais refinada das três de Cascais. Uma reputação que atrai clientela seleta que não se mistura com qualquer coisa.','rare',20000,FALSE,250,ARRAY['Refinada','Elegante','Selectiva'],76,70,80,74,22,TRUE,40),
('atleta','atleta','Diana','A disciplina atlética aplica-se a tudo o que faz. Clientes nunca saem desiludidos. A resistência dela é a melhor do negócio.','rare',24000,FALSE,270,ARRAY['Determinada','Resistente','Focada'],78,98,75,73,23,TRUE,49),
('loira_do_pau','loira_do_pau','Stacy','Clássica. Eficiente. Sempre disponível. Um pilar do estabelecimento que os clientes regulares já conhecem pelo nome.','common',12000,FALSE,155,ARRAY['Confiável','Clássica','Regular'],66,74,68,62,24,TRUE,34),
('neguinha','neguinha','Nia','Energética e dedicada. Os clientes pedem sempre para voltar. Tem uma naturalidade que ninguém consegue fingir.','common',13000,FALSE,160,ARRAY['Energética','Simpática','Natural'],68,82,76,66,25,TRUE,37),
('russa2','russa2','Olga','Segunda opção nunca soou tão bem. Competente, discreta, e faz o trabalho sem drama. Um ativo silencioso do negócio.','common',11500,FALSE,148,ARRAY['Discreta','Competente','Silenciosa'],63,74,66,60,26,TRUE,31),
('cadela','cadela','Bia','Tem atitude própria. Às vezes rebelde, mas os clientes adoram. Uma instabilidade calculada que acaba por fidelizar.','common',10000,FALSE,140,ARRAY['Teimosa','Atrevida','Imprevisível'],65,68,58,63,27,TRUE,16),
('casual_1','casual_1','Ana','Parece completamente normal. E é exatamente isso que a torna especial. Os clientes relaxam com ela de uma forma que não conseguem explicar.','common',10000,FALSE,145,ARRAY['Simpática','Natural','Reconfortante'],62,72,70,64,28,TRUE,19),
('cabra','cabra','Carla','Sabe trabalhar. Não faz perguntas, não cria problemas. Um investimento sólido e previsível. O que todo o negócio precisa.','common',11000,FALSE,150,ARRAY['Discreta','Eficiente','Estável'],60,70,62,58,29,TRUE,28),
('timida','timida','Sara','Tímida só no nome. Com tempo e carinho, floresce como nenhuma outra. Os clientes mais pacientes voltam sempre por ela.','common',10500,FALSE,140,ARRAY['Tímida','Leal','Crescente'],62,72,74,60,30,TRUE,25),
('tia_cascais','tia_cascais','Cristina','Cascais no nome, charme genuíno na prática. A clientela mais velha adora. Traz um conforto que nenhuma jovem consegue replicar.','common',10000,FALSE,138,ARRAY['Caseira','Reconfortante','Fiel'],60,68,78,65,31,TRUE,22),
('tia_cascais2','tia_cascais2','Mafalda','A segunda de Cascais, mas não em qualidade. Tem um conjunto de clientes fiéis que não trocam por nada.','common',8500,FALSE,125,ARRAY['Caseira','Simpática','Discreta'],56,66,75,60,32,TRUE,4),
('tia_cabedal','tia_cabedal','Fátima','Experiência conta. Décadas de conhecimento condensado num sorriso. Os novatos subestimam-na. Os clientes antigos sabem melhor.','common',9000,FALSE,130,ARRAY['Experiente','Fiel','Sábia'],58,70,82,68,33,TRUE,7),
('limpesa','limpesa','Rosa','Começou a limpar o estabelecimento. Ficou pelo negócio. Tem um charme caseiro que agrada a uma clientela muito específica.','common',8000,FALSE,125,ARRAY['Honesta','Simpática','Dedicada'],55,80,72,58,34,TRUE,1),
('alcolica','alcolica','Vera','Funciona melhor depois do terceiro copo. Os clientes gostam da autenticidade dela. Nunca sóbria, nunca previsível.','common',9000,FALSE,130,ARRAY['Descontraída','Imprevisível','Autêntica'],55,40,60,62,35,TRUE,10),
('mulher_gorda','mulher_gorda','Bertha','Um nicho muito específico com clientela de retorno garantido. Autenticidade pura. Os números são consistentes há anos.','common',9500,FALSE,135,ARRAY['Autêntica','Fiel','Consistente'],58,65,80,65,36,TRUE,13)
ON CONFLICT (id) DO NOTHING;
