import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import { grantDirtyMoney, deductDirtyMoney } from "@/lib/dirty-money";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ── E8: Shared XP helper ─────────────────────────────────── */
async function grantXP(playerId: string, xpEarned: number) {
  if (xpEarned <= 0) return;
  const { data: p } = await supabase.from("crime_players").select("xp, level, xp_to_next_level").eq("id", playerId).single();
  if (!p) return;
  let newXP = p.xp + xpEarned;
  let newLevel = p.level;
  while (newXP >= p.xp_to_next_level) {
    newXP -= p.xp_to_next_level;
    newLevel++;
  }
  const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));
  await supabase.from("crime_players").update({ xp: newXP, level: newLevel, xp_to_next_level: newXPToNext }).eq("id", playerId);
}

/* ── GET - Fetch all businesses and player's owned businesses ─── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get player
  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, dirty_cash, cash, class")
    .eq("user_id", user.id)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const brothelTypes = ["brothel_basic", "brothel_upgraded", "brothel_luxury", "brothel_exclusive", "brothel_empire"];

  // Get all businesses (excluding brothels — managed in Rua das Luzes)
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("enabled", true)
    .not("type", "in", `(${brothelTypes.join(",")})`)
    .order("required_level", { ascending: true });

  // Get player's businesses (excluding brothels)
  const { data: ownedBusinesses } = await supabase
    .from("player_businesses")
    .select(`
      *,
      business:businesses(*)
    `)
    .eq("player_id", player.id)
    .not("businesses.type", "in", `(${brothelTypes.join(",")})`);

  const pbIds = (ownedBusinesses ?? []).map((pb: any) => pb.id);

  // Count actual active workers per business (employees column is not kept in sync)
  let workerCountMap: Record<string, number> = {};
  if (pbIds.length > 0) {
    const { data: workerRows } = await supabase
      .from("player_business_workers")
      .select("player_business_id")
      .in("player_business_id", pbIds)
      .eq("is_active", true);
    for (const row of workerRows ?? []) {
      workerCountMap[row.player_business_id] = (workerCountMap[row.player_business_id] ?? 0) + 1;
    }
  }

  // Normalise owned businesses: expose the player_business UUID as `pb_id`
  // and inject real worker count as `employees`
  const normalisedOwned = (ownedBusinesses ?? []).map((pb: any) => ({
    ...pb,
    pb_id: pb.id, // the player_business UUID used for management route
    employees: workerCountMap[pb.id] ?? 0,
  }));

  return NextResponse.json({
    businesses: businesses || [],
    ownedBusinesses: normalisedOwned,
    player: {
      level: player.level,
      dirty_cash: player.dirty_cash,
      cash: player.cash,
      class: player.class,
    },
  });
}

/* ── POST - Business actions ──────────────────────────────── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { action, businessId, amount } = body;

  // Get player
  const { data: player } = await supabase
    .from("crime_players")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date()) {
    return NextResponse.json({ error: "Estás na prisão. Não podes gerir negócios agora." }, { status: 403 });
  }
  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
  }

  switch (action) {
    case "purchase":
      return handlePurchase(player, businessId);
    case "hire":
      return handleHire(player, businessId, amount || 1);
    case "fire":
      return handleFire(player, businessId, amount || 1);
    case "collect":
      return handleCollect(player, businessId);
    case "launder":
      return handleLaunder(player, businessId, amount);
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

/* ── Purchase Business ─────────────────────────────────────── */
async function handlePurchase(player: any, businessId: string) {
  // Get business details
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Check requirements
  if (player.level < business.required_level) {
    return NextResponse.json(
      { error: `Level ${business.required_level} required` },
      { status: 403 }
    );
  }

  if (player.cash < business.purchase_price) {
    return NextResponse.json(
      { error: "Not enough clean money" },
      { status: 403 }
    );
  }

  // Check if already owns
  const { data: existing } = await supabase
    .from("player_businesses")
    .select("id")
    .eq("player_id", player.id)
    .eq("business_id", businessId)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Already own this business" },
      { status: 403 }
    );
  }

  // Purchase business
  const maxEmp = player.class === "businessman"
    ? Math.floor(business.max_employees * 1.30)
    : business.max_employees;

  await supabase.from("player_businesses").insert({
    player_id: player.id,
    business_id: businessId,
    max_employees: maxEmp,
  });

  // Deduct money
  await supabase
    .from("crime_players")
    .update({
      cash: player.cash - business.purchase_price,
    })
    .eq("id", player.id);

  return NextResponse.json({
    success: true,
    message: `${business.name} comprado!`,
  });
}

