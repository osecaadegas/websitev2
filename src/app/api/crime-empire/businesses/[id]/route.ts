import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import {
  BUSINESS_DEFS,
  SHARED_BUSINESS_EVENTS,
  computeIncomeRate,
  computeDrugOutputRate,
  computeHeatRate,
  PRODUCTION_META,
  type ProductionLevel,
  type BusinessStatus,
} from "@/lib/business-defs";
import { grantDirtyMoney, deductDirtyMoney, getDirtyMoneyBalance } from "@/lib/dirty-money";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function grantXP(playerId: string, xpEarned: number) {
  if (xpEarned <= 0) return;
  const { data: p } = await supabase.from("crime_players").select("xp, level, xp_to_next_level").eq("id", playerId).single();
  if (!p) return;
  let newXP = p.xp + xpEarned;
  let newLevel = p.level;
  while (newXP >= p.xp_to_next_level) { newXP -= p.xp_to_next_level; newLevel++; }
  await supabase.from("crime_players").update({ xp: newXP, level: newLevel, xp_to_next_level: Math.floor(100 * Math.pow(1.25, newLevel - 1)) }).eq("id", playerId);
}

// ── Shared: calculate current heat ──────────────────────────────────────────
function calcCurrentHeat(
  storedHeat: number,
  lastHeatUpdate: string,
  heatRatePerHour: number,
  status: string
): number {
  if (status === "idle" || status === "suspended") return Math.max(0, storedHeat - 2); // cool down
  const hours = (Date.now() - new Date(lastHeatUpdate).getTime()) / 3_600_000;
  return Math.min(100, storedHeat + hours * heatRatePerHour);
}

