import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

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

/* ── GET - Fetch all businesses and player's owned businesses ─── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get player
  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, dirty_cash, cash")
    .eq("user_id", user.id)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Get all businesses
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("enabled", true)
    .order("required_level", { ascending: true });

  // Get player's businesses
  const { data: ownedBusinesses } = await supabase
    .from("player_businesses")
    .select(`
      *,
      business:businesses(*)
    `)
    .eq("player_id", player.id);

  return NextResponse.json({
    businesses: businesses || [],
    ownedBusinesses: ownedBusinesses || [],
    player: {
      level: player.level,
      dirty_cash: player.dirty_cash,
      cash: player.cash,
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
  await supabase.from("player_businesses").insert({
    player_id: player.id,
    business_id: businessId,
    max_employees: business.max_employees,
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

  if (hoursElapsed < 0.1) {
    return NextResponse.json(
      { error: "Wait at least 6 minutes between collections" },
      { status: 403 }
    );
  }

  const businessType = playerBusiness.business.type;
  const employees = playerBusiness.employees;
  const baseIncome = playerBusiness.business.base_income_per_hour;

  let collectedMoney = 0;
  let collectedItems: any[] = [];

  // Calculate based on business type
  if (businessType === "weed_farm") {
    // Produces cannabis items
    const gramsProduced = Math.floor(hoursElapsed * (1 + employees * 0.5));
    collectedItems.push({ name: "Cannabis (1g)", quantity: gramsProduced });
  } else if (businessType === "pill_factory") {
    // Produces pills
    const pillsProduced = Math.floor(hoursElapsed * (2 + employees * 1));
    collectedItems.push({ name: "Pílulas Ilegais", quantity: pillsProduced });
  } else if (businessType === "counterfeit_lab") {
    // Produces fake money
    const fakeMoney = Math.floor(hoursElapsed * (baseIncome + employees * 800));
    collectedItems.push({ name: "Notas Falsas ($1000)", quantity: Math.floor(fakeMoney / 1000) });
  } else if (businessType === "weapon_smuggling") {
    // Produces weapons
    const weaponsProduced = Math.floor(hoursElapsed * (2 + employees * 1));
    collectedItems.push({ name: "Arma Ilegal", quantity: weaponsProduced });
  } else if (businessType === "car_chop_shop") {
    // Produces car parts + income
    const partsProduced = Math.floor(hoursElapsed * (1 + employees * 0.5));
    collectedItems.push({ name: "Peças de Carro Roubadas", quantity: partsProduced });
    const incomePerHour = baseIncome + (employees * 800);
    collectedMoney = Math.floor(hoursElapsed * incomePerHour);
  } else if (businessType === "diamond_smuggling") {
    // Produces diamonds (rare, slower production)
    const diamondsProduced = Math.floor(hoursElapsed * (0.5 + employees * 0.5));
    if (diamondsProduced > 0) {
      collectedItems.push({ name: "Diamante Contrabandeado", quantity: diamondsProduced });
    }
  } else if (businessType === "chop_shop" || businessType === "offshore_bank") {
    // Money laundry - doesn't auto-collect, needs manual laundering
    return NextResponse.json(
      { error: "Use launder action for money laundry" },
      { status: 400 }
    );
  } else {
    // Regular income businesses (crypto_mining, scam_office, nightclub, casino, fight_club, etc.)
    let incomePerHour = baseIncome + (employees * (baseIncome * 0.5));
    
    // Empire HQ bonus
    if (businessType === "empire_hq") {
      incomePerHour = baseIncome + (employees * 3000);
    }
    
    collectedMoney = Math.floor(hoursElapsed * incomePerHour);
  }

  // Add collected items to inventory
  for (const item of collectedItems) {
    const { data: itemData } = await supabase
      .from("items")
      .select("id")
      .eq("name", item.name)
      .single();

    if (itemData) {
      const { data: existing } = await supabase
        .from("player_inventory")
        .select("*")
        .eq("player_id", player.id)
        .eq("item_id", itemData.id)
        .single();

      if (existing) {
        await supabase
          .from("player_inventory")
          .update({
            quantity: existing.quantity + item.quantity,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("player_inventory").insert({
          player_id: player.id,
          item_id: itemData.id,
          quantity: item.quantity,
        });
      }
    }
  }

  // Update player money
  if (collectedMoney > 0) {
    await supabase
      .from("crime_players")
      .update({
        dirty_cash: player.dirty_cash + collectedMoney,
      })
      .eq("id", player.id);
  }

  // Update last collection time
  await supabase
    .from("player_businesses")
    .update({
      last_collection: now.toISOString(),
    })
    .eq("id", playerBusiness.id);

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
  
  if (businessType !== "chop_shop" && businessType !== "offshore_bank") {
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
  let conversionRate;
  if (businessType === "chop_shop") {
    // Basic laundry: 60% base + 3% per worker (max 90%)
    conversionRate = Math.min(0.90, 0.60 + (playerBusiness.employees * 0.03));
  } else {
    // Offshore bank: 70% base + 2% per worker (max 95%)
    conversionRate = Math.min(0.95, 0.70 + (playerBusiness.employees * 0.02));
  }
  
  const cleanMoney = Math.floor(amount * conversionRate);

  await supabase
    .from("crime_players")
    .update({
      dirty_cash: player.dirty_cash - amount,
      cash: player.cash + cleanMoney,
    })
    .eq("id", player.id);

  // Update last collection to prevent spam
  await supabase
    .from("player_businesses")
    .update({
      last_collection: new Date().toISOString(),
    })
    .eq("id", playerBusiness.id);

  return NextResponse.json({
    success: true,
    dirty_amount: amount,
    clean_amount: cleanMoney,
    conversion_rate: (conversionRate * 100).toFixed(0),
    loss: amount - cleanMoney,
  });
}
