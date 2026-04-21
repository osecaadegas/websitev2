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
const COIN_MAP: Record<string, { realId: string; displayName: string; symbol: string; color: string }> = {
  "nether-coin":   { realId: "bitcoin",      displayName: "NetherCoin",   symbol: "NTC", color: "#f7931a" },
  "ghost-token":   { realId: "ethereum",     displayName: "GhostToken",   symbol: "GTK", color: "#627eea" },
  "shadow-node":   { realId: "solana",       displayName: "ShadowNode",   symbol: "SNO", color: "#9945ff" },
  "vault-coin":    { realId: "binancecoin",  displayName: "VaultCoin",    symbol: "VTC", color: "#f0b90b" },
  "phantom-chain": { realId: "ripple",       displayName: "PhantomChain", symbol: "PHC", color: "#00aae4" },
};

type PriceData = { usd: number; change24h: number; change7d: number; sparkline: number[] };

async function fetchMarketData(): Promise<Record<string, PriceData>> {
  const ids = Object.values(COIN_MAP).map((c) => c.realId).join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h%2C7d`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("CoinGecko unavailable");
    const data = await res.json();
    const result: Record<string, PriceData> = {};
    for (const coin of data) {
      result[coin.id] = {
        usd: coin.current_price ?? 0,
        change24h: Math.round((coin.price_change_percentage_24h ?? 0) * 100) / 100,
        change7d: Math.round((coin.price_change_percentage_7d_in_currency ?? 0) * 100) / 100,
        sparkline: coin.sparkline_in_7d?.price ?? [],
      };
    }
    return result;
  } catch {
    return {
      bitcoin:     { usd: 65000, change24h: 0.5,  change7d: 1.2,  sparkline: [] },
      ethereum:    { usd: 3200,  change24h: -0.3, change7d: -1.5, sparkline: [] },
      solana:      { usd: 150,   change24h: 1.2,  change7d: 3.1,  sparkline: [] },
      binancecoin: { usd: 580,   change24h: 0.1,  change7d: 0.8,  sparkline: [] },
      ripple:      { usd: 0.55,  change24h: -0.8, change7d: -2.3, sparkline: [] },
    };
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase.from("crime_players").select("id, dirty_cash, crypto").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const prices = await fetchMarketData();

  // Build market — real IDs never sent to client
  const market = Object.entries(COIN_MAP).map(([id, coin]) => {
    const p = prices[coin.realId] ?? { usd: 0, change24h: 0, change7d: 0, sparkline: [] };
    return {
      id,
      displayName: coin.displayName,
      symbol: coin.symbol,
      color: coin.color,
      price: p.usd,
      change24h: p.change24h,
      change7d: p.change7d,
      sparkline: p.sparkline,
    };
  });

  const { data: positions } = await supabase
    .from("stock_positions")
    .select("id, display_name, display_symbol, real_coin_id, bought_price, dirty_cash_invested, created_at")
    .eq("player_id", player.id)
    .order("created_at", { ascending: false });

  const positionsMapped = (positions ?? []).map((pos) => {
    const p = prices[pos.real_coin_id] ?? { usd: pos.bought_price, change24h: 0, change7d: 0, sparkline: [] };
    const pctChange = (p.usd - pos.bought_price) / pos.bought_price;
    const currentValue = Math.floor(pos.dirty_cash_invested * (1 + pctChange));
    // Disguised coinId so client can look up sparkline from market
    const coinId = Object.entries(COIN_MAP).find(([, c]) => c.realId === pos.real_coin_id)?.[0] ?? "";
    const color = COIN_MAP[coinId]?.color ?? "#888";
    return {
      id: pos.id,
      coinId,
      displayName: pos.display_name,
      symbol: pos.display_symbol,
      color,
      invested: pos.dirty_cash_invested,
      boughtPrice: pos.bought_price,
      currentPrice: p.usd,
      currentValue,
      pnl: currentValue - pos.dirty_cash_invested,
      pnlPercent: Math.round(pctChange * 10000) / 100,
      boughtAt: pos.created_at,
    };
  });

  return NextResponse.json({
    market,
    positions: positionsMapped,
    player: { dirty_cash: player.dirty_cash, crypto: player.crypto },
  });
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
    if (!amount || amount < 100 || amount > 10000) return NextResponse.json({ error: "Aposta inválida (min $100, max $10,000)" }, { status: 400 });
    if (player.dirty_cash < amount) return NextResponse.json({ error: "Dinheiro sujo insuficiente" }, { status: 400 });

    const prices = await fetchMarketData();
    const currentPrice = prices[coin.realId]?.usd;
    if (!currentPrice) return NextResponse.json({ error: "Erro ao obter preço" }, { status: 500 });

    const { data: fp } = await supabase.from("crime_players").select("dirty_cash").eq("id", player.id).single();
    const quantity = amount / currentPrice;
    await supabase.from("crime_players").update({ dirty_cash: (fp?.dirty_cash ?? player.dirty_cash) - amount }).eq("id", player.id);
    await supabase.from("stock_positions").insert({
      player_id: player.id,
      display_name: coin.displayName,
      display_symbol: coin.symbol,
      real_coin_id: coin.realId,
      bought_price: currentPrice,
      quantity,
      dirty_cash_invested: amount,
    });

    return NextResponse.json({ success: true, quantity, price: currentPrice, symbol: coin.symbol });
  }

  if (action === "sell") {
    const { positionId } = body;
    if (!positionId) return NextResponse.json({ error: "Posição inválida" }, { status: 400 });

    const { data: position } = await supabase.from("stock_positions")
      .select("*").eq("id", positionId).eq("player_id", player.id).maybeSingle();
    if (!position) return NextResponse.json({ error: "Posição não encontrada" }, { status: 404 });

    const prices = await fetchMarketData();
    const currentPrice = prices[position.real_coin_id]?.usd ?? position.bought_price;
    const pctChange = (currentPrice - position.bought_price) / position.bought_price;
    const payout = Math.floor(position.dirty_cash_invested * (1 + pctChange));
    const profit = payout - position.dirty_cash_invested;

    const { data: fp } = await supabase.from("crime_players").select("crypto").eq("id", player.id).single();
    await supabase.from("crime_players").update({ crypto: (fp?.crypto ?? player.crypto) + payout }).eq("id", player.id);
    await supabase.from("stock_positions").delete().eq("id", positionId);
    await supabase.from("gambling_history").insert({
      player_id: player.id, game_type: "stocks",
      bet_amount: position.dirty_cash_invested, payout, profit,
    });

    return NextResponse.json({ success: true, payout, profit });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