// ── GET — full management data ───────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, cash, dirty_cash, class")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Fetch player_business by its UUID (id = player_business.id)
  const { data: pb } = await supabase
    .from("player_businesses")
    .select("*, business:businesses(*)")
    .eq("id", id)
    .eq("player_id", player.id)
    .single();

  if (!pb) return NextResponse.json({ error: "Business not found or not owned" }, { status: 404 });

  const def = BUSINESS_DEFS[pb.business.type] ?? null;

  // Fetch active workers
  const { data: workers } = await supabase
    .from("player_business_workers")
    .select("*")
    .eq("player_business_id", id)
    .eq("is_active", true);

  // Fetch owned upgrades
  const { data: ownedUpgrades } = await supabase
    .from("player_business_upgrades")
    .select("upgrade_def_id")
    .eq("player_business_id", id);

  const ownedUpgradeIds = (ownedUpgrades ?? []).map((u: { upgrade_def_id: string }) => u.upgrade_def_id);

  // Fetch unresolved events
  const { data: events } = await supabase
    .from("player_business_events")
    .select("*")
    .eq("player_business_id", id)
    .eq("is_resolved", false)
    .order("created_at", { ascending: true });

  // Compute current heat
  const activeWorkers = workers ?? [];
  const activeUpgradeDefs = (def?.upgrades ?? []).filter((u) => ownedUpgradeIds.includes(u.id));
  const heatRate = def
    ? computeHeatRate({ base_heat_per_hour: def.heat_per_hour, production_level: pb.production_level as ProductionLevel, workers: activeWorkers, upgrades: activeUpgradeDefs })
    : 0;
  const currentHeat = calcCurrentHeat(pb.heat ?? 0, pb.last_heat_update ?? pb.purchased_at, heatRate, pb.status ?? "running");

  // Compute income rate
  const incomeRate = def
    ? computeIncomeRate({ base_income_per_hour: pb.business.base_income_per_hour, production_level: pb.production_level as ProductionLevel, workers: activeWorkers, upgrades: activeUpgradeDefs })
    : 0;

  // Accumulated income since last collect
  const hoursElapsed = (Date.now() - new Date(pb.last_collection).getTime()) / 3_600_000;
  const accumulatedIncome = Math.max(0, Math.floor(hoursElapsed * incomeRate));

  // Launder cap computation (for launder businesses)
  const launderCapPerWorker = def?.launder_cap_per_worker ?? 0;
  const baseLaunderCap: number = (pb.business.launder_cap_per_hour as number) ?? 0;
  const prodMultiplier = PRODUCTION_META[pb.production_level as ProductionLevel]?.income ?? 1;
  const effectiveLaunderCap = Math.floor((baseLaunderCap + activeWorkers.length * launderCapPerWorker) * prodMultiplier);
  const windowStart = new Date(pb.launder_window_start ?? pb.purchased_at);
  const windowAgeHours = (Date.now() - windowStart.getTime()) / 3_600_000;
  const launderUsedThisWindow = windowAgeHours >= 1 ? 0 : (pb.launder_used ?? 0);
  const launderRemaining = Math.max(0, effectiveLaunderCap - launderUsedThisWindow);
  const launderWindowResetAt = new Date(windowStart.getTime() + 3_600_000).toISOString();

  // Drug output rate (for drug businesses)
  const isDrugBusiness = def?.income_type === "drugs";
  const drugOutputRate = isDrugBusiness
    ? computeDrugOutputRate({ base_output_per_hour: (pb.business.drug_output_per_hour as number) ?? 0, production_level: pb.production_level as ProductionLevel, workers: activeWorkers, upgrades: activeUpgradeDefs })
    : 0;
  const accumulatedDrugQty = isDrugBusiness ? Math.max(0, Math.floor(hoursElapsed * drugOutputRate)) : 0;

  // Drug item name
  let drugItemName = "";
  if (isDrugBusiness && pb.business.drug_output_item_id) {
    const { data: drugItem } = await supabase.from("items").select("name").eq("id", pb.business.drug_output_item_id).single();
    drugItemName = drugItem?.name ?? "";
  }

  // Available workers to hire.
  // Always show full pool — workers not currently active can be hired.
  // When all pool entries are active but capacity exists (e.g. after upgrades), all workers
  // can be hired as a "second instance" — same person, new contract.
  const capacityBonus = activeUpgradeDefs.reduce((s, u) => s + u.capacity_bonus, 0);
  const maxWorkerSlots = pb.max_employees + capacityBonus;
  const activeWorkerDefIds = new Set(activeWorkers.map((w: { worker_def_id: string }) => w.worker_def_id));
  const openSlots = maxWorkerSlots - activeWorkers.length;
  const nonActivePool = (def?.worker_pool ?? []).filter((w) => !activeWorkerDefIds.has(w.id));
  // If open slots exceed distinct available workers, show full pool so every slot can be filled
  const availableWorkers = openSlots > nonActivePool.length
    ? (def?.worker_pool ?? [])
    : nonActivePool;

  // Available upgrades
  const availableUpgrades = (def?.upgrades ?? []).filter((u) => !ownedUpgradeIds.includes(u.id));

  return NextResponse.json({
    player_business: {
      ...pb,
      heat: currentHeat,
      income_per_hour: isDrugBusiness ? 0 : incomeRate,
      heat_rate_per_hour: heatRate,
      accumulated_income: isDrugBusiness ? 0 : accumulatedIncome,
      hours_elapsed: hoursElapsed,
      drug_output_per_hour: drugOutputRate,
      accumulated_drug_qty: accumulatedDrugQty,
      drug_item_name: drugItemName,
      launder_effective_cap: effectiveLaunderCap,
      launder_remaining: launderRemaining,
      launder_window_reset_at: launderWindowResetAt,
    },
    business: pb.business,
    def: def ?? null,
    workers: activeWorkers,
    owned_upgrade_ids: ownedUpgradeIds,
    active_events: events ?? [],
    available_workers: availableWorkers,
    available_upgrades: availableUpgrades,
    player: { id: player.id, cash: player.cash, dirty_cash: player.dirty_cash, level: player.level, class: player.class },
  });
}

