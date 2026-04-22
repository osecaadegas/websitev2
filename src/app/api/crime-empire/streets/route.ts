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

/* ── E8: Grant XP helper ── */
async function grantXP(playerId: string, xpEarned: number) {
  if (xpEarned <= 0) return;
  const { data: p } = await supabase.from("crime_players").select("xp, level, xp_to_next_level").eq("id", playerId).single();
  if (!p) return;
  let newXP = p.xp + xpEarned;
  let newLevel = p.level;
  while (newXP >= p.xp_to_next_level) { newXP -= p.xp_to_next_level; newLevel++; }
  const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));
  await supabase.from("crime_players").update({ xp: newXP, level: newLevel, xp_to_next_level: newXPToNext }).eq("id", playerId);
}

/* ── GET — Player's drug inventory + status ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, class, dirty_cash, in_jail, jail_release_at, last_street_sale_at")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Fetch drug items from inventory
  const { data: inventory } = await supabase
    .from("player_inventory")
    .select(`
      id,
      item_id,
      quantity,
      items (
        id, name, description, base_price, image_url
      )
    `)
    .eq("player_id", player.id)
    .eq("items.category", "drug")
    .gt("quantity", 0);

  // Filter out rows where the item join returned null (not a drug category)
  const drugs = (inventory || []).filter((row: any) => row.items !== null);

  return NextResponse.json({
    drugs,
    player: {
      class: player.class,
      dirty_cash: player.dirty_cash,
      in_jail: player.in_jail,
      jail_release_at: player.jail_release_at,
      last_street_sale_at: player.last_street_sale_at,
    },
  });
}

/* ── POST — Sell drugs on the streets ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, class, dirty_cash, in_jail, jail_release_at, last_street_sale_at")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Jail check
  if (player.in_jail) {
    const now = new Date();
    if (player.jail_release_at && new Date(player.jail_release_at) > now) {
      return NextResponse.json({ error: "Estás preso. Não podes vender nas ruas." }, { status: 403 });
    }
    // Release from jail if time passed
    await supabase.from("crime_players").update({ in_jail: false, jail_release_at: null }).eq("id", player.id);
    player.in_jail = false;
  }

  // Check if in hospital
  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
  }

  // Cooldown check — 5 minutes between sales
  const COOLDOWN_MS = 5 * 60 * 1000;
  if (player.last_street_sale_at) {
    const msSince = Date.now() - new Date(player.last_street_sale_at).getTime();
    if (msSince < COOLDOWN_MS) {
      const secsLeft = Math.ceil((COOLDOWN_MS - msSince) / 1000);
      return NextResponse.json({ error: `Cooldown ativo: aguarda ${secsLeft}s antes de vender de novo.` }, { status: 429 });
    }
  }

  const body = await req.json();
  const { inventoryId, amount } = body;

  if (!inventoryId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  // Dealer can sell up to 100g, everyone else up to 50g
  const maxAmount = player.class === "dealer" ? 100 : 50;
  if (amount > maxAmount) {
    return NextResponse.json({ error: `Máximo de ${maxAmount}g por venda para a tua classe.` }, { status: 400 });
  }

  // Fetch inventory entry
  const { data: entry } = await supabase
    .from("player_inventory")
    .select("id, quantity, item_id, items(name, base_price, category)")
    .eq("id", inventoryId)
    .eq("player_id", player.id)
    .single();

  if (!entry) return NextResponse.json({ error: "Item não encontrado no inventário" }, { status: 404 });

  const item = (entry as any).items;
  if (!item || item.category !== "drug") {
    return NextResponse.json({ error: "Só podes vender drogas nas ruas" }, { status: 400 });
  }

  if (entry.quantity < amount) {
    return NextResponse.json({ error: `Tens apenas ${entry.quantity}g de ${item.name}` }, { status: 400 });
  }

  // Jail risk — Dealer gets lower risk
  const baseJailRisk = 0.20;
  const jailRisk = player.class === "dealer" ? baseJailRisk * 0.50 : baseJailRisk;
  const caughtByPolice = Math.random() < jailRisk;

  const now = new Date();

  if (caughtByPolice) {
    // Confiscate the drugs being sold
    const newQty = entry.quantity - amount;
    if (newQty <= 0) {
      await supabase.from("player_inventory").delete().eq("id", inventoryId);
    } else {
      await supabase.from("player_inventory").update({ quantity: newQty }).eq("id", inventoryId);
    }

    // 20-40 min jail sentence
    const jailMinutes = 20 + Math.floor(Math.random() * 21);
    const releaseAt = new Date(now.getTime() + jailMinutes * 60000).toISOString();

    await supabase.from("crime_players").update({
      in_jail: true,
      jail_release_at: releaseAt,
      last_street_sale_at: now.toISOString(),
    }).eq("id", player.id);

    return NextResponse.json({
      success: false,
      caught: true,
      jail_minutes: jailMinutes,
      jail_release_at: releaseAt,
      drug_name: item.name,
      amount_confiscated: amount,
    });
  }

  // Successful sale — price per gram = base_price (admin sets this per item)
  const earned = Math.floor(item.base_price * amount);

  // Remove sold quantity
  const newQty = entry.quantity - amount;
  if (newQty <= 0) {
    await supabase.from("player_inventory").delete().eq("id", inventoryId);
  } else {
    await supabase.from("player_inventory").update({ quantity: newQty }).eq("id", inventoryId);
  }

  // Add dirty cash + update cooldown (re-fetch to avoid race condition)
  const { data: freshStreet } = await supabase.from("crime_players").select("dirty_cash").eq("id", player.id).single();
  await supabase.from("crime_players").update({
    dirty_cash: (freshStreet?.dirty_cash ?? player.dirty_cash) + earned,
    last_street_sale_at: now.toISOString(),
  }).eq("id", player.id);

  // E8: XP for drug sale
  const streetXP = Math.max(5, Math.floor(earned / 50));
  await grantXP(player.id, streetXP);

  return NextResponse.json({
    success: true,
    caught: false,
    earned,
    amount_sold: amount,
    drug_name: item.name,
    remaining: newQty,
  });
}
