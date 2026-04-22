import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getCasinoFee(level: number): number {
  if (level < 10) return 0;
  if (level < 25) return 500;
  if (level < 50) return 1500;
  return 3000;
}

// 9 slots for 8 rows. Center (slot 4) most likely (~27%), edges least (~0.4%)
// Multipliers designed for ~97% RTP
const MULTIPLIERS: Record<string, number[]> = {
  low:    [0.5, 0.7, 1.0, 1.2, 1.4, 1.2, 1.0, 0.7, 0.5],
  medium: [0.2, 0.4, 0.7, 1.0, 3.5, 1.0, 0.7, 0.4, 0.2],
  high:   [0.0, 0.2, 0.3, 0.5, 12.0, 0.5, 0.3, 0.2, 0.0],
};

// Simulate plinko: 8 coin flips, count rights → slot 0–8
function simulatePlinko(rows = 8): { flips: boolean[]; slot: number } {
  const flips: boolean[] = [];
  let rights = 0;
  for (let i = 0; i < rows; i++) {
    const right = Math.random() < 0.5;
    flips.push(right);
    if (right) rights++;
  }
  return { flips, slot: rights };
}

async function grantXP(playerId: string, xpEarned: number) {
  if (xpEarned <= 0) return;
  const { data: p } = await supabase.from("crime_players").select("xp, level, xp_to_next_level").eq("id", playerId).single();
  if (!p) return;
  let newXP = p.xp + xpEarned;
  let newLevel = p.level;
  while (newXP >= p.xp_to_next_level) { newXP -= p.xp_to_next_level; newLevel++; }
  const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));
  await supabase.from("crime_players").update({ xp: newXP, level: newLevel, xp_to_next_level: newXPToNext }).eq("id", playerId);
}

async function rollGamblingArrest(playerId: string, playerClass: string) {
  const risk = playerClass === "scammer" ? 0.075 : 0.15;
  if (Math.random() >= risk) return { arrested: false };
  const jailMinutes = 20 + Math.floor(Math.random() * 21);
  const jailReleaseAt = new Date(Date.now() + jailMinutes * 60_000).toISOString();
  await supabase.from("crime_players").update({ in_jail: true, jail_release_at: jailReleaseAt }).eq("id", playerId);
  await supabase.from("player_notifications").insert({
    player_id: playerId, type: "jail_released", title: "🚔 Apanhado no Casino!",
    message: `A polícia fez uma rusga ao casino. Ficaste preso por ${jailMinutes} minutos.`,
  });
  return { arrested: true, jailMinutes };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("*").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const { bet, risk = "medium" } = await req.json();
  if (!bet || bet < 100 || bet > 10000) return NextResponse.json({ error: "Aposta inválida (min $100, max $10,000)" }, { status: 400 });
  if (!["low", "medium", "high"].includes(risk)) return NextResponse.json({ error: "Risco inválido" }, { status: 400 });

  const fee = getCasinoFee(player.level);
  const totalCost = bet + fee;
  if (player.dirty_cash < totalCost)
    return NextResponse.json({ error: `Precisas de $${totalCost.toLocaleString()} (aposta $${bet.toLocaleString()} + taxa $${fee.toLocaleString()})` }, { status: 400 });

  const { flips, slot } = simulatePlinko();
  const mults = MULTIPLIERS[risk];
  const multiplier = mults[slot];
  const payout = Math.floor(Math.floor(bet * multiplier) / 2);

  const { data: fp } = await supabase.from("crime_players").select("dirty_cash, crypto").eq("id", player.id).single();
  await supabase.from("crime_players").update({
    dirty_cash: (fp?.dirty_cash ?? player.dirty_cash) - totalCost,
    crypto: (fp?.crypto ?? player.crypto) + payout,
  }).eq("id", player.id);

  await supabase.from("gambling_history").insert({
    player_id: player.id, game_type: "plinko", bet_amount: bet, payout, profit: payout - bet,
  });

  const xpEarned = Math.max(5, Math.floor(bet / 200));
  await grantXP(player.id, xpEarned);

  const arrestResult = await rollGamblingArrest(player.id, player.class);

  return NextResponse.json({ success: true, flips, slot, multiplier, payout, fee, multipliers: mults, xp_earned: xpEarned, arrested: arrestResult.arrested, jail_minutes: arrestResult.arrested ? (arrestResult as any).jailMinutes : 0 });
}
