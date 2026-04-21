import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/* ── Bonus Hunt Webhook ──────────────────────────────────────────────
   Accepts the same JSON payload as /api/bonus-hunt/import but
   authenticates via a shared secret header instead of a cookie.
   This lets the overlay website push completed hunts automatically.

   Required header:
     x-api-key: <value of BONUS_HUNT_WEBHOOK_SECRET env var>

   Payload: same ImportPayload shape as the manual import route.
──────────────────────────────────────────────────────────────────── */

interface ImportBonus {
  id?: number;
  slot: {
    rtp?: number | null;
    name: string;
    image?: string | null;
    provider?: string | null;
    volatility?: string | null;
    max_win_multiplier?: number | null;
  };
  opened: boolean;
  payout?: number;        // Optional if not opened
  result?: number;        // Optional if not opened
  betSize: number;
  slotName: string;
  isSuperBonus: boolean;
  isExtremeBonus: boolean;
}

interface WebhookPayload {
  hunt_name: string;
  phase: "hunting" | "opening" | "completed";
  currency?: string;
  hunt_date?: string;
  start_money: number;
  stop_loss: number;
  initial_buy?: number;  // Initial buy-in/bankroll entry
  total_bet?: number;
  total_win?: number;     // Optional during hunting
  profit?: number;        // Optional during hunting
  bonus_count: number;
  bonuses_opened?: number;  // Optional during hunting (will be 0)
  avg_multi?: number;     // Optional during hunting
  best_multi?: number;    // Optional during hunting
  best_slot_name?: string;
  bonuses: ImportBonus[];
}

export async function POST(request: NextRequest) {
  // Validate API key — must be set in env, never fall through on missing
  const webhookSecret = process.env.BONUS_HUNT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] BONUS_HUNT_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 });
  }

  const incomingKey = request.headers.get("x-api-key");
  if (!incomingKey || incomingKey !== webhookSecret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Parse body
  let data: WebhookPayload;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!data.hunt_name || !Array.isArray(data.bonuses) || !data.phase) {
    return NextResponse.json(
      { error: "Campos obrigatórios em falta: hunt_name, phase, bonuses" },
      { status: 400 }
    );
  }

  if (!['hunting', 'opening', 'completed'].includes(data.phase)) {
    return NextResponse.json(
      { error: "phase deve ser 'hunting', 'opening' ou 'completed'" },
      { status: 400 }
    );
  }

  const totalBuy = data.bonuses.reduce((sum, b) => sum + (b.betSize ?? 0), 0);
  const openedCount = data.bonuses.filter((b) => b.opened === true).length;

  // Insert session
  const { data: sessionRow, error: sessionError } = await supabase
    .from("bonus_hunt_sessions")
    .insert({
      title: data.hunt_name,
      status: data.phase === "completed" ? "completed" : "active",
      phase: data.phase,
      currency: data.currency ?? "€",
      total_buy: totalBuy,
      total_result: data.total_win ?? 0,
      start_money: data.initial_buy ?? data.start_money ?? 0,
      stop_loss: data.stop_loss ?? 0,
      profit: data.profit ?? 0,
      bonus_count: data.bonus_count ?? data.bonuses.length,
      bonuses_opened: data.bonuses_opened ?? openedCount,
      avg_multi: data.avg_multi ?? 0,
      best_multi: data.best_multi ?? 0,
      best_slot_name: data.best_slot_name ?? null,
      hunt_date: data.hunt_date ?? null,
      completed_at: data.phase === "completed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (sessionError || !sessionRow) {
    console.error("[webhook] session insert error:", sessionError);
    return NextResponse.json(
      { error: "Erro ao criar sessão: " + (sessionError?.message ?? "desconhecido") },
      { status: 500 }
    );
  }

  // Insert slots
  const slotRows = data.bonuses.map((b, i) => ({
    session_id: sessionRow.id,
    name: b.slotName || b.slot?.name || "Unknown",
    provider: b.slot?.provider ?? null,
    buy_value: b.betSize ?? 0,
    potential_multiplier: b.slot?.max_win_multiplier ?? 0,
    result: b.opened ? (b.result ?? null) : null,
    bet_size: b.betSize ?? null,
    rtp: b.slot?.rtp ?? null,
    volatility: b.slot?.volatility ?? null,
    is_super_bonus: b.isSuperBonus ?? false,
    is_extreme_bonus: b.isExtremeBonus ?? false,
    opened: b.opened ?? false,
    payout: b.opened ? (b.payout ?? null) : null,
    thumbnail_url: b.slot?.image ?? null,
    status: b.opened ? "completed" : "pending",
    order_index: i,
  }));

  const { error: slotsError } = await supabase
    .from("bonus_hunt_slots")
    .insert(slotRows);

  if (slotsError) {
    await supabase.from("bonus_hunt_sessions").delete().eq("id", sessionRow.id);
    console.error("[webhook] slots insert error:", slotsError);
    return NextResponse.json(
      { error: "Erro ao inserir slots: " + slotsError.message },
      { status: 500 }
    );
  }

  console.log(`[webhook] imported "${data.hunt_name}" → session ${sessionRow.id} (${slotRows.length} slots)`);

  return NextResponse.json({
    success: true,
    session_id: sessionRow.id,
    slots_imported: slotRows.length,
    hunt_name: data.hunt_name,
  });
}
