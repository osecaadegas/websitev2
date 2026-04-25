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

/* ── GET — Fetch shop items + player cash + owned inventory ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, cash, dirty_cash")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Shop sells everything except raw materials (those are produced by businesses)
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .neq("category", "material")
    .is("crypto_price", null)
    .order("base_price", { ascending: true });

  // Get what the player already owns
  const { data: inventory } = await supabase
    .from("player_inventory")
    .select("item_id, quantity, equipped")
    .eq("player_id", player.id);

  const ownedMap: Record<string, { quantity: number; equipped: boolean }> = {};
  for (const entry of inventory || []) {
    ownedMap[entry.item_id] = { quantity: entry.quantity, equipped: entry.equipped };
  }

  return NextResponse.json({
    items: items || [],
    ownedMap,
    player: {
      cash: player.cash,
      dirty_cash: player.dirty_cash,
      level: player.level,
    },
  });
}

/* ── POST — Buy an item ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { itemId, quantity = 1 } = await req.json();
  if (!itemId) return NextResponse.json({ error: "Item não especificado" }, { status: 400 });
  if (quantity < 1 || quantity > 99) return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, cash, level, hp, in_jail, jail_release_at")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date()) {
    return NextResponse.json({ error: "Estás na prisão. Não podes comprar itens." }, { status: 403 });
  }
  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
  }

  const { data: item } = await supabase
    .from("items")
    .select("id, name, base_price, category, required_level")
    .eq("id", itemId)
    .neq("category", "material")
    .single();

  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // D10: Enforce level requirement
  if ((item.required_level ?? 1) > (player.level ?? 1)) {
    return NextResponse.json({ error: `Nível ${item.required_level} necessário para comprar este item` }, { status: 403 });
  }

  const totalCost = item.base_price * quantity;

  if (player.cash < totalCost) {
    return NextResponse.json({ error: "Dinheiro limpo insuficiente" }, { status: 400 });
  }

  // Deduct cash (re-fetch to prevent race condition)
  const { data: freshShop } = await supabase.from("crime_players").select("cash").eq("id", player.id).single();
  const freshCash = freshShop?.cash ?? player.cash;
  if (freshCash < totalCost) {
    return NextResponse.json({ error: "Dinheiro limpo insuficiente" }, { status: 400 });
  }

  const { error: deductError } = await supabase
    .from("crime_players")
    .update({ cash: freshCash - totalCost })
    .eq("id", player.id);

  if (deductError) return NextResponse.json({ error: "Erro ao processar pagamento" }, { status: 500 });

  // Upsert inventory
  const { data: existing } = await supabase
    .from("player_inventory")
    .select("id, quantity")
    .eq("player_id", player.id)
    .eq("item_id", item.id)
    .single();

  if (existing) {
    await supabase
      .from("player_inventory")
      .update({ quantity: existing.quantity + quantity })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("player_inventory")
      .insert({ player_id: player.id, item_id: item.id, quantity });
  }

  return NextResponse.json({
    success: true,
    message: `Compraste ${quantity}x ${item.name} por 💵 ${totalCost.toLocaleString()}`,
    newCash: freshCash - totalCost,
  });
}
