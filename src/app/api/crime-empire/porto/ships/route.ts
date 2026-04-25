/**
 * /api/crime-empire/porto/ships/route.ts
 * Dynamic Ship Events System — Porto Antigo
 *
 * GET  → current/next ship, top contributors, player contribution, player drug inventory, activity feed
 * POST action="deliver"  → deliver drugs to current ship
 * POST action="tick"     → check ship lifecycle (called on GET to stay current)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
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

// ─── Preview ship generator ────────────────────────────────────────────────────

async function generatePreviewShip(afterDepartureTime: Date): Promise<void> {
  const { data: drugs } = await supabase
    .from("items")
    .select("id, name, base_price")
    .eq("category", "drug")
    .order("base_price", { ascending: false });

  if (!drugs || drugs.length === 0) return;

  const drug = drugs[Math.floor(Math.random() * Math.min(drugs.length, 5))];
  const roll = Math.random();
  const shipClass = roll < 0.7 ? "normal" : roll < 0.9 ? "high_demand" : "risky";
  const priceMult = shipClass === "normal"
    ? 1.3 + Math.random() * 0.7
    : shipClass === "high_demand"
    ? 1.8 + Math.random() * 0.7
    : 1.5 + Math.random() * 0.5;
  const pricePerUnit = Math.floor(drug.base_price * priceMult);
  const capacityTotal = 10000 + Math.floor(Math.random() * 40001);
  const durationHours = 6 + Math.floor(Math.random() * 7);
  const inspectionChance = shipClass === "risky" ? 15 : shipClass === "high_demand" ? 3 : 5;
  const maxDelivery = 5000;
  const topBonusPct = shipClass === "high_demand" ? 30 : 25;

  // Arrives 30min after the current ship departs
  const arrivalTime = new Date(afterDepartureTime.getTime() + 30 * 60 * 1000);
  const departureTime = new Date(arrivalTime.getTime() + durationHours * 3600 * 1000);

  const origins = ORIGIN_COUNTRIES[shipClass];
  const originCountry = origins[Math.floor(Math.random() * origins.length)];
  const shipName = SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)];

  await supabase.from("porto_ships").insert({
    name: shipName,
    drug_type: drug.name,
    drug_item_id: drug.id,
    capacity_total: capacityTotal,
    price_per_unit: pricePerUnit,
    arrival_time: arrivalTime.toISOString(),
    departure_time: departureTime.toISOString(),
    status: "preview",
    ship_class: shipClass,
    origin_country: originCountry,
    inspection_chance: inspectionChance,
    max_delivery: maxDelivery,
    top_bonus_pct: topBonusPct,
  });
}

// ─── Ship generator ──────────────────────────────────────────────────────────

async function generateNextShip(): Promise<void> {
  // Get all drug items
  const { data: drugs } = await supabase
    .from("items")
    .select("id, name, base_price")
    .eq("category", "drug")
    .order("base_price", { ascending: false });

  if (!drugs || drugs.length === 0) return;

  // Pick a random drug (weighted toward higher-value)
  const drug = drugs[Math.floor(Math.random() * Math.min(drugs.length, 5))];

  // Ship class distribution: 70% normal, 20% high_demand, 10% risky
  const roll = Math.random();
  const shipClass = roll < 0.7 ? "normal" : roll < 0.9 ? "high_demand" : "risky";

  // Price multiplier by class
  const priceMult = shipClass === "normal"
    ? 1.3 + Math.random() * 0.7   // 1.3x–2.0x
    : shipClass === "high_demand"
    ? 1.8 + Math.random() * 0.7   // 1.8x–2.5x
    : 1.5 + Math.random() * 0.5;  // 1.5x–2.0x (risky: good price but inspection risk)

  const pricePerUnit = Math.floor(drug.base_price * priceMult);
  const capacityTotal = 10000 + Math.floor(Math.random() * 40001); // 10K–50K
  const durationHours = 6 + Math.floor(Math.random() * 7); // 6–12h
  const inspectionChance = shipClass === "risky" ? 15 : shipClass === "high_demand" ? 3 : 5;
  const maxDelivery = 5000;
  const topBonusPct = shipClass === "high_demand" ? 30 : 25;

  // Arrive in 30 minutes (give players time to see it coming), depart after duration
  const now = new Date();
  // First ship or forced-immediate: dock right away; otherwise schedule 10 min out
  const { count: existingCount } = await supabase
    .from("porto_ships")
    .select("id", { count: "exact", head: true });
  const isFirstEver = (existingCount ?? 0) === 0;
  const arrivalTime = isFirstEver ? now : new Date(now.getTime() + 10 * 60 * 1000);
  const departureTime = new Date(arrivalTime.getTime() + durationHours * 3600 * 1000);
  const initialStatus = isFirstEver ? "docked" : "scheduled";

  const origins = ORIGIN_COUNTRIES[shipClass];
  const originCountry = origins[Math.floor(Math.random() * origins.length)];
  const shipName = SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)];

  await supabase.from("porto_ships").insert({
    name: shipName,
    drug_type: drug.name,
    drug_item_id: drug.id,
    capacity_total: capacityTotal,
    price_per_unit: pricePerUnit,
    arrival_time: arrivalTime.toISOString(),
    departure_time: departureTime.toISOString(),
    status: initialStatus,
    ship_class: shipClass,
    origin_country: originCountry,
    inspection_chance: inspectionChance,
    max_delivery: maxDelivery,
    top_bonus_pct: topBonusPct,
  });

  // Log activity
  await supabase.from("porto_activity").insert({
    event_type: "ship_docked",
    message: `Novo navio "${shipName}" chegará em breve com ${capacityTotal.toLocaleString("pt-PT")} de capacidade. Procura: ${drug.name}.`,
  });

  // Pre-generate the next ship as a preview (intel locked behind crypto payment)
  await generatePreviewShip(departureTime);
}

// ─── Tick: advance ship lifecycle ─────────────────────────────────────────────

async function tickShips(): Promise<void> {
  const now = new Date();

  // scheduled → docked
  await supabase
    .from("porto_ships")
    .update({ status: "docked" })
    .eq("status", "scheduled")
    .lte("arrival_time", now.toISOString())
    .gt("departure_time", now.toISOString());

  // docked → departed (timer expired OR full)
  // NOTE: PostgREST cannot do column-to-column comparisons in .or(), so we
  // fetch all docked ships and filter in code.
  const { data: toDepart } = await supabase
    .from("porto_ships")
    .select("id, name, capacity_total, capacity_filled, departure_time, ship_class, top_bonus_pct")
    .eq("status", "docked");

  if (toDepart) {
    for (const ship of toDepart) {
      if (new Date(ship.departure_time) > now && ship.capacity_filled < ship.capacity_total) continue;

      await supabase
        .from("porto_ships")
        .update({ status: "departed", departed_at: now.toISOString() })
        .eq("id", ship.id);

      // Award top contributor bonus
      const { data: topContrib } = await supabase
        .from("porto_ship_contributions")
        .select("player_id, quantity, earned")
        .eq("ship_id", ship.id)
        .order("quantity", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (topContrib) {
        const bonus = Math.floor(topContrib.earned * (ship.top_bonus_pct / 100));
        if (bonus > 0) {
          await grantDirtyMoney(topContrib.player_id, bonus);
          await supabase
            .from("porto_ship_contributions")
            .update({ top_bonus: bonus })
            .eq("ship_id", ship.id)
            .eq("player_id", topContrib.player_id);
        }
      }

      const reason = ship.capacity_filled >= ship.capacity_total ? "lotação completa" : "tempo esgotado";
      await supabase.from("porto_activity").insert({
        ship_id: ship.id,
        event_type: "ship_departed",
        message: `O "${ship.name}" partiu (${reason}). ${ship.capacity_filled.toLocaleString("pt-PT")}/${ship.capacity_total.toLocaleString("pt-PT")} carregado.`,
      });
    }
  }

  // If no active ship, promote preview → scheduled or generate fresh
  const { count } = await supabase
    .from("porto_ships")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled", "docked"]);

  if ((count ?? 0) === 0) {
    const { data: preview } = await supabase
      .from("porto_ships")
      .select("id, arrival_time, departure_time")
      .eq("status", "preview")
      .order("arrival_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (preview) {
      // Promote preview to scheduled, reschedule to 10min from now, keep original duration
      const newArrival = new Date(now.getTime() + 10 * 60 * 1000);
      const origDuration = new Date(preview.departure_time).getTime() - new Date(preview.arrival_time).getTime();
      const newDeparture = new Date(newArrival.getTime() + origDuration);
      await supabase.from("porto_ships").update({
        status: "scheduled",
        arrival_time: newArrival.toISOString(),
        departure_time: newDeparture.toISOString(),
      }).eq("id", preview.id);
      await generatePreviewShip(newDeparture);
    } else {
      await generateNextShip();
    }
  }

  // Bootstrap: ensure there is always a preview ship when an active ship exists
  if ((count ?? 0) > 0) {
    const { count: previewCount } = await supabase
      .from("porto_ships")
      .select("id", { count: "exact", head: true })
      .eq("status", "preview");
    if ((previewCount ?? 0) === 0) {
      const { data: activeShip } = await supabase
        .from("porto_ships")
        .select("departure_time")
        .in("status", ["scheduled", "docked"])
        .order("arrival_time", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (activeShip) await generatePreviewShip(new Date(activeShip.departure_time));
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

  // Advance ship lifecycle
  await tickShips();

  // Current ship (docked preferred, else next scheduled)
  const { data: ships } = await supabase
    .from("porto_ships")
    .select("*")
    .in("status", ["docked", "scheduled"])
    .order("arrival_time", { ascending: true })
    .limit(1);

  const currentShip = ships?.[0] ?? null;

  // Preview ship — the next ship after the current one (intel locked)
  const { data: previewShips } = await supabase
    .from("porto_ships")
    .select("id, name, arrival_time, departure_time, ship_class, capacity_total, drug_type, price_per_unit")
    .eq("status", "preview")
    .order("arrival_time", { ascending: true })
    .limit(1);
  const previewShip = previewShips?.[0] ?? null;

  // Check if this player has already paid to reveal the next ship's intel
  let nextShipRevealed = false;
  if (previewShip && player) {
    const { data: intel } = await supabase
      .from("porto_ship_intel")
      .select("id")
      .eq("ship_id", previewShip.id)
      .eq("player_id", player.id)
      .maybeSingle();
    nextShipRevealed = !!intel;
  }

  const nextShip = previewShip ? {
    id: previewShip.id,
    name: previewShip.name,
    arrival_time: previewShip.arrival_time,
    departure_time: previewShip.departure_time,
    ship_class: previewShip.ship_class as "normal" | "high_demand" | "risky",
    capacity_total: previewShip.capacity_total,
    drug_type: nextShipRevealed ? previewShip.drug_type : null,
    price_per_unit: nextShipRevealed ? previewShip.price_per_unit : null,
  } : null;

  // Top contributors for current ship
  let topContributors: { player_id: string; player_name: string; quantity: number; earned: number }[] = [];
  if (currentShip) {
    const { data: contribs } = await supabase
      .from("porto_ship_contributions")
      .select("player_id, quantity, earned")
      .eq("ship_id", currentShip.id)
      .order("quantity", { ascending: false })
      .limit(10);

    if (contribs && contribs.length > 0) {
      // Resolve player names
      const playerIds = contribs.map((c: any) => c.player_id);
      const { data: playerNames } = await supabase
        .from("crime_players")
        .select("id, username")
        .in("id", playerIds);

      const nameMap: Record<string, string> = {};
      (playerNames || []).forEach((p: any) => { nameMap[p.id] = p.username; });

      topContributors = contribs.map((c: any) => ({
        player_id: c.player_id,
        player_name: nameMap[c.player_id] ?? "Anónimo",
        quantity: c.quantity,
        earned: c.earned,
      }));
    }
  }

  // Player's own contribution to current ship
  let myContribution: { quantity: number; earned: number; top_bonus: number } | null = null;
  if (currentShip) {
    const { data: myContrib } = await supabase
      .from("porto_ship_contributions")
      .select("quantity, earned, top_bonus")
      .eq("ship_id", currentShip.id)
      .eq("player_id", player.id)
      .maybeSingle();
    myContribution = myContrib ?? null;
  }

  // Player's drug inventory
  const { data: drugItems } = await supabase
    .from("items")
    .select("id, name, base_price, image_url")
    .eq("category", "drug");

  const drugItemIds = (drugItems || []).map((i: any) => i.id);
  let drugInventory: { item_id: string; item_name: string; quantity: number; unit_value: number; image_url: string | null }[] = [];

  if (drugItemIds.length > 0) {
    const { data: inventory } = await supabase
      .from("player_inventory")
      .select("item_id, quantity")
      .eq("player_id", player.id)
      .in("item_id", drugItemIds)
      .gt("quantity", 0);

    drugInventory = (inventory || []).map((inv: any) => {
      const item = (drugItems || []).find((i: any) => i.id === inv.item_id);
      return {
        item_id: inv.item_id,
        item_name: item?.name ?? "Desconhecido",
        quantity: inv.quantity,
        unit_value: item?.base_price ?? 0,
        image_url: item?.image_url ?? null,
      };
    });
  }

  // Recent activity feed (last 20 entries)
  const { data: activity } = await supabase
    .from("porto_activity")
    .select("id, event_type, message, quantity, earned, created_at, player_id")
    .order("created_at", { ascending: false })
    .limit(20);

  // Resolve player names for activity
  const actPlayerIds = [...new Set((activity || []).filter((a: any) => a.player_id).map((a: any) => a.player_id))];
  const actNameMap: Record<string, string> = {};
  if (actPlayerIds.length > 0) {
    const { data: actPlayers } = await supabase
      .from("crime_players")
      .select("id, username")
      .in("id", actPlayerIds);
    (actPlayers || []).forEach((p: any) => { actNameMap[p.id] = p.username; });
  }

  const activityFeed = (activity || []).map((a: any) => ({
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
      id: player.id,
      dirty_cash: player.dirty_cash,
      in_jail: player.in_jail,
      hp: player.hp,
      crypto: player.crypto ?? 0,
    },
  });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action, shipId, itemId, quantity } = await req.json();

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail) {
    const releaseAt = new Date(player.jail_release_at);
    if (releaseAt > new Date()) return NextResponse.json({ error: "Estás na prisão" }, { status: 403 });
  }
  if (player.hp <= 0) return NextResponse.json({ error: "Estás no hospital" }, { status: 403 });

  // ── REVEAL NEXT SHIP ─────────────────────────────────────────────────────
  if (action === "reveal_ship") {
    const REVEAL_COST = 1000;
    const { data: fp } = await supabase
      .from("crime_players")
      .select("id, crypto")
      .eq("user_id", user.id)
      .single();
    if (!fp) return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
    if ((fp.crypto ?? 0) < REVEAL_COST)
      return NextResponse.json({ error: "Precisas de 1000💎 de crypto para subornar o Capitão" }, { status: 403 });

    const { data: preview } = await supabase
      .from("porto_ships")
      .select("id")
      .eq("status", "preview")
      .order("arrival_time", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!preview) return NextResponse.json({ error: "Sem navio para revelar" }, { status: 404 });

    const { data: existing } = await supabase
      .from("porto_ship_intel")
      .select("id")
      .eq("ship_id", preview.id)
      .eq("player_id", fp.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "Já revelaste as informações deste navio" }, { status: 400 });

    await supabase.from("crime_players").update({ crypto: (fp.crypto ?? 0) - REVEAL_COST }).eq("id", fp.id);
    await supabase.from("porto_ship_intel").insert({ ship_id: preview.id, player_id: fp.id });

    return NextResponse.json({ success: true, message: "O Capitão Barbosa revelou o próximo carregamento. -1000💎" });
  }

  // ── DELIVER ──────────────────────────────────────────────────────────────
  if (action === "deliver") {
    const qty = parseInt(quantity);
    if (!shipId || !itemId || !qty || qty <= 0) {
      return NextResponse.json({ error: "shipId, itemId e quantity obrigatórios" }, { status: 400 });
    }

    // Run tick first to keep ship status current
    await tickShips();

    const { data: ship } = await supabase
      .from("porto_ships")
      .select("*")
      .eq("id", shipId)
      .single();

    if (!ship) return NextResponse.json({ error: "Navio não encontrado" }, { status: 404 });
    if (ship.status !== "docked") {
      const msg = ship.status === "scheduled" ? "O navio ainda não atracou" : "O navio já partiu";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Validate drug matches what the ship wants
    const { data: item } = await supabase
      .from("items")
      .select("id, name, category, base_price")
      .eq("id", itemId)
      .single();

    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (item.category !== "drug") return NextResponse.json({ error: "Só podes carregar drogas" }, { status: 400 });
    if (item.name !== ship.drug_type) {
      return NextResponse.json({ error: `Este navio só aceita ${ship.drug_type}` }, { status: 400 });
    }

    // Cap quantity
    const remaining = ship.capacity_total - ship.capacity_filled;
    if (remaining <= 0) return NextResponse.json({ error: "O navio está cheio" }, { status: 400 });
    const maxAllowed = Math.min(qty, remaining, ship.max_delivery);
    const actualQty = maxAllowed;

    // Check inventory
    const { data: invRow } = await supabase
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
      if (invRow.quantity === actualQty) {
        await supabase.from("player_inventory").delete().eq("id", invRow.id);
      } else {
        await supabase.from("player_inventory").update({ quantity: invRow.quantity - actualQty }).eq("id", invRow.id);
      }
      await supabase.from("porto_activity").insert({
        ship_id: ship.id,
        player_id: player.id,
        event_type: "inspection_fail",
        message: `Carga inspecionada e confiscada! ${actualQty.toLocaleString("pt-PT")}g de ${ship.drug_type} perdidos.`,
        quantity: actualQty,
        earned: 0,
      });
      return NextResponse.json({ success: false, inspected: true, quantity: actualQty });
    }

    // Calculate earnings
    const earned = actualQty * ship.price_per_unit;

    // Deduct from inventory
    if (invRow.quantity === actualQty) {
      await supabase.from("player_inventory").delete().eq("id", invRow.id);
    } else {
      await supabase.from("player_inventory").update({ quantity: invRow.quantity - actualQty }).eq("id", invRow.id);
    }

    // Update ship capacity
    await supabase
      .from("porto_ships")
      .update({ capacity_filled: ship.capacity_filled + actualQty })
      .eq("id", ship.id);

    // Grant dirty money
    await grantDirtyMoney(player.id, earned);

    // Upsert contribution record
    const { data: existingContrib } = await supabase
      .from("porto_ship_contributions")
      .select("id, quantity, earned")
      .eq("ship_id", ship.id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (existingContrib) {
      await supabase
        .from("porto_ship_contributions")
        .update({
          quantity: existingContrib.quantity + actualQty,
          earned: existingContrib.earned + earned,
        })
        .eq("id", existingContrib.id);
    } else {
      await supabase.from("porto_ship_contributions").insert({
        ship_id: ship.id,
        player_id: player.id,
        quantity: actualQty,
        earned,
      });
    }

    // Activity feed entry
    const { data: pName } = await supabase
      .from("crime_players")
      .select("username")
      .eq("id", player.id)
      .single();

    await supabase.from("porto_activity").insert({
      ship_id: ship.id,
      player_id: player.id,
      event_type: "delivery",
      message: `${pName?.username ?? "Anónimo"} entregou ${actualQty.toLocaleString("pt-PT")}g de ${ship.drug_type} (+💵 ${earned.toLocaleString("pt-PT")}).`,
      quantity: actualQty,
      earned,
    });

    // Check if ship is now full — tick immediately
    if (ship.capacity_filled + actualQty >= ship.capacity_total) {
      await tickShips();
    }

    return NextResponse.json({ success: true, quantity: actualQty, earned });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