// ── POST — management actions ────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  const { data: player } = await supabase.from("crime_players").select("*").eq("user_id", user.id).single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date())
    return NextResponse.json({ error: "Estás na prisão." }, { status: 403 });
  if (player.hp <= 0)
    return NextResponse.json({ error: "Estás no hospital." }, { status: 403 });

  const { data: pb } = await supabase
    .from("player_businesses")
    .select("*, business:businesses(*)")
    .eq("id", id)
    .eq("player_id", player.id)
    .single();

  if (!pb) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  switch (action) {
    case "set_production": return handleSetProduction(pb, body, player);
    case "hire_worker":    return handleHireWorker(pb, body, player, id);
    case "fire_worker":    return handleFireWorker(pb, body, player, id);
    case "collect":        return handleCollect(pb, player, id);
    case "launder":        return handleLaunder(pb, body, player, id);
    case "resolve_event":  return handleResolveEvent(pb, body, player, id);
    case "buy_upgrade":    return handleBuyUpgrade(pb, body, player, id);
    case "raid_result":    return handleRaidResult(pb, body, player);
    default:               return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

// ── set_production ───────────────────────────────────────────────────────────
async function handleSetProduction(pb: any, body: any, player: any) {
  const { production_level } = body as { production_level: ProductionLevel };
  if (!["low", "normal", "overdrive"].includes(production_level))
    return NextResponse.json({ error: "Invalid production level" }, { status: 400 });

  // Flush current heat before changing rate
  const def = BUSINESS_DEFS[pb.business.type];
  const { data: workers } = await supabase.from("player_business_workers").select("*").eq("player_business_id", pb.id).eq("is_active", true);
  const { data: ownedUpgrades } = await supabase.from("player_business_upgrades").select("upgrade_def_id").eq("player_business_id", pb.id);
  const ownedIds = (ownedUpgrades ?? []).map((u: any) => u.upgrade_def_id);
  const activeDefs = (def?.upgrades ?? []).filter((u) => ownedIds.includes(u.id));
  const currentHeatRate = def ? computeHeatRate({ base_heat_per_hour: def.heat_per_hour, production_level: pb.production_level as ProductionLevel, workers: workers ?? [], upgrades: activeDefs }) : 0;
  const hours = (Date.now() - new Date(pb.last_heat_update ?? pb.purchased_at).getTime()) / 3_600_000;
  const newHeat = Math.min(100, (pb.heat ?? 0) + hours * currentHeatRate);
  const newStatus = production_level === "low" ? "idle" : "running";

  await supabase.from("player_businesses").update({
    production_level,
    heat: newHeat,
    last_heat_update: new Date().toISOString(),
    status: newStatus,
  }).eq("id", pb.id);

  return NextResponse.json({ success: true, production_level, status: newStatus });
}

// ── hire_worker ──────────────────────────────────────────────────────────────
async function handleHireWorker(pb: any, body: any, player: any, pbId: string) {
  const { worker_def_id } = body as { worker_def_id: string };
  const def = BUSINESS_DEFS[pb.business.type];
  if (!def) return NextResponse.json({ error: "Business type not found" }, { status: 400 });

  const workerDef = def.worker_pool.find((w) => w.id === worker_def_id);
  if (!workerDef) return NextResponse.json({ error: "Worker not found in pool" }, { status: 404 });

  // Check capacity
  const { count } = await supabase.from("player_business_workers").select("id", { count: "exact", head: true }).eq("player_business_id", pbId).eq("is_active", true);
  const { data: ownedUpgrades } = await supabase.from("player_business_upgrades").select("upgrade_def_id").eq("player_business_id", pbId);
  const ownedIds = (ownedUpgrades ?? []).map((u: any) => u.upgrade_def_id);
  const capacityBonus = def.upgrades.filter((u) => ownedIds.includes(u.id)).reduce((s, u) => s + u.capacity_bonus, 0);
  const maxWorkers = pb.max_employees + capacityBonus;
  if ((count ?? 0) >= maxWorkers) return NextResponse.json({ error: `Capacidade máxima (${maxWorkers}) atingida` }, { status: 403 });

  // Upfront cost: 8h salary advance
  const upfrontCost = workerDef.salary * 8;
  if (player.cash < upfrontCost) return NextResponse.json({ error: `Precisas de $${upfrontCost.toLocaleString()} para contratar (8h de salário antecipado)` }, { status: 403 });

  await supabase.from("player_business_workers").insert({
    player_id: player.id,
    player_business_id: pbId,
    worker_def_id: workerDef.id,
    name: workerDef.name,
    skill: workerDef.skill,
    trait: workerDef.trait,
    salary: workerDef.salary,
    production_bonus: workerDef.production_bonus,
    efficiency_bonus: workerDef.efficiency_bonus,
    stealth_bonus: workerDef.stealth_bonus,
    description: workerDef.description,
  });

  const { data: fp } = await supabase.from("crime_players").select("cash").eq("id", player.id).single();
  await supabase.from("crime_players").update({ cash: (fp?.cash ?? player.cash) - upfrontCost }).eq("id", player.id);

  return NextResponse.json({ success: true, message: `${workerDef.name} contratado! (-$${upfrontCost.toLocaleString()})`, cost: upfrontCost });
}

// ── fire_worker ──────────────────────────────────────────────────────────────
async function handleFireWorker(_pb: any, body: any, _player: any, _pbId: string) {
  const { worker_id } = body as { worker_id: string };
  const { data: w } = await supabase.from("player_business_workers").select("name").eq("id", worker_id).single();
  if (!w) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  await supabase.from("player_business_workers").update({ is_active: false }).eq("id", worker_id);
  return NextResponse.json({ success: true, message: `${w.name} foi despedido.` });
}

// ── grantDrugItem — upsert drug item into player inventory ───────────────────
async function grantDrugItem(playerId: string, itemId: string, qty: number) {
  const { data: existing } = await supabase.from("player_inventory").select("id, quantity").eq("player_id", playerId).eq("item_id", itemId).maybeSingle();
  if (existing) {
    await supabase.from("player_inventory").update({ quantity: existing.quantity + qty }).eq("id", existing.id);
  } else {
    await supabase.from("player_inventory").insert({ player_id: playerId, item_id: itemId, quantity: qty });
  }
}

// ── collect ───────────────────────────────────────────────────────────────────
async function handleCollect(pb: any, player: any, pbId: string) {
  const now = new Date();
  const def = BUSINESS_DEFS[pb.business.type];

  const lastCollect = new Date(pb.last_collection);
  const hoursElapsed = (now.getTime() - lastCollect.getTime()) / 3_600_000;
  if (hoursElapsed < 1) {
    const minsLeft = Math.ceil((3_600_000 - (now.getTime() - lastCollect.getTime())) / 60_000);
    return NextResponse.json({ error: `Podes coletar novamente em ${minsLeft} min.` }, { status: 429 });
  }
  if (pb.status === "raided") return NextResponse.json({ error: "O negócio está invadido! Resolve o evento primeiro." }, { status: 403 });

  // Get workers + upgrades
  const { data: workers } = await supabase.from("player_business_workers").select("*").eq("player_business_id", pbId).eq("is_active", true);
  const { data: ownedUpgrades } = await supabase.from("player_business_upgrades").select("upgrade_def_id").eq("player_business_id", pbId);
  const ownedIds = (ownedUpgrades ?? []).map((u: any) => u.upgrade_def_id);
  const activeDefs = (def?.upgrades ?? []).filter((u) => ownedIds.includes(u.id));

  const heatRate = def ? computeHeatRate({ base_heat_per_hour: def.heat_per_hour, production_level: pb.production_level as ProductionLevel, workers: workers ?? [], upgrades: activeDefs }) : 0;

  // Update heat
  const hours = (now.getTime() - new Date(pb.last_heat_update ?? pb.purchased_at).getTime()) / 3_600_000;
  let newHeat = Math.min(100, (pb.heat ?? 0) + hours * heatRate);

  // ── DRUG BUSINESSES ───────────────────────────────────────────────────────
  if (def?.income_type === "drugs") {
    const drugOutputRate = computeDrugOutputRate({
      base_output_per_hour: (pb.business.drug_output_per_hour as number) ?? 0,
      production_level: pb.production_level as ProductionLevel,
      workers: workers ?? [],
      upgrades: activeDefs,
    });
    let drugQty = Math.max(0, Math.floor(hoursElapsed * drugOutputRate));

    if (newHeat >= 90) {
      const seized = Math.floor(drugQty * 0.70);
      drugQty = drugQty - seized;
      newHeat = 30;
      await supabase.from("player_businesses").update({ status: "raided", heat: newHeat, last_heat_update: now.toISOString(), last_collection: now.toISOString() }).eq("id", pbId);
      await spawnEvent(pbId, player.id, "police_raid_aftermath", {});
      if (drugQty > 0 && pb.business.drug_output_item_id) {
        await grantDrugItem(player.id, pb.business.drug_output_item_id, drugQty);
      }
      const itemName = pb.business.drug_output_item_slug ?? "droga";
      return NextResponse.json({ success: true, drug_qty: drugQty, raided: true, message: `Foste invadido! A polícia apreendeu 70% da ${itemName}. Recuperaste ${drugQty} unidades.`, heat: newHeat });
    }

    if (drugQty > 0 && pb.business.drug_output_item_id) {
      await grantDrugItem(player.id, pb.business.drug_output_item_id, drugQty);
    }
    await supabase.from("player_businesses").update({ last_collection: now.toISOString(), heat: newHeat, last_heat_update: now.toISOString() }).eq("id", pbId);
    await grantXP(player.id, Math.max(5, Math.floor(drugQty * 5)));
    let newEvent = null;
    if (def) newEvent = await maybeSpawnEvent(pb, def, player.id, pbId, newHeat);
    return NextResponse.json({ success: true, drug_qty: drugQty, heat: newHeat, raided: false, new_event: newEvent });
  }

  // ── CASH BUSINESSES ───────────────────────────────────────────────────────
  const incomeRate = def ? computeIncomeRate({ base_income_per_hour: pb.business.base_income_per_hour, production_level: pb.production_level as ProductionLevel, workers: workers ?? [], upgrades: activeDefs }) : 0;
  let earned = Math.floor(hoursElapsed * incomeRate);
  if (player.class === "businessman") earned = Math.floor(earned * 1.20);

  let raided = false;
  if (newHeat >= 90) {
    raided = true;
    const seized = Math.floor(earned * 0.70);
    earned = earned - seized;
    newHeat = 30;
    await supabase.from("player_businesses").update({ status: "raided", heat: newHeat, last_heat_update: now.toISOString(), last_collection: now.toISOString() }).eq("id", pbId);
    await spawnEvent(pbId, player.id, "police_raid_aftermath", {});
    if (earned > 0) await grantDirtyMoney(player.id, earned);
    return NextResponse.json({ success: true, earned, raided: true, message: `Foste invadido! A polícia apreendeu 70% dos fundos. Recuperaste $${earned.toLocaleString()} sujos.`, heat: newHeat });
  }

  if (earned > 0) await grantDirtyMoney(player.id, earned);

  await supabase.from("player_businesses").update({
    last_collection: now.toISOString(),
    heat: newHeat,
    last_heat_update: now.toISOString(),
  }).eq("id", pbId);

  // XP
  await grantXP(player.id, Math.max(5, Math.floor(earned / 100)));

  // Random event check
  let newEvent = null;
  if (def) {
    newEvent = await maybeSpawnEvent(pb, def, player.id, pbId, newHeat);
  }

  return NextResponse.json({ success: true, earned, heat: newHeat, raided: false, new_event: newEvent });
}

// ── launder (chop_shop etc.) ─────────────────────────────────────────────────
async function handleLaunder(pb: any, body: any, player: any, pbId: string) {
  const { amount } = body as { amount: number };
  if (!amount || amount <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });

  const def = BUSINESS_DEFS[pb.business.type];
  if (!def || def.income_type !== "launder") {
    return NextResponse.json({ error: "Este negócio não lava dinheiro" }, { status: 400 });
  }

  // Load workers to compute effective cap
  const { data: workers } = await supabase
    .from("player_business_workers")
    .select("*")
    .eq("player_business_id", pbId)
    .eq("is_active", true);
  const workerCount = (workers ?? []).length;

  const baseLaunderCap: number = pb.business.launder_cap_per_hour ?? 0;
  const launderProdMult = PRODUCTION_META[pb.production_level as ProductionLevel]?.income ?? 1;
  const effectiveCap = Math.floor((baseLaunderCap + workerCount * (def.launder_cap_per_worker ?? 0)) * launderProdMult);

  // Check / reset hourly window
  const windowStart = new Date(pb.launder_window_start ?? pb.purchased_at);
  const windowExpired = (Date.now() - windowStart.getTime()) >= 3_600_000;
  const launderUsed: number = windowExpired ? 0 : (pb.launder_used ?? 0);
  const remaining = Math.max(0, effectiveCap - launderUsed);

  if (remaining <= 0) {
    const resetAt = new Date(windowStart.getTime() + 3_600_000);
    const minsLeft = Math.ceil((resetAt.getTime() - Date.now()) / 60_000);
    return NextResponse.json(
      { error: `Cap de lavagem atingido. Recarrega em ${minsLeft} min.` },
      { status: 429 }
    );
  }

  // Clamp to remaining cap and dirty balance
  const dirtyBalance = await getDirtyMoneyBalance(player.id);
  if (dirtyBalance <= 0) return NextResponse.json({ error: "Sem dinheiro sujo para lavar" }, { status: 403 });

  const finalAmount = Math.min(amount, remaining, dirtyBalance);

  // Conversion rate — base rate from admin-configured fee, workers reduce the fee slightly
  const feePercent: number = pb.business.launder_fee_percent ?? 20;
  const baseRate = 1 - feePercent / 100;
  const scammerBonus = player.class === "scammer" ? 0.10 : 0;
  const workerBonus = workerCount * 0.015; // each worker reduces fee by 1.5%
  const rate = Math.min(0.95, baseRate + scammerBonus + workerBonus);
  const clean = Math.floor(finalAmount * rate);

  // Deduct dirty money from inventory + balance
  const deductResult = await deductDirtyMoney(player.id, finalAmount);
  if (!deductResult.success) {
    return NextResponse.json({ error: "Sem dinheiro sujo suficiente" }, { status: 403 });
  }

  // Add clean cash
  const { data: fpCash } = await supabase.from("crime_players").select("cash").eq("id", player.id).single();
  await supabase.from("crime_players")
    .update({ cash: (fpCash?.cash ?? player.cash) + clean })
    .eq("id", player.id);

  // Update launder window tracking
  const now = new Date();
  if (windowExpired) {
    await supabase.from("player_businesses")
      .update({ launder_used: finalAmount, launder_window_start: now.toISOString() })
      .eq("id", pbId);
  } else {
    await supabase.from("player_businesses")
      .update({ launder_used: launderUsed + finalAmount })
      .eq("id", pbId);
  }

  await grantXP(player.id, Math.max(5, Math.floor(clean / 200)));

  return NextResponse.json({
    success: true,
    dirty_amount: finalAmount,
    clean_amount: clean,
    rate: (rate * 100).toFixed(0),
    loss: finalAmount - clean,
    launder_cap: effectiveCap,
    launder_remaining: remaining - finalAmount,
  });
}

