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

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get player
    const { data: player } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Get all brothels (filtered by type)
    const { data: brothels } = await supabase
      .from("businesses")
      .select("*")
      .in("type", ["brothel_basic", "brothel_upgraded", "brothel_luxury", "brothel_exclusive", "brothel_empire"])
      .eq("enabled", true)
      .order("required_level", { ascending: true });

    // Get player's owned brothels
    const { data: ownedBrothels } = await supabase
      .from("player_businesses")
      .select("*, businesses(*)")
      .eq("player_id", player.id)
      .in("businesses.type", ["brothel_basic", "brothel_upgraded", "brothel_luxury", "brothel_exclusive", "brothel_empire"]);

    // Get hired workers for all brothels
    const { data: workers } = await supabase
      .from("brothel_workers")
      .select("*")
      .eq("player_id", player.id);

    return NextResponse.json({
      success: true,
      brothels: brothels || [],
      ownedBrothels: ownedBrothels || [],
      workers: workers || [],
      playerClass: player.class,
      playerLevel: player.level,
    });
  } catch (error) {
    console.error("Error in GET /api/crime-empire/brothels:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: player } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const body = await req.json();
    const { action, brothelId, playerBusinessId, workerName } = body;

    // ==================== PURCHASE BROTHEL ====================
    if (action === "purchase") {
      const { data: brothel } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", brothelId)
        .single();

      if (!brothel) {
        return NextResponse.json({ error: "Brothel not found" }, { status: 404 });
      }

      // Check level requirement
      if (player.level < brothel.required_level) {
        return NextResponse.json({
          error: `Precisas de nível ${brothel.required_level} para comprar este bordel!`,
        }, { status: 400 });
      }

      // Check if already owns this brothel
      const { data: existing } = await supabase
        .from("player_businesses")
        .select("id")
        .eq("player_id", player.id)
        .eq("business_id", brothelId)
        .single();

      if (existing) {
        return NextResponse.json({ error: "Já tens este bordel!" }, { status: 400 });
      }

      // Check cash
      if (player.cash < brothel.purchase_price) {
        return NextResponse.json({
          error: `Precisas de $${brothel.purchase_price.toLocaleString()} limpos!`,
        }, { status: 400 });
      }

      // Apply PIMP bonus: double worker capacity
      const maxWorkers = player.class === "pimp" ? brothel.max_employees * 2 : brothel.max_employees;

      // Deduct cash and purchase
      await supabase
        .from("crime_players")
        .update({ cash: player.cash - brothel.purchase_price })
        .eq("id", player.id);

      await supabase
        .from("player_businesses")
        .insert({
          player_id: player.id,
          business_id: brothelId,
          employees: 0,
          max_employees: maxWorkers,
          upgrade_level: 1,
          income_multiplier: 1.0,
          active: true,
        });

      return NextResponse.json({
        success: true,
        message: `Compraste ${brothel.name}!`,
      });
    }

    // ==================== HIRE WORKER ====================
    if (action === "hire") {
      const { data: playerBusiness } = await supabase
        .from("player_businesses")
        .select("*, businesses(*)")
        .eq("id", playerBusinessId)
        .single();

      if (!playerBusiness) {
        return NextResponse.json({ error: "Brothel not owned" }, { status: 404 });
      }

      // Check worker capacity
      const { data: currentWorkers } = await supabase
        .from("brothel_workers")
        .select("id")
        .eq("player_id", player.id);

      const workerCount = currentWorkers?.length || 0;

      if (workerCount >= playerBusiness.max_employees) {
        return NextResponse.json({
          error: `Capacidade máxima atingida! (${playerBusiness.max_employees} workers)`,
        }, { status: 400 });
      }

      // Hiring cost: $10,000
      const hiringCost = 10000;
      if (player.cash < hiringCost) {
        return NextResponse.json({
          error: `Precisas de $${hiringCost.toLocaleString()} para contratar!`,
        }, { status: 400 });
      }

      // Deduct hiring cost
      await supabase
        .from("crime_players")
        .update({ cash: player.cash - hiringCost })
        .eq("id", player.id);

      // Random stats for worker
      const incomePerHour = Math.floor(Math.random() * 100) + 150; // 150-250/h base
      const charismaBonus = Math.floor(Math.random() * 3) + 1; // 1-3
      const intelligenceBonus = Math.floor(Math.random() * 3) + 1; // 1-3

      await supabase
        .from("brothel_workers")
        .insert({
          player_id: player.id,
          name: workerName || `Worker #${workerCount + 1}`,
          status: "healthy",
          income_per_hour: incomePerHour,
          charisma_bonus: charismaBonus,
          intelligence_bonus: intelligenceBonus,
          respect_bonus: 1,
        });

      return NextResponse.json({
        success: true,
        message: `Contrataste ${workerName || "nova worker"}!`,
      });
    }

    // ==================== FIRE WORKER ====================
    if (action === "fire") {
      const { workerId } = body;

      await supabase
        .from("brothel_workers")
        .delete()
        .eq("id", workerId)
        .eq("player_id", player.id);

      return NextResponse.json({
        success: true,
        message: "Worker despedida!",
      });
    }

    // ==================== COLLECT INCOME ====================
    if (action === "collect") {
      const { data: workers } = await supabase
        .from("brothel_workers")
        .select("*")
        .eq("player_id", player.id)
        .eq("status", "healthy");

      if (!workers || workers.length === 0) {
        return NextResponse.json({ error: "Sem workers para gerar rendimento!" }, { status: 400 });
      }

      // Calculate total hourly income
      let totalIncome = 0;
      workers.forEach((w) => {
        totalIncome += w.income_per_hour;
      });

      // Apply PIMP bonus: +20% income
      if (player.class === "pimp") {
        totalIncome = Math.floor(totalIncome * 1.2);
      }

      // Time-based collection (max 24 hours)
      const now = new Date();
      const lastCollection = new Date(player.last_login);
      const hoursPassed = Math.min(
        (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60),
        24
      );

      const collected = Math.floor(totalIncome * hoursPassed);

      await supabase
        .from("crime_players")
        .update({
          cash: player.cash + collected,
          last_login: now.toISOString(),
        })
        .eq("id", player.id);

      return NextResponse.json({
        success: true,
        collected,
        message: `Coletaste $${collected.toLocaleString()}!`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/crime-empire/brothels:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
