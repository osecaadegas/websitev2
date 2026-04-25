import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { generateEscapeToken } from "@/lib/crime-empire/arrest-helpers";

export const dynamic = "force-dynamic";

const GAMBLING_STAMINA_GAIN = 3;
const GAMBLING_ADDICTION_GAIN = 2;

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
// After /2 payout divisor: low ~66% RTP, medium ~72% RTP, high ~83% RTP
// Previous high center (12x) gave player +78% edge (casino losing money) — fixed to 5x
const MULTIPLIERS: Record<string, number[]> = {
  low:    [0.5, 0.7, 1.0, 1.3, 1.8, 1.3, 1.0, 0.7, 0.5],
  medium: [0.2, 0.4, 0.7, 1.0, 3.0, 1.0, 0.7, 0.4, 0.2],
  high:   [0.0, 0.2, 0.3, 0.5, 5.0, 0.5, 0.3, 0.2, 0.0],
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

async function rollGamblingArrest(playerId: string, playerClass: string, bet: number, cryptoAtRisk: number) {
  const risk = playerClass === "scammer" ? 0.075 : 0.15;
  if (Math.random() >= risk) return { arrested: false, escapeToken: undefined as string | undefined, cryptoAtRisk: 0 };
  const jailMinutes = 20 + Math.floor(Math.random() * 21);
  const jailReleaseAt = new Date(Date.now() + jailMinutes * 60_000).toISOString();
  const et = generateEscapeToken();
  await supabase.from("crime_players").update({
    in_jail: true, jail_release_at: jailReleaseAt,
    escape_token: et.escape_token, escape_token_expires_at: et.escape_token_expires_at,
    escape_cash_at_risk: bet,
    escape_crypto_at_risk: cryptoAtRisk,
  }).eq("id", playerId);
  await supabase.from("player_notifications").insert({
    player_id: playerId, type: "jail_released", title: "🚔 Apanhado no Casino!",
    message: `A polícia fez uma rusga ao casino. Ficaste preso por ${jailMinutes} minutos.`,
  });
  return { arrested: true, jailMinutes, escapeToken: et.escape_token, cryptoAtRisk };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("*").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date()) {
    return NextResponse.json({ error: "Estás na prisão. Não podes jogar no casino." }, { status: 403 });
  }
  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
  }

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

  const { data: fp } = await supabase.from("crime_players").select("dirty_cash, crypto, stamina, max_stamina, addiction").eq("id", player.id).single();
  const newStamina = Math.min(fp?.max_stamina ?? player.max_stamina, (fp?.stamina ?? player.stamina) + GAMBLING_STAMINA_GAIN);
  const newAddiction = Math.min(100, (fp?.addiction ?? player.addiction ?? 0) + GAMBLING_ADDICTION_GAIN);
  await supabase.from("crime_players").update({
    dirty_cash: (fp?.dirty_cash ?? player.dirty_cash) - totalCost,
    crypto: (fp?.crypto ?? player.crypto) + payout,
    stamina: newStamina,
    addiction: newAddiction,
  }).eq("id", player.id);

  await supabase.from("gambling_history").insert({
    player_id: player.id, game_type: "plinko", bet_amount: bet, payout, profit: payout - bet,
  });

  const xpEarned = Math.max(5, Math.floor(bet / 200));
  await grantXP(player.id, xpEarned);

  const arrestResult = await rollGamblingArrest(player.id, player.class, bet, Math.floor((player.crypto ?? 0) * 0.15));

  return NextResponse.json({ success: true, flips, slot, multiplier, payout, fee, multipliers: mults, xp_earned: xpEarned, arrested: arrestResult.arrested, jail_minutes: arrestResult.arrested ? (arrestResult as any).jailMinutes : 0, escape_token: arrestResult.arrested ? (arrestResult as any).escapeToken ?? null : null, crypto_at_risk: arrestResult.cryptoAtRisk ?? 0, stamina_gained: GAMBLING_STAMINA_GAIN, new_stamina: newStamina, new_addiction: newAddiction });
}
