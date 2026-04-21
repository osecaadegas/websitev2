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

// Server-side only — real coin IDs NEVER sent to client
const COIN_MAP: Record<string, { realId: string; display: string; symbol: string; color: string }> = {
  "nether-coin":   { realId: "bitcoin",      display: "NetherCoin",   symbol: "NTC", color: "#f7931a" },
  "ghost-token":   { realId: "ethereum",     display: "GhostToken",   symbol: "GTK", color: "#627eea" },
  "shadow-node":   { realId: "solana",       display: "ShadowNode",   symbol: "SNO", color: "#9945ff" },
  "vault-coin":    { realId: "binancecoin",  display: "VaultCoin",    symbol: "VTC", color: "#f0b90b" },
  "phantom-chain": { realId: "ripple",       display: "PhantomChain", symbol: "PHC", color: "#00aae4" },
};

async function fetchPrices(): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  const ids = Object.values(COIN_MAP).map((c) => c.realId).join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("CoinGecko unavailable");
    return res.json();
  } catch {
    // Fallback if API is down
    return {
      bitcoin:     { usd: 65000, usd_24h_change: 0.5 },
      ethereum:    { usd: 3200,  usd_24h_change: -0.3 },
      solana:      { usd: 150,   usd_24h_change: 1.2 },
      binancecoin: { usd: 580,   usd_24h_change: 0.1 },
      ripple:      { usd: 0.55,  usd_24h_change: -0.8 },
    };
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("id, dirty_cash, crypto").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const prices = await fetchPrices();

  // Build market — strip real IDs before sending to client
  const market = Object.entries(COIN_MAP).map(([id, coin]) => {
    const p = prices[coin.realId] ?? { usd: 0, usd_24h_change: 0 };
    return { id, display: coin.display, symbol: coin.symbol, color: coin.color, price: p.usd, change24h: Math.round(p.usd_24h_change * 100) / 100 };
  });

  const { data: positions } = await supabase
    .from("stock_positions")
    .select("id, display_name, display_symbol, real_coin_id, bought_price, dirty_cash_invested, created_at")
    .eq("player_id", player.id);

  const positionsWithPnl = (positions ?? []).map((pos) => {
    const currentPrice = prices[pos.real_coin_id]?.usd ?? pos.bought_price;
    const pctChange = (currentPrice - pos.bought_price) / pos.bought_price;
    const currentValue = Math.floor(pos.dirty_cash_invested * (1 + pctChange));
    return {
      id: pos.id,
      display_name: pos.display_name,
      display_symbol: pos.display_symbol,
      dirty_cash_invested: pos.dirty_cash_invested,
      currentValue,
      profit: currentValue - pos.dirty_cash_invested,
      pctChange: Math.round(pctChange * 10000) / 100,
      created_at: pos.created_at,
    };
  });

  return NextResponse.json({ market, positions: positionsWithPnl, player: { dirty_cash: player.dirty_cash, crypto: player.crypto } });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("*").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  if (action === "buy") {
    const { coinId, amount } = body;
    const coin = COIN_MAP[coinId];
    if (!coin) return NextResponse.json({ error: "Moeda inválida" }, { status: 400 });
    if (!amount || amount < 1000) return NextResponse.json({ error: "Mínimo $1,000 para investir" }, { status: 400 });
    if (player.dirty_cash < amount) return NextResponse.json({ error: "Dinheiro sujo insuficiente" }, { status: 400 });

    const prices = await fetchPrices();
    const currentPrice = prices[coin.realId]?.usd;
    if (!currentPrice) return NextResponse.json({ error: "Erro ao obter preço" }, { status: 500 });

    const { data: fp } = await supabase.from("crime_players").select("dirty_cash").eq("id", player.id).single();
    await supabase.from("crime_players").update({ dirty_cash: (fp?.dirty_cash ?? player.dirty_cash) - amount }).eq("id", player.id);
    await supabase.from("stock_positions").insert({
      player_id: player.id,
      display_name: coin.display,
      display_symbol: coin.symbol,
      real_coin_id: coin.realId,
      bought_price: currentPrice,
      quantity: amount / currentPrice,
      dirty_cash_invested: amount,
    });

    return NextResponse.json({ success: true, message: `Investiste $${amount.toLocaleString()} em ${coin.display}!` });
  }

  if (action === "sell") {
    const { positionId } = body;
    if (!positionId) return NextResponse.json({ error: "Posição inválida" }, { status: 400 });

    const { data: position } = await supabase.from("stock_positions")
      .select("*").eq("id", positionId).eq("player_id", player.id).maybeSingle();
    if (!position) return NextResponse.json({ error: "Posição não encontrada" }, { status: 404 });

    const prices = await fetchPrices();
    const currentPrice = prices[position.real_coin_id]?.usd ?? position.bought_price;
    const pctChange = (currentPrice - position.bought_price) / position.bought_price;
    const sellValue = Math.floor(position.dirty_cash_invested * (1 + pctChange));
    const profit = sellValue - position.dirty_cash_invested;

    const { data: fp } = await supabase.from("crime_players").select("crypto").eq("id", player.id).single();
    await supabase.from("crime_players").update({ crypto: (fp?.crypto ?? player.crypto) + sellValue }).eq("id", player.id);
    await supabase.from("stock_positions").delete().eq("id", positionId);
    await supabase.from("gambling_history").insert({
      player_id: player.id, game_type: "stocks",
      bet_amount: position.dirty_cash_invested, payout: sellValue, profit,
    });

    return NextResponse.json({ success: true, sellValue, profit, message: `Vendeste ${position.display_name} por ⚡${sellValue.toLocaleString()} crypto!` });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
