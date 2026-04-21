import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/* ── Bonus Hunt Sync from Overlay ────────────────────────────────────
   Fetches live bonus hunt data from overlay API and imports it.
   
   Usage:
     POST /api/bonus-hunt/sync
     Body: { "overlay_api_key": "YOUR_KEY" }
   
   Or query params:
     POST /api/bonus-hunt/sync?key=YOUR_KEY
──────────────────────────────────────────────────────────────────── */

interface OverlayBonus {
  slotName?: string;
  name?: string;
  betSize?: number;
  bet?: number;
  buy?: number;
  opened?: boolean;
  isOpened?: boolean;
  result?: number;
  win?: number;
  payout?: number;
  isSuperBonus?: boolean;
  isExtremeBonus?: boolean;
  slot?: {
    name?: string;
    image?: string;
    provider?: string;
    rtp?: number;
    volatility?: string;
    max_win_multiplier?: number;
    maxWin?: number;
  };
  // Fallback fields if slot metadata is at root level
  image?: string;
  provider?: string;
  rtp?: number;
  volatility?: string;
  max_win_multiplier?: number;
}

interface OverlayResponse {
  hunt_name?: string;
  huntName?: string;
  name?: string;
  phase?: "hunting" | "opening" | "completed";
  status?: string;
  currency?: string;
  hunt_date?: string;
  huntDate?: string;
  date?: string;
  start_money?: number;
  startMoney?: number;
  initial_buy?: number;
  initialBuy?: number;
  bankroll?: number;
  stop_loss?: number;
  stopLoss?: number;
  total_win?: number;
  totalWin?: number;
  profit?: number;
  bonus_count?: number;
  bonusCount?: number;
  count?: number;
  bonuses_opened?: number;
  bonusesOpened?: number;
  opened?: number;
  avg_multi?: number;
  avgMulti?: number;
  best_multi?: number;
  bestMulti?: number;
  best_slot_name?: string;
  bestSlotName?: string;
  bonuses?: OverlayBonus[];
  slots?: OverlayBonus[];
  items?: OverlayBonus[];
}

export async function POST(request: NextRequest) {
  // Auth check — admin only
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("twitch_session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let session;
  try {
    session = JSON.parse(sessionCookie);
  } catch {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  if (session.role !== "admin" && session.role !== "configurador") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Get overlay API key from environment variable
  const overlayApiKey = process.env.OVERLAY_API_KEY;

  if (!overlayApiKey) {
    console.error("[sync] OVERLAY_API_KEY is not configured");
    return NextResponse.json(
      { error: "OVERLAY_API_KEY não configurada no servidor" },
      { status: 503 }
    );
  }

  // Fetch from overlay API
  const overlayUrl = `https://osecaadegas.pt/api/streamer-data?key=${overlayApiKey}&action=bonus_hunt`;
  
  let overlayData: OverlayResponse;
  try {
    const response = await fetch(overlayUrl);
    if (!response.ok) {
      throw new Error(`Overlay API retornou ${response.status}: ${response.statusText}`);
    }
    overlayData = await response.json();
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar dados do overlay: " + error.message },
      { status: 502 }
    );
  }

  // Normalize the response (handle different field names)
  const huntName = overlayData.hunt_name || overlayData.huntName || overlayData.name || "Bonus Hunt";
  const bonuses = overlayData.bonuses || overlayData.slots || overlayData.items || [];
  
  if (!bonuses.length) {
    return NextResponse.json(
      { error: "Nenhum bonus encontrado na resposta do overlay" },
      { status: 400 }
    );
  }

  // Detect phase if not provided
  const openedCount = bonuses.filter((b) => b.opened || b.isOpened).length;
  const phase = 
    overlayData.phase || 
    (overlayData.status === "completed" ? "completed" : 
     openedCount === 0 ? "hunting" : 
     openedCount < bonuses.length ? "opening" : "completed");

  // Calculate total buy
  const totalBuy = bonuses.reduce((sum, b) => sum + (b.betSize || b.bet || b.buy || 0), 0);

  // Insert session
  const { data: sessionRow, error: sessionError } = await supabase
    .from("bonus_hunt_sessions")
    .insert({
      title: huntName,
      status: phase === "completed" ? "completed" : "active",
      phase: phase as "hunting" | "opening" | "completed",
      currency: overlayData.currency ?? "€",
      total_buy: totalBuy,
      total_result: overlayData.total_win || overlayData.totalWin || 0,
      start_money: overlayData.initial_buy || overlayData.initialBuy || overlayData.bankroll || overlayData.start_money || overlayData.startMoney || 0,
      stop_loss: overlayData.stop_loss || overlayData.stopLoss || 0,
      profit: overlayData.profit ?? 0,
      bonus_count: overlayData.bonus_count || overlayData.bonusCount || overlayData.count || bonuses.length,
      bonuses_opened: overlayData.bonuses_opened || overlayData.bonusesOpened || overlayData.opened || openedCount,
      avg_multi: overlayData.avg_multi || overlayData.avgMulti || 0,
      best_multi: overlayData.best_multi || overlayData.bestMulti || 0,
      best_slot_name: overlayData.best_slot_name || overlayData.bestSlotName || null,
      hunt_date: overlayData.hunt_date || overlayData.huntDate || overlayData.date || null,
      completed_at: phase === "completed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (sessionError || !sessionRow) {
    console.error("[sync] session insert error:", sessionError);
    return NextResponse.json(
      { error: "Erro ao criar sessão: " + (sessionError?.message ?? "desconhecido") },
      { status: 500 }
    );
  }

  // Insert slots
  const slotRows = bonuses.map((b, i) => {
    const isOpened = b.opened || b.isOpened || false;
    const slotName = b.slotName || b.name || b.slot?.name || "Unknown";
    const betSize = b.betSize || b.bet || b.buy || 0;
    
    return {
      session_id: sessionRow.id,
      name: slotName,
      provider: b.slot?.provider || b.provider || null,
      buy_value: betSize,
      potential_multiplier: b.slot?.max_win_multiplier || b.slot?.maxWin || b.max_win_multiplier || 0,
      result: isOpened ? (b.result || b.win || null) : null,
      bet_size: betSize,
      rtp: b.slot?.rtp || b.rtp || null,
      volatility: b.slot?.volatility || b.volatility || null,
      is_super_bonus: b.isSuperBonus ?? false,
      is_extreme_bonus: b.isExtremeBonus ?? false,
      opened: isOpened,
      payout: isOpened ? (b.payout || b.win || b.result || null) : null,
      thumbnail_url: b.slot?.image || b.image || null,
      status: isOpened ? "completed" : "pending",
      order_index: i,
    };
  });

  const { error: slotsError } = await supabase
    .from("bonus_hunt_slots")
    .insert(slotRows);

  if (slotsError) {
    await supabase.from("bonus_hunt_sessions").delete().eq("id", sessionRow.id);
    console.error("[sync] slots insert error:", slotsError);
    return NextResponse.json(
      { error: "Erro ao inserir slots: " + slotsError.message },
      { status: 500 }
    );
  }

  console.log(`[sync] imported "${huntName}" → session ${sessionRow.id} (${slotRows.length} slots, phase: ${phase})`);

  return NextResponse.json({
    success: true,
    session_id: sessionRow.id,
    slots_imported: slotRows.length,
    hunt_name: huntName,
    phase: phase,
    source: "overlay_api",
  });
}
