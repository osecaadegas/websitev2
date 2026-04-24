-- ============================================================
-- 19 — brothel_worker_defs (editable worker catalog)
-- ============================================================

CREATE TABLE IF NOT EXISTS brothel_worker_defs (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  rarity              TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','elite')),
  hire_price          INTEGER NOT NULL DEFAULT 10000,
  hire_uses_crypto    BOOLEAN NOT NULL DEFAULT FALSE,
  earnings_per_hour   INTEGER NOT NULL DEFAULT 300,
  traits              TEXT[] NOT NULL DEFAULT '{}',
  stat_attractiveness INTEGER NOT NULL DEFAULT 50,
  stat_stamina        INTEGER NOT NULL DEFAULT 50,
  stat_mood           INTEGER NOT NULL DEFAULT 50,
  stat_charisma       INTEGER NOT NULL DEFAULT 50,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Seed all 36 workers (ON CONFLICT = skip if already exists)
INSERT INTO brothel_worker_defs (id,slug,name,description,rarity,hire_price,hire_uses_crypto,earnings_per_hour,traits,stat_attractiveness,stat_stamina,stat_mood,stat_charisma,sort_order,enabled) VALUES
('instagram_model','instagram_model','Kylie','100k seguidores. Cada visita ao teu estabelecimento vale mais do que parece. Os clientes pagam só para dizer que a conhecem.','elite',100000,TRUE,520,ARRAY['Influencer','Premium','Famosa'],96,68,90,95,1,TRUE),
('sra_perfeita','sra_perfeita','Perfeita','O nome não é coincidência. Raro existir outra igual no mercado. Quem a conhece não consegue descrever — apenas recomendar.','elite',120000,TRUE,550,ARRAY['Perfeita','Única','Lendária'],97,85,92,98,2,TRUE),
('modelo_russa','modelo_russa','Katya','Ex-modelo de Moscovo. A elegância russa tem um preço — e vale cada cêntimo. Chegou há seis meses e já tem lista de espera.','elite',80000,FALSE,460,ARRAY['Elegante','Premium','Gelada'],93,75,82,89,3,TRUE),
('grandes_assets','grandes_assets','Valentina','Não precisa de apresentação. A fama precede-a. Os clientes de alto valor pedem especificamente por ela.','elite',75000,FALSE,450,ARRAY['Carismática','Premium','Notória'],94,78,86,92,4,TRUE),
('enfermeira_da_twitch','enfermeira_da_twitch','Nurse','Famosa na internet, agora disponível ao vivo. Os fãs pagam premium só para a ver. O teu negócio nunca teve tanta atenção.','elite',90000,TRUE,500,ARRAY['Famosa','Online','Carismática'],92,70,88,96,5,TRUE),
('brazileira','brazileira','Yasmin','O calor do Brasil num estabelecimento do norte. Traz alegria aonde quer que vá. Clientes voltam sempre — e trazem amigos.','elite',65000,FALSE,420,ARRAY['Extrovertida','Carismática','Radiante'],90,82,90,91,6,TRUE),
('neguinha_cara','neguinha_cara','Luxara','Cobra o que quer. E os clientes pagam sem questionar. Tem uma presença que nenhum dinheiro consegue ensinar.','elite',70000,FALSE,430,ARRAY['Premium','Confiante','Intimidante'],91,78,85,90,7,TRUE),
('princessa','princessa','Isabella','Trata-se como realeza. Os clientes também a tratam. Há um protocolo para marcar com ela — e os clientes adoram isso.','elite',72000,FALSE,440,ARRAY['Elegante','Exigente','Real'],89,68,84,88,8,TRUE),
('gotica_tetus2','gotica_tetus2','Lilith','Há uma lista de espera apenas para falar com ela. Não trabalha para todos — escolhe os seus clientes. E isso vale ouro.','elite',58000,FALSE,380,ARRAY['Lendária','Misteriosa','Seletiva'],88,76,72,87,9,TRUE),
('acrobata_flexivel','acrobata_flexivel','Jade','A flexibilidade dela é lendária nos bastidores. Os clientes pagam extra só para a ver chegar. Cada sessão é uma performance.','elite',55000,FALSE,380,ARRAY['Flexível','Artista','Memorável'],88,92,80,83,10,TRUE),
('ruiva_safada','ruiva_safada','Scarlett','A ruiva que toda a gente conhece. Temperamento próprio, resultados garantidos. Uma sessão com ela e os clientes contam a história.','rare',32000,FALSE,295,ARRAY['Picante','Impulsiva','Irresistível'],85,78,70,82,11,TRUE),
('asian_rabbit','asian_rabbit','Mei','Tem um sorriso que vale ouro. Vinda de longe, com uma história para contar. Os clientes ficam fascinados antes mesmo de a conhecer.','rare',35000,FALSE,310,ARRAY['Misteriosa','Discreta','Exótica'],84,78,82,80,12,TRUE),
('chinoca_striper','chinoca_striper','Xiao','Treinada nos melhores clubes de Macau. Sabe como fazer um espetáculo que os clientes não esquecem tão facilmente.','rare',30000,FALSE,300,ARRAY['Elegante','Performista','Disciplinada'],86,80,76,81,13,TRUE),
('russa_safadad','russa_safadad','Vika','Não deixa ninguém indiferente. Alta energia, altos rendimentos. Tem uma reputação que antecede qualquer apresentação.','rare',36000,FALSE,310,ARRAY['Energética','Atrevida','Imparável'],86,82,74,84,14,TRUE),
('19anos_estudante_direito','19anos_estudante_direito','Sofia','Estudante de direito que precisava de um extra. Sabe como negociar qualquer coisa. Inteligente, ambiciosa e sem escrúpulos.','rare',28000,FALSE,280,ARRAY['Inteligente','Ambiciosa','Persuasiva'],82,65,78,79,15,TRUE),
('russa','russa','Nadia','A frieza russa esconde um fogo interior. Os clientes voltam para descobrir mais. Nunca diz mais do que o necessário.','rare',28000,FALSE,280,ARRAY['Misteriosa','Reservada','Intensa'],82,76,68,77,16,TRUE),
('estudante_europea','estudante_europea','Elena','De Praga para cá. Tem a classe europeia que os clientes de alto valor procuram. Fala três línguas e usa isso a seu favor.','rare',27000,FALSE,285,ARRAY['Elegante','Culta','Ambiciosa'],83,72,79,78,17,TRUE),
('gotica_tets','gotica_tets','Morgana','A escuridão atrai. Os clientes que a procuram nunca mais querem outra. Tem um nicho muito específico — e muito fiel.','rare',26000,FALSE,265,ARRAY['Misteriosa','Única','Nicho'],79,74,65,76,18,TRUE),
('acrobata','acrobata','Luna','Ex-ginasta que trocou os holofotes por algo mais lucrativo. A resistência física dela é incomparável. Nunca se queixa.','rare',22000,FALSE,260,ARRAY['Flexível','Resistente','Atlética'],75,95,72,71,19,TRUE),
('lider_claque','lider_claque','Raquel','Lidera multidões. O teu negócio nunca esteve tão animado. Sabe criar uma atmosfera que os clientes pagam para respirar.','rare',23000,FALSE,275,ARRAY['Extrovertida','Motivadora','Animada'],77,85,88,82,20,TRUE),
('preta_pau','preta_pau','Ebony','Profissional de alto calibre. Sabe exatamente o que vale no mercado e não aceita menos do que isso. Experiência garantida.','rare',25000,FALSE,270,ARRAY['Profissional','Direta','Confiante'],80,80,78,78,21,TRUE),
('tia_cascais3','tia_cascais3','Leonor','A mais refinada das três de Cascais. Uma reputação que atrai clientela seleta que não se mistura com qualquer coisa.','rare',20000,FALSE,250,ARRAY['Refinada','Elegante','Selectiva'],76,70,80,74,22,TRUE),
('atleta','atleta','Diana','A disciplina atlética aplica-se a tudo o que faz. Clientes nunca saem desiludidos. A resistência dela é a melhor do negócio.','rare',24000,FALSE,270,ARRAY['Determinada','Resistente','Focada'],78,98,75,73,23,TRUE),
('loira_do_pau','loira_do_pau','Stacy','Clássica. Eficiente. Sempre disponível. Um pilar do estabelecimento que os clientes regulares já conhecem pelo nome.','common',12000,FALSE,155,ARRAY['Confiável','Clássica','Regular'],66,74,68,62,24,TRUE),
('neguinha','neguinha','Nia','Energética e dedicada. Os clientes pedem sempre para voltar. Tem uma naturalidade que ninguém consegue fingir.','common',13000,FALSE,160,ARRAY['Energética','Simpática','Natural'],68,82,76,66,25,TRUE),
('russa2','russa2','Olga','Segunda opção nunca soou tão bem. Competente, discreta, e faz o trabalho sem drama. Um ativo silencioso do negócio.','common',11500,FALSE,148,ARRAY['Discreta','Competente','Silenciosa'],63,74,66,60,26,TRUE),
('cadela','cadela','Bia','Tem atitude própria. Às vezes rebelde, mas os clientes adoram. Uma instabilidade calculada que acaba por fidelizar.','common',10000,FALSE,140,ARRAY['Teimosa','Atrevida','Imprevisível'],65,68,58,63,27,TRUE),
('casual_1','casual_1','Ana','Parece completamente normal. E é exatamente isso que a torna especial. Os clientes relaxam com ela de uma forma que não conseguem explicar.','common',10000,FALSE,145,ARRAY['Simpática','Natural','Reconfortante'],62,72,70,64,28,TRUE),
('cabra','cabra','Carla','Sabe trabalhar. Não faz perguntas, não cria problemas. Um investimento sólido e previsível. O que todo o negócio precisa.','common',11000,FALSE,150,ARRAY['Discreta','Eficiente','Estável'],60,70,62,58,29,TRUE),
('timida','timida','Sara','Tímida só no nome. Com tempo e carinho, floresce como nenhuma outra. Os clientes mais pacientes voltam sempre por ela.','common',10500,FALSE,140,ARRAY['Tímida','Leal','Crescente'],62,72,74,60,30,TRUE),
('tia_cascais','tia_cascais','Cristina','Cascais no nome, charme genuíno na prática. A clientela mais velha adora. Traz um conforto que nenhuma jovem consegue replicar.','common',10000,FALSE,138,ARRAY['Caseira','Reconfortante','Fiel'],60,68,78,65,31,TRUE),
('tia_cascais2','tia_cascais2','Mafalda','A segunda de Cascais, mas não em qualidade. Tem um conjunto de clientes fiéis que não trocam por nada.','common',8500,FALSE,125,ARRAY['Caseira','Simpática','Discreta'],56,66,75,60,32,TRUE),
('tia_cabedal','tia_cabedal','Fátima','Experiência conta. Décadas de conhecimento condensado num sorriso. Os novatos subestimam-na. Os clientes antigos sabem melhor.','common',9000,FALSE,130,ARRAY['Experiente','Fiel','Sábia'],58,70,82,68,33,TRUE),
('limpesa','limpesa','Rosa','Começou a limpar o estabelecimento. Ficou pelo negócio. Tem um charme caseiro que agrada a uma clientela muito específica.','common',8000,FALSE,125,ARRAY['Honesta','Simpática','Dedicada'],55,80,72,58,34,TRUE),
('alcolica','alcolica','Vera','Funciona melhor depois do terceiro copo. Os clientes gostam da autenticidade dela. Nunca sóbria, nunca previsível.','common',9000,FALSE,130,ARRAY['Descontraída','Imprevisível','Autêntica'],55,40,60,62,35,TRUE),
('mulher_gorda','mulher_gorda','Bertha','Um nicho muito específico com clientela de retorno garantido. Autenticidade pura. Os números são consistentes há anos.','common',9500,FALSE,135,ARRAY['Autêntica','Fiel','Consistente'],58,65,80,65,36,TRUE)
ON CONFLICT (id) DO NOTHING;