/* ── Hire Workers ──────────────────────────────────────────── */
async function handleHire(player: any, businessId: string, amount: number) {
  const { data: playerBusiness } = await supabase
    .from("player_businesses")
    .select(`
      *,
      business:businesses(*)
    `)
    .eq("player_id", player.id)
    .eq("business_id", businessId)
    .single();

  if (!playerBusiness) {
    return NextResponse.json(
      { error: "You don't own this business" },
      { status: 404 }
    );
  }

  const newEmployees = playerBusiness.employees + amount;
  if (newEmployees > playerBusiness.max_employees) {
    return NextResponse.json(
      { error: `Maximum ${playerBusiness.max_employees} employees` },
      { status: 403 }
    );
  }

  // Hiring cost: 1 week of wages upfront
  const hiringCost = amount * playerBusiness.business.employee_cost_per_hour * 168; // 168 hours in a week

  if (player.cash < hiringCost) {
    return NextResponse.json(
      { error: `Need $${hiringCost} to hire ${amount} worker(s)` },
      { status: 403 }
    );
  }

  await supabase
    .from("player_businesses")
    .update({
      employees: newEmployees,
    })
    .eq("id", playerBusiness.id);

  await supabase
    .from("crime_players")
    .update({
      cash: player.cash - hiringCost,
    })
    .eq("id", player.id);

  return NextResponse.json({
    success: true,
    message: `${amount} worker(s) hired!`,
    cost: hiringCost,
    new_employees: newEmployees,
  });
}

/* ── Fire Workers ──────────────────────────────────────────── */
async function handleFire(player: any, businessId: string, amount: number) {
  const { data: playerBusiness } = await supabase
    .from("player_businesses")
    .select("*")
    .eq("player_id", player.id)
    .eq("business_id", businessId)
    .single();

  if (!playerBusiness) {
    return NextResponse.json(
      { error: "You don't own this business" },
      { status: 404 }
    );
  }

  const newEmployees = Math.max(0, playerBusiness.employees - amount);

  await supabase
    .from("player_businesses")
    .update({
      employees: newEmployees,
    })
    .eq("id", playerBusiness.id);

  return NextResponse.json({
    success: true,
    message: `${amount} worker(s) fired`,
    new_employees: newEmployees,
  });
}

/* ── Collect Income/Items ──────────────────────────────────── */
async function handleCollect(player: any, businessId: string) {
  const now = new Date();

  const { data: playerBusiness } = await supabase
    .from("player_businesses")
    .select(`
      *,
      business:businesses(*)
    `)
    .eq("player_id", player.id)
    .eq("business_id", businessId)
    .single();

  if (!playerBusiness) {
    return NextResponse.json(
      { error: "You don't own this business" },
      { status: 404 }
    );
  }

  const lastCollection = new Date(playerBusiness.last_collection);
  const hoursElapsed = (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60);

  if (hoursElapsed < 1) {
    const minsLeft = Math.ceil((3_600_000 - (now.getTime() - lastCollection.getTime())) / 60_000);
    return NextResponse.json(
      { error: `Podes coletar novamente em ${minsLeft} min.` },
      { status: 429 }
    );
  }

  const businessType = playerBusiness.business.type;
  const employees = playerBusiness.employees;
  const baseIncome = playerBusiness.business.base_income_per_hour;

  if (businessType === "chop_shop" || businessType === "offshore_bank" || businessType === "shell_company") {
    return NextResponse.json(
      { error: "Use launder action for money laundry" },
      { status: 400 }
    );
  }

  let collectedMoney = 0;
  const collectedItems: { name: string; quantity: number }[] = [];

  // ── Output items from admin-configured business_output_items ──
  const { data: outputItems } = await supabase
    .from("business_output_items")
    .select("item_id, quantity_per_hour, drop_chance, item:items(name)")
    .eq("business_id", businessId);

  if (outputItems && outputItems.length > 0) {
    for (const output of outputItems) {
      // Check drop chance (roll once per collection)
      if (Math.random() > output.drop_chance) continue;

      const qty = Math.floor(hoursElapsed * output.quantity_per_hour * (1 + employees * 0.5));
      if (qty <= 0) continue;

      const { data: existing } = await supabase
        .from("player_inventory")
        .select("id, quantity")
        .eq("player_id", player.id)
        .eq("item_id", output.item_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("player_inventory")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("player_inventory")
          .insert({ player_id: player.id, item_id: output.item_id, quantity: qty });
      }

      collectedItems.push({ name: (output.item as any)?.name || "Item", quantity: qty });
    }
  }

  // ── Cash income for non-item businesses ──
  // Sick workers reduce income by 15% each (max 80% total penalty)
  const sickPenalty = 1.0 - Math.min(0.80, (playerBusiness.sick_workers || 0) * 0.15);

  // If no output items configured (or in addition to them), generate dirty cash
  if (outputItems === null || outputItems.length === 0) {
    let incomePerHour = baseIncome + (employees * (baseIncome * 0.5));
    if (businessType === "empire_hq") {
      incomePerHour = baseIncome + (employees * 3000);
    }
    collectedMoney = Math.floor(hoursElapsed * incomePerHour * sickPenalty);
  } else if (businessType === "car_chop_shop") {
    // Chop shop also earns some dirty cash alongside items
    const incomePerHour = baseIncome + (employees * 800);
    collectedMoney = Math.floor(hoursElapsed * incomePerHour * sickPenalty);
  }

  // Update player money
  if (collectedMoney > 0) {
    // Businessman gets +20% income on regular businesses
    if (player.class === "businessman") collectedMoney = Math.floor(collectedMoney * 1.20);
    await grantDirtyMoney(player.id, collectedMoney);
  }

  // Update last collection time
  await supabase
    .from("player_businesses")
    .update({ last_collection: now.toISOString() })
    .eq("id", playerBusiness.id);

  // E8: Grant XP for collecting income
  const xpEarned = Math.floor((collectedMoney > 0 ? collectedMoney : 50) / 100);
  await grantXP(player.id, Math.max(5, xpEarned));

  return NextResponse.json({
    success: true,
    money: collectedMoney,
    items: collectedItems,
    hours_elapsed: Math.floor(hoursElapsed * 10) / 10,
  });
}

