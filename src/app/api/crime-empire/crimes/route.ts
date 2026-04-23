import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { grantDirtyMoney } from "@/lib/dirty-money";

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

  // Check if in hospital
  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
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

  // D1: Enforce cooldown before stamina check
  if (crime.cooldown_minutes > 0 && experience?.last_attempt) {
    const now_check = new Date();
    const msSinceLast = now_check.getTime() - new Date(experience.last_attempt).getTime();
    const cooldownMs = crime.cooldown_minutes * 60_000;
    if (msSinceLast < cooldownMs) {
      const secsLeft = Math.ceil((cooldownMs - msSinceLast) / 1000);
      return NextResponse.json({ error: `Cooldown: aguarda ${secsLeft}s` }, { status: 429 });
    }
  }

  const bonusSuccessRate = experience?.bonus_success_rate || 0;

  // Get equipped items success_rate bonus
  const { data: equippedItems } = await supabase
    .from("player_inventory")
    .select("items(success_rate_bonus)")
    .eq("player_id", player.id)
    .eq("equipped", true);

  const rawItemBonus = (equippedItems || []).reduce((sum: number, row: any) => {
    return sum + (row.items?.success_rate_bonus || 0);
  }, 0);
  // Hooligan gets +15% on all equipped item bonuses
  const itemSuccessBonus = player.class === 'hooligan' ? rawItemBonus * 1.15 : rawItemBonus;

  // Calculate success rate
  let baseSuccess = crime.base_success_rate;

  // Apply class bonuses
    if (player.class === 'thief') {
    baseSuccess += 0.15; // +15% for thieves on all crimes
  }
  // Scammer bonuses are on laundering businesses and gambling, not crimes directly

  const now = new Date();

  // Apply prestige bonus (+2% per prestige level, max 20%)
  const prestigeBonus = Math.min(player.prestige_level * 0.02, 0.20);
  baseSuccess += prestigeBonus;

  const finalSuccessRate = Math.min(0.95, baseSuccess + bonusSuccessRate + itemSuccessBonus);

  // Apply addiction debuff: each 1% addiction = -0.5% success rate (max -50% at 100 addiction)
  const addictionPenalty = ((player.addiction || 0) / 100) * 0.5;
  const effectiveSuccessRate = Math.max(0.05, finalSuccessRate * (1 - addictionPenalty));

  // Roll for success
  const roll = Math.random();
  const success = roll <= effectiveSuccessRate;

  // Calculate rewards
  let dirtyCashEarned = 0;
  let cleanCashEarned = 0;
  let xpEarned = 0;
  let respectEarned = 0;

  if (success) {
    // Reward is exactly within the displayed min/max range
    const totalCash = Math.floor(Math.random() * (crime.max_dirty_cash - crime.min_dirty_cash + 1)) + crime.min_dirty_cash;
    const cleanPct = Math.max(0, Math.min(100, crime.clean_cash_pct ?? 0));
    cleanCashEarned = Math.floor(totalCash * cleanPct / 100);
    dirtyCashEarned = totalCash - cleanCashEarned;
    xpEarned = Math.floor(crime.xp_reward);
    respectEarned = crime.respect_reward;

    // Apply class bonuses
    if (player.class === 'thief') {
      dirtyCashEarned = Math.floor(dirtyCashEarned * 1.1);
      cleanCashEarned  = Math.floor(cleanCashEarned  * 1.1);
    }
    if (player.class === 'hooligan') {
      respectEarned = Math.floor(respectEarned * 1.2);
    }
  }

  // Roll for jail
  let wentToJail = false;
  let jailTimeMinutes = 0;
  let jailReleaseAt = null;

  if (!success && Math.random() <= crime.jail_risk) {
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

  const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));

  // Re-fetch fresh balance to prevent race conditions
  const { data: freshPlayer } = await supabase.from("crime_players").select("dirty_cash, cash, respect, stamina").eq("id", player.id).single();

  // Update player
  const updates: any = {
    stamina: (freshPlayer?.stamina ?? player.stamina) - crime.stamina_cost,
    last_stamina_update: now.toISOString(),
    cash: ((freshPlayer as any)?.cash ?? player.cash ?? 0) + cleanCashEarned,
    respect: (freshPlayer?.respect ?? player.respect) + respectEarned,
    xp: newXP,
    level: newLevel,
    xp_to_next_level: newXPToNext,
  };

  if (wentToJail) {
    updates.in_jail = true;
    updates.jail_release_at = jailReleaseAt;
  }

  await supabase.from("crime_players").update(updates).eq("id", player.id);
  if (dirtyCashEarned > 0) await grantDirtyMoney(player.id, dirtyCashEarned);

  // Record attempt
  await supabase.from("crime_attempts").insert({
    player_id: player.id,
    crime_id: crimeId,
    success,
    went_to_jail: wentToJail,
    dirty_cash_earned: dirtyCashEarned,
    xp_earned: xpEarned,
    respect_earned: respectEarned,
    success_rate_used: effectiveSuccessRate,
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
        total_dirty_cash_earned: currentStats.total_dirty_cash_earned + dirtyCashEarned + cleanCashEarned,
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

  // Roll item drops on successful crime
  const droppedItems: { name: string; quantity: number }[] = [];
  if (success) {
    const { data: drops } = await supabase
      .from("crime_item_drops")
      .select("item_id, drop_chance, min_quantity, max_quantity, item:items(name)")
      .eq("crime_id", crimeId);

    if (drops && drops.length > 0) {
      for (const drop of drops) {
        if (Math.random() <= drop.drop_chance) {
          const qty = drop.min_quantity === drop.max_quantity
            ? drop.min_quantity
            : Math.floor(Math.random() * (drop.max_quantity - drop.min_quantity + 1)) + drop.min_quantity;

          // Upsert into player inventory
          const { data: existing } = await supabase
            .from("player_inventory")
            .select("id, quantity")
            .eq("player_id", player.id)
            .eq("item_id", drop.item_id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("player_inventory")
              .update({ quantity: existing.quantity + qty })
              .eq("id", existing.id);
          } else {
            await supabase
              .from("player_inventory")
              .insert({ player_id: player.id, item_id: drop.item_id, quantity: qty });
          }

          droppedItems.push({ name: (drop.item as any)?.name || "Item", quantity: qty });
        }
      }
    }
  }

  return NextResponse.json({
    success,
    went_to_jail: wentToJail,
    jail_release_at: jailReleaseAt,
    jail_time_minutes: jailTimeMinutes,
    dirty_cash_earned: dirtyCashEarned,
    clean_cash_earned: cleanCashEarned,
    xp_earned: xpEarned,
    respect_earned: respectEarned,
    leveled_up: leveledUp,
    new_level: newLevel,
    new_stamina: updates.stamina,
    success_rate_used: effectiveSuccessRate,
    dropped_items: droppedItems,
  });
}
