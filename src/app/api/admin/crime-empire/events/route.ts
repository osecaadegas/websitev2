import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

const LOCATIONS = [
  "Serra da Estrela", "Planície do Alentejo", "Costa Vicentina",
  "Vale do Douro", "Montanha do Gerês", "Estuário do Tejo",
  "Litoral Algarvio", "Planícies de Trás-os-Montes", "Vale do Minho",
  "Serra de Sintra", "Lagoa de Óbidos", "Marismas do Sado",
];

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

function generateWreckSegments() {
  const segments: { x: number; y: number }[] = [];
  const occupied = new Set<string>();
  const clusterCount = 1 + Math.floor(Math.random() * 3);

  for (let c = 0; c < clusterCount; c++) {
    const length = 3 + Math.floor(Math.random() * 4);
    const horizontal = Math.random() < 0.5;
    let placed = false;

    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const startX = horizontal ? Math.floor(Math.random() * (10 - length)) : Math.floor(Math.random() * 10);
      const startY = horizontal ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * (10 - length));
      const tiles: { x: number; y: number }[] = [];
      let collision = false;

      for (let i = 0; i < length; i++) {
        const tx = horizontal ? startX + i : startX;
        const ty = horizontal ? startY : startY + i;
        if (occupied.has(`${tx},${ty}`)) { collision = true; break; }
        tiles.push({ x: tx, y: ty });
      }

      if (!collision) {
        tiles.forEach((t) => { occupied.add(`${t.x},${t.y}`); segments.push(t); });
        placed = true;
      }
    }
  }
  return segments;
}

// ─── GET: dashboard data ─────────────────────────────────────────────────────

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [drugsRes, shipsRes, planesRes] = await Promise.all([
    supabase.from("items").select("id, name, base_price").eq("category", "drug").order("base_price", { ascending: false }),
    supabase.from("porto_ships")
      .select("id, name, drug_type, status, capacity_total, capacity_filled, arrival_time, departure_time, ship_class, price_per_unit, origin_country")
      .in("status", ["docked", "scheduled", "preview"])
      .order("arrival_time", { ascending: true }),
    supabase.from("plane_crashes")
      .select("id, location_name, status, scheduled_at, active_until, entry_cost, forced_drug_id, total_segments")
      .in("status", ["active", "upcoming"])
      .order("scheduled_at", { ascending: true }),
  ]);

  return NextResponse.json({
    drugs: drugsRes.data || [],
    locations: LOCATIONS,
    activeShips: shipsRes.data || [],
    activePlanes: planesRes.data || [],
  });
}

