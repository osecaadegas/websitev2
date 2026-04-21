-- ============================================================
-- Arena Gladiator — Supabase Database Schema
-- Run this in Supabase SQL Editor to set up all tables.
-- ============================================================

-- Bonus Hunt Sessions
create table if not exists bonus_hunt_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Bonus Hunt',
  status text not null default 'active' check (status in ('active', 'completed', 'upcoming')),
  phase text not null default 'hunting' check (phase in ('hunting', 'opening', 'completed')),
  currency text not null default '€',
  total_buy numeric not null default 0,
  total_result numeric not null default 0,
  start_money numeric not null default 0,
  stop_loss numeric not null default 0,
  profit numeric not null default 0,
  bonus_count integer not null default 0,
  bonuses_opened integer not null default 0,
  avg_multi numeric not null default 0,
  best_multi numeric not null default 0,
  best_slot_name text,
  hunt_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Bonus Hunt Slots
create table if not exists bonus_hunt_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references bonus_hunt_sessions(id) on delete cascade,
  name text not null,
  provider text,
  buy_value numeric not null default 0,
  potential_multiplier numeric not null default 0,
  result numeric,
  bet_size numeric,
  rtp numeric,
  volatility text,
  is_super_bonus boolean not null default false,
  is_extreme_bonus boolean not null default false,
  opened boolean not null default false,
  payout numeric,
  special text,
  thumbnail_url text,
  status text not null default 'pending' check (status in ('pending', 'active', 'completed')),
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_bonus_hunt_slots_session on bonus_hunt_slots(session_id);

-- Slot Requests
create table if not exists slot_requests (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  slot_name text not null,
  status text not null default 'queued' check (status in ('queued', 'playing', 'done')),
  points_cost integer not null default 0,
  created_at timestamptz not null default now()
);

-- Leaderboard
create table if not exists leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_name text not null unique,
  display_name text not null,
  avatar_url text,
  total_points integer not null default 0,
  biggest_win numeric not null default 0,
  rank text not null default 'recruit' check (rank in ('recruit', 'warrior', 'champion', 'legend')),
  created_at timestamptz not null default now()
);

create index idx_leaderboard_points on leaderboard(total_points desc);

-- Casino Affiliates (for CMS-driven casino pages)
create table if not exists casino_affiliates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  rating numeric not null default 0 check (rating >= 0 and rating <= 5),
  bonus_text text not null default '',
  bonus_details text not null default '',
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  supported_countries text[] not null default '{}',
  affiliate_url text not null default '',
  review_body text not null default '',
  faq jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Casino Offers (admin-managed partnerships)
create table if not exists casino_offers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  logo_bg text not null default '#666',
  banner_url text,
  badge text check (badge in ('NEW', 'HOT', 'ELITE', null)),
  tags text[] not null default '{}',
  headline text not null,
  bonus_value text not null,
  free_spins text not null default '',
  min_deposit text not null,
  code text not null default '',
  cashback text,
  withdraw_time text not null default 'Up to 48h',
  license text not null default 'Curaçao',
  established text not null default '2023',
  notes text[] not null default '{}',
  affiliate_url text not null default '#',
  rating numeric(2,1) not null default 4.5 check (rating >= 0 and rating <= 5),
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_casino_offers_visible on casino_offers(visible, sort_order);

-- Users (Twitch-authenticated, with roles)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  twitch_id text not null unique,
  login text not null,
  display_name text not null,
  profile_image_url text,
  email text,
  ip_address text,
  se_username text,
  discord_username text,
  role text not null default 'viewer' check (role in ('admin', 'configurador', 'moderador', 'viewer')),
  role_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_twitch_id on users(twitch_id);

-- Enable Realtime for bonus hunt tracking
alter publication supabase_realtime add table bonus_hunt_slots;
alter publication supabase_realtime add table slot_requests;
alter publication supabase_realtime add table spin_history;

-- Row Level Security (RLS)
alter table bonus_hunt_sessions enable row level security;
alter table bonus_hunt_slots enable row level security;
alter table slot_requests enable row level security;
alter table leaderboard enable row level security;
alter table casino_affiliates enable row level security;

-- Public read access
create policy "Public read sessions" on bonus_hunt_sessions for select using (true);
create policy "Public read slots" on bonus_hunt_slots for select using (true);
create policy "Public read requests" on slot_requests for select using (true);
create policy "Public read leaderboard" on leaderboard for select using (true);
create policy "Public read casinos" on casino_affiliates for select using (true);