/* ── Launder Money (Money Laundry) ────────────────────────── */
async function handleLaunder(player: any, businessId: string, amount: number) {
  const { data: playerBusiness } = await supabase
    .from("player_businesses")
    .select(`
      *,
      business:businesses(*)
    `)
    .eq("player_id", player.id)
    .eq("business_id", businessId)
    .single();

  if (!playerBusiness) {
    return NextResponse.json(
      { error: "You don't own this business" },
      { status: 404 }
    );
  }

  const businessType = playerBusiness.business.type;
  
  if (businessType !== "chop_shop" && businessType !== "offshore_bank" && businessType !== "shell_company") {
    return NextResponse.json(
      { error: "This business can't launder money" },
      { status: 400 }
    );
  }

  if (playerBusiness.employees === 0) {
    return NextResponse.json(
      { error: "Need at least 1 worker to launder money" },
      { status: 403 }
    );
  }

  if (amount <= 0 || amount > player.dirty_cash) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400 }
    );
  }

  // Conversion rate based on business type
  // Scammer bonus: +10% base rate on all laundering
  const scammerBonus = player.class === "scammer" ? 0.10 : 0;
  let conversionRate;
  if (businessType === "chop_shop") {
    // Basic laundry: 60% base + 3% per worker (max 90%), scammer gets 70% base (max 95%)
    conversionRate = Math.min(0.90 + scammerBonus, (0.60 + scammerBonus) + (playerBusiness.employees * 0.03));
  } else if (businessType === "offshore_bank") {
    // Offshore bank: 70% base + 2% per worker (max 95%), scammer gets 80% base (max 99%)
    conversionRate = Math.min(0.95 + scammerBonus, (0.70 + scammerBonus) + (playerBusiness.employees * 0.02));
  } else {
    // Shell company: 80% base + 1.5% per worker (max 98%), scammer gets 90% base (max 99%)
    conversionRate = Math.min(Math.min(0.98 + scammerBonus, 0.99), (0.80 + scammerBonus) + (playerBusiness.employees * 0.015));
  }
  
  const cleanMoney = Math.floor(amount * conversionRate);

  const deductResult = await deductDirtyMoney(player.id, amount);
  if (!deductResult.success) {
    return NextResponse.json({ error: "Dinheiro sujo insuficiente" }, { status: 400 });
  }
  const { data: fpCash } = await supabase.from("crime_players").select("cash").eq("id", player.id).single();
  await supabase
    .from("crime_players")
    .update({ cash: (fpCash?.cash ?? player.cash) + cleanMoney })
    .eq("id", player.id);

  // Update last collection to prevent spam
  await supabase
    .from("player_businesses")
    .update({
      last_collection: new Date().toISOString(),
    })
    .eq("id", playerBusiness.id);

  // E8: Grant XP for laundering
  const launderXP = Math.max(5, Math.floor(cleanMoney / 200));
  await grantXP(player.id, launderXP);

  return NextResponse.json({
    success: true,
    dirty_amount: amount,
    clean_amount: cleanMoney,
    conversion_rate: (conversionRate * 100).toFixed(0),
    loss: amount - cleanMoney,
  });
}
