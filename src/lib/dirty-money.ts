/**
 * dirty-money.ts
 * Helpers for granting / deducting / clearing the "Dinheiro Sujo" inventory
 * item while keeping the crime_players.dirty_cash balance in sync.
 *
 * Use these helpers in every API route that modifies dirty cash so that the
 * inventory item and the balance column never drift apart.
 */
import { supabase } from "@/lib/supabase";

// Module-level cache — avoids a DB lookup on every call after the first.
let _itemId: string | null = null;
let _itemIdLoaded = false;

async function getDirtyMoneyItemId(): Promise<string | null> {
  if (_itemIdLoaded) return _itemId;
  const { data } = await supabase
    .from("items")
    .select("id")
    .eq("item_code", "dirty_money")
    .maybeSingle();
  _itemId = data?.id ?? null;
  _itemIdLoaded = true;
  return _itemId;
}

/** Add `amount` dirty cash to a player's inventory + balance. */
export async function grantDirtyMoney(playerId: string, amount: number): Promise<void> {
  if (amount <= 0) return;

  // 1. Update dirty_cash balance (re-fetch to avoid race condition)
  const { data: p } = await supabase
    .from("crime_players")
    .select("dirty_cash")
    .eq("id", playerId)
    .single();
  await supabase
    .from("crime_players")
    .update({ dirty_cash: (p?.dirty_cash ?? 0) + amount })
    .eq("id", playerId);

  // 2. Update inventory item (upsert pattern)
  const itemId = await getDirtyMoneyItemId();
  if (!itemId) return;
  const { data: inv } = await supabase
    .from("player_inventory")
    .select("id, quantity")
    .eq("player_id", playerId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (inv) {
    await supabase
      .from("player_inventory")
      .update({ quantity: inv.quantity + amount })
      .eq("id", inv.id);
  } else {
    await supabase
      .from("player_inventory")
      .insert({ player_id: playerId, item_id: itemId, quantity: amount });
  }
}

/** Deduct `amount` dirty cash from a player's inventory + balance.
 *  Returns { success: true } or { success: false, available } if insufficient. */
export async function deductDirtyMoney(
  playerId: string,
  amount: number
): Promise<{ success: boolean; available: number }> {
  const itemId = await getDirtyMoneyItemId();
  if (!itemId) return { success: false, available: 0 };

  const { data: inv } = await supabase
    .from("player_inventory")
    .select("id, quantity")
    .eq("player_id", playerId)
    .eq("item_id", itemId)
    .maybeSingle();

  const available = inv?.quantity ?? 0;
  if (available < amount) return { success: false, available };

  // Deduct from inventory
  const newQty = available - amount;
  if (newQty <= 0) {
    await supabase.from("player_inventory").delete().eq("id", inv!.id);
  } else {
    await supabase.from("player_inventory").update({ quantity: newQty }).eq("id", inv!.id);
  }

  // Keep balance in sync
  const { data: p } = await supabase
    .from("crime_players")
    .select("dirty_cash")
    .eq("id", playerId)
    .single();
  await supabase
    .from("crime_players")
    .update({ dirty_cash: Math.max(0, (p?.dirty_cash ?? 0) - amount) })
    .eq("id", playerId);

  return { success: true, available };
}

/** Read a player's dirty cash balance from the inventory item. */
export async function getDirtyMoneyBalance(playerId: string): Promise<number> {
  const itemId = await getDirtyMoneyItemId();
  if (!itemId) return 0;
  const { data } = await supabase
    .from("player_inventory")
    .select("quantity")
    .eq("player_id", playerId)
    .eq("item_id", itemId)
    .maybeSingle();
  return data?.quantity ?? 0;
}

/** Reset dirty cash to 0 — both inventory and balance (use on prestige). */
export async function clearDirtyMoney(playerId: string): Promise<void> {
  const itemId = await getDirtyMoneyItemId();
  if (itemId) {
    await supabase
      .from("player_inventory")
      .delete()
      .eq("player_id", playerId)
      .eq("item_id", itemId);
  }
  await supabase
    .from("crime_players")
    .update({ dirty_cash: 0 })
    .eq("id", playerId);
}
