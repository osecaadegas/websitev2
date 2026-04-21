import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("twitch_session");
  if (!sessionCookie) return null;

  const session = JSON.parse(sessionCookie.value);
  return { id: session.id, username: session.login, display_name: session.display_name, avatar: session.profile_image_url };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { healAmount } = await req.json();

    if (!healAmount || healAmount <= 0) {
      return NextResponse.json({ error: "Quantidade de cura inválida" }, { status: 400 });
    }

    // Get player
    const { data: player, error: playerError } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
    }

    // Check if already at max HP
    if (player.hp >= player.max_hp) {
      return NextResponse.json({ error: "Já estás com HP máximo" }, { status: 400 });
    }

    // Validate heal amount doesn't exceed needed
    const hpNeeded = player.max_hp - player.hp;
    const actualHealAmount = Math.min(healAmount, hpNeeded);

    // Calculate cost ($10 per HP point)
    const HP_COST_PER_POINT = 10;
    const cost = actualHealAmount * HP_COST_PER_POINT;

    // Check if player has enough cash
    if (player.cash < cost) {
      return NextResponse.json({ error: "Dinheiro insuficiente" }, { status: 400 });
    }

    // Heal and deduct cost
    const newHp = Math.min(player.hp + actualHealAmount, player.max_hp);

    const { error: updateError } = await supabase
      .from("crime_players")
      .update({
        hp: newHp,
        cash: player.cash - cost,
      })
      .eq("id", player.id);

    if (updateError) {
      console.error("Error healing player:", updateError);
      return NextResponse.json({ error: "Erro ao curar" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      healedAmount: actualHealAmount,
      cost,
      newHp,
      maxHp: player.max_hp,
      remainingCash: player.cash - cost,
    });
  } catch (error) {
    console.error("Error in hospital heal:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
