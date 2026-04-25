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

/* ── GET — catalog + player crypto + owned items ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, crypto, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Gun shop catalog: weapon + armor with a crypto_price set
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .in("category", ["weapon", "armor"])
    .not("crypto_price", "is", null)
    .order("crypto_price", { ascending: true });

  // What the player already owns from this catalog
  const itemIds = (items || []).map((i) => i.id);
  const ownedMap: Record<
    string,
    { quantity: number; equipped: boolean; durability: number | null; inventoryId: string }
  > = {};

  if (itemIds.length > 0) {
    const { data: inv } = await supabase
      .from("player_inventory")
      .select("id, item_id, quantity, equipped, durability")
      .eq("player_id", player.id)
      .in("item_id", itemIds);

    for (const row of inv || []) {
      ownedMap[row.item_id] = {
        quantity: row.quantity,
        equipped: row.equipped,
        durability: row.durability,
        inventoryId: row.id,
      };
    }
  }

  return NextResponse.json({
    items: items || [],
    ownedMap,
    player: { crypto: player.crypto, level: player.level },
  });
}

/* ── POST — buy | equip | unequip | repair ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action, itemId } = body;
  if (!action || !itemId) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, crypto, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (player.hp <= 0) return NextResponse.json({ error: "Estás no hospital." }, { status: 403 });
  if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date())
    return NextResponse.json({ error: "Estás na prisão." }, { status: 403 });

  // Fetch the item from the gun shop catalog
  const { data: item } = await supabase
    .from("items")
    .select("id, name, category, crypto_price, required_level, has_durability, max_durability")
    .eq("id", itemId)
    .not("crypto_price", "is", null)
    .single();

  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // Fetch existing inventory entry
  const { data: invEntry } = await supabase
    .from("player_inventory")
    .select("id, quantity, equipped, durability")
    .eq("player_id", player.id)
    .eq("item_id", itemId)
    .maybeSingle();

  /* ── BUY ── */
  if (action === "buy") {
    if (invEntry && invEntry.quantity > 0)
      return NextResponse.json({ error: "Já possuís este item. Usa Reparar se precisares." }, { status: 400 });
    if ((item.required_level ?? 1) > (player.level ?? 1))
      return NextResponse.json({ error: `Nível ${item.required_level} necessário para esta peça.` }, { status: 403 });

    const cost = item.crypto_price as number;
    const { data: fp } = await supabase.from("crime_players").select("crypto").eq("id", player.id).single();
    if ((fp?.crypto ?? 0) < cost)
      return NextResponse.json({ error: `Precisas de 💎 ${cost.toLocaleString()} crypto.` }, { status: 400 });

    const { error: deductErr } = await supabase
      .from("crime_players")
      .update({ crypto: (fp?.crypto ?? 0) - cost })
      .eq("id", player.id);

    if (deductErr) return NextResponse.json({ error: "Erro ao processar pagamento." }, { status: 500 });

    await supabase.from("player_inventory").insert({
      player_id: player.id,
      item_id: itemId,
      quantity: 1,
      equipped: false,
      durability: item.has_durability ? (item.max_durability ?? 100) : null,
    });

    return NextResponse.json({
      success: true,
      message: `💰 Compraste ${item.name}!`,
      newCrypto: (fp?.crypto ?? 0) - cost,
    });
  }

  /* ── EQUIP ── */
  if (action === "equip") {
    if (!invEntry || invEntry.quantity === 0)
      return NextResponse.json({ error: "Não possuis este item." }, { status: 400 });
    if (item.has_durability && (invEntry.durability ?? 1) <= 0)
      return NextResponse.json({ error: "Item quebrado! Repara-o primeiro." }, { status: 400 });

    await supabase.from("player_inventory").update({ equipped: true }).eq("id", invEntry.id);
    return NextResponse.json({ success: true, message: `⚔️ ${item.name} equipado!` });
  }

  /* ── UNEQUIP ── */
  if (action === "unequip") {
    if (!invEntry) return NextResponse.json({ error: "Não possuis este item." }, { status: 400 });
    await supabase.from("player_inventory").update({ equipped: false }).eq("id", invEntry.id);
    return NextResponse.json({ success: true, message: `${item.name} guardado.` });
  }

  /* ── REPAIR ── */
  if (action === "repair") {
    if (!invEntry || invEntry.quantity === 0)
      return NextResponse.json({ error: "Não possuis este item." }, { status: 400 });
    const maxDur = item.max_durability ?? 100;
    if ((invEntry.durability ?? maxDur) >= maxDur)
      return NextResponse.json({ error: "O item já está em perfeito estado." }, { status: 400 });

    const repairCost = Math.max(10, Math.floor((item.crypto_price as number) * 0.30));
    const { data: fp } = await supabase.from("crime_players").select("crypto").eq("id", player.id).single();
    if ((fp?.crypto ?? 0) < repairCost)
      return NextResponse.json({ error: `Precisas de 💎 ${repairCost} para reparar.` }, { status: 400 });

    await supabase.from("crime_players").update({ crypto: (fp?.crypto ?? 0) - repairCost }).eq("id", player.id);
    await supabase.from("player_inventory").update({ durability: maxDur }).eq("id", invEntry.id);

    return NextResponse.json({
      success: true,
      message: `🔧 ${item.name} reparado!`,
      newCrypto: (fp?.crypto ?? 0) - repairCost,
    });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
