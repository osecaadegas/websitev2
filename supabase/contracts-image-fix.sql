-- ============================================================
-- CONTRACTS IMAGE FIX (idempotent)
-- Fills `image` column for ALL contract_targets rows that
-- still have NULL/empty image, so every WANTED poster renders.
-- ============================================================

-- ─── 1. Make sure column exists ──────────────────────────────
ALTER TABLE contract_targets ADD COLUMN IF NOT EXISTS image TEXT;

-- ─── 2. Specific name → image mappings (Portuguese names) ────
-- Roadmap 1
UPDATE contract_targets SET image = 'thief'             WHERE image IS NULL AND name = 'Pombo Correio';
UPDATE contract_targets SET image = 'random1'           WHERE image IS NULL AND name = 'Contador Nervoso';
UPDATE contract_targets SET image = 'brute'             WHERE image IS NULL AND name = 'O Cobrador';

-- Common admin-created level 1
UPDATE contract_targets SET image = 'dealer'            WHERE image IS NULL AND name ILIKE '%traficante%';
UPDATE contract_targets SET image = 'thief'             WHERE image IS NULL AND name ILIKE '%ladr%o%';
UPDATE contract_targets SET image = 'brute'             WHERE image IS NULL AND name ILIKE '%hooligan%';
UPDATE contract_targets SET image = 'priest'            WHERE image IS NULL AND name ILIKE '%caf%';
UPDATE contract_targets SET image = 'hooker'            WHERE image IS NULL AND name ILIKE '%chulo%';

-- Roadmap 2
UPDATE contract_targets SET image = 'rich'              WHERE image IS NULL AND name = 'Testa de Ferro';
UPDATE contract_targets SET image = 'constructionworker' WHERE image IS NULL AND name = 'O Engenheiro';
UPDATE contract_targets SET image = 'cop'               WHERE image IS NULL AND name = 'Coronel Sombra';
UPDATE contract_targets SET image = 'rich'              WHERE image IS NULL AND name ILIKE '%empres%rio%';
UPDATE contract_targets SET image = 'rich'              WHERE image IS NULL AND name ILIKE '%empres%';
UPDATE contract_targets SET image = 'cop'               WHERE image IS NULL AND name ILIKE '%pol%cia%';
UPDATE contract_targets SET image = 'cop'               WHERE image IS NULL AND name ILIKE '%coronel%';
UPDATE contract_targets SET image = 'cop'               WHERE image IS NULL AND name ILIKE '%detetive%';

-- Roadmap 3
UPDATE contract_targets SET image = 'priest'            WHERE image IS NULL AND name = 'A Notária';
UPDATE contract_targets SET image = 'doctorkiller'      WHERE image IS NULL AND name = 'Doutor Nulo';
UPDATE contract_targets SET image = 'mafiaboss'         WHERE image IS NULL AND name = 'O Arquiteto';
UPDATE contract_targets SET image = 'doctorkiller'      WHERE image IS NULL AND name ILIKE '%doutor%';
UPDATE contract_targets SET image = 'doctorkiller'      WHERE image IS NULL AND name ILIKE '%m%dico%';
UPDATE contract_targets SET image = 'priest'            WHERE image IS NULL AND name ILIKE '%not%ria%';
UPDATE contract_targets SET image = 'priest'            WHERE image IS NULL AND name ILIKE '%padre%';
UPDATE contract_targets SET image = 'mafiaboss'         WHERE image IS NULL AND name ILIKE '%chefe%';
UPDATE contract_targets SET image = 'mafiaboss'         WHERE image IS NULL AND name ILIKE '%boss%';
UPDATE contract_targets SET image = 'mafiaboss'         WHERE image IS NULL AND name ILIKE '%arquiteto%';

-- Roadmap 4 / 5
UPDATE contract_targets SET image = 'dealer'            WHERE image IS NULL AND name = 'O Infiltrado';
UPDATE contract_targets SET image = 'rich'              WHERE image IS NULL AND name = 'A Executiva Sombra';
UPDATE contract_targets SET image = 'hacker'            WHERE image IS NULL AND name = 'O Hacker Fantasma';
UPDATE contract_targets SET image = 'random1'           WHERE image IS NULL AND name = 'O Conselheiro';
UPDATE contract_targets SET image = 'mafiaboss'         WHERE image IS NULL AND name = 'O Diretor';
UPDATE contract_targets SET image = 'cop'               WHERE image IS NULL AND name = 'A Sombra';
UPDATE contract_targets SET image = 'hacker'            WHERE image IS NULL AND name ILIKE '%hacker%';

-- ─── 3. Deterministic fallback for ANY remaining NULL ────────
-- Spread images across difficulty buckets so the carousel still shows
-- distinct portraits. Uses MOD on a stable hash of the id.
UPDATE contract_targets
SET image = CASE difficulty
  WHEN 'easy'   THEN (ARRAY['thief','random1','dealer','priest'])         [1 + (abs(hashtext(id::text)) % 4)]
  WHEN 'medium' THEN (ARRAY['rich','constructionworker','random1','priest'])[1 + (abs(hashtext(id::text)) % 4)]
  WHEN 'hard'   THEN (ARRAY['brute','cop','mafiaboss','doctorkiller','hacker'])[1 + (abs(hashtext(id::text)) % 5)]
  ELSE 'random1'
END
WHERE image IS NULL OR image = '';

-- ─── 4. Sanity report ────────────────────────────────────────
-- (run this manually to verify)
-- SELECT name, difficulty, image FROM contract_targets ORDER BY roadmap_level, difficulty;