// ── resolve_event ─────────────────────────────────────────────────────────────
async function handleResolveEvent(pb: any, body: any, player: any, _pbId: string) {
  const { event_id, choice_id } = body as { event_id: string; choice_id: string };

  const { data: event } = await supabase.from("player_business_events").select("*").eq("id", event_id).eq("player_id", player.id).eq("is_resolved", false).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // ── Police investigation (spawned by raid arrest, not random) ──
  if (event.event_def_id === "police_investigation") {
    const investigationChoices: Record<string, { cash_cost: number; dirty_cost?: number; outcome: string; success_chance?: number; fail_outcome?: string }> = {
      bribe:  { cash_cost: 15000,                   outcome: "Subornaste o investigador. O caso foi arquivado e o negócio reabriu." },
      lawyer: { cash_cost:  8000, success_chance: 0.70, outcome: "O advogado arquivou o processo. O negócio está de volta.", fail_outcome: "O advogado não conseguiu ajudar. O processo continua — tenta outro método." },
      wait:   { cash_cost:     0, dirty_cost: 500,  outcome: "A investigação encerrou por falta de provas. Operações retomadas." },
    };
    const inv = investigationChoices[choice_id];
    if (!inv) return NextResponse.json({ error: "Opção inválida" }, { status: 400 });

    const { data: fp } = await supabase.from("crime_players").select("cash, dirty_cash").eq("id", player.id).single();
    const curCash = fp?.cash ?? player.cash;
    const curDirty = fp?.dirty_cash ?? 0;
    if (inv.cash_cost > curCash) return NextResponse.json({ error: `Precisas de $${inv.cash_cost.toLocaleString()} de dinheiro limpo` }, { status: 403 });
    if ((inv.dirty_cost ?? 0) > curDirty) return NextResponse.json({ error: `Precisas de $${(inv.dirty_cost ?? 0).toLocaleString()} de dinheiro sujo` }, { status: 403 });

    const success = inv.success_chance === undefined || Math.random() < inv.success_chance;
    const outcomeMsg = success ? inv.outcome : (inv.fail_outcome ?? "Algo correu mal.");

    if (success) {
      if (inv.cash_cost > 0) await supabase.from("crime_players").update({ cash: curCash - inv.cash_cost }).eq("id", player.id);
      if ((inv.dirty_cost ?? 0) > 0) await deductDirtyMoney(player.id, inv.dirty_cost!);
      // Reopen business
      await supabase.from("player_businesses").update({ status: "running" }).eq("id", pb.id);
      // Mark resolved
      await supabase.from("player_business_events").update({ is_resolved: true, choice_made: choice_id, outcome_data: { success: true, message: outcomeMsg }, resolved_at: new Date().toISOString() }).eq("id", event_id);
    } else {
      // Failed — deduct cost but leave event open for another try
      if (inv.cash_cost > 0) await supabase.from("crime_players").update({ cash: curCash - inv.cash_cost }).eq("id", player.id);
    }

    return NextResponse.json({ success: true, outcome: outcomeMsg, event_success: success });
  }

  const def = BUSINESS_DEFS[pb.business.type];
  const eventDef = def?.events.find((e) => e.id === event.event_def_id)
    ?? SHARED_BUSINESS_EVENTS.find((e) => e.id === event.event_def_id);
  if (!eventDef) return NextResponse.json({ error: "Event definition not found" }, { status: 400 });

  const choice = eventDef.choices.find((c) => c.id === choice_id);
  if (!choice) return NextResponse.json({ error: "Choice not found" }, { status: 400 });

  // Success check
  const success = choice.success_chance === undefined || Math.random() < choice.success_chance;
  const heatChange = success ? (choice.heat_change ?? 0) : (choice.fail_heat_change ?? Math.abs(choice.heat_change ?? 0) * 2);
  const cashCost = choice.cash_cost ?? 0;
  const dirtyCost = choice.dirty_cost ?? 0;
  const cashGain = success ? (choice.cash_gain ?? 0) : 0;
  const dirtyGain = success ? (choice.dirty_gain ?? 0) : 0;

  // Check player can afford
  const { data: fp } = await supabase.from("crime_players").select("cash, dirty_cash").eq("id", player.id).single();
  const currentCash = fp?.cash ?? player.cash;
  const currentDirty = fp?.dirty_cash ?? player.dirty_cash;
  if (cashCost > currentCash) return NextResponse.json({ error: `Precisas de $${cashCost.toLocaleString()} de dinheiro limpo` }, { status: 403 });
  if (dirtyCost > currentDirty) return NextResponse.json({ error: `Precisas de $${dirtyCost.toLocaleString()} de dinheiro sujo` }, { status: 403 });

  // Apply cash changes
  const newCash = currentCash - cashCost + cashGain;
  await supabase.from("crime_players").update({ cash: newCash }).eq("id", player.id);
  if (dirtyCost > 0) await deductDirtyMoney(player.id, dirtyCost);
  if (dirtyGain > 0) await grantDirtyMoney(player.id, dirtyGain);

  // Apply heat change
  const { data: pbFresh } = await supabase.from("player_businesses").select("heat, last_heat_update, production_level, status").eq("id", event.player_business_id).single();
  if (pbFresh) {
    const newHeat = Math.max(0, Math.min(100, (pbFresh.heat ?? 0) + heatChange));
    const newStatus = newHeat < 90 && pbFresh.status === "raided" ? "running" : (pbFresh.status as BusinessStatus);
    await supabase.from("player_businesses").update({ heat: newHeat, last_heat_update: new Date().toISOString(), status: newStatus }).eq("id", event.player_business_id);
  }

  // Mark event resolved
  const outcomeMsg = success ? choice.outcome : (choice.fail_outcome ?? "Algo correu mal.");
  await supabase.from("player_business_events").update({
    is_resolved: true,
    choice_made: choice_id,
    outcome_data: { success, message: outcomeMsg, cash_change: cashGain - cashCost, dirty_change: dirtyGain - dirtyCost, heat_change: heatChange },
    resolved_at: new Date().toISOString(),
  }).eq("id", event_id);

  return NextResponse.json({ success: true, outcome: outcomeMsg, event_success: success, cash_change: cashGain - cashCost, dirty_change: dirtyGain - dirtyCost, heat_change: heatChange });
}

