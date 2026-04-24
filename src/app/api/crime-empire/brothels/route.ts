import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const CRYPTO_BROTHEL_TYPES = ["brothel_luxury", "brothel_exclusive", "brothel_empire"];

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

    const { data: player } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // All brothel type definitions (separate from businesses)
    const { data: brothelTypes } = await supabase
      .from("brothel_types")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    // Player's owned brothels with type info joined
    const { data: ownedBrothels } = await supabase
      .from("player_brothels")
      .select("*, brothel_type:brothel_types(*)")
      .eq("player_id", player.id);

    // Hired workers
    const { data: workers } = await supabase
      .from("brothel_workers")
      .select("*")
      .eq("player_id", player.id);

    return NextResponse.json({
      success: true,
      brothelTypes: brothelTypes || [],
      ownedBrothels: ownedBrothels || [],
      workers: workers || [],
      playerClass: player.class,
      playerLevel: player.level,
      playerCash: player.cash,
      playerCrypto: player.crypto,
    });
  } catch (error) {
    console.error("GET /api/crime-empire/brothels error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: player } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date())
      return NextResponse.json({ error: "Estás na prisão. Não podes fazer isso agora." }, { status: 403 });
    if (player.hp <= 0)
      return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });

    const body = await req.json();
    const { action } = body;

    // ==================== PURCHASE BROTHEL ====================
    if (action === "purchase") {
      const { brothelTypeId } = body;

      const { data: brothelType } = await supabase
        .from("brothel_types")
        .select("*")
        .eq("id", brothelTypeId)
        .eq("enabled", true)
        .single();
      if (!brothelType) return NextResponse.json({ error: "Bordel não encontrado." }, { status: 404 });

      if (player.level < brothelType.required_level)
        return NextResponse.json({ error: `Precisas de nível ${brothelType.required_level} para comprar este bordel!` }, { status: 400 });

      const { data: existing } = await supabase
        .from("player_brothels")
        .select("id")
        .eq("player_id", player.id)
        .eq("brothel_type_id", brothelTypeId)
        .single();
      if (existing) return NextResponse.json({ error: "Já tens este bordel!" }, { status: 400 });

      const usesCrypto = CRYPTO_BROTHEL_TYPES.includes(brothelType.type);
      if (usesCrypto) {
        if (player.crypto < brothelType.purchase_price)
          return NextResponse.json({ error: `Precisas de 🪙${brothelType.purchase_price.toLocaleString()} em crypto!` }, { status: 400 });
      } else {
        if (player.cash < brothelType.purchase_price)
          return NextResponse.json({ error: `Precisas de $${brothelType.purchase_price.toLocaleString()} limpos!` }, { status: 400 });
      }

      // PIMP bonus: double worker capacity
      const maxWorkers = player.class === "pimp" ? brothelType.max_employees * 2 : brothelType.max_employees;

      await supabase
        .from("crime_players")
        .update(usesCrypto
          ? { crypto: player.crypto - brothelType.purchase_price }
          : { cash: player.cash - brothelType.purchase_price })
        .eq("id", player.id);

      await supabase.from("player_brothels").insert({
        player_id: player.id,
        brothel_type_id: brothelTypeId,
        max_employees: maxWorkers,
      });

      return NextResponse.json({ success: true, message: `Compraste ${brothelType.name}!` });
    }

    // ==================== HIRE WORKER ====================
    if (action === "hire") {
      const { playerBrothelId, workerName } = body;

      const { data: playerBrothel } = await supabase
        .from("player_brothels")
        .select("*, brothel_type:brothel_types(*)")
        .eq("id", playerBrothelId)
        .eq("player_id", player.id)
        .single();
      if (!playerBrothel) return NextResponse.json({ error: "Bordel não encontrado." }, { status: 404 });

      const { data: currentWorkers } = await supabase
        .from("brothel_workers")
        .select("id")
        .eq("player_id", player.id);
      const workerCount = currentWorkers?.length || 0;

      if (workerCount >= playerBrothel.max_employees)
        return NextResponse.json({ error: `Capacidade máxima atingida! (${playerBrothel.max_employees} workers)` }, { status: 400 });

      const hiringCost = 10000;
      const hireUsesCrypto = CRYPTO_BROTHEL_TYPES.includes(playerBrothel.brothel_type?.type ?? "");
      if (hireUsesCrypto) {
        if (player.crypto < hiringCost)
          return NextResponse.json({ error: `Precisas de 🪙${hiringCost.toLocaleString()} em crypto para contratar!` }, { status: 400 });
      } else {
        if (player.cash < hiringCost)
          return NextResponse.json({ error: `Precisas de $${hiringCost.toLocaleString()} para contratar!` }, { status: 400 });
      }

      await supabase
        .from("crime_players")
        .update(hireUsesCrypto
          ? { crypto: player.crypto - hiringCost }
          : { cash: player.cash - hiringCost })
        .eq("id", player.id);

      const incomePerHour     = Math.floor(Math.random() * 100) + 150;
      const charismaBonus     = Math.floor(Math.random() * 3) + 1;
      const intelligenceBonus = Math.floor(Math.random() * 3) + 1;

      await supabase.from("brothel_workers").insert({
        player_id: player.id,
        name: workerName || `Worker #${workerCount + 1}`,
        status: "healthy",
        income_per_hour: incomePerHour,
        charisma_bonus: charismaBonus,
        intelligence_bonus: intelligenceBonus,
        respect_bonus: 1,
      });

      return NextResponse.json({ success: true, message: `Contrataste ${workerName || "nova worker"}!` });
    }

    // ==================== FIRE WORKER ====================
    if (action === "fire") {
      const { workerId } = body;
      await supabase.from("brothel_workers").delete().eq("id", workerId).eq("player_id", player.id);
      return NextResponse.json({ success: true, message: "Worker despedida!" });
    }

    // ==================== COLLECT INCOME ====================
    if (action === "collect") {
      const { data: workers } = await supabase
        .from("brothel_workers")
        .select("*")
        .eq("player_id", player.id)
        .eq("status", "healthy");

      if (!workers || workers.length === 0)
        return NextResponse.json({ error: "Sem workers saudáveis para gerar rendimento!" }, { status: 400 });

      let totalIncome = workers.reduce((s, w) => s + w.income_per_hour, 0);
      if (player.class === "pimp") totalIncome = Math.floor(totalIncome * 1.2);

      const now = new Date();
      const lastCollectRaw = player.last_brothel_collect_at ?? player.created_at ?? now.toISOString();
      const hoursPassed = Math.min((now.getTime() - new Date(lastCollectRaw).getTime()) / 3_600_000, 24);

      if (hoursPassed < 1 / 60)
        return NextResponse.json({ error: "Aguarda um pouco antes de recolher novamente!" }, { status: 400 });

      const collected = Math.floor(totalIncome * hoursPassed);

      const { data: freshPlayer } = await supabase
        .from("crime_players").select("dirty_cash").eq("id", player.id).single();

      await supabase.from("crime_players").update({
        dirty_cash: (freshPlayer?.dirty_cash ?? player.dirty_cash) + collected,
        last_brothel_collect_at: now.toISOString(),
      }).eq("id", player.id);

      const xpEarned = Math.max(5, Math.floor(collected / 1000));
      const { data: xpPlayer } = await supabase
        .from("crime_players").select("xp, level, xp_to_next_level").eq("id", player.id).single();
      if (xpPlayer) {
        let newXP = xpPlayer.xp + xpEarned;
        let newLevel = xpPlayer.level;
        while (newXP >= xpPlayer.xp_to_next_level) { newXP -= xpPlayer.xp_to_next_level; newLevel++; }
        const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));
        await supabase.from("crime_players").update({ xp: newXP, level: newLevel, xp_to_next_level: newXPToNext }).eq("id", player.id);
      }

      return NextResponse.json({ success: true, collected, xp_earned: xpEarned, message: `Coletaste $${collected.toLocaleString()} em dinheiro sujo!` });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/crime-empire/brothels error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
