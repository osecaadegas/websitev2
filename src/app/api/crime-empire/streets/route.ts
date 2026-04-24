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
    return NextResponse.json({ error: "Erro ao iniciar sessão" }, { status: 500 });
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

  const heatPct = session.heat / 100;
  const type = pickCustomerType(zone, heatPct);
  const customer = await spawnCustomer(type, player.level);

  if (!customer) {
    return NextResponse.json({ error: "Sem clientes disponíveis para o teu nível" }, { status: 400 });
  }

  const greeting = getDialogue(type, "greeting");

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
    name: rawCustomer.name,
    type: rawCustomer.type as CustomerType,
    budget: customerState?.budget ?? rawCustomer.budget_min,
    patience: customerState?.patience ?? rawCustomer.patience,
    riskTolerance: rawCustomer.risk_tolerance,
    snitchChance: rawCustomer.snitch_chance,
    preferredQty: rawCustomer.preferred_quantity,
    offersReceived: customerState?.offersReceived ?? 0,
    suspicion: customerState?.suspicion ?? 0,
  };

  const result = resolveNegotiation({
    customer,
    pricePerUnit,
    quantity,
    itemBasePrice: item.base_price,
    action: negotiationAction as "offer" | "push" | "discount" | "rush",
    zoneDef: zone,
    playerLevel: player.level,
  });

  const baseArrestRisk = player.class === "dealer" ? 0.08 : 0.15;
  const arrestRisk = baseArrestRisk + zone.riskMod;
  const newHeat = Math.min(100, session.heat + result.heatDelta);
  await supabase.from("street_sessions").update({ heat: newHeat }).eq("id", sessionId);

  const dialogue = getDialogue(customer.type as CustomerType, result.dialogueKey);

  if (result.outcome === "accept" && result.earned != null) {
    const caught = Math.random() < arrestRisk;
    if (caught) {
      return await triggerArrest(sessionId, player.id, quantity, entry, item, zone, newHeat);
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
    const snitchHeat = Math.min(100, session.heat + result.heatDelta);
    await supabase.from("street_sessions").update({ heat: snitchHeat }).eq("id", sessionId);
    await supabase.from("street_deals").insert({
      session_id: sessionId, customer_id: customerId, item_id: item.id,
      offered_price: pricePerUnit, agreed_price: null, quantity,
      success: false, snitched: true, heat_added: result.heatDelta,
    });
    if (snitchHeat >= 100) return await triggerBust(sessionId, player.id);
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

  const baseArrestRisk = player.class === "dealer" ? 0.08 : 0.15;
  const caught = Math.random() < (baseArrestRisk + zone.riskMod);
  if (caught) return await triggerArrest(sessionId, player.id, quantity, entry, item, zone, session.heat);

  const earned = Math.floor(agreedPrice * quantity * zone.rewardMult);
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
    dialogue: getDialogue("regular", "accept_fair"),
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

async function spawnCustomer(type: CustomerType, playerLevel: number): Promise<SpawnedCustomer | null> {
  const { data: pool } = await supabase
    .from("street_customers")
    .select("*")
    .eq("type", type)
    .lte("unlock_level", playerLevel);

  if (!pool || pool.length === 0) return null;
  const raw = pool[Math.floor(Math.random() * pool.length)];
  const budget = raw.budget_min + Math.floor(Math.random() * (raw.budget_max - raw.budget_min + 1));

  return {
    id: raw.id,
    name: raw.name,
    type: raw.type as CustomerType,
    budget,
    patience: raw.patience,
    riskTolerance: raw.risk_tolerance,
    snitchChance: raw.snitch_chance,
    preferredQty: raw.preferred_quantity,
    offersReceived: 0,
    suspicion: 0,
  };
}

async function triggerArrest(
  sessionId: string, playerId: string, quantity: number,
  entry: any, item: any, zone: any, currentHeat: number
) {
  await deductInventory(entry.id, entry.quantity, quantity);
  await supabase.from("street_sessions").update({
    status: "busted", heat: 100, ended_at: new Date().toISOString(),
  }).eq("id", sessionId);

  const jailMinutes = 20 + Math.floor(Math.random() * 21) + Math.floor(zone.riskMod * 30);
  const releaseAt = new Date(Date.now() + jailMinutes * 60000).toISOString();
  const et = generateEscapeToken();

  await supabase.from("crime_players").update({
    in_jail: true, jail_release_at: releaseAt,
    escape_token: et.escape_token, escape_token_expires_at: et.escape_token_expires_at,
  }).eq("id", playerId);

  return NextResponse.json({
    outcome: "arrested",
    escape_token: et.escape_token,
    jail_minutes: jailMinutes,
    jail_release_at: releaseAt,
    drug_name: item.name,
    amount_confiscated: quantity,
  });
}

async function triggerBust(sessionId: string, playerId: string) {
  await supabase.from("street_sessions").update({
    status: "busted", heat: 100, ended_at: new Date().toISOString(),
  }).eq("id", sessionId);

  const jailMinutes = 30 + Math.floor(Math.random() * 31);
  const releaseAt = new Date(Date.now() + jailMinutes * 60000).toISOString();
  const et = generateEscapeToken();

  await supabase.from("crime_players").update({
    in_jail: true, jail_release_at: releaseAt,
    escape_token: et.escape_token, escape_token_expires_at: et.escape_token_expires_at,
  }).eq("id", playerId);

  return NextResponse.json({
    outcome: "busted",
    escape_token: et.escape_token,
    jail_minutes: jailMinutes,
    jail_release_at: releaseAt,
  });
}
