/**
 * /api/crime-empire/streets/route.ts
 * Street Selling System — full session-based negotiation API
 *
 * Endpoints (distinguished by `action` body param on POST, or plain GET):
 *
 *  GET  → load player inventory + active session (if any) + zone list
 *
 *  POST actions:
 *    start_session   – open a new session in a zone
 *    next_customer   – spawn the next customer for an active session
 *    negotiate       – submit an offer (or action: push/discount/rush)
 *    accept_deal     – finalise a counter-offer from customer
 *    reject_deal     – skip the current customer
 *    end_session     – voluntarily close the session
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { grantDirtyMoney } from "@/lib/dirty-money";
import { generateEscapeToken } from "@/lib/crime-empire/arrest-helpers";
import {
  ZONES,
  getZone,
  resolveNegotiation,
  getDialogue,
  getHeatStage,
  pickCustomerType,
  type SpawnedCustomer,
  type CustomerType,
} from "@/lib/street-defs";

export const dynamic = "force-dynamic";

// ─── Auth helper ────────────────────────────────────────────────────────────

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── XP helper ──────────────────────────────────────────────────────────────

async function grantXP(playerId: string, xpEarned: number) {
  if (xpEarned <= 0) return;
  const { data: p } = await supabase
    .from("crime_players")
    .select("xp, level, xp_to_next_level")
    .eq("id", playerId)
    .single();
  if (!p) return;
  let newXP = p.xp + xpEarned;
  let newLevel = p.level;
  while (newXP >= p.xp_to_next_level) { newXP -= p.xp_to_next_level; newLevel++; }
  const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));
  await supabase
    .from("crime_players")
    .update({ xp: newXP, level: newLevel, xp_to_next_level: newXPToNext })
    .eq("id", playerId);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — Load player state + active session + zones
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, class, level, dirty_cash, cash, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Drug inventory
  const { data: inventory } = await supabase
    .from("player_inventory")
    .select(`id, item_id, quantity, items(id, name, description, base_price, image_url, category)`)
    .eq("player_id", player.id)
    .gt("quantity", 0);

  const drugs = (inventory || []).filter((r: any) => r.items?.category === "drug");

  // Active session (if any)
  const { data: activeSession } = await supabase
    .from("street_sessions")
    .select("*")
    .eq("player_id", player.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Debug: verify street_customers is readable
  const { count: customerCount, error: custErr } = await supabase
    .from("street_customers")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({
    player: {
      id: player.id,
      class: player.class,
      level: player.level,
      dirty_cash: player.dirty_cash,
      cash: player.cash,
      in_jail: player.in_jail,
      jail_release_at: player.jail_release_at,
      hp: player.hp,
    },
    drugs,
    activeSession,
    zones: ZONES,
    _debug: { customerCount, custErr: custErr?.message },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Action dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "start_session":  return handleStartSession(body, user);
    case "next_customer":  return handleNextCustomer(body, user);
    case "negotiate":      return handleNegotiate(body, user);
    case "accept_deal":    return handleAcceptDeal(body, user);
    case "reject_deal":    return handleRejectDeal(body, user);
    case "end_session":    return handleEndSession(body, user);
    default:
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// start_session
// ─────────────────────────────────────────────────────────────────────────────

async function handleStartSession(body: any, user: any) {
  const { zoneId } = body;
  const zone = getZone(zoneId);
  if (!zone) return NextResponse.json({ error: "Zona inválida" }, { status: 400 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail) {
    const now = new Date();
    if (player.jail_release_at && new Date(player.jail_release_at) > now) {
      return NextResponse.json({ error: "Estás preso. Não podes vender." }, { status: 403 });
    }
    await supabase.from("crime_players").update({ in_jail: false, jail_release_at: null }).eq("id", player.id);
  }
  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital." }, { status: 403 });
  }
  if (player.level < zone.unlockLevel) {
    return NextResponse.json({ error: `Nível ${zone.unlockLevel} necessário para ${zone.name}.` }, { status: 403 });
  }

  // Close any stale active session
  await supabase
    .from("street_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("player_id", player.id)
    .eq("status", "active");

  const { data: session, error } = await supabase
    .from("street_sessions")
    .insert({ player_id: player.id, zone: zoneId, heat: 0, status: "active" })
    .select()
    .single();

  if (error || !session) {
    console.error("[streets] insert error:", error);
    return NextResponse.json({ error: "Erro ao iniciar sessão", detail: error?.message, code: error?.code }, { status: 500 });
  }

  return NextResponse.json({ session });
}

// ─────────────────────────────────────────────────────────────────────────────
// next_customer
// ─────────────────────────────────────────────────────────────────────────────

async function handleNextCustomer(body: any, user: any) {
  const { sessionId } = body;

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const session = await getActiveSession(sessionId, player.id);
  if (!session) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const zone = getZone(session.zone);
  if (!zone) return NextResponse.json({ error: "Zona inválida" }, { status: 500 });

  // Fetch player's drug inventory to generate a realistic client request
  const { data: inventory } = await supabase
    .from("player_inventory")
    .select("id, quantity, items(id, name, base_price, category)")
    .eq("player_id", player.id)
    .gt("quantity", 0);

  const drugs = (inventory || []).filter((r: any) => r.items?.category === "drug");

  const heatPct = session.heat / 100;
  const policeMult = await getPoliceMultiplier();
  const qtyBounds = await getQtyBounds();
  const type = pickCustomerType(zone, heatPct, policeMult);
  const customer = await spawnCustomer(type, player.level, drugs, qtyBounds);

  if (!customer) {
    const { count } = await supabase.from("street_customers").select("*", { count: "exact", head: true }).eq("type", type);
    console.error("[streets] spawnCustomer null. type:", type, "level:", player.level, "count for type:", count);
    return NextResponse.json({ error: `Sem clientes (tipo: ${type}, nível: ${player.level}, disponíveis: ${count ?? "erro RLS"})` }, { status: 400 });
  }

  const greeting = getDialogue(type, "greeting", {
    drug: customer.requestedDrugName,
    qty: customer.requestedQty,
  });

  return NextResponse.json({
    customer,
    greeting,
    session: { id: session.id, heat: session.heat, zone: session.zone },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// negotiate — player submits an offer
// ─────────────────────────────────────────────────────────────────────────────

async function handleNegotiate(body: any, user: any) {
  const {
    sessionId,
    customerId,
    inventoryId,
    pricePerUnit,
    quantity,
    negotiationAction = "offer",
    customerState,
  } = body;

  if (!sessionId || !customerId || !inventoryId || pricePerUnit == null || quantity == null) {
    return NextResponse.json({ error: "Parâmetros em falta" }, { status: 400 });
  }

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, class, level")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const session = await getActiveSession(sessionId, player.id);
  if (!session) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const zone = getZone(session.zone);
  if (!zone) return NextResponse.json({ error: "Zona inválida" }, { status: 500 });

  const { data: entry } = await supabase
    .from("player_inventory")
    .select("id, quantity, items(id, name, base_price, category)")
    .eq("id", inventoryId)
    .eq("player_id", player.id)
    .single();

  if (!entry) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  const item = (entry as any).items;
  if (!item || item.category !== "drug") {
    return NextResponse.json({ error: "Só podes vender drogas" }, { status: 400 });
  }
  if ((entry as any).quantity < quantity) {
    return NextResponse.json({ error: `Stock insuficiente (${(entry as any).quantity}g)` }, { status: 400 });
  }

  const { data: rawCustomer } = await supabase
    .from("street_customers")
    .select("*")
    .eq("id", customerId)
    .single();
  if (!rawCustomer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const customer: SpawnedCustomer = {
    id: rawCustomer.id,
    name: rawCustomer.type === "undercover" ? "???" : rawCustomer.name,
    type: rawCustomer.type as CustomerType,
    budget: customerState?.budget ?? rawCustomer.budget_min,
    patience: customerState?.patience ?? rawCustomer.patience,
    riskTolerance: rawCustomer.risk_tolerance,
    snitchChance: rawCustomer.snitch_chance,
    preferredQty: rawCustomer.preferred_quantity,
    offersReceived: customerState?.offersReceived ?? 0,
    suspicion: customerState?.suspicion ?? 0,
    requestedDrugName: customerState?.requestedDrugName ?? item?.name ?? "produto",
    requestedQty: customerState?.requestedQty ?? rawCustomer.preferred_quantity,
    requestedPriceExpectation: customerState?.requestedPriceExpectation ?? rawCustomer.budget_min,
    flexibility: customerState?.flexibility ?? 0.4,
  };

  // Scale snitch chance by police intensity before negotiation engine sees it
  const policeMult = await getPoliceMultiplier();
  customer.snitchChance = Math.min(1, customer.snitchChance * policeMult);

  const result = resolveNegotiation({
    customer,
    pricePerUnit,
    quantity,
    itemBasePrice: item.base_price,
    action: negotiationAction as "offer" | "push" | "discount" | "rush",
    zoneDef: zone,
    playerLevel: player.level,
  });

  const baseArrestRisk = (player.class === "dealer" ? 0.05 : 0.10) * policeMult;
  const arrestRisk = baseArrestRisk + zone.riskMod;
  const newHeat = Math.min(100, session.heat + result.heatDelta);
  await supabase.from("street_sessions").update({ heat: newHeat }).eq("id", sessionId);

  const dialogue = getDialogue(customer.type as CustomerType, result.dialogueKey, {
    drug: item.name,
    qty: quantity,
  });

  if (result.outcome === "accept" && result.earned != null) {
    const caught = Math.random() < arrestRisk;
    if (caught) {
      return await triggerArrest(sessionId, player.id, quantity, entry, item, zone, newHeat, policeMult, result.earned);
    }
    await deductInventory(inventoryId, (entry as any).quantity, quantity);
    await grantDirtyMoney(player.id, result.earned);
    await grantXP(player.id, Math.max(5, Math.floor(result.earned / 50)));
    await supabase.from("street_deals").insert({
      session_id: sessionId, customer_id: customerId, item_id: item.id,
      offered_price: pricePerUnit, agreed_price: pricePerUnit, quantity,
      success: true, snitched: false, heat_added: result.heatDelta,
    });
    return NextResponse.json({
      outcome: "accept", earned: result.earned, dialogue,
      heat: newHeat, heatStage: getHeatStage(newHeat),
      suspicion: customer.suspicion, offersReceived: customer.offersReceived + 1,
    });
  }

  if (result.outcome === "snitch") {
    const scaledHeatDelta = Math.round(result.heatDelta * policeMult);
    const snitchHeat = Math.min(100, session.heat + scaledHeatDelta);
    await supabase.from("street_sessions").update({ heat: snitchHeat }).eq("id", sessionId);
    await supabase.from("street_deals").insert({
      session_id: sessionId, customer_id: customerId, item_id: item.id,
      offered_price: pricePerUnit, agreed_price: null, quantity,
      success: false, snitched: true, heat_added: scaledHeatDelta,
    });
    if (snitchHeat >= 100) return await triggerBust(sessionId, player.id, policeMult);
    return NextResponse.json({
      outcome: "snitch", dialogue, heat: snitchHeat,
      heatStage: getHeatStage(snitchHeat),
      suspicion: customer.suspicion, offersReceived: customer.offersReceived + 1,
    });
  }

  if (result.outcome === "hostile") {
    await supabase.from("street_deals").insert({
      session_id: sessionId, customer_id: customerId, item_id: item.id,
      offered_price: pricePerUnit, agreed_price: null, quantity,
      success: false, snitched: false, heat_added: result.heatDelta,
    });
    return NextResponse.json({
      outcome: "hostile", dialogue, heat: newHeat,
      heatStage: getHeatStage(newHeat),
      suspicion: customer.suspicion, offersReceived: customer.offersReceived + 1,
    });
  }

  // counter or reject
  return NextResponse.json({
    outcome: result.outcome, dialogue,
    counterPrice: result.counterPrice, counterQty: result.counterQty,
    heat: newHeat, heatStage: getHeatStage(newHeat),
    suspicion: customer.suspicion,
    offersReceived: (customerState?.offersReceived ?? 0) + 1,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// accept_deal — player accepts a customer counter-offer
// ─────────────────────────────────────────────────────────────────────────────

async function handleAcceptDeal(body: any, user: any) {
  const { sessionId, customerId, inventoryId, agreedPrice, quantity } = body;

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, class")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const session = await getActiveSession(sessionId, player.id);
  if (!session) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const zone = getZone(session.zone);
  if (!zone) return NextResponse.json({ error: "Zona inválida" }, { status: 500 });

  const { data: entry } = await supabase
    .from("player_inventory")
    .select("id, quantity, items(id, name, base_price, category)")
    .eq("id", inventoryId)
    .eq("player_id", player.id)
    .single();

  if (!entry || (entry as any).quantity < quantity) {
    return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 });
  }
  const item = (entry as any).items;

  const policeMult = await getPoliceMultiplier();
  const baseArrestRisk = (player.class === "dealer" ? 0.05 : 0.10) * policeMult;
  const earned = Math.floor(agreedPrice * quantity * zone.rewardMult);
  const caught = Math.random() < (baseArrestRisk + zone.riskMod);
  if (caught) return await triggerArrest(sessionId, player.id, quantity, entry, item, zone, session.heat, policeMult, earned);

  await deductInventory(inventoryId, (entry as any).quantity, quantity);
  await grantDirtyMoney(player.id, earned);
  await grantXP(player.id, Math.max(5, Math.floor(earned / 50)));

  const heatDelta = zone.heatPerDeal;
  const newHeat = Math.min(100, session.heat + heatDelta);
  await supabase.from("street_sessions").update({ heat: newHeat }).eq("id", sessionId);
  await supabase.from("street_deals").insert({
    session_id: sessionId, customer_id: customerId, item_id: item.id,
    offered_price: agreedPrice, agreed_price: agreedPrice, quantity,
    success: true, snitched: false, heat_added: heatDelta,
  });

  return NextResponse.json({
    outcome: "accept", earned, heat: newHeat, heatStage: getHeatStage(newHeat),
    dialogue: getDialogue("regular", "accept_fair", {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// reject_deal — player skips current customer
// ─────────────────────────────────────────────────────────────────────────────

async function handleRejectDeal(body: any, user: any) {
  const { sessionId, customerId } = body;

  const { data: player } = await supabase
    .from("crime_players")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const session = await getActiveSession(sessionId, player.id);
  if (!session) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const heatDelta = 2;
  const newHeat = Math.min(100, session.heat + heatDelta);
  await supabase.from("street_sessions").update({ heat: newHeat }).eq("id", sessionId);

  if (customerId) {
    await supabase.from("street_deals").insert({
      session_id: sessionId, customer_id: customerId, item_id: null,
      offered_price: 0, agreed_price: null, quantity: 0,
      success: false, snitched: false, heat_added: heatDelta,
    });
  }

  return NextResponse.json({ heat: newHeat, heatStage: getHeatStage(newHeat) });
}

// ─────────────────────────────────────────────────────────────────────────────
// end_session — player voluntarily leaves
// ─────────────────────────────────────────────────────────────────────────────

async function handleEndSession(body: any, user: any) {
  const { sessionId } = body;

  const { data: player } = await supabase
    .from("crime_players")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  await supabase
    .from("street_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("player_id", player.id);

  const { data: deals } = await supabase
    .from("street_deals")
    .select("success, snitched, agreed_price, quantity")
    .eq("session_id", sessionId);

  const successful = (deals || []).filter((d: any) => d.success);
  const totalEarned = successful.reduce(
    (sum: number, d: any) => sum + (d.agreed_price ?? 0) * (d.quantity ?? 0),
    0
  );

  return NextResponse.json({
    ended: true,
    totalDeals: deals?.length ?? 0,
    successfulDeals: successful.length,
    totalEarned,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getActiveSession(sessionId: string, playerId: string) {
  const { data } = await supabase
    .from("street_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("player_id", playerId)
    .eq("status", "active")
    .single();
  return data;
}

async function deductInventory(inventoryId: string, currentQty: number, amount: number) {
  const newQty = currentQty - amount;
  if (newQty <= 0) {
    await supabase.from("player_inventory").delete().eq("id", inventoryId);
  } else {
    await supabase.from("player_inventory").update({ quantity: newQty }).eq("id", inventoryId);
  }
}

async function spawnCustomer(
  type: CustomerType,
  playerLevel: number,
  drugs: any[] = [],
  qtyBounds: { min: number; max: number } = { min: 3, max: 100 }
): Promise<SpawnedCustomer | null> {
  // ── Worker: pull from active brothel workers (any player) ──────────────
  if (type === "worker") {
    const { data: workerPool } = await supabase
      .from("brothel_workers")
      .select("id, name, salary, worker_def_id")
      .eq("status", "healthy")
      .limit(50);

    if (!workerPool || workerPool.length === 0) {
      // No workers in the system yet — fall back to regular
      return spawnCustomer("regular", playerLevel, drugs, qtyBounds);
    }

    const raw = workerPool[Math.floor(Math.random() * workerPool.length)];
    const hourlyEarnings = Number(raw.salary ?? 200);
    const budget = Math.floor(hourlyEarnings * (3 + Math.random() * 5)); // 3–8h of wages

    let requestedDrugName = "produto";
    let requestedQty = 5;
    let requestedPriceExpectation = 100;

    if (drugs.length > 0) {
      const pick = drugs[Math.floor(Math.random() * drugs.length)];
      const item = pick.items;
      requestedDrugName = item.name;
      requestedPriceExpectation = Math.round(item.base_price * (0.85 + Math.random() * 0.4));
      const rawQty = Math.max(qtyBounds.min, Math.min(
        Math.round(5 * (0.8 + Math.random() * 0.6)),
        qtyBounds.max,
        pick.quantity
      ));
      requestedQty = Math.max(qtyBounds.min, Math.min(rawQty, 20)); // workers buy small amounts
    }

    return {
      id: String(raw.id),
      name: raw.name,
      type: "worker",
      budget,
      patience: 5,
      riskTolerance: 5,
      snitchChance: 0.02, // very discreet
      preferredQty: requestedQty,
      offersReceived: 0,
      suspicion: 0,
      requestedDrugName,
      requestedQty,
      requestedPriceExpectation,
      flexibility: 0.5,
    };
  }

  // ── All other types: pull from street_customers table ──────────────────
  const { data: pool, error } = await supabase
    .from("street_customers")
    .select("*")
    .eq("type", type)
    .lte("unlock_level", playerLevel);

  if (error) {
    console.error("[spawnCustomer] Supabase error:", error.message, error.code);
    return null;
  }
  if (!pool || pool.length === 0) {
    console.warn("[spawnCustomer] Empty pool. type:", type, "level:", playerLevel);
    return null;
  }
  const raw = pool[Math.floor(Math.random() * pool.length)];
  const budget = raw.budget_min + Math.floor(Math.random() * (raw.budget_max - raw.budget_min + 1));

  // Build client drug request from player's actual inventory
  let requestedDrugName = "produto";
  let requestedQty = raw.preferred_quantity;
  let requestedPriceExpectation = 100;
  let flexibility = 0.4;

  if (drugs.length > 0) {
    const pick = drugs[Math.floor(Math.random() * drugs.length)];
    const item = pick.items;
    requestedDrugName = item.name;
    requestedPriceExpectation = Math.round(item.base_price * (0.8 + Math.random() * 0.5));
    // Qty: 75–140% of preferred_quantity, capped at available stock and admin bounds
    const qtyFactor = 0.75 + Math.random() * 0.65;
    const rawQty = Math.round(raw.preferred_quantity * qtyFactor);
    const clampedQty = Math.min(rawQty, pick.quantity, qtyBounds.max);
    requestedQty = Math.max(qtyBounds.min, clampedQty);
    // Flexibility: higher for regular/tourist, lower for dealer/junkie
    flexibility = type === "tourist" ? 0.7
      : type === "regular" ? 0.5
      : type === "dealer" ? 0.3
      : type === "junkie" ? 0.2
      : 0.4; // undercover
  }

  return {
    id: raw.id,
    name: raw.type === "undercover" ? "???" : raw.name,
    type: raw.type as CustomerType,
    budget,
    patience: raw.patience,
    riskTolerance: raw.risk_tolerance,
    snitchChance: raw.snitch_chance,
    preferredQty: raw.preferred_quantity,
    offersReceived: 0,
    suspicion: 0,
    requestedDrugName,
    requestedQty,
    requestedPriceExpectation,
    flexibility,
  };
}

async function getPoliceMultiplier(): Promise<number> {
  const { data } = await supabase
    .from("ce_system_settings")
    .select("value")
    .eq("key", "police_intensity")
    .single();
  const intensity = Number(data?.value ?? 50);
  // intensity 50 = 1.0× (default), 0 = no police, 100 = 2×
  return Math.min(2, Math.max(0, intensity / 50));
}

async function getQtyBounds(): Promise<{ min: number; max: number }> {
  const { data } = await supabase
    .from("ce_system_settings")
    .select("key, value")
    .in("key", ["street_qty_min", "street_qty_max"]);
  const rows = data || [];
  const get = (k: string, def: number) => Number(rows.find((r: any) => r.key === k)?.value ?? def);
  return { min: get("street_qty_min", 3), max: get("street_qty_max", 100) };
}

async function triggerArrest(
  sessionId: string, playerId: string, quantity: number,
  entry: any, item: any, zone: any, currentHeat: number, policeMult = 1.0, earnedPending = 0
) {
  await deductInventory(entry.id, entry.quantity, quantity);
  await supabase.from("street_sessions").update({
    status: "busted", heat: 100, ended_at: new Date().toISOString(),
  }).eq("id", sessionId);

  const baseJail = 10 + Math.floor(Math.random() * 15) + Math.floor(zone.riskMod * 20);
  const jailMinutes = Math.max(2, Math.round(baseJail * policeMult));
  const releaseAt = new Date(Date.now() + jailMinutes * 60000).toISOString();
  const et = generateEscapeToken();

  await supabase.from("crime_players").update({
    in_jail: true, jail_release_at: releaseAt,
    escape_token: et.escape_token, escape_token_expires_at: et.escape_token_expires_at,
    escape_pending_cash: earnedPending,
  }).eq("id", playerId);

  return NextResponse.json({
    outcome: "arrested",
    escape_token: et.escape_token,
    jail_minutes: jailMinutes,
    jail_release_at: releaseAt,
    drug_name: item.name,
    amount_confiscated: quantity,
    earned_pending: earnedPending,
  });
}

async function triggerBust(sessionId: string, playerId: string, policeMult = 1.0) {
  await supabase.from("street_sessions").update({
    status: "busted", heat: 100, ended_at: new Date().toISOString(),
  }).eq("id", sessionId);

  const baseJail = 15 + Math.floor(Math.random() * 21);
  const jailMinutes = Math.max(2, Math.round(baseJail * policeMult));
  const releaseAt = new Date(Date.now() + jailMinutes * 60000).toISOString();
  const et = generateEscapeToken();

  await supabase.from("crime_players").update({
    in_jail: true, jail_release_at: releaseAt,
    escape_token: et.escape_token, escape_token_expires_at: et.escape_token_expires_at,
    escape_pending_cash: 0,
  }).eq("id", playerId);

  return NextResponse.json({
    outcome: "busted",
    escape_token: et.escape_token,
    jail_minutes: jailMinutes,
    jail_release_at: releaseAt,
    earned_pending: 0,
  });
}
