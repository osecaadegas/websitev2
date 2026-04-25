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
    .select("id, escape_token, escape_token_expires_at, escape_pending_cash, dirty_cash, escape_cash_at_risk, escape_crypto_at_risk, crypto")
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
    const cryptoAtRisk = player.escape_crypto_at_risk ?? 0;
    // Escaped: lose 50% of at-risk dirty cash and 50% of at-risk crypto
    const cashLostOnEscape = Math.floor(cashAtRisk / 2);
    const cryptoLostOnEscape = Math.floor(cryptoAtRisk / 2);
    const newDirtyCash = Math.max(0, (player.dirty_cash ?? 0) + pendingCash - cashLostOnEscape);
    const newCrypto = Math.max(0, (player.crypto ?? 0) - cryptoLostOnEscape);

    // Confiscate 10% of drug inventory on escape
    const { data: drugItems } = await supabase.from("items").select("id").eq("category", "drug");
    const drugItemIds = (drugItems ?? []).map((i: { id: string }) => i.id);
    if (drugItemIds.length > 0) {
      const { data: drugInv } = await supabase.from("player_inventory").select("id, quantity").eq("player_id", player.id).in("item_id", drugItemIds).gt("quantity", 0);
      for (const inv of (drugInv ?? [])) {
        const seize = Math.max(1, Math.floor(inv.quantity * 0.1));
        const newQty = Math.max(0, inv.quantity - seize);
        if (newQty <= 0) {
          await supabase.from("player_inventory").delete().eq("id", inv.id);
        } else {
          await supabase.from("player_inventory").update({ quantity: newQty }).eq("id", inv.id);
        }
      }
    }

    await supabase
      .from("crime_players")
      .update({
        in_jail: false, jail_release_at: null,
        escape_token: null, escape_token_expires_at: null,
        escape_pending_cash: 0,
        escape_cash_at_risk: 0,
        escape_crypto_at_risk: 0,
        dirty_cash: newDirtyCash,
        crypto: newCrypto,
      })
      .eq("id", player.id);
    return NextResponse.json({
      success: true, escaped: true,
      cash_granted: pendingCash,
      cash_lost: cashLostOnEscape,
      cash_saved: cashAtRisk - cashLostOnEscape,
      crypto_lost: cryptoLostOnEscape,
    });
  } else {
    // Player failed the minigame — keep in jail, deduct full assets at risk
    const cashAtRisk = player.escape_cash_at_risk ?? 0;
    const cryptoAtRisk = player.escape_crypto_at_risk ?? 0;
    const cashLost = Math.min(cashAtRisk, player.dirty_cash ?? 0);
    const cryptoLost = Math.min(cryptoAtRisk, player.crypto ?? 0);
    const newDirtyCash = Math.max(0, (player.dirty_cash ?? 0) - cashLost);
    const newCrypto = Math.max(0, (player.crypto ?? 0) - cryptoLost);

    // Confiscate 25% of drug inventory on arrest
    const { data: drugItems } = await supabase.from("items").select("id").eq("category", "drug");
    const drugItemIds = (drugItems ?? []).map((i: { id: string }) => i.id);
    if (drugItemIds.length > 0) {
      const { data: drugInv } = await supabase.from("player_inventory").select("id, quantity").eq("player_id", player.id).in("item_id", drugItemIds).gt("quantity", 0);
      for (const inv of (drugInv ?? [])) {
        const seize = Math.max(1, Math.floor(inv.quantity * 0.25));
        const newQty = Math.max(0, inv.quantity - seize);
        if (newQty <= 0) {
          await supabase.from("player_inventory").delete().eq("id", inv.id);
        } else {
          await supabase.from("player_inventory").update({ quantity: newQty }).eq("id", inv.id);
        }
      }
    }

    await supabase
      .from("crime_players")
      .update({
        escape_token: null, escape_token_expires_at: null,
        escape_pending_cash: 0,
        escape_cash_at_risk: 0,
        escape_crypto_at_risk: 0,
        ...(cashAtRisk > 0 ? { dirty_cash: newDirtyCash } : {}),
        ...(cryptoAtRisk > 0 ? { crypto: newCrypto } : {}),
      })
      .eq("id", player.id);
    return NextResponse.json({ success: true, escaped: false, cash_lost: cashLost, crypto_lost: cryptoLost });
  }
}