-- Insert policy for slot requests (anyone can request)
create policy "Anyone can request slots" on slot_requests for insert with check (true);

-- Spin history: public read + insert
alter table spin_history enable row level security;
create policy "Public read spin history" on spin_history for select using (true);
create policy "Anyone can insert spin history" on spin_history for insert with check (true);

-- Casino offers: public read, authenticated full access
alter table casino_offers enable row level security;
create policy "Public read visible offers" on casino_offers for select using (true);
create policy "Admin insert offers" on casino_offers for insert with check (true);
create policy "Admin update offers" on casino_offers for update using (true);
create policy "Admin delete offers" on casino_offers for delete using (true);

-- Users: public read, admin-only write
alter table users enable row level security;
create policy "Public read users" on users for select using (true);
create policy "Admin insert users" on users for insert with check (true);
create policy "Admin update users" on users for update using (true);
create policy "Admin delete users" on users for delete using (true);

-- Notifications (giveaway wins, adivinha o resultado, etc.)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_twitch_id text not null references users(twitch_id) on delete cascade,
  type text not null check (type in ('giveaway_win', 'guess_result_win', 'general')),
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications(user_twitch_id, created_at desc);

alter table notifications enable row level security;
create policy "Users read own notifications" on notifications for select using (true);
create policy "Admin insert notifications" on notifications for insert with check (true);
create policy "Admin update notifications" on notifications for update using (true);
create policy "Admin delete notifications" on notifications for delete using (true);

-- Rewards (Reward Armory store items)
create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  image text,
  cost integer not null default 0,
  type text not null default 'custom' check (type in ('deposit', 'ticket', 'gift', 'cash', 'custom')),
  tier text not null default 'common' check (tier in ('common', 'elite', 'legendary')),
  stock integer,
  cooldown integer,
  vip_only boolean not null default false,
  vip_level_required integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rewards_active on rewards(active, sort_order);

-- Reward redemptions (tracks who redeemed what)
create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id) on delete cascade,
  user_twitch_id text not null references users(twitch_id) on delete cascade,
  cost integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_redemptions_user on reward_redemptions(user_twitch_id, created_at desc);
create index idx_redemptions_reward on reward_redemptions(reward_id, created_at desc);

alter table rewards enable row level security;
create policy "Public read rewards" on rewards for select using (true);
create policy "Admin insert rewards" on rewards for insert with check (true);
create policy "Admin update rewards" on rewards for update using (true);
create policy "Admin delete rewards" on rewards for delete using (true);

alter table reward_redemptions enable row level security;
create policy "Public read redemptions" on reward_redemptions for select using (true);
create policy "Insert redemptions" on reward_redemptions for insert with check (true);
create policy "Admin update redemptions" on reward_redemptions for update using (true);

-- ============================================================
-- Analytics System — Session, Event, and Fraud Tracking
-- ============================================================

-- Analytics Sessions (visitor tracking)
create table if not exists analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  session_token text not null unique,
  ip_address text not null,
  user_agent text,
  country text,
  city text,
  region text,
  isp text,
  referrer text,
  referrer_source text check (referrer_source in ('direct', 'twitch', 'social', 'search', 'other')),
  is_suspicious boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index idx_analytics_sessions_token on analytics_sessions(session_token);
create index idx_analytics_sessions_user on analytics_sessions(user_id);
create index idx_analytics_sessions_ip on analytics_sessions(ip_address);
create index idx_analytics_sessions_created on analytics_sessions(created_at desc);
create index idx_analytics_sessions_country on analytics_sessions(country);

