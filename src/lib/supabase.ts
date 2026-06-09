import { createClient } from "@supabase/supabase-js";

// Trim trailing slashes and whitespace to prevent malformed WebSocket URLs
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");

/* â”€â”€ Database Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   These mirror the Supabase tables used by the arena platform.
   bonus_hunts: tracks active/past bonus hunt sessions
   slot_requests: user-submitted slot requests via !sr
   leaderboard: gladiator rank progression
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface BonusHuntSession {
  id: string;
  title: string;
  status: "active" | "completed" | "upcoming";
  phase: "hunting" | "opening" | "completed";
  currency: string;
  total_buy: number;
  total_result: number;
  start_money: number;
  stop_loss: number;
  profit: number;
  bonus_count: number;
  bonuses_opened: number;
  avg_multi: number;
  best_multi: number;
  best_slot_name?: string;
  hunt_date?: string;
  created_at: string;
  completed_at?: string;
}

export interface BonusHuntSlot {
  id: string;
  name: string;
  provider?: string;
  buy_value: number;
  potential_multiplier: number;
  result?: number;
  bet_size?: number;
  rtp?: number;
  volatility?: string;
  is_super_bonus: boolean;
  is_extreme_bonus: boolean;
  opened: boolean;
  payout?: number;
  special?: string;
  thumbnail_url?: string;
  status: "pending" | "active" | "completed";
  order_index: number;
  session_id: string;
  created_at: string;
}

export interface SlotRequest {
  id: string;
  user_name: string;
  slot_name: string;
  status: "queued" | "playing" | "done";
  points_cost: number;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  user_name: string;
  display_name: string;
  avatar_url?: string;
  total_points: number;
  biggest_win: number;
  rank: "recruit" | "warrior" | "champion" | "legend";
  created_at: string;
}

export interface CasinoAffiliate {
  id: string;
  slug: string;
  name: string;
  logo_url: string;
  rating: number;
  bonus_text: string;
  bonus_details: string;
  pros: string[];
  cons: string[];
  supported_countries: string[];
  affiliate_url: string;
  review_body: string;
  faq: { question: string; answer: string }[];
  created_at: string;
}

export interface SpinHistoryRow {
  id: string;
  player: string;
  reward: string;
  icon: string;
  color: string;
  tier: string;
  created_at: string;
}

export type UserRole = "admin" | "configurador" | "moderador" | "viewer";

export interface UserRow {
  id: string;
  twitch_id: string;
  login: string;
  display_name: string;
  profile_image_url: string | null;
  email: string | null;
  ip_address: string | null;
  se_username: string | null;
  discord_username: string | null;
  role: UserRole;
  role_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WelcomeBonusStage {
  label: string;  // "1ST", "2ND", "3RD", "4TH"
  pct: string;    // "120%"
  fs?: string;    // "100 FS"
  min: string;    // "5€"
}

export interface CasinoOfferRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  logo_bg: string;
  banner_url: string | null;
  badge: "NEW" | "HOT" | "ELITE" | null;
  tags: string[];
  headline: string;
  bonus_value: string;
  free_spins: string;
  min_deposit: string;
  code: string;
  cashback: string | null;
  withdraw_time: string;
  max_withdrawal: string | null;
  license: string;
  established: string;
  live_support: string | null;
  total_games: string | null;
  languages: string | null;
  game_providers: string[] | null;
  notes: string[];
  welcome_bonus_stages: WelcomeBonusStage[] | null;
  vip_program: string | null;
  details: string | null;
  affiliate_url: string;
  rating: number;
  is_exclusive: boolean;
  payment_methods: string[];
  kyc_required: boolean | null;
  vpn_friendly: boolean | null;
  visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WheelSegmentRow {
  id: string;
  label: string;
  icon: string;
  color: string;
  glow_color: string;
  tier: "legendary" | "epic" | "rare" | "common" | "loss";
  reward_type: "SE_POINTS" | "FREE_SPIN" | "CUSTOM";
  reward_value: number;
  weight: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WheelConfigRow {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface LeaderboardYearRow {
  id: string;
  year: number;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
}

export interface LeaderboardEntryRow {
  id: string;
  year_id: string;
  month: number;
  winner_name: string;
  winner_avatar: string | null;
  updated_at: string;
}

export interface LeaderboardYearRow {
  id: string;
  year: number;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
}

export interface LeaderboardEntryRow {
  id: string;
  year_id: string;
  month: number;
  winner_name: string;
  winner_avatar: string | null;
  updated_at: string;
}

export interface ScheduledStreamRow {
  id: string;
  title: string;
  description: string;
  stream_date: string;
  start_time: string;
  end_time: string | null;
  categories: string[];
  casino: string | null;
  is_special: boolean;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserClipRow {
  id: string;
  twitch_id: string;
  username: string;
  avatar_url: string | null;
  title: string;
  description: string | null;
  url: string;
  provider: string | null;
  embed_type: "video" | "iframe" | "link";
  embed_url: string;
  honors: number;
  created_at: string;
}

export interface ScheduledStreamRowWithExtra extends ScheduledStreamRow {
  prize?: string;
  duration?: string;
}
