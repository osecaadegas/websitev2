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

type Card = { suit: string; value: string };
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const v of VALUES) deck.push({ suit: s, value: v });
  return [...deck, ...deck, ...deck, ...deck]; // 4 decks
}

function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardVal(card: Card): number {
  if (["J", "Q", "K"].includes(card.value)) return 10;
  if (card.value === "A") return 11;
  return parseInt(card.value);
}

function handValue(hand: Card[]): number {
  let total = hand.reduce((s, c) => s + cardVal(c), 0);
  let aces = hand.filter((c) => c.value === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isSoft17(hand: Card[]): boolean {
  const hasAce = hand.some((c) => c.value === "A");
  const total = handValue(hand);
  if (!hasAce) return false;
  // Check if removing 10 from an ace still sums to 17 (soft)
  const rawTotal = hand.reduce((s, c) => s + cardVal(c), 0);
  return total === 17 && rawTotal > 17;
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
    .eq("game_type", "blackjack")
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
        playerHand: state.playerHand,
        dealerHand: [state.dealerHand[0], { suit: "?", value: "?" }],
        playerValue: handValue(state.playerHand),
        dealerValue: handValue([state.dealerHand[0]]),
        canDouble: state.playerHand.length === 2,
      },
      player: { dirty_cash: player.dirty_cash, crypto: player.crypto, level: player.level },
    });
  }

  return NextResponse.json({
    activeSession: null,
    player: { dirty_cash: player.dirty_cash, crypto: player.crypto, level: player.level },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("*").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  // ── DEAL ────────────────────────────────────────────────────
  if (action === "deal") {
    const { bet } = body;
    if (!bet || bet <= 0) return NextResponse.json({ error: "Aposta inválida" }, { status: 400 });

    const fee = getCasinoFee(player.level);
    const totalCost = bet + fee;
    if (player.dirty_cash < totalCost)
      return NextResponse.json({ error: `Precisas de $${totalCost.toLocaleString()} (aposta $${bet.toLocaleString()} + taxa $${fee.toLocaleString()})` }, { status: 400 });

    // Cancel any existing session
    await supabase.from("casino_sessions")
      .update({ status: "finished" })
      .eq("player_id", player.id).eq("game_type", "blackjack").eq("status", "active");

    const deck = shuffle(buildDeck());
    const playerHand: Card[] = [deck.pop()!, deck.pop()!];
    const dealerHand: Card[] = [deck.pop()!, deck.pop()!];
    const pv = handValue(playerHand);
    const dv = handValue(dealerHand);
    const playerBJ = pv === 21 && playerHand.length === 2;
    const dealerBJ = dv === 21 && dealerHand.length === 2;

    await supabase.from("crime_players").update({ dirty_cash: player.dirty_cash - totalCost }).eq("id", player.id);

    let status = "active";
    let result: string | null = null;
    let payout = 0;

    if (playerBJ || dealerBJ) {
      if (playerBJ && dealerBJ) { result = "push"; payout = bet; }
      else if (playerBJ) { result = "blackjack"; payout = Math.floor(bet * 2.5); }
      else { result = "dealer_blackjack"; payout = 0; }
      await supabase.from("crime_players").update({ crypto: player.crypto + payout }).eq("id", player.id);
      await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "blackjack", bet_amount: bet, payout, profit: payout - bet });
      status = "finished";
    }

    const state = { deck, playerHand, dealerHand, bet, fee, result, dealerRevealed: status === "finished" };
    const { data: session } = await supabase.from("casino_sessions").insert({
      player_id: player.id, game_type: "blackjack", bet, state, status,
    }).select().single();

    return NextResponse.json({
      success: true,
      sessionId: session?.id,
      playerHand,
      dealerHand: status === "active" ? [dealerHand[0], { suit: "?", value: "?" }] : dealerHand,
      playerValue: pv,
      dealerValue: status === "active" ? handValue([dealerHand[0]]) : dv,
      status,
      result,
      payout,
      fee,
      canDouble: playerHand.length === 2 && status === "active",
    });
  }

  // ── HIT / STAND / DOUBLE ────────────────────────────────────
  const { sessionId } = body;
  if (!sessionId) return NextResponse.json({ error: "sessionId em falta" }, { status: 400 });

  const { data: session } = await supabase.from("casino_sessions")
    .select("*").eq("id", sessionId).eq("player_id", player.id).eq("status", "active").maybeSingle();
  if (!session) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  let state = session.state as any;
  let { deck, playerHand, dealerHand, bet } = state;

  if (action === "double") {
    // Re-fetch player for updated dirty_cash after deal deduction
    const { data: freshPlayer } = await supabase.from("crime_players").select("dirty_cash, crypto").eq("id", player.id).single();
    if (!freshPlayer || freshPlayer.dirty_cash < bet)
      return NextResponse.json({ error: "Sem dinheiro sujo para dobrar!" }, { status: 400 });
    await supabase.from("crime_players").update({ dirty_cash: freshPlayer.dirty_cash - bet }).eq("id", player.id);
    bet = bet * 2;
    playerHand = [...playerHand, deck[deck.length - 1]];
    deck = deck.slice(0, -1);
  }

  if (action === "hit") {
    playerHand = [...playerHand, deck[deck.length - 1]];
    deck = deck.slice(0, -1);
  }

  const pv = handValue(playerHand);

  if (pv > 21) {
    // Bust
    const { data: fp } = await supabase.from("crime_players").select("crypto").eq("id", player.id).single();
    await supabase.from("casino_sessions").update({ status: "finished", state: { ...state, deck, playerHand, dealerHand, bet, result: "bust", dealerRevealed: true } }).eq("id", sessionId);
    await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "blackjack", bet_amount: bet, payout: 0, profit: -bet });
    return NextResponse.json({ success: true, playerHand, dealerHand, playerValue: pv, dealerValue: handValue(dealerHand), status: "finished", result: "bust", payout: 0 });
  }

  // Hit but not bust → keep playing
  if (action === "hit") {
    await supabase.from("casino_sessions").update({ state: { ...state, deck, playerHand, bet } }).eq("id", sessionId);
    return NextResponse.json({
      success: true,
      playerHand,
      dealerHand: [dealerHand[0], { suit: "?", value: "?" }],
      playerValue: pv,
      dealerValue: handValue([dealerHand[0]]),
      status: "active",
      canDouble: false,
    });
  }

  // Stand or double → dealer plays
  let dHand = [...dealerHand];
  while (handValue(dHand) < 17 || isSoft17(dHand)) {
    dHand = [...dHand, deck[deck.length - 1]];
    deck = deck.slice(0, -1);
  }
  const dv = handValue(dHand);
  let result: string;
  let payout: number;

  if (dv > 21 || pv > dv) { result = "win"; payout = bet * 2; }
  else if (pv === dv) { result = "push"; payout = bet; }
  else { result = "loss"; payout = 0; }

  const { data: fp } = await supabase.from("crime_players").select("crypto").eq("id", player.id).single();
  await supabase.from("crime_players").update({ crypto: (fp?.crypto ?? 0) + payout }).eq("id", player.id);
  await supabase.from("casino_sessions").update({ status: "finished", state: { ...state, deck, playerHand, dealerHand: dHand, bet, result, dealerRevealed: true } }).eq("id", sessionId);
  await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "blackjack", bet_amount: bet, payout, profit: payout - bet });

  return NextResponse.json({ success: true, playerHand, dealerHand: dHand, playerValue: pv, dealerValue: dv, status: "finished", result, payout });
}
