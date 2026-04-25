import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ─── Upgrade cost tables ──────────────────────────────────────────────────────

/** Inventory: index 0 = going 4→5, index 5 = 9→10 */
const INV_UPGRADE_COSTS: { dirty?: number; cash?: number; crypto?: number }[] = [
  { dirty: 5_000 },                           // 4→5  dirty cash only
  { cash: 10_000,   crypto: 5_000 },          // 5→6
  { cash: 25_000,   crypto: 12_500 },         // 6→7
  { cash: 50_000,   crypto: 25_000 },         // 7→8
  { cash: 100_000,  crypto: 50_000 },         // 8→9
  { cash: 200_000,  crypto: 100_000 },        // 9→10
];

/** Stash: index 0 = going 10→11, index 9 = 19→20 */
const STASH_UPGRADE_COSTS: { cash: number; crypto: number }[] = [
  { cash: 20_000,  crypto: 10_000 },          // 10→11
  { cash: 35_000,  crypto: 17_500 },          // 11→12
  { cash: 55_000,  crypto: 27_500 },          // 12→13
  { cash: 80_000,  crypto: 40_000 },          // 13→14
  { cash: 110_000, crypto: 55_000 },          // 14→15
  { cash: 150_000, crypto: 75_000 },          // 15→16
  { cash: 200_000, crypto: 100_000 },         // 16→17
  { cash: 260_000, crypto: 130_000 },         // 17→18
  { cash: 330_000, crypto: 165_000 },         // 18→19
  { cash: 400_000, crypto: 200_000 },         // 19→20
];

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── Ensure hideout row exists ────────────────────────────────────────────────

