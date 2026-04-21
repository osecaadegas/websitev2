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

// Payout table: PAYOUTS[picks][hits] = multiplier
const PAYOUTS: Record<number, Record<number, number>> = {
  1:  { 1: 3 },
  2:  { 2: 8 },
  3:  { 2: 1.5, 3: 25 },
  4:  { 2: 1, 3: 5, 4: 75 },
  5:  { 3: 2, 4: 20, 5: 300 },
  6:  { 3: 1.5, 4: 6, 5: 60, 6: 1000 },
  7:  { 3: 1, 4: 3, 5: 20, 6: 150, 7: 3000 },
  8:  { 4: 2, 5: 15, 6: 100, 7: 1000, 8: 10000 },
  9:  { 4: 1.5, 5: 10, 6: 50, 7: 300, 8: 5000, 9: 25000 },
  10: { 5: 5, 6: 25, 7: 150, 8: 1000, 9: 10000, 10: 50000 },
};

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("*").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

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

  const { data: fp } = await supabase.from("crime_players").select("dirty_cash, crypto").eq("id", player.id).single();
  await supabase.from("crime_players").update({
    dirty_cash: (fp?.dirty_cash ?? player.dirty_cash) - totalCost,
    crypto: (fp?.crypto ?? player.crypto) + payout,
  }).eq("id", player.id);

  await supabase.from("gambling_history").insert({
    player_id: player.id, game_type: "keno", bet_amount: bet, payout, profit: payout - bet,
  });

  return NextResponse.json({ success: true, drawn, hits, picks, multiplier, payout, fee });
}
