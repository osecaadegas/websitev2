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
    player_id: playerId,
    type: "jail_released",
    title: "🚔 Apanhado no Casino!",
    message: `A polícia fez uma rusga. Ficaste preso por ${jailMinutes} minutos.`,
  });
  return { arrested: true, jailMinutes, escapeToken: et.escape_token, cryptoAtRisk };
}

// Payout table: PAYOUTS[picks][hits] = multiplier (before /2 payout divisor)
// Redesigned for ~65-70% RTP across all pick counts, with partial payouts for low picks.
// Previous table had no partial payouts for picks 1-4, making those nearly unplayable (<30% RTP).
const PAYOUTS: Record<number, Record<number, number>> = {
  1:  { 1: 5 },
  2:  { 1: 1.5, 2: 10 },
  3:  { 1: 1,   2: 3,   3: 35 },
  4:  { 1: 0.5, 2: 2,   3: 10,  4: 100 },
  5:  { 2: 1,   3: 4,   4: 35,  5: 500 },
  6:  { 2: 0.5, 3: 3,   4: 12,  5: 100,  6: 1000 },
  7:  { 2: 0.5, 3: 2,   4: 6,   5: 35,   6: 250,   7: 3000 },
  8:  { 3: 0.5, 4: 3,   5: 22,  6: 140,  7: 1200,  8: 10000 },
  9:  { 4: 2,   5: 12,  6: 60,  7: 350,  8: 5000,  9: 25000 },
  10: { 4: 1,   5: 7,   6: 30,  7: 200,  8: 1200,  9: 12000, 10: 100000 },
};

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

  const { bet, picks } = await req.json();
  if (!bet || bet < 100 || bet > 10000) return NextResponse.json({ error: "Aposta inválida (min $100, max $10,000)" }, { status: 400 });
  if (!picks || !Array.isArray(picks) || picks.length < 1 || picks.length > 10)
    return NextResponse.json({ error: "Escolhe 1 a 10 números" }, { status: 400 });
  if (picks.some((n: number) => n < 1 || n > 80))
    return NextResponse.json({ error: "Números devem ser entre 1 e 80" }, { status: 400 });

  const fee = getCasinoFee(player.level);
  const totalCost = bet + fee;
  if (player.dirty_cash < totalCost)
    return NextResponse.json({ error: `Precisas de $${totalCost.toLocaleString()} (aposta $${bet.toLocaleString()} + taxa $${fee.toLocaleString()})` }, { status: 400 });

  // Draw 20 numbers from 1–80
  const pool = Array.from({ length: 80 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const drawn = pool.slice(0, 20).sort((a, b) => a - b);

  const picksSet = new Set(picks);
  const hits = drawn.filter((n) => picksSet.has(n)).length;
  const multiplier = (PAYOUTS[picks.length] || {})[hits] || 0;
  const payout = Math.floor(Math.floor(bet * multiplier) / 2);

  const newStamina = Math.min(player.max_stamina, player.stamina + GAMBLING_STAMINA_GAIN);
  const newAddiction = Math.min(100, (player.addiction ?? 0) + GAMBLING_ADDICTION_GAIN);
  await supabase.from("crime_players").update({
    dirty_cash: player.dirty_cash - totalCost,
    crypto: player.crypto + payout,
    stamina: newStamina,
    addiction: newAddiction,
  }).eq("id", player.id);

  await supabase.from("gambling_history").insert({
    player_id: player.id, game_type: "keno", bet_amount: bet, payout, profit: payout - bet,
  });

  const arrestInfo = await rollGamblingArrest(player.id, player.class, bet, Math.min(player.crypto ?? 0, bet));
  // E8: XP for gambling
  await grantXP(player.id, 10);

  return NextResponse.json({ success: true, drawn, hits, picks, multiplier, payout, fee, arrested: arrestInfo.arrested, jailMinutes: (arrestInfo as any).jailMinutes, escape_token: (arrestInfo as any).escapeToken ?? null, crypto_at_risk: arrestInfo.cryptoAtRisk ?? 0, stamina_gained: GAMBLING_STAMINA_GAIN, new_stamina: newStamina, new_addiction: newAddiction });
}