async function getOrCreateHideout(playerId: string) {
  const { data } = await supabase
    .from("player_hideout")
    .select("player_id, inventory_slots, stash_slots")
    .eq("player_id", playerId)
    .maybeSingle();

  if (data) return data;

  const { data: created } = await supabase
    .from("player_hideout")
    .insert({ player_id: playerId, inventory_slots: 4, stash_slots: 10 })
    .select("player_id, inventory_slots, stash_slots")
    .single();

  return created;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, cash, dirty_cash, crypto, level, class")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const hideout = await getOrCreateHideout(player.id);

  // Inventory with full item details + durability
  const { data: inventory } = await supabase
    .from("player_inventory")
    .select(`
      id, item_id, quantity, equipped, durability,
      items (
        id, name, description, category, equipment_slot,
        power_bonus, intelligence_bonus, charisma_bonus,
        hp_bonus, stamina_restore, success_rate_bonus,
        has_durability, max_durability, crypto_price, base_price,
        tradeable, image_url, rarity, addiction_effect
      )
    `)
    .eq("player_id", player.id)
    .gt("quantity", 0)
    .order("equipped", { ascending: false });

  // Stash items
  const { data: stash } = await supabase
    .from("player_stash")
    .select(`
      id, item_id, quantity,
      items (
        id, name, description, category, equipment_slot,
        power_bonus, intelligence_bonus, charisma_bonus,
        hp_bonus, stamina_restore, success_rate_bonus,
        has_durability, max_durability, crypto_price, base_price,
        tradeable, image_url, rarity, addiction_effect
      )
    `)
    .eq("player_id", player.id);

  return NextResponse.json({
    player: {
      id: player.id,
      cash: player.cash,
      dirty_cash: player.dirty_cash,
      crypto: player.crypto,
      level: player.level,
      class: player.class,
    },
    hideout: {
      inventory_slots: hideout?.inventory_slots ?? 4,
      stash_slots: hideout?.stash_slots ?? 10,
    },
    inventory: inventory || [],
    stash: stash || [],
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, cash, dirty_cash, crypto")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const hideout = await getOrCreateHideout(player.id);
  if (!hideout) return NextResponse.json({ error: "Erro ao carregar esconderijo" }, { status: 500 });

  // ── STASH ITEM (inventory → stash) ──────────────────────────────────────────
  if (action === "stash_item") {
    const { inventoryId, quantity = 1 } = body;

    const { data: invEntry } = await supabase
      .from("player_inventory")
      .select("id, item_id, quantity, equipped")
      .eq("id", inventoryId)
      .eq("player_id", player.id)
      .single();

    if (!invEntry) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (invEntry.equipped) return NextResponse.json({ error: "Desequipa o item antes de guardar." }, { status: 400 });

    const moveQty = Math.min(Math.max(1, quantity), invEntry.quantity);

    const { data: existingStash } = await supabase
      .from("player_stash")
      .select("id, quantity")
      .eq("player_id", player.id)
      .eq("item_id", invEntry.item_id)
      .maybeSingle();

    if (!existingStash) {
      const { count } = await supabase
        .from("player_stash")
        .select("id", { count: "exact", head: true })
        .eq("player_id", player.id);

      if ((count ?? 0) >= hideout.stash_slots) {
        return NextResponse.json({ error: `Esconderijo cheio! (${hideout.stash_slots} slots). Faz upgrade para guardar mais.` }, { status: 400 });
      }

      await supabase.from("player_stash").insert({ player_id: player.id, item_id: invEntry.item_id, quantity: moveQty });
    } else {
      await supabase.from("player_stash").update({ quantity: existingStash.quantity + moveQty }).eq("id", existingStash.id);
    }

    if (invEntry.quantity <= moveQty) {
      await supabase.from("player_inventory").delete().eq("id", invEntry.id);
    } else {
      await supabase.from("player_inventory").update({ quantity: invEntry.quantity - moveQty }).eq("id", invEntry.id);
    }

    return NextResponse.json({ success: true, message: "Item guardado no esconderijo." });
  }

  // ── RETRIEVE ITEM (stash → inventory) ───────────────────────────────────────
  if (action === "retrieve_item") {
    const { stashId, quantity = 1 } = body;

    const { data: stashEntry } = await supabase
      .from("player_stash")
      .select("id, item_id, quantity")
      .eq("id", stashId)
      .eq("player_id", player.id)
      .single();

    if (!stashEntry) return NextResponse.json({ error: "Item não encontrado no esconderijo" }, { status: 404 });

    const moveQty = Math.min(Math.max(1, quantity), stashEntry.quantity);

    const { data: existingInv } = await supabase
      .from("player_inventory")
      .select("id, quantity")
      .eq("player_id", player.id)
      .eq("item_id", stashEntry.item_id)
      .maybeSingle();

    if (!existingInv) {
      const { count } = await supabase
        .from("player_inventory")
        .select("id", { count: "exact", head: true })
        .eq("player_id", player.id)
        .gt("quantity", 0);

      if ((count ?? 0) >= hideout.inventory_slots) {
        return NextResponse.json({ error: `Inventário cheio! (${hideout.inventory_slots} slots). Faz upgrade ou guarda outros items.` }, { status: 400 });
      }

      await supabase.from("player_inventory").insert({ player_id: player.id, item_id: stashEntry.item_id, quantity: moveQty });
    } else {
      await supabase.from("player_inventory").update({ quantity: existingInv.quantity + moveQty }).eq("id", existingInv.id);
    }

    if (stashEntry.quantity <= moveQty) {
      await supabase.from("player_stash").delete().eq("id", stashEntry.id);
    } else {
      await supabase.from("player_stash").update({ quantity: stashEntry.quantity - moveQty }).eq("id", stashEntry.id);
    }

    return NextResponse.json({ success: true, message: "Item recuperado do esconderijo." });
  }

  // ── EQUIP / UNEQUIP ─────────────────────────────────────────────────────────
  if (action === "equip" || action === "unequip") {
    const { inventoryId } = body;

    const { data: invEntry } = await supabase
      .from("player_inventory")
      .select("id, item_id, quantity, equipped, durability, items(id, name, category, equipment_slot, has_durability)")
      .eq("id", inventoryId)
      .eq("player_id", player.id)
      .single();

    if (!invEntry) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

    const item = (Array.isArray(invEntry.items) ? invEntry.items[0] : invEntry.items) as {
      id: string; name: string; category: string; equipment_slot: string | null; has_durability: boolean;
    } | null;

    if (!item) return NextResponse.json({ error: "Item inválido" }, { status: 404 });

    if (action === "unequip") {
      await supabase.from("player_inventory").update({ equipped: false }).eq("id", invEntry.id);
      return NextResponse.json({ success: true, message: `${item.name} guardado.` });
    }

    // Equip: check durability
    if (item.has_durability && (invEntry.durability ?? 1) <= 0) {
      return NextResponse.json({ error: "Item quebrado! Repara-o no SGT. Machado primeiro." }, { status: 400 });
    }

    // Determine slot: use equipment_slot if set, fall back to category
    const slot = item.equipment_slot ?? item.category;

    // Unequip any other item in the same slot
    const { data: equipped } = await supabase
      .from("player_inventory")
      .select("id, items(equipment_slot, category)")
      .eq("player_id", player.id)
      .eq("equipped", true);

    for (const other of equipped || []) {
      if (other.id === invEntry.id) continue;
      const oi = (Array.isArray(other.items) ? other.items[0] : other.items) as any;
      const otherSlot = oi?.equipment_slot ?? oi?.category;
      if (otherSlot === slot) {
        await supabase.from("player_inventory").update({ equipped: false }).eq("id", other.id);
      }
    }

    await supabase.from("player_inventory").update({ equipped: true }).eq("id", invEntry.id);
    return NextResponse.json({ success: true, message: `⚔️ ${item.name} equipado!` });
  }

  // ── UPGRADE INVENTORY SLOTS ──────────────────────────────────────────────────
  if (action === "upgrade_inventory") {
    const { currency } = body;
    const currentSlots = hideout.inventory_slots;

    if (currentSlots >= 10) {
      return NextResponse.json({ error: "Inventário já está no máximo (10 slots)." }, { status: 400 });
    }

    const idx = currentSlots - 4;
    const costs = INV_UPGRADE_COSTS[idx];
    if (!costs) return NextResponse.json({ error: "Erro interno nos custos." }, { status: 500 });

    if (currency === "dirty") {
      if (!costs.dirty) return NextResponse.json({ error: "Este upgrade não aceita dinheiro sujo. Usa cash limpo ou crypto." }, { status: 400 });
      if (player.dirty_cash < costs.dirty) return NextResponse.json({ error: `Precisas de $${costs.dirty.toLocaleString()} sujo.` }, { status: 400 });
      await supabase.from("crime_players").update({ dirty_cash: player.dirty_cash - costs.dirty }).eq("id", player.id);
    } else if (currency === "cash") {
      if (!costs.cash) return NextResponse.json({ error: "1º upgrade apenas aceita dinheiro sujo." }, { status: 400 });
      if (player.cash < costs.cash) return NextResponse.json({ error: `Precisas de $${costs.cash.toLocaleString()} limpo.` }, { status: 400 });
      await supabase.from("crime_players").update({ cash: player.cash - costs.cash }).eq("id", player.id);
    } else if (currency === "crypto") {
      if (!costs.crypto) return NextResponse.json({ error: "1º upgrade apenas aceita dinheiro sujo." }, { status: 400 });
      if (player.crypto < costs.crypto) return NextResponse.json({ error: `Precisas de 💎 ${costs.crypto.toLocaleString()} crypto.` }, { status: 400 });
      await supabase.from("crime_players").update({ crypto: player.crypto - costs.crypto }).eq("id", player.id);
    } else {
      return NextResponse.json({ error: "Moeda inválida." }, { status: 400 });
    }

    const newSlots = currentSlots + 1;
    await supabase
      .from("player_hideout")
      .update({ inventory_slots: newSlots, updated_at: new Date().toISOString() })
      .eq("player_id", player.id);

    return NextResponse.json({ success: true, message: `🎒 Inventário expandido para ${newSlots} slots!`, newSlots });
  }

  // ── UPGRADE STASH SLOTS ──────────────────────────────────────────────────────
  if (action === "upgrade_stash") {
    const { currency } = body;
    const currentSlots = hideout.stash_slots;

    if (currentSlots >= 20) {
      return NextResponse.json({ error: "Esconderijo já está no máximo (20 slots)." }, { status: 400 });
    }

    const idx = currentSlots - 10;
    const costs = STASH_UPGRADE_COSTS[idx];
    if (!costs) return NextResponse.json({ error: "Erro interno nos custos." }, { status: 500 });

    if (currency === "cash") {
      if (player.cash < costs.cash) return NextResponse.json({ error: `Precisas de $${costs.cash.toLocaleString()} limpo.` }, { status: 400 });
      await supabase.from("crime_players").update({ cash: player.cash - costs.cash }).eq("id", player.id);
    } else if (currency === "crypto") {
      if (player.crypto < costs.crypto) return NextResponse.json({ error: `Precisas de 💎 ${costs.crypto.toLocaleString()} crypto.` }, { status: 400 });
      await supabase.from("crime_players").update({ crypto: player.crypto - costs.crypto }).eq("id", player.id);
    } else {
      return NextResponse.json({ error: "Apenas cash limpo ou crypto para upgrades do esconderijo." }, { status: 400 });
    }

    const newSlots = currentSlots + 1;
    await supabase
      .from("player_hideout")
      .update({ stash_slots: newSlots, updated_at: new Date().toISOString() })
      .eq("player_id", player.id);

    return NextResponse.json({ success: true, message: `🏚️ Esconderijo expandido para ${newSlots} slots!`, newSlots });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