// ─── POST: spawn / manage events ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // ── SPAWN SHIP ────────────────────────────────────────────────────────────
  if (action === "spawn_ship") {
    const {
      drugItemId,
      shipName,
      shipClass = "normal",
      capacityTotal = 25000,
      pricePerUnit,
      durationHours = 8,
      originCountry,
      inspectionChance = 5,
      maxDelivery = 5000,
      dockImmediately = false,
      delayMinutes = 10,
    } = body;

    if (!drugItemId) return NextResponse.json({ error: "drugItemId obrigatório" }, { status: 400 });
    if (!["normal", "high_demand", "risky"].includes(shipClass))
      return NextResponse.json({ error: "shipClass inválido" }, { status: 400 });

    const { data: drug } = await supabase
      .from("items").select("id, name, base_price").eq("id", drugItemId).single();
    if (!drug) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

    const now = new Date();
    const delay = dockImmediately ? 0 : Math.max(0, Number(delayMinutes));
    const arrivalTime = new Date(now.getTime() + delay * 60 * 1000);
    const departureTime = new Date(arrivalTime.getTime() + Number(durationHours) * 3600 * 1000);
    const initialStatus = dockImmediately ? "docked" : "scheduled";

    const resolvedPrice = pricePerUnit
      ? Number(pricePerUnit)
      : Math.floor(drug.base_price * (shipClass === "normal" ? 1.6 : shipClass === "high_demand" ? 2.1 : 1.75));
    const name = (shipName as string)?.trim() || SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)];
    const origin = (originCountry as string)?.trim() || ORIGIN_COUNTRIES[shipClass]?.[0] || "Desconhecido";
    const topBonusPct = shipClass === "high_demand" ? 30 : 25;

    const { data: ship, error } = await supabase.from("porto_ships").insert({
      name,
      drug_type: drug.name,
      drug_item_id: drug.id,
      capacity_total: Number(capacityTotal),
      capacity_filled: 0,
      price_per_unit: resolvedPrice,
      arrival_time: arrivalTime.toISOString(),
      departure_time: departureTime.toISOString(),
      status: initialStatus,
      ship_class: shipClass,
      origin_country: origin,
      inspection_chance: Math.min(100, Math.max(0, Number(inspectionChance))),
      max_delivery: Number(maxDelivery),
      top_bonus_pct: topBonusPct,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("porto_activity").insert({
      event_type: "ship_docked",
      message: `⭐ EVENTO ESPECIAL: "${name}" a caminho com ${Number(capacityTotal).toLocaleString("pt-PT")} de ${drug.name}. Procura: ${drug.name}.`,
    });

    await writeAuditLog(admin, "spawn_ship", "porto_ship", ship.id, name, {
      drug: drug.name, shipClass, capacityTotal, pricePerUnit: resolvedPrice, dockImmediately,
    });

    return NextResponse.json({ success: true, ship });
  }

  // ── SPAWN PLANE ───────────────────────────────────────────────────────────
  if (action === "spawn_plane") {
    const {
      location,
      forcedDrugId = null,
      entryCost = 125000,
      activateImmediately = false,
      delayMinutes = 30,
      durationHours = 6,
    } = body;

    const locationName = (location as string)?.trim() || LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    // Validate forced drug if provided
    if (forcedDrugId) {
      const { data: drugCheck } = await supabase.from("items").select("id").eq("id", forcedDrugId).eq("category", "drug").maybeSingle();
      if (!drugCheck) return NextResponse.json({ error: "Drug item não encontrado" }, { status: 404 });
    }

    const now = new Date();
    const delay = activateImmediately ? 0 : Math.max(0, Number(delayMinutes));
    const scheduledAt = new Date(now.getTime() + delay * 60 * 1000);
    const activeUntil = new Date(scheduledAt.getTime() + Number(durationHours) * 3600 * 1000);

    let status: string;
    if (scheduledAt <= now) status = "active";
    else status = "upcoming";

    const wreckSegments = generateWreckSegments();
    const lootSeed = Math.floor(Math.random() * 0x7fffffff);
    const { week, year } = getISOWeekInfo(now);

    const { data: crash, error } = await supabase.from("plane_crashes").insert({
      week_number: week,
      week_year: year,
      scheduled_at: scheduledAt.toISOString(),
      active_until: activeUntil.toISOString(),
      location_name: locationName,
      info_cost: Number(entryCost),
      entry_cost: Number(entryCost),
      loot: [],
      total_loot_value: 0,
      status,
      wreck_segments: wreckSegments,
      total_segments: wreckSegments.length,
      loot_seed: lootSeed,
      forced_drug_id: forcedDrugId || null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog(admin, "spawn_plane", "plane_crash", crash.id, locationName, {
      location: locationName, forcedDrugId, entryCost, activateImmediately, durationHours,
    });

    return NextResponse.json({ success: true, crash });
  }

  // ── FORCE EXPIRE SHIP ─────────────────────────────────────────────────────
  if (action === "force_expire_ship") {
    const { shipId } = body;
    if (!shipId) return NextResponse.json({ error: "shipId obrigatório" }, { status: 400 });

    const { data: ship } = await supabase.from("porto_ships").select("name").eq("id", shipId).maybeSingle();
    await supabase.from("porto_ships").update({ status: "departed", departed_at: new Date().toISOString() }).eq("id", shipId);
    await supabase.from("porto_activity").insert({
      ship_id: shipId,
      event_type: "ship_departed",
      message: `O "${ship?.name ?? shipId}" foi forçado a partir pelo administrador.`,
    });
    await writeAuditLog(admin, "force_expire_ship", "porto_ship", shipId, ship?.name ?? null, {});
    return NextResponse.json({ success: true });
  }

  // ── FORCE EXPIRE PLANE ────────────────────────────────────────────────────
  if (action === "force_expire_plane") {
    const { crashId } = body;
    if (!crashId) return NextResponse.json({ error: "crashId obrigatório" }, { status: 400 });

    await supabase.from("plane_crashes").update({ status: "expired" }).eq("id", crashId);
    await writeAuditLog(admin, "force_expire_plane", "plane_crash", crashId, null, {});
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
}

// ─── ISO week helper ──────────────────────────────────────────────────────────

function getISOWeekInfo(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}
