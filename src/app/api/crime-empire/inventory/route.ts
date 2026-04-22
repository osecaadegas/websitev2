import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

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

/* ── GET — Fetch player inventory with item details ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, hp, max_hp, stamina, max_stamina, cash, dirty_cash, addiction")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const { data: inventory, error } = await supabase
    .from("player_inventory")
    .select(`
      id,
      item_id,
      quantity,
      equipped,
      items (
        id, name, description, category,
        power_bonus, intelligence_bonus, charisma_bonus,
        hp_bonus, stamina_restore, success_rate_bonus,
        has_durability, max_durability, base_price, tradeable, image_url
      )
    `)
    .eq("player_id", player.id)
    .gt("quantity", 0)
    .order("equipped", { ascending: false });

  if (error) return NextResponse.json({ error: "Erro ao carregar inventário" }, { status: 500 });

  return NextResponse.json({
    inventory: inventory || [],
    player: {
      id: player.id,
      hp: player.hp,
      max_hp: player.max_hp,
      stamina: player.stamina,
      max_stamina: player.max_stamina,
      addiction: player.addiction ?? 0,
    },
  });
}

/* ── POST — Use / Equip / Unequip / Drop item ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action, inventoryId } = await req.json();
  if (!action || !inventoryId) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, hp, max_hp, stamina, max_stamina, addiction")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Fetch inventory entry + item
  const { data: entry } = await supabase
    .from("player_inventory")
    .select(`
      id, item_id, quantity, equipped,
      items (
        id, name, category, hp_bonus, stamina_restore,
        power_bonus, intelligence_bonus, charisma_bonus
      )
    `)
    .eq("id", inventoryId)
    .eq("player_id", player.id)
    .single();

  if (!entry) return NextResponse.json({ error: "Item não encontrado no inventário" }, { status: 404 });

  const item = (Array.isArray(entry.items) ? entry.items[0] : entry.items) as {
    id: string; name: string; category: string;
    hp_bonus: number; stamina_restore: number;
    power_bonus: number; intelligence_bonus: number; charisma_bonus: number;
  } | null;

  if (!item) return NextResponse.json({ error: "Item inválido" }, { status: 404 });

  /* ── USE consumable ── */
  if (action === "use") {
    if (item.category !== "consumable") {
      return NextResponse.json({ error: "Este item não pode ser usado directamente" }, { status: 400 });
    }

    const hpGain = item.hp_bonus || 0;
    const staminaGain = item.stamina_restore || 0;

    if (hpGain === 0 && staminaGain === 0) {
      return NextResponse.json({ error: "Este item não tem efeito de consumo" }, { status: 400 });
    }

    const newHp = Math.min(player.max_hp, player.hp + hpGain);
    const newStamina = Math.min(player.max_stamina, player.stamina + staminaGain);

    // Stamina consumables increase addiction by +5 (capped at 100)
    const addictionGain = staminaGain > 0 ? 5 : 0;
    const newAddiction = Math.min(100, (player.addiction ?? 0) + addictionGain);

    // Apply effects to player
    await supabase
      .from("crime_players")
      .update({ hp: newHp, stamina: newStamina, addiction: newAddiction })
      .eq("id", player.id);

    // Decrement or remove from inventory
    if (entry.quantity <= 1) {
      await supabase.from("player_inventory").delete().eq("id", entry.id);
    } else {
      await supabase
        .from("player_inventory")
        .update({ quantity: entry.quantity - 1 })
        .eq("id", entry.id);
    }

    const effects: string[] = [];
    if (hpGain > 0) effects.push(`+${newHp - player.hp} HP`);
    if (staminaGain > 0) effects.push(`+${newStamina - player.stamina} Stamina`);
    if (addictionGain > 0) effects.push(`+${addictionGain} Vício`);

    return NextResponse.json({
      success: true,
      message: `Usaste ${item.name}! ${effects.join(", ")}`,
      newHp,
      newStamina,
      newAddiction,
    });
  }

  /* ── EQUIP / UNEQUIP ── */
  if (action === "equip" || action === "unequip") {
    if (item.category === "consumable" || item.category === "material") {
      return NextResponse.json({ error: "Este tipo de item não pode ser equipado" }, { status: 400 });
    }

    const equipping = action === "equip";
    await supabase
      .from("player_inventory")
      .update({ equipped: equipping })
      .eq("id", entry.id);

    return NextResponse.json({
      success: true,
      message: equipping ? `Equipaste ${item.name}!` : `Desequipaste ${item.name}.`,
      equipped: equipping,
    });
  }

  /* ── DROP item ── */
  if (action === "drop") {
    if (entry.equipped) {
      return NextResponse.json({ error: "Desequipa o item antes de o descartar" }, { status: 400 });
    }
    if (entry.quantity <= 1) {
      await supabase.from("player_inventory").delete().eq("id", entry.id);
    } else {
      await supabase
        .from("player_inventory")
        .update({ quantity: entry.quantity - 1 })
        .eq("id", entry.id);
    }
    return NextResponse.json({ success: true, message: `${item.name} descartado.` });
  }

  return NextResponse.json({ error: "Acção desconhecida" }, { status: 400 });
}

