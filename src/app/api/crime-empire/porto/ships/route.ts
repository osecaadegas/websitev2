/**
 * /api/crime-empire/porto/ships/route.ts
 * Dynamic Ship Events System — Porto Antigo
 *
 * GET  → current/next ship, top contributors, player contribution, player drug inventory, activity feed
 * POST action="deliver"     → deliver drugs to current ship
 * POST action="reveal_ship" → pay 1000 crypto to reveal preview ship intel
 *
 * NOTE: All DB writes use supabaseAdmin (service role) to guarantee success on Vercel.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-server";
import { grantDirtyMoney } from "@/lib/dirty-money";

export const dynamic = "force-dynamic";

// ─── Auth helper ────────────────────────────────────────────────────────────

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── Ship name pools ─────────────────────────────────────────────────────────

const SHIP_NAMES = [
  "Ocean Reaper", "Midnight Tide", "Black Horizon", "Silver Ghost",
  "Porto Negro", "Vento do Sul", "Sombra do Mar", "Iron Current",
  "Deep Silence", "Storm Rider", "Crimson Wave", "Norte Perdido",
  "Água Funda", "Costa Sombria", "Mar Sem Lei", "Névoa de Ferro",
];

const ORIGIN_COUNTRIES: Record<string, string[]> = {
  normal:      ["Marrocos", "Argélia", "Holanda", "Espanha"],
  high_demand: ["Colômbia", "Venezuela", "Brasil", "Jamaica"],
  risky:       ["México", "El Salvador", "Guiné", "Panamá"],
};

// ─── Preview ship generator ───────────────────────────────────────────────────
// Creates a locked preview ship. Players can pay crypto to reveal its details.

async function createPreviewShip(afterDeparture: Date): Promise<void> {
  // Only create if no preview already exists
  const { count } = await supabaseAdmin
    .from("porto_ships")
    .select("id", { count: "exact", head: true })
    .eq("status", "preview");
  if ((count ?? 0) > 0) return;

  const { data: drugs } = await supabaseAdmin
    .from("items")
    .select("id, name, base_price")
    .eq("category", "drug")
    .order("base_price", { ascending: false });
  if (!drugs || drugs.length === 0) return;

  const drug      = drugs[Math.floor(Math.random() * Math.min(drugs.length, 5))];
  const roll      = Math.random();
  const shipClass = roll < 0.7 ? "normal" : roll < 0.9 ? "high_demand" : "risky";
  const priceMult =
    shipClass === "normal"      ? 1.3 + Math.random() * 0.7 :
    shipClass === "high_demand" ? 1.8 + Math.random() * 0.7 :
                                  1.5 + Math.random() * 0.5;

  const now           = new Date();
  const base          = new Date(Math.max(afterDeparture.getTime(), now.getTime()));
  const arrivalTime   = new Date(base.getTime() + 30 * 60_000);
  const durationHours = 6 + Math.floor(Math.random() * 7);
  const departureTime = new Date(arrivalTime.getTime() + durationHours * 3600_000);
  const origins       = ORIGIN_COUNTRIES[shipClass];

  await supabaseAdmin.from("porto_ships").insert({
    name:              SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)],
    drug_type:         drug.name,
    drug_item_id:      drug.id,
    capacity_total:    10000 + Math.floor(Math.random() * 40001),
    price_per_unit:    Math.floor(drug.base_price * priceMult),
    arrival_time:      arrivalTime.toISOString(),
    departure_time:    departureTime.toISOString(),
    status:            "preview",
    ship_class:        shipClass,
    origin_country:    origins[Math.floor(Math.random() * origins.length)],
    inspection_chance: shipClass === "risky" ? 15 : shipClass === "high_demand" ? 3 : 5,
    max_delivery:      5000,
    top_bonus_pct:     shipClass === "high_demand" ? 30 : 25,
  });
}

// ─── Ship generator ───────────────────────────────────────────────────────────
// Always creates a docked ship ready for deliveries.

async function createDockedShip(): Promise<void> {
  const { data: drugs, error: drugsErr } = await supabaseAdmin
    .from("items")
    .select("id, name, base_price")
    .eq("category", "drug")
    .order("base_price", { ascending: false });

  if (drugsErr || !drugs || drugs.length === 0) {
    console.error("[porto/ships] createDockedShip: no drug items found", drugsErr);
    return;
  }

  const drug          = drugs[Math.floor(Math.random() * Math.min(drugs.length, 5))];
  const roll          = Math.random();
  const shipClass     = roll < 0.7 ? "normal" : roll < 0.9 ? "high_demand" : "risky";
  const priceMult     =
    shipClass === "normal"      ? 1.3 + Math.random() * 0.7 :
    shipClass === "high_demand" ? 1.8 + Math.random() * 0.7 :
                                  1.5 + Math.random() * 0.5;
  const pricePerUnit  = Math.floor(drug.base_price * priceMult);
  const capacityTotal = 10000 + Math.floor(Math.random() * 40001);
  const durationHours = 6 + Math.floor(Math.random() * 7);
  const origins       = ORIGIN_COUNTRIES[shipClass];
  const shipName      = SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)];
  const now           = new Date();
  const departureTime = new Date(now.getTime() + durationHours * 3600_000);

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("porto_ships")
    .insert({
      name:              shipName,
      drug_type:         drug.name,
      drug_item_id:      drug.id,
      capacity_total:    capacityTotal,
      price_per_unit:    pricePerUnit,
      arrival_time:      now.toISOString(),
      departure_time:    departureTime.toISOString(),
      status:            "docked",
      ship_class:        shipClass,
      origin_country:    origins[Math.floor(Math.random() * origins.length)],
      inspection_chance: shipClass === "risky" ? 15 : shipClass === "high_demand" ? 3 : 5,
      max_delivery:      5000,
      top_bonus_pct:     shipClass === "high_demand" ? 30 : 25,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[porto/ships] createDockedShip INSERT failed:", JSON.stringify(insertErr));
    return;
  }

  await supabaseAdmin.from("porto_activity").insert({
    ship_id:    inserted.id,
    event_type: "ship_docked",
    message:    `"${shipName}" atracou com ${capacityTotal.toLocaleString("pt-PT")}g de ${drug.name}. Preço: 💵${pricePerUnit.toLocaleString("pt-PT")}/g.`,
  })

  // Schedule preview ship in background (non-critical)
  createPreviewShip(departureTime)
}

// ─── Tick: advance ship lifecycle ─────────────────────────────────────────────

async function tickShips(): Promise<void> {
  const now = new Date();

  // 1. scheduled → docked when arrival time has passed and not yet expired
  await supabaseAdmin
    .from("porto_ships")
    .update({ status: "docked" })
    .eq("status", "scheduled")
    .lte("arrival_time", now.toISOString())
    .gt("departure_time", now.toISOString());

  // 2. Stale scheduled: departure_time passed before docking → depart immediately
  const { data: staleScheduled } = await supabaseAdmin
    .from("porto_ships")
    .select("id, name, capacity_filled, capacity_total")
    .eq("status", "scheduled")
    .lte("departure_time", now.toISOString());

  for (const ship of staleScheduled ?? []) {
    await supabaseAdmin
      .from("porto_ships")
      .update({ status: "departed", departed_at: now.toISOString() })
      .eq("id", ship.id);
    await supabaseAdmin.from("porto_activity").insert({
      ship_id:    ship.id,
      event_type: "ship_departed",
      message:    `"${ship.name}" partiu sem atracar (janela ultrapassada). ${(ship.capacity_filled ?? 0).toLocaleString("pt-PT")}/${ship.capacity_total.toLocaleString("pt-PT")}g carregado.`,
    })
  }

  // 3. Docked → departed (timer expired OR full)
  const { data: dockedShips } = await supabaseAdmin
    .from("porto_ships")
    .select("id, name, capacity_total, capacity_filled, departure_time, ship_class, top_bonus_pct")
    .eq("status", "docked");

  for (const ship of dockedShips ?? []) {
    const timerExpired = new Date(ship.departure_time) <= now;
    const isFull       = ship.capacity_filled >= ship.capacity_total;
    if (!timerExpired && !isFull) continue;

    await supabaseAdmin
      .from("porto_ships")
      .update({ status: "departed", departed_at: now.toISOString() })
      .eq("id", ship.id);

    const { data: topContrib } = await supabaseAdmin
      .from("porto_ship_contributions")
      .select("player_id, quantity, earned")
      .eq("ship_id", ship.id)
      .order("quantity", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topContrib && topContrib.earned > 0) {
      const bonus = Math.floor(topContrib.earned * ((ship.top_bonus_pct ?? 25) / 100));
      if (bonus > 0) {
        await grantDirtyMoney(topContrib.player_id, bonus);
        await supabaseAdmin
          .from("porto_ship_contributions")
          .update({ top_bonus: bonus })
          .eq("ship_id", ship.id)
          .eq("player_id", topContrib.player_id);
      }
    }

    const reason = isFull ? "lotação completa" : "tempo esgotado";
    await supabaseAdmin.from("porto_activity").insert({
      ship_id:    ship.id,
      event_type: "ship_departed",
      message:    `"${ship.name}" partiu (${reason}). ${ship.capacity_filled.toLocaleString("pt-PT")}/${ship.capacity_total.toLocaleString("pt-PT")}g carregado.`,
    })
  }

  // 4. If no active ship → promote preview to docked OR create fresh docked ship
  const { count: activeCount } = await supabaseAdmin
    .from("porto_ships")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled", "docked"]);

  if ((activeCount ?? 0) === 0) {
    const { data: preview } = await supabaseAdmin
      .from("porto_ships")
      .select("id, departure_time")
      .eq("status", "preview")
      .order("arrival_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (preview) {
      // Promote preview → docked immediately, keep original duration
      const origDuration  = new Date(preview.departure_time).getTime() - Date.now();
      const newDeparture  = new Date(now.getTime() + Math.max(origDuration, 6 * 3600_000));
      await supabaseAdmin.from("porto_ships").update({
        status:         "docked",
        arrival_time:   now.toISOString(),
        departure_time: newDeparture.toISOString(),
      }).eq("id", preview.id);
      createPreviewShip(newDeparture)
    } else {
      // No preview either — create a fresh docked ship immediately
      await createDockedShip();
    }
  } else {
    // Active ship exists — ensure a preview is always queued
    const { count: previewCount } = await supabaseAdmin
      .from("porto_ships")
      .select("id", { count: "exact", head: true })
      .eq("status", "preview");
    if ((previewCount ?? 0) === 0) {
      const { data: activeShip } = await supabaseAdmin
        .from("porto_ships")
        .select("departure_time")
        .in("status", ["scheduled", "docked"])
        .order("arrival_time", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (activeShip) {
        const base = new Date(Math.max(new Date(activeShip.departure_time).getTime(), now.getTime()));
        createPreviewShip(base)
      }
    }
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, dirty_cash, in_jail, jail_release_at, hp, crypto")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Advance ship lifecycle (uses supabaseAdmin internally)
  await tickShips();

  // Current ship
  const { data: ships } = await supabaseAdmin
    .from("porto_ships")
    .select("*")
    .in("status", ["docked", "scheduled"])
    .order("arrival_time", { ascending: true })
    .limit(1);

  const currentShip = ships?.[0] ?? null;

  // Preview ship (intel locked)
  const { data: previewShips } = await supabaseAdmin
    .from("porto_ships")
    .select("id, name, arrival_time, departure_time, ship_class, capacity_total, drug_type, price_per_unit")
    .eq("status", "preview")
    .order("arrival_time", { ascending: true })
    .limit(1);
  const previewShip = previewShips?.[0] ?? null;

  let nextShipRevealed = false;
  if (previewShip) {
    const { data: intel } = await supabaseAdmin
      .from("porto_ship_intel")
      .select("id")
      .eq("ship_id", previewShip.id)
      .eq("player_id", player.id)
      .maybeSingle();
    nextShipRevealed = !!intel;
  }

  const nextShip = previewShip ? {
    id:             previewShip.id,
    name:           previewShip.name,
    arrival_time:   previewShip.arrival_time,
    departure_time: previewShip.departure_time,
    ship_class:     previewShip.ship_class as "normal" | "high_demand" | "risky",
    capacity_total: previewShip.capacity_total,
    drug_type:      nextShipRevealed ? previewShip.drug_type      : null,
    price_per_unit: nextShipRevealed ? previewShip.price_per_unit : null,
  } : null;

  // Top contributors
  let topContributors: { player_id: string; player_name: string; quantity: number; earned: number }[] = [];
  if (currentShip) {
    const { data: contribs } = await supabaseAdmin
      .from("porto_ship_contributions")
      .select("player_id, quantity, earned")
      .eq("ship_id", currentShip.id)
      .order("quantity", { ascending: false })
      .limit(10);

    if (contribs && contribs.length > 0) {
      const { data: playerNames } = await supabaseAdmin
        .from("crime_players")
        .select("id, username")
        .in("id", contribs.map((c: any) => c.player_id));

      const nameMap: Record<string, string> = {};
      (playerNames ?? []).forEach((p: any) => { nameMap[p.id] = p.username; });

      topContributors = contribs.map((c: any) => ({
        player_id:   c.player_id,
        player_name: nameMap[c.player_id] ?? "Anónimo",
        quantity:    c.quantity,
        earned:      c.earned,
      }));
    }
  }

  // Player's own contribution
  let myContribution: { quantity: number; earned: number; top_bonus: number } | null = null;
  if (currentShip) {
    const { data: mc } = await supabaseAdmin
      .from("porto_ship_contributions")
      .select("quantity, earned, top_bonus")
      .eq("ship_id", currentShip.id)
      .eq("player_id", player.id)
      .maybeSingle();
    myContribution = mc ?? null;
  }

  // Drug inventory
  const { data: drugItems } = await supabaseAdmin
    .from("items")
    .select("id, name, base_price, image_url")
    .eq("category", "drug");

  let drugInventory: { item_id: string; item_name: string; quantity: number; unit_value: number; image_url: string | null }[] = [];
  if (drugItems && drugItems.length > 0) {
    const { data: inventory } = await supabaseAdmin
      .from("player_inventory")
      .select("item_id, quantity")
      .eq("player_id", player.id)
      .in("item_id", drugItems.map((i: any) => i.id))
      .gt("quantity", 0);

    drugInventory = (inventory ?? []).map((inv: any) => {
      const item = drugItems.find((i: any) => i.id === inv.item_id);
      return {
        item_id:    inv.item_id,
        item_name:  item?.name ?? "Desconhecido",
        quantity:   inv.quantity,
        unit_value: item?.base_price ?? 0,
        image_url:  item?.image_url ?? null,
      };
    });
  }

  // Activity feed
  const { data: activity } = await supabaseAdmin
    .from("porto_activity")
    .select("id, event_type, message, quantity, earned, created_at, player_id")
    .order("created_at", { ascending: false })
    .limit(20);

  const actPlayerIds = [...new Set((activity ?? []).filter((a: any) => a.player_id).map((a: any) => a.player_id))];
  const actNameMap: Record<string, string> = {};
  if (actPlayerIds.length > 0) {
    const { data: actPlayers } = await supabaseAdmin
      .from("crime_players")
      .select("id, username")
      .in("id", actPlayerIds);
    (actPlayers ?? []).forEach((p: any) => { actNameMap[p.id] = p.username; });
  }

  const activityFeed = (activity ?? []).map((a: any) => ({
    ...a,
    player_name: a.player_id ? (actNameMap[a.player_id] ?? "Anónimo") : null,
  }));

  return NextResponse.json({
    currentShip,
    nextShip,
    nextShipRevealed,
    topContributors,
    myContribution,
    drugInventory,
    activityFeed,
    player: {
      id:         player.id,
      dirty_cash: player.dirty_cash,
      in_jail:    player.in_jail,
      hp:         player.hp,
      crypto:     player.crypto ?? 0,
    },
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action, shipId, itemId, quantity } = body;

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, in_jail, jail_release_at, hp, crypto")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail && new Date(player.jail_release_at) > new Date())
    return NextResponse.json({ error: "Estás na prisão" }, { status: 403 });
  if (player.hp <= 0)
    return NextResponse.json({ error: "Estás no hospital" }, { status: 403 });

  // ── REVEAL NEXT SHIP ───────────────────────────────────────────────────────
  if (action === "reveal_ship") {
    const REVEAL_COST = 1000;
    if ((player.crypto ?? 0) < REVEAL_COST)
      return NextResponse.json({ error: "Precisas de 1000💎 para subornar o Capitão" }, { status: 403 });

    const { data: preview } = await supabaseAdmin
      .from("porto_ships")
      .select("id")
      .eq("status", "preview")
      .order("arrival_time", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!preview) return NextResponse.json({ error: "Sem navio para revelar" }, { status: 404 });

    const { data: existing } = await supabaseAdmin
      .from("porto_ship_intel")
      .select("id")
      .eq("ship_id", preview.id)
      .eq("player_id", player.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "Já revelaste as informações deste navio" }, { status: 400 });

    await supabaseAdmin.from("crime_players").update({ crypto: (player.crypto ?? 0) - REVEAL_COST }).eq("id", player.id);
    await supabaseAdmin.from("porto_ship_intel").insert({ ship_id: preview.id, player_id: player.id });

    return NextResponse.json({ success: true, message: "O Capitão Barbosa revelou o próximo carregamento. -1000💎" });
  }

  // ── DELIVER ────────────────────────────────────────────────────────────────
  if (action === "deliver") {
    const qty = parseInt(quantity);
    if (!shipId || !itemId || !qty || qty <= 0)
      return NextResponse.json({ error: "shipId, itemId e quantity obrigatórios" }, { status: 400 });

    await tickShips();

    const { data: ship } = await supabaseAdmin
      .from("porto_ships")
      .select("id, name, status, drug_type, drug_item_id, capacity_total, capacity_filled, price_per_unit, max_delivery, inspection_chance, ship_class, top_bonus_pct, departure_time")
      .eq("id", shipId)
      .single();

    if (!ship) return NextResponse.json({ error: "Navio não encontrado" }, { status: 404 });
    if (ship.status !== "docked") {
      const msg = ship.status === "scheduled" ? "O navio ainda não atracou" : "O navio já partiu";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { data: item } = await supabaseAdmin
      .from("items")
      .select("id, name, category, base_price")
      .eq("id", itemId)
      .single();

    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (item.category !== "drug") return NextResponse.json({ error: "Só podes carregar drogas" }, { status: 400 });
    if (item.name !== ship.drug_type)
      return NextResponse.json({ error: `Este navio só aceita ${ship.drug_type}` }, { status: 400 });

    const remaining = ship.capacity_total - ship.capacity_filled;
    if (remaining <= 0) return NextResponse.json({ error: "O navio está cheio" }, { status: 400 });
    const actualQty = Math.min(qty, remaining, ship.max_delivery);

    const { data: invRow } = await supabaseAdmin
      .from("player_inventory")
      .select("id, quantity")
      .eq("player_id", player.id)
      .eq("item_id", itemId)
      .maybeSingle();

    if (!invRow || invRow.quantity < actualQty) {
      return NextResponse.json({ error: "Inventário insuficiente" }, { status: 400 });
    }

    // Inspection roll (risky ships lose cargo with no reward)
    if (Math.random() * 100 < ship.inspection_chance) {
      // Confiscate the drugs — deduct inventory, no reward
      if (invRow.quantity <= actualQty) {
        await supabaseAdmin.from("player_inventory").delete().eq("id", invRow.id);
      } else {
        await supabaseAdmin.from("player_inventory").update({ quantity: invRow.quantity - actualQty }).eq("id", invRow.id);
      }
      await supabaseAdmin.from("porto_activity").insert({
        ship_id:    ship.id,
        player_id:  player.id,
        event_type: "inspection_fail",
        message:    `Carga inspecionada e confiscada! ${actualQty.toLocaleString("pt-PT")}g de ${ship.drug_type} perdidos.`,
        quantity:   actualQty,
        earned:     0,
      })
      return NextResponse.json({ success: false, inspected: true, quantity: actualQty });
    }

    const earned = actualQty * ship.price_per_unit;

    // Deduct inventory
    const newInvQty = invRow.quantity - actualQty;
    if (newInvQty <= 0) {
      await supabaseAdmin.from("player_inventory").delete().eq("id", invRow.id);
    } else {
      await supabaseAdmin.from("player_inventory").update({ quantity: newInvQty }).eq("id", invRow.id);
    }

    // Update ship fill
    await supabaseAdmin
      .from("porto_ships")
      .update({ capacity_filled: ship.capacity_filled + actualQty })
      .eq("id", ship.id);

    await grantDirtyMoney(player.id, earned);

    // Upsert contribution
    const { data: existingContrib } = await supabaseAdmin
      .from("porto_ship_contributions")
      .select("id, quantity, earned")
      .eq("ship_id", ship.id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (existingContrib) {
      await supabaseAdmin
        .from("porto_ship_contributions")
        .update({ quantity: existingContrib.quantity + actualQty, earned: existingContrib.earned + earned })
        .eq("id", existingContrib.id);
    } else {
      await supabaseAdmin.from("porto_ship_contributions").insert({
        ship_id:   ship.id,
        player_id: player.id,
        quantity:  actualQty,
        earned,
      });
    }

    const { data: pName } = await supabaseAdmin
      .from("crime_players")
      .select("username")
      .eq("id", player.id)
      .single();

    await supabaseAdmin.from("porto_activity").insert({
      ship_id:    ship.id,
      player_id:  player.id,
      event_type: "delivery",
      message:    `${pName?.username ?? "Anónimo"} entregou ${actualQty.toLocaleString("pt-PT")}g de ${ship.drug_type} (+💵 ${earned.toLocaleString("pt-PT")}).`,
      quantity:   actualQty,
      earned,
    })

    if (ship.capacity_filled + actualQty >= ship.capacity_total) {
      await tickShips();
    }

    return NextResponse.json({ success: true, quantity: actualQty, earned });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
