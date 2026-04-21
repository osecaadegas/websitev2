import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ── GET - Fetch all available crimes ───────────────────────── */
export async function GET() {
  const { data: crimes, error } = await supabase
    .from("crimes")
    .select("*")
    .eq("enabled", true)
    .order("required_level", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ crimes });
}

/* ── POST - Commit a crime ──────────────────────────────────── */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { crimeId } = body;

  if (!crimeId) return NextResponse.json({ error: "Crime ID required" }, { status: 400 });

  // Get player
  const { data: player, error: playerError } = await supabase
    .from("crime_players")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Check if in jail
  if (player.in_jail) {
    const now = new Date();
    const releaseAt = new Date(player.jail_release_at);
    if (releaseAt > now) {
      return NextResponse.json({
        error: "You are in jail",
        jail_release_at: player.jail_release_at,
      }, { status: 403 });
    }
  }

  // Get crime details
  const { data: crime, error: crimeError } = await supabase
    .from("crimes")
    .select("*")
    .eq("id", crimeId)
    .single();

  if (crimeError || !crime) {
    return NextResponse.json({ error: "Crime not found" }, { status: 404 });
  }

  // Check requirements
  if (player.level < crime.required_level) {
    return NextResponse.json({ error: `Level ${crime.required_level} required` }, { status: 403 });
  }

  if (player.stamina < crime.stamina_cost) {
    return NextResponse.json({ error: "Not enough stamina" }, { status: 403 });
  }

  // Get player's experience with this crime
  const { data: experience } = await supabase
    .from("player_crime_experience")
    .select("*")
    .eq("player_id", player.id)
    .eq("crime_id", crimeId)
    .single();

  const bonusSuccessRate = experience?.bonus_success_rate || 0;

  // Calculate success rate
  let baseSuccess = crime.base_success_rate;

  // Apply class bonuses
  if (player.class === 'thief' && crime.difficulty === 'petty') {
    baseSuccess += 0.15; // +15% for thieves on petty crimes
  }
  if (player.class === 'scammer' && crime.name.includes('Scam')) {
    baseSuccess += 0.15;
  }

  // Apply new player boost
  const now = new Date();
  const boostActive = new Date(player.boost_expires_at) > now;
  if (boostActive) {
    baseSuccess += 0.30; // +30% for new players
  }

  const finalSuccessRate = Math.min(0.95, baseSuccess + bonusSuccessRate);

  // Roll for success
  const roll = Math.random();
  const success = roll <= finalSuccessRate;

  // Calculate rewards
  let dirtyCashEarned = 0;
  let xpEarned = 0;
  let respectEarned = 0;

  if (success) {
    // Reward scaling based on success rate
    const rewardMultiplier = 1 / finalSuccessRate;
    const baseReward = Math.floor(Math.random() * (crime.max_dirty_cash - crime.min_dirty_cash + 1)) + crime.min_dirty_cash;
    dirtyCashEarned = Math.floor(baseReward * rewardMultiplier);
    xpEarned = Math.floor(crime.xp_reward * (boostActive ? 1.2 : 1));
    respectEarned = crime.respect_reward;

    // Apply class bonuses
    if (player.class === 'thief') {
      dirtyCashEarned = Math.floor(dirtyCashEarned * 1.1);
    }
    if (player.class === 'hooligan') {
      respectEarned = Math.floor(respectEarned * 1.2);
    }
  }

  // Roll for jail
  let wentToJail = false;
  let jailTimeMinutes = 0;
  let jailReleaseAt = null;

  if (!success && Math.random() <= crime.jail_risk * (boostActive ? 0.5 : 1)) {
    wentToJail = true;
    jailTimeMinutes = 15 + Math.floor(Math.random() * 30); // 15-45 minutes
    const releaseDate = new Date(now.getTime() + jailTimeMinutes * 60000);
    jailReleaseAt = releaseDate.toISOString();
  }

  // Calculate new stamina
  const newStamina = player.stamina - crime.stamina_cost;

  // Calculate XP and level up
  let newXP = player.xp + xpEarned;
  let newLevel = player.level;
  let leveledUp = false;

  while (newXP >= player.xp_to_next_level) {
    newXP -= player.xp_to_next_level;
    newLevel++;
    leveledUp = true;
  }

  const newXPToNext = Math.floor(100 * Math.pow(1.5, newLevel - 1));

  // Update player
  const updates: any = {
    stamina: newStamina,
    last_stamina_update: now.toISOString(),
    dirty_cash: player.dirty_cash + dirtyCashEarned,
    respect: player.respect + respectEarned,
    xp: newXP,
    level: newLevel,
    xp_to_next_level: newXPToNext,
  };

  if (wentToJail) {
    updates.in_jail = true;
    updates.jail_release_at = jailReleaseAt;
  }

  await supabase.from("crime_players").update(updates).eq("id", player.id);

  // Record attempt
  await supabase.from("crime_attempts").insert({
    player_id: player.id,
    crime_id: crimeId,
    success,
    went_to_jail: wentToJail,
    dirty_cash_earned: dirtyCashEarned,
    xp_earned: xpEarned,
    respect_earned: respectEarned,
    success_rate_used: finalSuccessRate,
  });

  // Update crime experience
  if (experience) {
    const newAttempts = experience.attempts + 1;
    const newSuccesses = experience.successes + (success ? 1 : 0);
    const newBonusRate = Math.min(0.3, newAttempts * 0.002); // +0.2% per attempt, max 30%

    await supabase
      .from("player_crime_experience")
      .update({
        attempts: newAttempts,
        successes: newSuccesses,
        bonus_success_rate: newBonusRate,
        last_attempt: now.toISOString(),
      })
      .eq("id", experience.id);
  } else {
    await supabase.from("player_crime_experience").insert({
      player_id: player.id,
      crime_id: crimeId,
      attempts: 1,
      successes: success ? 1 : 0,
      bonus_success_rate: 0.002,
      last_attempt: now.toISOString(),
    });
  }

  // Update stats (fetch current, then increment)
  const { data: currentStats } = await supabase
    .from("player_stats")
    .select("*")
    .eq("player_id", player.id)
    .single();

  if (currentStats) {
    await supabase
      .from("player_stats")
      .update({
        total_crimes_attempted: currentStats.total_crimes_attempted + 1,
        total_crimes_succeeded: currentStats.total_crimes_succeeded + (success ? 1 : 0),
        times_jailed: currentStats.times_jailed + (wentToJail ? 1 : 0),
        total_dirty_cash_earned: currentStats.total_dirty_cash_earned + dirtyCashEarned,
      })
      .eq("player_id", player.id);
  }

  // Record jail if happened
  if (wentToJail) {
    await supabase.from("jail_records").insert({
      player_id: player.id,
      crime_id: crimeId,
      jail_time_minutes: jailTimeMinutes,
      release_at: jailReleaseAt,
    });
  }

  return NextResponse.json({
    success,
    went_to_jail: wentToJail,
    jail_release_at: jailReleaseAt,
    jail_time_minutes: jailTimeMinutes,
    dirty_cash_earned: dirtyCashEarned,
    xp_earned: xpEarned,
    respect_earned: respectEarned,
    leveled_up: leveledUp,
    new_level: newLevel,
    new_stamina: newStamina,
    success_rate_used: finalSuccessRate,
  });
}