// ── raid_result ───────────────────────────────────────────────────────────────
async function handleRaidResult(pb: any, body: any, player: any) {
  const { escaped, cashAtRisk } = body as { escaped: boolean; cashAtRisk: number };

  // Flush current heat so we operate on up-to-date value
  const def = BUSINESS_DEFS[pb.business.type];
  const { data: workers } = await supabase.from("player_business_workers").select("*").eq("player_business_id", pb.id).eq("is_active", true);
  const { data: ownedUpgrades } = await supabase.from("player_business_upgrades").select("upgrade_def_id").eq("player_business_id", pb.id);
  const ownedIds = (ownedUpgrades ?? []).map((u: any) => u.upgrade_def_id);
  const activeDefs = (def?.upgrades ?? []).filter((u) => ownedIds.includes(u.id));
  const heatRate = def ? computeHeatRate({ base_heat_per_hour: def.heat_per_hour, production_level: pb.production_level as ProductionLevel, workers: workers ?? [], upgrades: activeDefs }) : 0;
  const hours = (Date.now() - new Date(pb.last_heat_update ?? pb.purchased_at).getTime()) / 3_600_000;
  const currentHeat = Math.min(100, (pb.heat ?? 0) + hours * heatRate);

  if (escaped) {
    // Escape: reduce heat, grant XP
    const newHeat = Math.max(0, currentHeat - 35);
    await supabase.from("player_businesses").update({ heat: newHeat, last_heat_update: new Date().toISOString() }).eq("id", pb.id);
    await grantXP(player.id, 50);
    return NextResponse.json({ success: true, message: `Escapaste! Calor reduzido para ${newHeat.toFixed(0)}%. +50 XP` });
  } else {
    // Arrested: lose accumulated income, heat resets, status set to raided
    const { data: fp } = await supabase.from("crime_players").select("dirty_cash").eq("id", player.id).single();
    const cashLost = Math.min(cashAtRisk, fp?.dirty_cash ?? 0);
    if (cashLost > 0) await deductDirtyMoney(player.id, cashLost);
    await supabase.from("player_businesses")
      .update({ heat: 0, last_heat_update: new Date().toISOString(), status: "raided", accumulated_income: 0 })
      .eq("id", pb.id);

    // Send player to jail (30–60 min)
    const jailMinutes = 30 + Math.floor(Math.random() * 31);
    const jailReleaseAt = new Date(Date.now() + jailMinutes * 60_000).toISOString();
    await supabase.from("crime_players").update({ in_jail: true, jail_release_at: jailReleaseAt }).eq("id", player.id);

    // Spawn police investigation event so player can reopen the business
    await supabase.from("player_business_events").insert({
      player_id: player.id,
      player_business_id: pb.id,
      event_def_id: "police_investigation",
      event_data: {},
    });

    return NextResponse.json({
      success: true,
      jailed: true,
      jail_minutes: jailMinutes,
      message: `Foste preso por ${jailMinutes} min! Perdeste $${cashLost.toLocaleString()}. O negócio está sob investigação — resolve o evento para reabrir.`,
    });
  }
}

