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

    // Get player
    const { data: player, error: playerError } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
    }

    // Check if in jail
    if (!player.in_jail) {
      return NextResponse.json({ error: "Não estás na prisão" }, { status: 400 });
    }

    // Calculate cost based on time remaining
    const now = new Date();
    const releaseAt = new Date(player.jail_release_at);
    const minutesRemaining = Math.ceil((releaseAt.getTime() - now.getTime()) / 60000);
    const cost = Math.max(0, minutesRemaining * 1000); // $1000 per minute

    // Check if player has enough cash
    if (player.cash < cost) {
      return NextResponse.json({ error: "Dinheiro insuficiente" }, { status: 400 });
    }

    // Release from jail and deduct cost
    const { error: updateError } = await supabase
      .from("crime_players")
      .update({
        in_jail: false,
        jail_release_at: null,
        cash: player.cash - cost,
      })
      .eq("id", player.id);

    if (updateError) {
      console.error("Error releasing from jail:", updateError);
      return NextResponse.json({ error: "Erro ao libertar da prisão" }, { status: 500 });
    }

    // Update jail record to show early release — find the latest record first
    const { data: latestRecord } = await supabase
      .from("jail_records")
      .select("id")
      .eq("player_id", player.id)
      .eq("released_early", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRecord) {
      await supabase
        .from("jail_records")
        .update({
          released_early: true,
          release_method: "paid_bail",
          amount_paid: cost,
        })
        .eq("id", latestRecord.id);
    }

    return NextResponse.json({
      success: true,
      cost,
      message: "Libertado da prisão!",
    });
  } catch (error) {
    console.error("Error in jail release:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
