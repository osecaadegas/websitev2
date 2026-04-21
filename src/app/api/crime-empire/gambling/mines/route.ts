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

  const body = await req.json();
  const { action } = body;

  // ── START ────────────────────────────────────────────────────
  if (action === "start") {
    const { bet, mineCount } = body;
    if (!bet || bet <= 0) return NextResponse.json({ error: "Aposta inválida" }, { status: 400 });
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
    await supabase.from("crime_players").update({ dirty_cash: player.dirty_cash - totalCost }).eq("id", player.id);

    const { data: session } = await supabase.from("casino_sessions").insert({
      player_id: player.id, game_type: "mines", bet,
      state: { grid, revealed, mineCount, revealedCount: 0, fee },
    }).select().single();

    return NextResponse.json({ success: true, sessionId: session?.id, fee, revealed, currentMultiplier: 1, currentPayout: Math.floor(bet / 2) });
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
      return NextResponse.json({ success: true, hit: "mine", revealed: newRevealed, payout: 0, status: "finished" });
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
    const { data: fp } = await supabase.from("crime_players").select("crypto").eq("id", player.id).single();
    await supabase.from("crime_players").update({ crypto: (fp?.crypto ?? 0) + payout }).eq("id", player.id);
    await supabase.from("casino_sessions").update({ status: "finished", state: { ...state, result: "cashout" } }).eq("id", sessionId);
    await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "mines", bet_amount: session.bet, payout, profit: payout - session.bet });
    return NextResponse.json({ success: true, payout, multiplier: mult, status: "finished" });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
