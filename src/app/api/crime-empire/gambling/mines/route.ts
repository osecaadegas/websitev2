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

async function rollGamblingArrest(playerId: string, playerClass: string, bet: number) {
  const risk = playerClass === "scammer" ? 0.075 : 0.15;
  if (Math.random() >= risk) return { arrested: false, escapeToken: undefined as string | undefined };
  const jailMinutes = 20 + Math.floor(Math.random() * 21);
  const jailReleaseAt = new Date(Date.now() + jailMinutes * 60_000).toISOString();
  const et = generateEscapeToken();
  await supabase.from("crime_players").update({
    in_jail: true, jail_release_at: jailReleaseAt,
    escape_token: et.escape_token, escape_token_expires_at: et.escape_token_expires_at,
    escape_cash_at_risk: bet,
  }).eq("id", playerId);
  await supabase.from("player_notifications").insert({
    player_id: playerId,
    type: "jail_released",
    title: "🚔 Apanhado no Casino!",
    message: `A polícia fez uma rusga. Ficaste preso por ${jailMinutes} minutos.`,
  });
  return { arrested: true, jailMinutes, escapeToken: et.escape_token };
}

function calcMultiplier(mines: number, revealed: number): number {
  const TILES = 25;
  let mult = 1;
  for (let i = 0; i < revealed; i++) {
    mult *= (TILES - i) / (TILES - mines - i);
  }
  return Math.round(mult * 0.97 * 100) / 100;
}

