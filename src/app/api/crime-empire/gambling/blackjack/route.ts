import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { generateEscapeToken } from "@/lib/crime-empire/arrest-helpers";
import { grantXP } from "@/lib/crime-empire/xp";
import { trackMissionEvent } from "@/lib/crime-empire/missions";

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

/** E8: Grant XP to player */
/** Roll for police raid after a gambling session ends. Returns jail info if arrested. */
async function rollGamblingArrest(playerId: string, playerClass: string, bet: number, cryptoAtRisk: number): Promise<{
  arrested: boolean; jailMinutes?: number; jailReleaseAt?: string; escapeToken?: string; cryptoAtRisk?: number;
}> {
  const baseRisk = 0.15; // 15% per session
  const risk = playerClass === "scammer" ? baseRisk * 0.5 : baseRisk;
  if (Math.random() >= risk) return { arrested: false };

  const jailMinutes = 20 + Math.floor(Math.random() * 21);
  const jailReleaseAt = new Date(Date.now() + jailMinutes * 60_000).toISOString();
  const et = generateEscapeToken();
  await supabase.from("crime_players").update({
    in_jail: true,
    jail_release_at: jailReleaseAt,
    escape_token: et.escape_token,
    escape_token_expires_at: et.escape_token_expires_at,
    escape_cash_at_risk: bet,
    escape_crypto_at_risk: cryptoAtRisk,
  }).eq("id", playerId);
  await supabase.from("player_notifications").insert({
    player_id: playerId,
    type: "jail_released",
    title: "🚔 Apanhado no Casino!",
    message: `A polícia fez uma rusga ao casino. Ficaste preso por ${jailMinutes} minutos.`,
  });
  return { arrested: true, jailMinutes, jailReleaseAt, escapeToken: et.escape_token, cryptoAtRisk };
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
  if (!hand.some((c) => c.value === "A")) return false;
  if (handValue(hand) !== 17) return false;
  // Hard total: all aces counted as 1. If hardTotal+10 <= 21, one ace CAN count as 11 → soft 17.
  // Fixes: A-6 (hardTotal=7, 17≤21 → true) and A-A-6-9 (hardTotal=17, 27>21 → false, hard 17)
  const hardTotal = hand.reduce((s, c) => s + (c.value === "A" ? 1 : cardVal(c)), 0);
  return hardTotal + 10 <= 21;
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

  if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date()) {
    return NextResponse.json({ error: "Estás na prisão. Não podes jogar no casino." }, { status: 403 });
  }
  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  // ── DEAL ────────────────────────────────────────────────────
  if (action === "deal") {
    const { bet } = body;
    if (!bet || bet < 100 || bet > 10000) return NextResponse.json({ error: "Aposta inválida (min $100, max $10,000)" }, { status: 400 });

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
    void trackMissionEvent(player.id, "onCasinoPlay", 1);
    // E8: XP for placing a bet
    await grantXP(player.id, 10);

    let status = "active";
    let result: string | null = null;
    let payout = 0;

    if (playerBJ || dealerBJ) {
      if (playerBJ && dealerBJ) { result = "push"; payout = Math.floor(bet / 2); }
      else if (playerBJ) { result = "blackjack"; payout = Math.floor(bet * 1.25); }
      else { result = "dealer_blackjack"; payout = 0; }
      const { data: fpBJ } = await supabase.from("crime_players").select("crypto, stamina, max_stamina, addiction").eq("id", player.id).single();
      const newStaminaBJ = Math.min(fpBJ?.max_stamina ?? player.max_stamina, (fpBJ?.stamina ?? player.stamina) + GAMBLING_STAMINA_GAIN);
      const newAddictionBJ = Math.min(100, (fpBJ?.addiction ?? player.addiction ?? 0) + GAMBLING_ADDICTION_GAIN);
      await supabase.from("crime_players").update({ crypto: (fpBJ?.crypto ?? player.crypto) + payout, stamina: newStaminaBJ, addiction: newAddictionBJ }).eq("id", player.id);
      await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "blackjack", bet_amount: bet, payout, profit: payout - bet });
      status = "finished";
      const arrestInfo = await rollGamblingArrest(player.id, player.class, bet, Math.min(player.crypto ?? 0, bet));
      const state2 = { deck, playerHand, dealerHand, bet, fee, result, dealerRevealed: true };
      const { data: session2 } = await supabase.from("casino_sessions").insert({
        player_id: player.id, game_type: "blackjack", bet, state: state2, status,
      }).select().single();
      return NextResponse.json({
        success: true, sessionId: session2?.id, playerHand, dealerHand,
        playerValue: pv, dealerValue: dv, status, result, payout, fee,
        canDouble: false, arrested: arrestInfo.arrested, jailMinutes: arrestInfo.jailMinutes, escape_token: arrestInfo.escapeToken ?? null,
        crypto_at_risk: arrestInfo.cryptoAtRisk ?? 0,
        stamina_gained: GAMBLING_STAMINA_GAIN, new_stamina: newStaminaBJ, new_addiction: newAddictionBJ,
      });
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
    await supabase.from("casino_sessions").update({ status: "finished", state: { ...state, deck, playerHand, dealerHand, bet, result: "bust", dealerRevealed: true } }).eq("id", sessionId);
    await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "blackjack", bet_amount: bet, payout: 0, profit: -bet });
    const newStaminaBust = Math.min(player.max_stamina, player.stamina + GAMBLING_STAMINA_GAIN);
    const newAddictionBust = Math.min(100, (player.addiction ?? 0) + GAMBLING_ADDICTION_GAIN);
    await supabase.from("crime_players").update({ stamina: newStaminaBust, addiction: newAddictionBust }).eq("id", player.id);
    const arrestInfo = await rollGamblingArrest(player.id, player.class, bet, Math.min(player.crypto ?? 0, bet));
    return NextResponse.json({ success: true, playerHand, dealerHand, playerValue: pv, dealerValue: handValue(dealerHand), status: "finished", result: "bust", payout: 0, arrested: arrestInfo.arrested, jailMinutes: arrestInfo.jailMinutes, escape_token: arrestInfo.escapeToken ?? null, crypto_at_risk: arrestInfo.cryptoAtRisk ?? 0, stamina_gained: GAMBLING_STAMINA_GAIN, new_stamina: newStaminaBust, new_addiction: newAddictionBust });
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

  if (dv > 21 || pv > dv) { result = "win"; payout = bet; }
  else if (pv === dv) { result = "push"; payout = Math.floor(bet / 2); }
  else { result = "loss"; payout = 0; }

  const { data: fp } = await supabase.from("crime_players").select("crypto, stamina, max_stamina, addiction").eq("id", player.id).single();
  const newStamina = Math.min(fp?.max_stamina ?? player.max_stamina, (fp?.stamina ?? player.stamina) + GAMBLING_STAMINA_GAIN);
  const newAddiction = Math.min(100, (fp?.addiction ?? player.addiction ?? 0) + GAMBLING_ADDICTION_GAIN);
  await supabase.from("crime_players").update({ crypto: (fp?.crypto ?? 0) + payout, stamina: newStamina, addiction: newAddiction }).eq("id", player.id);
  await supabase.from("casino_sessions").update({ status: "finished", state: { ...state, deck, playerHand, dealerHand: dHand, bet, result, dealerRevealed: true } }).eq("id", sessionId);
  await supabase.from("gambling_history").insert({ player_id: player.id, game_type: "blackjack", bet_amount: bet, payout, profit: payout - bet });
  const arrestInfo = await rollGamblingArrest(player.id, player.class, bet, Math.min(player.crypto ?? 0, bet));
  if (result === "win" || result === "blackjack") void trackMissionEvent(player.id, "onCasinoWin", 1);
  void trackMissionEvent(player.id, "onCasinoSessionEnd", 1);

  return NextResponse.json({ success: true, playerHand, dealerHand: dHand, playerValue: pv, dealerValue: dv, status: "finished", result, payout, arrested: arrestInfo.arrested, jailMinutes: arrestInfo.jailMinutes, escape_token: arrestInfo.escapeToken ?? null, crypto_at_risk: arrestInfo.cryptoAtRisk ?? 0, stamina_gained: GAMBLING_STAMINA_GAIN, new_stamina: newStamina, new_addiction: newAddiction });
}
