import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { token: string; escaped: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Pedido inválido" }, { status: 400 }); }

  const { token, escaped } = body;
  if (!token || typeof escaped !== "boolean") {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, escape_token, escape_token_expires_at")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });

  // Validate token
  if (!player.escape_token || player.escape_token !== token) {
    return NextResponse.json({ error: "Token inválido" }, { status: 403 });
  }
  if (!player.escape_token_expires_at || new Date(player.escape_token_expires_at) < new Date()) {
    // Token expired — clear it, player stays in jail
    await supabase
      .from("crime_players")
      .update({ escape_token: null, escape_token_expires_at: null })
      .eq("id", player.id);
    return NextResponse.json({ success: false, escaped: false, reason: "expired" });
  }

  if (escaped) {
    // Player beat the minigame — release from jail
    await supabase
      .from("crime_players")
      .update({ in_jail: false, jail_release_at: null, escape_token: null, escape_token_expires_at: null })
      .eq("id", player.id);
    return NextResponse.json({ success: true, escaped: true });
  } else {
    // Player failed the minigame — keep in jail, just clear token
    await supabase
      .from("crime_players")
      .update({ escape_token: null, escape_token_expires_at: null })
      .eq("id", player.id);
    return NextResponse.json({ success: true, escaped: false });
  }
}