-- Analytics Events (page views, clicks, conversions)
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references analytics_sessions(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  event_type text not null check (event_type in ('pageview', 'click', 'offer_click', 'external_link', 'conversion', 'button_click')),
  page_url text,
  offer_id uuid references casino_offers(id) on delete set null,
  metadata jsonb not null default '{}',
  ip_address text,
  country text,
  city text,
  is_suspicious boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_analytics_events_session on analytics_events(session_id);
create index idx_analytics_events_user on analytics_events(user_id);
create index idx_analytics_events_type on analytics_events(event_type);
create index idx_analytics_events_created on analytics_events(created_at desc);
create index idx_analytics_events_offer on analytics_events(offer_id) where offer_id is not null;
create index idx_analytics_events_page on analytics_events(page_url);

-- Fraud Logs (suspicious activity records)
create table if not exists fraud_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references analytics_sessions(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  ip_address text not null,
  reason text not null,
  risk_score integer not null default 0 check (risk_score >= 0 and risk_score <= 100),
  metadata jsonb not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_fraud_logs_session on fraud_logs(session_id);
create index idx_fraud_logs_ip on fraud_logs(ip_address);
create index idx_fraud_logs_score on fraud_logs(risk_score desc);
create index idx_fraud_logs_created on fraud_logs(created_at desc);

-- IP Geolocation Cache (avoid repeated API calls)
create table if not exists geo_cache (
  ip_address text primary key,
  country text,
  city text,
  region text,
  isp text,
  cached_at timestamptz not null default now()
);

-- Fraud Detection Config (adjustable thresholds)
create table if not exists fraud_config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value integer not null,
  description text,
  updated_at timestamptz not null default now()
);

-- Default fraud thresholds
insert into fraud_config (key, value, description) values
  ('max_clicks_per_10s', 10, 'Max clicks allowed in 10 seconds per session'),
  ('max_same_offer_clicks_per_hour', 5, 'Max clicks on same offer per hour'),
  ('max_sessions_per_ip_per_hour', 10, 'Max new sessions from same IP in 1 hour'),
  ('risk_threshold_flag', 50, 'Risk score to auto-flag as suspicious'),
  ('risk_threshold_block', 80, 'Risk score to block session')
on conflict (key) do nothing;

-- RLS for analytics tables
alter table analytics_sessions enable row level security;
create policy "Admin read sessions" on analytics_sessions for select using (true);
create policy "Insert sessions" on analytics_sessions for insert with check (true);
create policy "Update sessions" on analytics_sessions for update using (true);

alter table analytics_events enable row level security;
create policy "Admin read events" on analytics_events for select using (true);
create policy "Insert events" on analytics_events for insert with check (true);

alter table fraud_logs enable row level security;
create policy "Admin read fraud" on fraud_logs for select using (true);
create policy "Insert fraud" on fraud_logs for insert with check (true);
create policy "Update fraud" on fraud_logs for update using (true);

alter table geo_cache enable row level security;
create policy "Read geo cache" on geo_cache for select using (true);
create policy "Insert geo cache" on geo_cache for insert with check (true);
create policy "Update geo cache" on geo_cache for update using (true);

alter table fraud_config enable row level security;
create policy "Read fraud config" on fraud_config for select using (true);
create policy "Admin update fraud config" on fraud_config for update using (true);

-- Enable realtime for live dashboard
alter publication supabase_realtime add table analytics_events;
alter publication supabase_realtime add table analytics_sessions;
alter publication supabase_realtime add table fraud_logs;

-- GDPR: data deletion function
create or replace function delete_user_analytics(target_user_id uuid)
returns void as $$
begin
  delete from analytics_events where user_id = target_user_id;
  delete from fraud_logs where user_id = target_user_id;
  delete from analytics_sessions where user_id = target_user_id;
end;
$$ language plpgsql security definer;

-- GDPR: delete by IP
create or replace function delete_ip_analytics(target_ip text)
returns void as $$
begin
  delete from analytics_events where ip_address = target_ip;
  delete from fraud_logs where ip_address = target_ip;
  delete from analytics_sessions where ip_address = target_ip;
  delete from geo_cache where ip_address = target_ip;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Daily Sessions — "Sessão do Dia" Tracking
-- ============================================================

create table if not exists daily_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Sessão do Dia',
  session_date date not null default current_date,
  casino_id uuid references casino_offers(id) on delete set null,
  spotify_url text,
  deposits numeric(12,2) not null default 0,
  withdrawals numeric(12,2) not null default 0,
  bonuses_count integer not null default 0,
  biggest_win numeric(12,2) not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_daily_sessions_active on daily_sessions(is_active) where is_active = true;
create index idx_daily_sessions_date on daily_sessions(session_date desc);

alter table daily_sessions enable row level security;
create policy "Public read daily sessions" on daily_sessions for select using (true);
create policy "Admin insert daily sessions" on daily_sessions for insert with check (true);
create policy "Admin update daily sessions" on daily_sessions for update using (true);
create policy "Admin delete daily sessions" on daily_sessions for delete using (true);

-- Enable realtime for live stat updates
alter publication supabase_realtime add table daily_sessions;

-- ============================================================
-- Spin History (log of every wheel spin)
-- ============================================================
create table if not exists spin_history (
  id uuid primary key default gen_random_uuid(),
  player text not null,
  reward text not null,
  icon text not null default '',
  color text not null default '',
  tier text not null default 'common',
  created_at timestamptz not null default now()
);

create index if not exists idx_spin_history_created on spin_history(created_at desc);

-- ============================================================
-- Wheel Segments — Admin-configurable wheel prizes
-- ============================================================
create table if not exists wheel_segments (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text not null default '🎁',
  color text not null default '#d4a843',
  glow_color text not null default 'rgba(212,168,67,0.5)',
  tier text not null default 'common' check (tier in ('legendary', 'epic', 'rare', 'common', 'loss')),
  reward_type text not null default 'SE_POINTS' check (reward_type in ('SE_POINTS', 'FREE_SPIN', 'CUSTOM')),
  reward_value numeric not null default 0,
  weight integer not null default 10 check (weight >= 1),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wheel_segments_active on wheel_segments(is_active, sort_order);

alter table wheel_segments enable row level security;
create policy "Public read wheel segments" on wheel_segments for select using (true);
create policy "Admin insert wheel segments" on wheel_segments for insert with check (true);
create policy "Admin update wheel segments" on wheel_segments for update using (true);
create policy "Admin delete wheel segments" on wheel_segments for delete using (true);

-- Wheel Config — Global wheel settings
create table if not exists wheel_config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table wheel_config enable row level security;
create policy "Public read wheel config" on wheel_config for select using (true);
create policy "Admin insert wheel config" on wheel_config for insert with check (true);
create policy "Admin update wheel config" on wheel_config for update using (true);

-- Default wheel config
insert into wheel_config (key, value) values
  ('free_spin_enabled', 'true'),
  ('max_free_spins_per_day', '1'),
  ('chain_limit', '3')
on conflict (key) do nothing;

-- Enable realtime for wheel segments
alter publication supabase_realtime add table wheel_segments;

-- ============================================================
-- Scheduled Streams — Calendar of upcoming live streams
-- ============================================================
create table if not exists scheduled_streams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  stream_date date not null,
  start_time time not null default '18:00',
  end_time time,
  categories text[] not null default '{Slots}',
  casino text,
  is_special boolean not null default false,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scheduled_streams_date on scheduled_streams(stream_date desc);

alter table scheduled_streams enable row level security;
create policy "Public read scheduled streams" on scheduled_streams for select using (true);
create policy "Admin insert scheduled streams" on scheduled_streams for insert with check (true);
create policy "Admin update scheduled streams" on scheduled_streams for update using (true);
create policy "Admin delete scheduled streams" on scheduled_streams for delete using (true);

alter publication supabase_realtime add table scheduled_streams;

-- ============================================================
-- Liga dos Secas — Yearly Leaderboard Hall of Fame
-- ============================================================

-- Leaderboard Years
create table if not exists leaderboard_years (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  is_active boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_leaderboard_years_year on leaderboard_years(year desc);

-- Leaderboard Entries (12 months per year)
create table if not exists leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references leaderboard_years(id) on delete cascade,
  month integer not null check (month >= 1 and month <= 12),
  winner_name text not null default '',
  winner_avatar text,
  updated_at timestamptz not null default now(),
  unique(year_id, month)
);

create index if not exists idx_leaderboard_entries_year on leaderboard_entries(year_id, month);

alter table leaderboard_years enable row level security;
create policy "Public read leaderboard years" on leaderboard_years for select using (true);
create policy "Admin insert leaderboard years" on leaderboard_years for insert with check (true);
create policy "Admin update leaderboard years" on leaderboard_years for update using (true);
create policy "Admin delete leaderboard years" on leaderboard_years for delete using (true);

alter table leaderboard_entries enable row level security;
create policy "Public read leaderboard entries" on leaderboard_entries for select using (true);
create policy "Admin insert leaderboard entries" on leaderboard_entries for insert with check (true);
create policy "Admin update leaderboard entries" on leaderboard_entries for update using (true);
create policy "Admin delete leaderboard entries" on leaderboard_entries for delete using (true);

-- ============================================================
-- Page Settings — per-page background images & visual effects
-- ============================================================
create table if not exists page_settings (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null unique,
  page_name text not null,
  background_image text,
  hero_image text,
  effect text not null default 'none' check (effect in ('none', 'snow', 'rain', 'thunder', 'fireflies', 'embers')),
  effect_intensity numeric not null default 1.0 check (effect_intensity >= 0 and effect_intensity <= 2),
  overlay_opacity numeric not null default 0.6 check (overlay_opacity >= 0 and overlay_opacity <= 1),
  bg_brightness numeric not null default 0.35 check (bg_brightness >= 0 and bg_brightness <= 1),
  bg_saturation numeric not null default 0.7 check (bg_saturation >= 0 and bg_saturation <= 2),
  bg_contrast numeric not null default 0.95 check (bg_contrast >= 0 and bg_contrast <= 2),
  bg_position_x integer not null default 50 check (bg_position_x >= 0 and bg_position_x <= 100),
  bg_position_y integer not null default 50 check (bg_position_y >= 0 and bg_position_y <= 100),
  bg_zoom numeric not null default 100 check (bg_zoom >= 50 and bg_zoom <= 200),
  bg_color text not null default '#000000',
  updated_at timestamptz not null default now()
);

alter table page_settings enable row level security;
create policy "Public read page settings" on page_settings for select using (true);
create policy "Admin insert page settings" on page_settings for insert with check (true);
create policy "Admin update page settings" on page_settings for update using (true);
create policy "Admin delete page settings" on page_settings for delete using (true);

-- Seed default pages
insert into page_settings (page_slug, page_name) values
  ('home', 'Página Inicial'),
  ('ofertas', 'Ofertas'),
  ('casinos', 'Casinos'),
  ('destaques', 'Destaques'),
  ('stream', 'Stream'),
  ('liga-dos-secas', 'Liga dos Secas'),
  ('torneio', 'Torneio'),
  ('loja', 'Loja'),
  ('contactos', 'Contactos'),
  ('sobre', 'Sobre'),
  ('bonus-hunt', 'Bonus Hunt'),
  ('roda-diaria', 'Roda Diária'),
  ('leaderboard', 'Leaderboard'),
  ('giveaways', 'Giveaways'),
  ('live', 'Live'),
  ('slots', 'Slots'),
  ('calendario', 'Calendário'),
  ('daily-session', 'Sessão do Dia'),
  ('adivinha-o-resultado', 'Adivinha o Resultado'),
  ('perfil', 'Perfil'),
  ('moderador', 'Moderador'),
  ('politica-de-privacidade', 'Política de Privacidade'),
  ('politica-de-cookies', 'Política de Cookies'),
  ('termos-e-condicoes', 'Termos e Condições')
on conflict (page_slug) do nothing;

-- ============================================================
-- Giveaway System — Arena Giveaways with SE Points + Twitch Chat
-- ============================================================

-- Giveaways
create table if not exists giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  mode text not null default 'single' check (mode in ('single', 'tickets')),
  ticket_cost integer not null default 0,
  max_entries_per_user integer,
  prize text not null default '',
  prize_image text,
  duration_seconds integer not null default 300,
  scheduled_end timestamptz,
  start_time timestamptz,
  end_time timestamptz,
  is_active boolean not null default false,
  is_ended boolean not null default false,
  chat_command text not null default '!enter',
  require_live boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_giveaways_active on giveaways(is_active) where is_active = true;
create index idx_giveaways_created on giveaways(created_at desc);

-- Giveaway Participants
create table if not exists giveaway_participants (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references giveaways(id) on delete cascade,
  twitch_id text not null,
  twitch_username text not null,
  tickets integer not null default 1,
  total_points_spent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(giveaway_id, twitch_id)
);

create index idx_giveaway_participants_giveaway on giveaway_participants(giveaway_id);
create index idx_giveaway_participants_user on giveaway_participants(twitch_id);

-- Giveaway Winners
create table if not exists giveaway_winners (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references giveaways(id) on delete cascade,
  twitch_id text not null,
  twitch_username text not null,
  selected_at timestamptz not null default now()
);

create index idx_giveaway_winners_giveaway on giveaway_winners(giveaway_id);

-- RLS
alter table giveaways enable row level security;
create policy "Public read giveaways" on giveaways for select using (true);
create policy "Admin insert giveaways" on giveaways for insert with check (true);
create policy "Admin update giveaways" on giveaways for update using (true);
create policy "Admin delete giveaways" on giveaways for delete using (true);

alter table giveaway_participants enable row level security;
create policy "Public read giveaway participants" on giveaway_participants for select using (true);
create policy "Insert giveaway participants" on giveaway_participants for insert with check (true);
create policy "Update giveaway participants" on giveaway_participants for update using (true);

alter table giveaway_winners enable row level security;
create policy "Public read giveaway winners" on giveaway_winners for select using (true);
create policy "Admin insert giveaway winners" on giveaway_winners for insert with check (true);

-- Enable realtime for live participant updates
alter publication supabase_realtime add table giveaway_participants;
alter publication supabase_realtime add table giveaways;
