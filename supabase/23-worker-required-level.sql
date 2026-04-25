-- ============================================================
-- 23 — Add required_level to brothel_worker_defs
-- ============================================================
-- The required_level column was never added to the DB table.
-- The code worked via a static fallback in worker-defs.ts.
-- This migration makes the DB the source of truth.
-- ============================================================

ALTER TABLE brothel_worker_defs
  ADD COLUMN IF NOT EXISTS required_level INT NOT NULL DEFAULT 1;

-- Populate from static worker-defs.ts values
UPDATE brothel_worker_defs SET required_level = 103 WHERE slug = 'instagram_model';
UPDATE brothel_worker_defs SET required_level = 106 WHERE slug = 'sra_perfeita';
UPDATE brothel_worker_defs SET required_level = 97  WHERE slug = 'modelo_russa';
UPDATE brothel_worker_defs SET required_level = 94  WHERE slug = 'grandes_assets';
UPDATE brothel_worker_defs SET required_level = 100 WHERE slug = 'enfermeira_da_twitch';
UPDATE brothel_worker_defs SET required_level = 85  WHERE slug = 'brazileira';
UPDATE brothel_worker_defs SET required_level = 88  WHERE slug = 'neguinha_cara';
UPDATE brothel_worker_defs SET required_level = 91  WHERE slug = 'princessa';
UPDATE brothel_worker_defs SET required_level = 82  WHERE slug = 'gotica_tetus2';
UPDATE brothel_worker_defs SET required_level = 79  WHERE slug = 'acrobata_flexivel';
UPDATE brothel_worker_defs SET required_level = 70  WHERE slug = 'ruiva_safada';
UPDATE brothel_worker_defs SET required_level = 73  WHERE slug = 'asian_rabbit';
UPDATE brothel_worker_defs SET required_level = 67  WHERE slug = 'chinoca_striper';
UPDATE brothel_worker_defs SET required_level = 76  WHERE slug = 'russa_safadad';
UPDATE brothel_worker_defs SET required_level = 61  WHERE slug = '19anos_estudante_direito';
UPDATE brothel_worker_defs SET required_level = 64  WHERE slug = 'russa';
UPDATE brothel_worker_defs SET required_level = 58  WHERE slug = 'estudante_europea';
UPDATE brothel_worker_defs SET required_level = 55  WHERE slug = 'gotica_tets';
UPDATE brothel_worker_defs SET required_level = 43  WHERE slug = 'acrobata';
UPDATE brothel_worker_defs SET required_level = 46  WHERE slug = 'lider_claque';
UPDATE brothel_worker_defs SET required_level = 52  WHERE slug = 'preta_pau';
UPDATE brothel_worker_defs SET required_level = 40  WHERE slug = 'tia_cascais3';
UPDATE brothel_worker_defs SET required_level = 49  WHERE slug = 'atleta';
UPDATE brothel_worker_defs SET required_level = 34  WHERE slug = 'loira_do_pau';
UPDATE brothel_worker_defs SET required_level = 37  WHERE slug = 'neguinha';
UPDATE brothel_worker_defs SET required_level = 31  WHERE slug = 'russa2';
UPDATE brothel_worker_defs SET required_level = 16  WHERE slug = 'cadela';
UPDATE brothel_worker_defs SET required_level = 19  WHERE slug = 'casual_1';
UPDATE brothel_worker_defs SET required_level = 28  WHERE slug = 'cabra';
UPDATE brothel_worker_defs SET required_level = 25  WHERE slug = 'timida';
UPDATE brothel_worker_defs SET required_level = 22  WHERE slug = 'tia_cascais';
UPDATE brothel_worker_defs SET required_level = 4   WHERE slug = 'tia_cascais2';
UPDATE brothel_worker_defs SET required_level = 7   WHERE slug = 'tia_cabedal';
UPDATE brothel_worker_defs SET required_level = 1   WHERE slug = 'limpesa';
UPDATE brothel_worker_defs SET required_level = 10  WHERE slug = 'alcolica';
UPDATE brothel_worker_defs SET required_level = 13  WHERE slug = 'mulher_gorda';
