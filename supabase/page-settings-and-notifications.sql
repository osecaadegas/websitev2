-- ═══════════════════════════════════════════════════════════════
-- PAGE SETTINGS TABLE
-- ═══════════════════════════════════════════════════════════════

create table if not exists page_settings (
  id uuid primary key default gen_random_uuid(),
  page_slug text unique not null,
  page_name text not null,
  background_image text,
  hero_image text,
  effect text default 'none' check (effect in ('none', 'snow', 'rain', 'thunder', 'fireflies', 'embers')),
  effect_intensity numeric default 1 check (effect_intensity between 0 and 2),
  overlay_opacity numeric default 0.6 check (overlay_opacity between 0 and 1),
  bg_brightness numeric default 0.35 check (bg_brightness between 0 and 2),
  bg_saturation numeric default 0.7 check (bg_saturation between 0 and 2),
  bg_contrast numeric default 0.95 check (bg_contrast between 0 and 2),
  bg_position_x numeric default 50 check (bg_position_x between 0 and 100),
  bg_position_y numeric default 50 check (bg_position_y between 0 and 100),
  bg_zoom numeric default 100 check (bg_zoom between 50 and 200),
  bg_color text default '#000000',
  updated_at timestamptz default now()
);

-- Insert default pages
insert into page_settings (page_slug, page_name) values
  ('home', 'Home'),
  ('jogos', 'Jogos'),
  ('comunidade', 'Comunidade'),
  ('daily-session', 'Sessão do Dia'),
  ('adivinha-o-resultado', 'Adivinha o Resultado'),
  ('moderador', 'Moderador'),
  ('hall-of-victories', 'Bruta do Mês'),
  ('perfil', 'Perfil'),
  ('politica-de-privacidade', 'Política de Privacidade'),
  ('politica-de-cookies', 'Política de Cookies'),
  ('termos-e-condicoes', 'Termos e Condições'),
  ('sobre', 'Sobre'),
  ('ofertas', 'Ofertas'),
  ('live', 'Live'),
  ('stream', 'Stream'),
  ('loja', 'Loja'),
  ('calendario', 'Calendário'),
  ('bonus-hunt', 'Bonus Hunt'),
  ('giveaways', 'Giveaways'),
  ('destaques', 'Destaques'),
  ('roda-diaria', 'Roda Diária'),
  ('liga-dos-secas', 'Liga dos Secas'),
  ('admin', 'Admin')
on conflict (page_slug) do nothing;

-- RLS Policies
alter table page_settings enable row level security;

drop policy if exists "Public read access" on page_settings;
drop policy if exists "Admins can update" on page_settings;

create policy "Public read access" on page_settings
  for select using (true);

create policy "Admins can update" on page_settings
  for update using (true);  -- You can add admin role check here later


-- ═══════════════════════════════════════════════════════════════
-- NOTIFICATIONS TABLE
-- ═══════════════════════════════════════════════════════════════

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_twitch_id text not null,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'success', 'warning', 'error')),
  read boolean default false,
  created_at timestamptz default now()
);

-- Index for faster lookups
create index if not exists idx_notifications_user on notifications(user_twitch_id, created_at desc);

-- RLS Policies
alter table notifications enable row level security;

drop policy if exists "Users can read own notifications" on notifications;
drop policy if exists "System can insert notifications" on notifications;
drop policy if exists "Users can update own notifications" on notifications;

create policy "Users can read own notifications" on notifications
  for select using (true);  -- In production, add: user_twitch_id = auth.uid()

create policy "System can insert notifications" on notifications
  for insert with check (true);  -- In production, restrict this

create policy "Users can update own notifications" on notifications
  for update using (true);  -- In production, add: user_twitch_id = auth.uid()