// ── buy_upgrade ───────────────────────────────────────────────────────────────
async function handleBuyUpgrade(pb: any, body: any, player: any, pbId: string) {
  const { upgrade_id } = body as { upgrade_id: string };
  const def = BUSINESS_DEFS[pb.business.type];
  if (!def) return NextResponse.json({ error: "Business type not found" }, { status: 400 });

  const upgradeDef = def.upgrades.find((u) => u.id === upgrade_id);
  if (!upgradeDef) return NextResponse.json({ error: "Upgrade not found" }, { status: 404 });

  // Check not already owned
  const { data: existing } = await supabase.from("player_business_upgrades").select("id").eq("player_business_id", pbId).eq("upgrade_def_id", upgrade_id).maybeSingle();
  if (existing) return NextResponse.json({ error: "Upgrade já comprado" }, { status: 400 });

  const { data: fp } = await supabase.from("crime_players").select("cash").eq("id", player.id).single();
  if ((fp?.cash ?? player.cash) < upgradeDef.cost) return NextResponse.json({ error: `Precisas de $${upgradeDef.cost.toLocaleString()} de dinheiro limpo` }, { status: 403 });

  await supabase.from("player_business_upgrades").insert({ player_id: player.id, player_business_id: pbId, upgrade_def_id: upgrade_id });
  await supabase.from("crime_players").update({ cash: (fp?.cash ?? player.cash) - upgradeDef.cost }).eq("id", player.id);

  return NextResponse.json({ success: true, message: `${upgradeDef.name} instalado!`, cost: upgradeDef.cost });
}

// ── Internal: maybe spawn event ───────────────────────────────────────────────
async function maybeSpawnEvent(pb: any, def: any, playerId: string, pbId: string, currentHeat: number) {
  // Check unresolved event count — max 2 pending events
  const { count } = await supabase.from("player_business_events").select("id", { count: "exact", head: true }).eq("player_business_id", pbId).eq("is_resolved", false);
  if ((count ?? 0) >= 2) return null;

  const eligible = def.events.filter((e: any) =>
    currentHeat >= (e.min_heat ?? 0) &&
    Math.random() < e.base_chance
  );
  if (eligible.length === 0) return null;

  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  const { data: newEvent } = await supabase.from("player_business_events").insert({
    player_id: playerId,
    player_business_id: pbId,
    event_def_id: picked.id,
    event_data: {},
  }).select().single();

  return { ...newEvent, def: picked };
}

async function spawnEvent(pbId: string, playerId: string, eventDefId: string, data: object) {
  await supabase.from("player_business_events").insert({ player_id: playerId, player_business_id: pbId, event_def_id: eventDefId, event_data: data });
}
