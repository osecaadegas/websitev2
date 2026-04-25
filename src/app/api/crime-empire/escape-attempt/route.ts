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
    .select("id, escape_token, escape_token_expires_at, escape_pending_cash, dirty_cash, escape_cash_at_risk")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });

  // Validate token
  if (!player.escape_token || player.escape_token !== token) {
    return NextResponse.json({ error: "Token inválido" }, { status: 403 });
  }
  if (!player.escape_token_expires_at || new Date(player.escape_token_expires_at) < new Date()) {
    // Token expired — clear it and pending cash, player stays in jail
    await supabase
      .from("crime_players")
      .update({ escape_token: null, escape_token_expires_at: null, escape_pending_cash: 0 })
      .eq("id", player.id);
    return NextResponse.json({ success: false, escaped: false, reason: "expired" });
  }

  if (escaped) {
    // Player beat the minigame — release from jail
    const pendingCash = player.escape_pending_cash ?? 0;
    const cashAtRisk = player.escape_cash_at_risk ?? 0;
    // When cashAtRisk > 0 (gambling raid), player escapes but loses 50% of their at-risk cash
    const cashLostOnEscape = Math.floor(cashAtRisk / 2);
    const newDirtyCash = Math.max(0, (player.dirty_cash ?? 0) + pendingCash - cashLostOnEscape);
    await supabase
      .from("crime_players")
      .update({
        in_jail: false, jail_release_at: null,
        escape_token: null, escape_token_expires_at: null,
        escape_pending_cash: 0,
        escape_cash_at_risk: 0,
        dirty_cash: newDirtyCash,
      })
      .eq("id", player.id);
    return NextResponse.json({
      success: true, escaped: true,
      cash_granted: pendingCash,
      cash_lost: cashLostOnEscape,
      cash_saved: cashAtRisk - cashLostOnEscape,
    });
  } else {
    // Player failed the minigame — keep in jail, deduct full cashAtRisk from dirty_cash
    const cashAtRisk = player.escape_cash_at_risk ?? 0;
    const cashLost = Math.min(cashAtRisk, player.dirty_cash ?? 0);
    const newDirtyCash = Math.max(0, (player.dirty_cash ?? 0) - cashLost);
    await supabase
      .from("crime_players")
      .update({
        escape_token: null, escape_token_expires_at: null,
        escape_pending_cash: 0,
        escape_cash_at_risk: 0,
        ...(cashAtRisk > 0 ? { dirty_cash: newDirtyCash } : {}),
      })
      .eq("id", player.id);
    return NextResponse.json({ success: true, escaped: false, cash_lost: cashLost });
  }
}
