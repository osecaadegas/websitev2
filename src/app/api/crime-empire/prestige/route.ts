import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser(req: NextRequest) {
  const sessionCookie = req.cookies.get("twitch_session");
  if (!sessionCookie) return null;

  try {
    const session = JSON.parse(sessionCookie.value);
    return session?.id || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { newClass } = body;

    const VALID_CLASSES = ["thief", "scammer", "hooligan", "dealer", "hitman", "businessman", "hacker", "brute", "pimp"];
    if (newClass && !VALID_CLASSES.includes(newClass)) {
      return NextResponse.json({ error: "Classe inválida" }, { status: 400 });
    }

    // Fetch player data
    const { data: player, error: playerError } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
    }

    // Validate level 120+
    if (player.level < 120) {
      return NextResponse.json(
        { error: "Precisas estar no nível 120 ou superior para fazer prestige" },
        { status: 400 }
      );
    }

    // Calculate prestige bonuses
    const newPrestigeLevel = player.prestige_level + 1;
    const totalLevels = player.total_levels_earned + player.level;

    const prestigeSuccessBonus = Math.min(newPrestigeLevel * 0.02, 0.20);
    const newMaxHp = 100 + (newPrestigeLevel * 5);
    const newMaxStamina = 100 + (newPrestigeLevel * 5);

    // Record prestige in history
    const { error: historyError } = await supabase
      .from("prestige_history")
      .insert({
        player_id: player.id,
        old_level: player.level,
        prestige_level: newPrestigeLevel,
        respect_at_prestige: player.respect,
        dirty_cash_at_prestige: player.dirty_cash,
        cash_at_prestige: player.cash,
      });

    if (historyError) {
      console.error("Error recording prestige history:", historyError);
      return NextResponse.json({ error: "Erro ao guardar histórico de prestige" }, { status: 500 });
    }

    // Full reset: level, XP, all money, respect, jail, class (optional)
    const resetUpdate: Record<string, any> = {
      level: 1,
      xp: 0,
      xp_to_next_level: 100,
      prestige_level: newPrestigeLevel,
      total_levels_earned: totalLevels,
      max_hp: newMaxHp,
      hp: newMaxHp,
      max_stamina: newMaxStamina,
      stamina: newMaxStamina,
      in_jail: false,
      jail_release_at: null,
      // Full economy reset
      cash: 0,
      dirty_cash: 0,
      crypto: 0,
      respect: 0,
      addiction: 0,
    };

    if (newClass) {
      resetUpdate.class = newClass;
    }

    const { error: updateError } = await supabase
      .from("crime_players")
      .update(resetUpdate)
      .eq("id", player.id);

    if (updateError) {
      console.error("Error updating player prestige:", updateError);
      return NextResponse.json({ error: "Erro ao fazer prestige" }, { status: 500 });
    }

    // Delete inventory and businesses (full reset)
    await supabase.from("player_inventory").delete().eq("player_id", player.id);
    await supabase.from("player_businesses").delete().eq("player_id", player.id);

    // Reset crime experience bonuses
    await supabase.from("player_crime_experience").delete().eq("player_id", player.id);

    // Update player stats
    const { data: currentStats } = await supabase
      .from("player_stats")
      .select("times_prestiged")
      .eq("player_id", player.id)
      .single();

    if (currentStats) {
      await supabase
        .from("player_stats")
        .update({ times_prestiged: currentStats.times_prestiged + 1, updated_at: new Date().toISOString() })
        .eq("player_id", player.id);
    }

    return NextResponse.json({
      success: true,
      message: `Prestige ${newPrestigeLevel} alcançado!`,
      prestigeLevel: newPrestigeLevel,
      newClass: newClass || player.class,
      bonuses: {
        successRateBonus: `+${(prestigeSuccessBonus * 100).toFixed(0)}%`,
        maxHp: newMaxHp,
        maxStamina: newMaxStamina,
      },
    });
  } catch (error) {
    console.error("Prestige error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

