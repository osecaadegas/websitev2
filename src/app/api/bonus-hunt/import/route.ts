import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/* ── Bonus Hunt JSON Import ──────────────────────────────────────────
   Accepts the JSON export from the overlay website and maps it
   into bonus_hunt_sessions + bonus_hunt_slots tables.
──────────────────────────────────────────────────────────────────── */

interface ImportBonus {
  id: number;
  slot: {
    rtp?: number | null;
    name: string;
    image?: string | null;
    provider?: string | null;
    volatility?: string | null;
    max_win_multiplier?: number | null;
  };
  opened: boolean;
  payout: number;
  result: number;
  betSize: number;
  slotName: string;
  isSuperBonus: boolean;
  isExtremeBonus: boolean;
}

interface ImportPayload {
  hunt_name: string;
  currency: string;
  hunt_date?: string;
  start_money: number;
  stop_loss: number;
  total_bet?: number;
  total_win: number;
  profit: number;
  bonus_count: number;
  bonuses_opened: number;
  avg_multi: number;
  best_multi: number;
  best_slot_name: string;
  phase?: "hunting" | "opening" | "completed";
  bonuses: ImportBonus[];
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

  // Parse the uploaded JSON
  let data: ImportPayload;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Validate required fields
  if (!data.hunt_name || !Array.isArray(data.bonuses)) {
    return NextResponse.json(
      { error: "Campos obrigatórios em falta: hunt_name, bonuses" },
      { status: 400 }
    );
  }

  // Calculate total_buy from betSize sum
  const totalBuy = data.bonuses.reduce((sum, b) => sum + (b.betSize ?? 0), 0);

  // 1. Insert session
  const { data: sessionRow, error: sessionError } = await supabase
    .from("bonus_hunt_sessions")
    .insert({
      title: data.hunt_name,
      status: "completed",
      phase: data.phase ?? "completed",
      currency: data.currency || "€",
      total_buy: totalBuy,
      total_result: data.total_win ?? 0,
      start_money: data.start_money ?? 0,
      stop_loss: data.stop_loss ?? 0,
      profit: data.profit ?? 0,
      bonus_count: data.bonus_count ?? data.bonuses.length,
      bonuses_opened: data.bonuses_opened ?? data.bonuses.filter((b) => b.opened).length,
      avg_multi: data.avg_multi ?? 0,
      best_multi: data.best_multi ?? 0,
      best_slot_name: data.best_slot_name || null,
      hunt_date: data.hunt_date || null,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (sessionError || !sessionRow) {
    return NextResponse.json(
      { error: "Erro ao criar sessão: " + (sessionError?.message ?? "desconhecido") },
      { status: 500 }
    );
  }

  // 2. Insert slots
  const slotRows = data.bonuses.map((b, i) => ({
    session_id: sessionRow.id,
    name: b.slotName || b.slot?.name || "Unknown",
    provider: b.slot?.provider || null,
    buy_value: b.betSize ?? 0,
    potential_multiplier: b.slot?.max_win_multiplier ?? 0,
    result: b.opened ? b.result ?? null : null,
    bet_size: b.betSize ?? null,
    rtp: b.slot?.rtp ?? null,
    volatility: b.slot?.volatility || null,
    is_super_bonus: b.isSuperBonus ?? false,
    is_extreme_bonus: b.isExtremeBonus ?? false,
    opened: b.opened ?? false,
    payout: b.opened ? b.payout ?? null : null,
    thumbnail_url: b.slot?.image || null,
    status: b.opened ? "completed" : "pending",
    order_index: i,
  }));

  const { error: slotsError } = await supabase
    .from("bonus_hunt_slots")
    .insert(slotRows);

  if (slotsError) {
    // Clean up the session if slots fail
    await supabase.from("bonus_hunt_sessions").delete().eq("id", sessionRow.id);
    return NextResponse.json(
      { error: "Erro ao inserir slots: " + slotsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    session_id: sessionRow.id,
    slots_imported: slotRows.length,
    hunt_name: data.hunt_name,
  });
}
