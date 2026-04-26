/**
 * lib/crime-empire/missions.ts
 *
 * Core mission engine:
 *  - trackMissionEvent   — called from game routes to advance mission progress
 *  - assignDailyMissions — assign 3 daily missions to a player (idempotent)
 *  - assignWeeklyMissions— assign 5 weekly missions to a player (idempotent)
 *  - getPlayerMissions   — return active missions with progress
 *  - updateLoginStreak   — called on player login/session start
 */

import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MissionDefinition {
  id: string;
  name: string;
  description: string | null;
  category: string;
  system: string;
  difficulty: "easy" | "medium" | "hard";
  tier_min: number;
  tier_max: number;
  base_target: number;
  event_trigger: string;
  weight: number;
  daily_eligible: boolean;
  weekly_eligible: boolean;
  monthly_eligible: boolean;
  bonus_target: number | null;
  bonus_multiplier: number;
  xp_reward: number;
  cash_reward: number;
  crypto_reward: number;
  item_reward_pool: string | null;
}

export interface PlayerMission {
  id: string;
  player_id: string;
  mission_id: string;
  type: "daily" | "weekly" | "monthly";
  assigned_at: string;
  expires_at: string;
  progress: number;
  bonus_progress: number;
  status: "active" | "completed" | "claimed";
  completed_at: string | null;
  claimed_at: string | null;
  xp_awarded: number;
  cash_awarded: number;
  crypto_awarded: number;
  definition: MissionDefinition;
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

function getTier(level: number): 1 | 2 | 3 | 4 {
  if (level <= 10) return 1;
  if (level <= 25) return 2;
  if (level <= 50) return 3;
  return 4;
}

const TIER_MULT: Record<number, number> = { 1: 1.0, 2: 1.8, 3: 3.2, 4: 5.5 };
const DIFF_MOD: Record<string, number>  = { easy: 1.0, medium: 1.5, hard: 2.2 };

function scaleTarget(base: number, tier: number): number {
  return Math.max(1, Math.round(base * TIER_MULT[tier]));
}

function scaleXP(base: number, tier: number, difficulty: string): number {
  return Math.round(base * TIER_MULT[tier] * (DIFF_MOD[difficulty] ?? 1));
}

function scaleCash(base: number, tier: number, difficulty: string, level: number): number {
  const raw = Math.round(base * TIER_MULT[tier] * (DIFF_MOD[difficulty] ?? 1));
  const weeklyCapCheck = level * 2000;
  return Math.min(raw, weeklyCapCheck);
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function nextDailyResetISO(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}

function nextWeeklyResetISO(): string {
  const now = new Date();
  // Next Monday 00:00 UTC
  const day = now.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
  return next.toISOString();
}

function startOfTodayUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function nextMonthlyResetISO(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

function startOfThisMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function startOfThisWeekUTC(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysBack = day === 0 ? 6 : day - 1; // back to Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
  return monday.toISOString();
}

// ─── Weighted random selection ────────────────────────────────────────────────

function weightedSample<T extends { weight: number }>(pool: T[], n: number): T[] {
  const results: T[] = [];
  const remaining = [...pool];
  while (results.length < n && remaining.length > 0) {
    const totalWeight = remaining.reduce((s, m) => s + m.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < remaining.length; i++) {
      r -= remaining[i].weight;
      if (r <= 0) { idx = i; break; }
    }
    results.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return results;
}

// ─── Anti-exploit rate limiter ────────────────────────────────────────────────

interface RateLimitOptions {
  cooldownMs?: number;  // min time between ticks on same key
  maxPerHour?: number;  // max ticks in a 1-hour window
}

/**
 * Returns true if the event is allowed (not rate-limited).
 * Updates the lock record on approval.
 */
async function checkRateLimit(
  playerId: string,
  eventKey: string,
  opts: RateLimitOptions = {}
): Promise<boolean> {
  const { cooldownMs = 0, maxPerHour = 999 } = opts;
  const now = new Date();

  const { data: lock } = await supabase
    .from("mission_event_locks")
    .select("*")
    .eq("player_id", playerId)
    .eq("event_key", eventKey)
    .single();

  if (lock) {
    // Cooldown check
    if (cooldownMs > 0) {
      const elapsed = now.getTime() - new Date(lock.last_tick_at).getTime();
      if (elapsed < cooldownMs) return false;
    }
    // Hourly cap check
    if (maxPerHour < 999) {
      const windowStart = new Date(lock.window_start);
      const windowElapsed = now.getTime() - windowStart.getTime();
      const resetWindow = windowElapsed > 3600000;
      if (!resetWindow && lock.tick_count >= maxPerHour) return false;
      const newCount = resetWindow ? 1 : lock.tick_count + 1;
      const newWindowStart = resetWindow ? now.toISOString() : lock.window_start;
      await supabase
        .from("mission_event_locks")
        .update({ last_tick_at: now.toISOString(), tick_count: newCount, window_start: newWindowStart })
        .eq("player_id", playerId)
        .eq("event_key", eventKey);
      return true;
    }
    await supabase
      .from("mission_event_locks")
      .update({ last_tick_at: now.toISOString() })
      .eq("player_id", playerId)
      .eq("event_key", eventKey);
    return true;
  }

  // No lock yet — create it
  await supabase.from("mission_event_locks").insert({
    player_id: playerId,
    event_key: eventKey,
    last_tick_at: now.toISOString(),
    tick_count: 1,
    window_start: now.toISOString(),
  });
  return true;
}

// ─── assignMonthlyMissions ───────────────────────────────────────────────────

/**
 * Assigns 3 monthly missions for the current calendar month.
 * Idempotent — skips if player already has monthly missions this month.
 */
export async function assignMonthlyMissions(playerId: string): Promise<void> {
  const monthStart = startOfThisMonthUTC();

  const { data: existing } = await supabase
    .from("player_missions")
    .select("id")
    .eq("player_id", playerId)
    .eq("type", "monthly")
    .gte("assigned_at", monthStart)
    .limit(1);

  if ((existing ?? []).length > 0) return;

  const { data: player } = await supabase
    .from("crime_players")
    .select("level")
    .eq("id", playerId)
    .single();

  if (!player) return;
  const tier = getTier(player.level);

  const { data: pool } = await supabase
    .from("mission_definitions")
    .select("*")
    .eq("monthly_eligible", true)
    .lte("tier_min", tier)
    .gte("tier_max", tier);

  if (!pool || pool.length === 0) return;

  const selected = weightedSample(pool as MissionDefinition[], Math.min(3, pool.length));
  const expiresAt = nextMonthlyResetISO();

  const rows = selected.map((m) => ({
    player_id: playerId,
    mission_id: m.id,
    type: "monthly",
    expires_at: expiresAt,
    progress: 0,
    bonus_progress: 0,
    status: "active",
  }));

  await supabase.from("player_missions").insert(rows);
}

// ─── assignDailyMissions ─────────────────────────────────────────────────────

/**
 * Assigns up to 3 daily missions for today.
 * Idempotent — skips if player already has daily missions assigned today.
 */
export async function assignDailyMissions(playerId: string): Promise<void> {
  const todayStart = startOfTodayUTC();

  // Check if already assigned today
  const { data: existing } = await supabase
    .from("player_missions")
    .select("id")
    .eq("player_id", playerId)
    .eq("type", "daily")
    .gte("assigned_at", todayStart)
    .limit(1);

  if ((existing ?? []).length > 0) return;

  // Get player level for tier + scaling
  const { data: player } = await supabase
    .from("crime_players")
    .select("level")
    .eq("id", playerId)
    .single();

  if (!player) return;
  const tier = getTier(player.level);

  // Get eligible missions for this tier
  const { data: pool } = await supabase
    .from("mission_definitions")
    .select("*")
    .eq("daily_eligible", true)
    .lte("tier_min", tier)
    .gte("tier_max", tier);

  if (!pool || pool.length === 0) return;

  const selected = weightedSample(pool as MissionDefinition[], 3);
  const expiresAt = nextDailyResetISO();

  const rows = selected.map((m) => ({
    player_id: playerId,
    mission_id: m.id,
    type: "daily",
    expires_at: expiresAt,
    progress: 0,
    bonus_progress: 0,
    status: "active",
  }));

  await supabase.from("player_missions").insert(rows);
}

// ─── assignWeeklyMissions ─────────────────────────────────────────────────────

/**
 * Assigns up to 5 weekly missions for this week.
 * Always includes at least 1 PvP mission and 1 chain mission if available.
 * Idempotent — skips if player already has weekly missions this week.
 */
export async function assignWeeklyMissions(playerId: string): Promise<void> {
  const weekStart = startOfThisWeekUTC();

  const { data: existing } = await supabase
    .from("player_missions")
    .select("id")
    .eq("player_id", playerId)
    .eq("type", "weekly")
    .gte("assigned_at", weekStart)
    .limit(1);

  if ((existing ?? []).length > 0) return;

  const { data: player } = await supabase
    .from("crime_players")
    .select("level")
    .eq("id", playerId)
    .single();

  if (!player) return;
  const tier = getTier(player.level);

  const { data: allWeekly } = await supabase
    .from("mission_definitions")
    .select("*")
    .eq("weekly_eligible", true)
    .lte("tier_min", tier)
    .gte("tier_max", tier);

  if (!allWeekly || allWeekly.length === 0) return;

  const defs = allWeekly as MissionDefinition[];

  // Ensure at least 1 PvP and 1 chain (CH prefix)
  const pvpPool   = defs.filter((m) => m.system === "pvp");
  const chainPool = defs.filter((m) => m.id.startsWith("CH"));
  const restPool  = defs.filter((m) => m.system !== "pvp" && !m.id.startsWith("CH"));

  const mandatory: MissionDefinition[] = [];
  if (pvpPool.length > 0)   mandatory.push(weightedSample(pvpPool, 1)[0]);
  if (chainPool.length > 0) mandatory.push(weightedSample(chainPool, 1)[0]);

  const remaining = 5 - mandatory.length;
  const filler = weightedSample(
    restPool.filter((m) => !mandatory.find((x) => x.id === m.id)),
    remaining
  );

  const selected = [...mandatory, ...filler].slice(0, 5);
  const expiresAt = nextWeeklyResetISO();

  const rows = selected.map((m) => ({
    player_id: playerId,
    mission_id: m.id,
    type: "weekly",
    expires_at: expiresAt,
    progress: 0,
    bonus_progress: 0,
    status: "active",
  }));

  await supabase.from("player_missions").insert(rows);
}

// ─── getPlayerMissions ────────────────────────────────────────────────────────

/**
 * Returns the player's active missions (daily + weekly) with definitions.
 * Automatically assigns missions if none exist for today / this week.
 */
export async function getPlayerMissions(playerId: string): Promise<{
  daily: PlayerMission[];
  weekly: PlayerMission[];
  monthly: PlayerMission[];
  streak: { current_streak: number; longest_streak: number; streak_shields: number } | null;
}> {
  // Auto-assign if needed
  await Promise.all([
    assignDailyMissions(playerId),
    assignWeeklyMissions(playerId),
    assignMonthlyMissions(playerId),
  ]);

  const todayStart  = startOfTodayUTC();
  const weekStart   = startOfThisWeekUTC();
  const monthStart  = startOfThisMonthUTC();

  const [dailyRes, weeklyRes, monthlyRes, streakRes] = await Promise.all([
    supabase
      .from("player_missions")
      .select("*, definition:mission_definitions(*)")
      .eq("player_id", playerId)
      .eq("type", "daily")
      .gte("assigned_at", todayStart)
      .order("assigned_at", { ascending: true }),
    supabase
      .from("player_missions")
      .select("*, definition:mission_definitions(*)")
      .eq("player_id", playerId)
      .eq("type", "weekly")
      .gte("assigned_at", weekStart)
      .order("assigned_at", { ascending: true }),
    supabase
      .from("player_missions")
      .select("*, definition:mission_definitions(*)")
      .eq("player_id", playerId)
      .eq("type", "monthly")
      .gte("assigned_at", monthStart)
      .order("assigned_at", { ascending: true }),
    supabase
      .from("player_streaks")
      .select("current_streak, longest_streak, streak_shields")
      .eq("player_id", playerId)
      .single(),
  ]);

  return {
    daily:   (dailyRes.data   ?? []) as unknown as PlayerMission[],
    weekly:  (weeklyRes.data  ?? []) as unknown as PlayerMission[],
    monthly: (monthlyRes.data ?? []) as unknown as PlayerMission[],
    streak:  streakRes.data ?? null,
  };
}

// ─── trackMissionEvent ────────────────────────────────────────────────────────

/**
 * Records an in-game event and advances matching active missions.
 *
 * @param playerId   The crime_players.id of the player
 * @param event      Event name, e.g. "onDrugSold", "onPvPWin"
 * @param value      How many units this event represents (default 1)
 * @param meta       Optional metadata (e.g. { targetId, system })
 */
export async function trackMissionEvent(
  playerId: string,
  event: string,
  value: number = 1,
  meta?: Record<string, unknown>
): Promise<void> {
  if (!playerId || !event) return;

  // ── Rate limits per event type ──────────────────────────────
  const rateLimits: Record<string, RateLimitOptions> = {
    onDrugSold:          { cooldownMs: 60_000, maxPerHour: 3 },
    onCasinoPlay:        { cooldownMs: 0 },      // session-based — caller deduplicates
    onPvPAttack:         { cooldownMs: 0 },
    onPvPWin:            { cooldownMs: 0 },
    onPvPDefend:         { cooldownMs: 0 },
  };

  // PvP target-specific 4-hour cooldown
  if ((event === "onPvPWin" || event === "onPvPAttack") && meta?.targetId) {
    const pvpKey = `pvp_target:${meta.targetId as string}`;
    const allowed = await checkRateLimit(playerId, pvpKey, { cooldownMs: 4 * 3600_000 });
    if (!allowed) return;
  } else if (rateLimits[event]) {
    const eventKey = `event:${event}`;
    const allowed = await checkRateLimit(playerId, eventKey, rateLimits[event]);
    if (!allowed) return;
  }

  // ── Find active missions matching this trigger ──────────────
  const now   = new Date().toISOString();
  const todayStart = startOfTodayUTC();
  const weekStart  = startOfThisWeekUTC();

  // Fetch active missions that listen to this event
  const { data: missions } = await supabase
    .from("player_missions")
    .select("*, definition:mission_definitions(*)")
    .eq("player_id", playerId)
    .eq("status", "active")
    .gt("expires_at", now);

  if (!missions || missions.length === 0) return;

  // Filter to those whose trigger matches
  const matching = (missions as unknown as PlayerMission[]).filter(
    (m) => m.definition?.event_trigger === event
  );

  if (matching.length === 0) return;

  // ── Get player level once for scaling ──────────────────────
  const { data: player } = await supabase
    .from("crime_players")
    .select("level")
    .eq("id", playerId)
    .single();

  if (!player) return;
  const tier = getTier(player.level);

  // ── Advance each matching mission ─────────────────────────
  for (const mission of matching) {
    const def = mission.definition;
    const scaledTarget = scaleTarget(def.base_target, tier);
    const newProgress  = Math.min(mission.progress + value, scaledTarget);
    const justCompleted = mission.progress < scaledTarget && newProgress >= scaledTarget;

    const updates: Record<string, unknown> = { progress: newProgress };

    if (justCompleted) {
      updates.status       = "completed";
      updates.completed_at = now;
    }

    await supabase
      .from("player_missions")
      .update(updates)
      .eq("id", mission.id);
  }
}

// ─── claimMissionReward ───────────────────────────────────────────────────────

/**
 * Claims rewards for a completed mission.
 * Returns the xp and cash granted.
 */
export async function claimMissionReward(
  playerId: string,
  missionInstanceId: string
): Promise<{ xp: number; cash: number; crypto: number; error?: string }> {
  // Fetch the mission
  const { data: mission } = await supabase
    .from("player_missions")
    .select("*, definition:mission_definitions(*)")
    .eq("id", missionInstanceId)
    .eq("player_id", playerId)
    .single();

  if (!mission) return { xp: 0, cash: 0, crypto: 0, error: "Missão não encontrada" };
  const m = mission as unknown as PlayerMission;

  if (m.status !== "completed") return { xp: 0, cash: 0, crypto: 0, error: m.status === "claimed" ? "Recompensa já reclamada" : "Missão ainda não concluída" };

  // Get player level for scaling
  const { data: player } = await supabase
    .from("crime_players")
    .select("level, cash, crypto")
    .eq("id", playerId)
    .single();

  if (!player) return { xp: 0, cash: 0, crypto: 0, error: "Jogador não encontrado" };
  const tier = getTier(player.level);
  const def  = m.definition;

  const xp     = scaleXP(def.xp_reward, tier, def.difficulty);
  const cash   = scaleCash(def.cash_reward, tier, def.difficulty, player.level);
  const crypto = m.type === "monthly" ? (def.crypto_reward ?? 0) : 0;

  // Mark as claimed
  await supabase
    .from("player_missions")
    .update({ status: "claimed", claimed_at: new Date().toISOString(), xp_awarded: xp, cash_awarded: cash, crypto_awarded: crypto })
    .eq("id", missionInstanceId);

  // Grant rewards
  await Promise.all([
    supabase
      .from("crime_players")
      .update({ cash: player.cash + cash })
      .eq("id", playerId),
    (async () => {
      const { grantXP } = await import("@/lib/crime-empire/xp");
      await grantXP(playerId, xp);
    })(),
  ]);

  if (crypto > 0) {
    await supabase
      .from("crime_players")
      .update({ crypto: (player.crypto ?? 0) + crypto })
      .eq("id", playerId);
  }

  return { xp, cash, crypto };
}

// ─── updateLoginStreak ────────────────────────────────────────────────────────

/**
 * Call once per day when a player logs in.
 * Returns the updated streak info.
 */
export async function updateLoginStreak(playerId: string): Promise<{
  current_streak: number;
  longest_streak: number;
  streak_shields: number;
  gained: boolean;
}> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: streak } = await supabase
    .from("player_streaks")
    .select("*")
    .eq("player_id", playerId)
    .single();

  if (!streak) {
    // First ever login
    await supabase.from("player_streaks").insert({
      player_id: playerId,
      current_streak: 1,
      longest_streak: 1,
      last_login_date: today,
      streak_shields: 0,
    });
    return { current_streak: 1, longest_streak: 1, streak_shields: 0, gained: true };
  }

  const last = streak.last_login_date;
  if (last === today) {
    // Already logged in today — no change
    return {
      current_streak:  streak.current_streak,
      longest_streak:  streak.longest_streak,
      streak_shields:  streak.streak_shields,
      gained: false,
    };
  }

  const lastDate  = new Date(last + "T00:00:00Z");
  const todayDate = new Date(today + "T00:00:00Z");
  const diffDays  = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);

  let newStreak: number;
  if (diffDays === 1) {
    // Consecutive day
    newStreak = streak.current_streak + 1;
  } else if (diffDays === 2 && streak.streak_shields > 0) {
    // Missed one day but has a shield
    newStreak = streak.current_streak + 1;
    await supabase
      .from("player_streaks")
      .update({ streak_shields: streak.streak_shields - 1 })
      .eq("player_id", playerId);
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newLongest = Math.max(newStreak, streak.longest_streak);

  await supabase
    .from("player_streaks")
    .update({
      current_streak:  newStreak,
      longest_streak:  newLongest,
      last_login_date: today,
      updated_at:      new Date().toISOString(),
    })
    .eq("player_id", playerId);

  return {
    current_streak:  newStreak,
    longest_streak:  newLongest,
    streak_shields:  streak.streak_shields,
    gained: true,
  };
}