function generateGrid(mines: number): boolean[] {
  const grid = new Array(25).fill(false);
  let placed = 0;
  while (placed < mines) {
    const idx = Math.floor(Math.random() * 25);
    if (!grid[idx]) { grid[idx] = true; placed++; }
  }
  return grid;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("*").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const { data: session } = await supabase
    .from("casino_sessions")
    .select("*")
    .eq("player_id", player.id)
    .eq("game_type", "mines")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session) {
    const state = session.state as any;
    return NextResponse.json({
      activeSession: {
        id: session.id,
        bet: session.bet,
        mineCount: state.mineCount,
        revealed: state.revealed,
        revealedCount: state.revealedCount,
        currentMultiplier: calcMultiplier(state.mineCount, state.revealedCount),
        currentPayout: Math.floor(Math.floor(session.bet * calcMultiplier(state.mineCount, state.revealedCount)) / 2),
      },
      player: { dirty_cash: player.dirty_cash, crypto: player.crypto, level: player.level },
    });
  }

  return NextResponse.json({ activeSession: null, player: { dirty_cash: player.dirty_cash, crypto: player.crypto, level: player.level } });
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

  const body = await req.json();
  const { action } = body;

  // ── START ────────────────────────────────────────────────────
  if (action === "start") {
    const { bet, mineCount } = body;
    if (!bet || bet < 100 || bet > 10000) return NextResponse.json({ error: "Aposta inválida (min $100, max $10,000)" }, { status: 400 });
    if (!mineCount || mineCount < 1 || mineCount > 24)
      return NextResponse.json({ error: "Número de minas: 1–24" }, { status: 400 });

    const fee = getCasinoFee(player.level);
    const totalCost = bet + fee;
    if (player.dirty_cash < totalCost)
      return NextResponse.json({ error: `Precisas de $${totalCost.toLocaleString()} (aposta $${bet.toLocaleString()} + taxa $${fee.toLocaleString()})` }, { status: 400 });

    await supabase.from("casino_sessions").update({ status: "finished" })
      .eq("player_id", player.id).eq("game_type", "mines").eq("status", "active");

    const grid = generateGrid(mineCount);
    const revealed: (null | "safe" | "mine")[] = new Array(25).fill(null);

    // Create session FIRST to prevent money deducted without session (atomicity fix)
    const { data: session, error: sessionError } = await supabase.from("casino_sessions").insert({
      player_id: player.id, game_type: "mines", bet,
      state: { grid, revealed, mineCount, revealedCount: 0, fee },
    }).select().single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Erro ao criar sessão de jogo" }, { status: 500 });
    }

    // Deduct money only after session is confirmed created
    await supabase.from("crime_players").update({ dirty_cash: player.dirty_cash - totalCost }).eq("id", player.id);
    // E8: XP for starting a mines game
    await grantXP(player.id, 10);

    return NextResponse.json({ success: true, sessionId: session.id, fee, revealed, currentMultiplier: 1, currentPayout: Math.floor(bet / 2) });
  }

  // Active session required for reveal/cashout
  const { sessionId } = body;
  if (!sessionId) return NextResponse.json({ error: "sessionId em falta" }, { status: 400 });

  const { data: session } = await supabase.from("casino_sessions")
    .select("*").eq("id", sessionId).eq("player_id", player.id).eq("status", "active").maybeSingle();
  if (!session) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const state = session.state as any;

  // ── REVEAL ───────────────────────────────────────────────────
  if (action === "reveal") {
    const { tileIndex } = body;
    if (tileIndex < 0 || tileIndex > 24) return NextResponse.json({ error: "Tile inválido" }, { status: 400 });
    if (state.revealed[tileIndex] !== null) return NextResponse.json({ error: "Tile já revelado" }, { status: 400 });

    const isMine = state.grid[tileIndex];
    const newRevealed = [...state.revealed];

    if (isMine) {
      // Reveal all mines on explosion
      for (let i = 0; i < 25; i++) {
        if (state.grid[i]) newRevealed[i] = "mine";
      }
      newRevealed[tileIndex] = "mine";
      await supabase.from("casino_sessions").update({ status: "finished", state: { ...state, revealed: newRevealed } }).eq("id", sessionId);
      await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "mines", bet_amount: session.bet, payout: 0, profit: -session.bet });
      const newStaminaMine = Math.min(player.max_stamina, player.stamina + GAMBLING_STAMINA_GAIN);
      const newAddictionMine = Math.min(100, (player.addiction ?? 0) + GAMBLING_ADDICTION_GAIN);
      await supabase.from("crime_players").update({ stamina: newStaminaMine, addiction: newAddictionMine }).eq("id", player.id);
      const arrestInfo = await rollGamblingArrest(player.id, player.class, session.state.bet ?? 0);
      return NextResponse.json({ success: true, hit: "mine", revealed: newRevealed, payout: 0, status: "finished", arrested: arrestInfo.arrested, jailMinutes: (arrestInfo as any).jailMinutes, escape_token: (arrestInfo as any).escapeToken ?? null, stamina_gained: GAMBLING_STAMINA_GAIN, new_stamina: newStaminaMine, new_addiction: newAddictionMine });
    }

    newRevealed[tileIndex] = "safe";
    const newRevealedCount = state.revealedCount + 1;
    const mult = calcMultiplier(state.mineCount, newRevealedCount);
    await supabase.from("casino_sessions").update({ state: { ...state, revealed: newRevealed, revealedCount: newRevealedCount } }).eq("id", sessionId);

    return NextResponse.json({
      success: true,
      hit: "safe",
      revealed: newRevealed,
      revealedCount: newRevealedCount,
      currentMultiplier: mult,
      currentPayout: Math.floor(Math.floor(session.bet * mult) / 2),
      status: "active",
    });
  }

  // ── CASHOUT ──────────────────────────────────────────────────
  if (action === "cashout") {
    if (state.revealedCount === 0) return NextResponse.json({ error: "Revela pelo menos um tile primeiro!" }, { status: 400 });
    const mult = calcMultiplier(state.mineCount, state.revealedCount);
    const payout = Math.floor(Math.floor(session.bet * mult) / 2);
    const { data: fp } = await supabase.from("crime_players").select("crypto, stamina, max_stamina, addiction").eq("id", player.id).single();
    const newStaminaCash = Math.min(fp?.max_stamina ?? player.max_stamina, (fp?.stamina ?? player.stamina) + GAMBLING_STAMINA_GAIN);
    const newAddictionCash = Math.min(100, (fp?.addiction ?? player.addiction ?? 0) + GAMBLING_ADDICTION_GAIN);
    await supabase.from("crime_players").update({ crypto: (fp?.crypto ?? 0) + payout, stamina: newStaminaCash, addiction: newAddictionCash }).eq("id", player.id);
    await supabase.from("casino_sessions").update({ status: "finished", state: { ...state, result: "cashout" } }).eq("id", sessionId);
    await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "mines", bet_amount: session.bet, payout, profit: payout - session.bet });
    const arrestInfo = await rollGamblingArrest(player.id, player.class, session.bet ?? 0);
    return NextResponse.json({ success: true, payout, multiplier: mult, status: "finished", arrested: arrestInfo.arrested, jailMinutes: (arrestInfo as any).jailMinutes, escape_token: (arrestInfo as any).escapeToken ?? null, stamina_gained: GAMBLING_STAMINA_GAIN, new_stamina: newStaminaCash, new_addiction: newAddictionCash });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
