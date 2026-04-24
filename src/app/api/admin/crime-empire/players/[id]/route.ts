import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: player, error } = await supabase
    .from("crime_players")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !player) return NextResponse.json({ error: "Player não encontrado" }, { status: 404 });

  // Inventory count
  const { count: inventoryCount } = await supabase
    .from("player_inventory")
    .select("*", { count: "exact", head: true })
    .eq("player_id", id);

  // Businesses count
  const { count: bizCount } = await supabase
    .from("player_businesses")
    .select("*", { count: "exact", head: true })
    .eq("player_id", id);

  // Crime stats
  const { data: crimeStats } = await supabase
    .from("crime_attempts")
    .select("success")
    .eq("player_id", id);

  const total    = crimeStats?.length ?? 0;
  const successes = crimeStats?.filter((c) => c.success).length ?? 0;

  // Recent inventory
  const { data: inventory } = await supabase
    .from("player_inventory")
    .select("quantity, equipped, item:items(id, name, category, rarity)")
    .eq("player_id", id)
    .limit(20);

  return NextResponse.json({
    player,
    stats: {
      inventory_count: inventoryCount ?? 0,
      businesses_count: bizCount ?? 0,
      crimes_total: total,
      crimes_success: successes,
    },
    inventory: inventory || [],
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, amount, itemId, inventoryId, stats, value, quantity } = await req.json();

  const { data: player, error: fetchErr } = await supabase
    .from("crime_players")
    .select("id, username, cash, dirty_cash, hp, max_hp, stamina, max_stamina, addiction, level, xp, power, intelligence, charisma, respect")
    .eq("id", id)
    .single();

  if (fetchErr || !player) return NextResponse.json({ error: "Player não encontrado" }, { status: 404 });

  switch (action) {
    case "give_cash": {
      const val = Math.max(0, Number(amount) || 0);
      await supabase.from("crime_players").update({ cash: player.cash + val }).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, amount: val });
      return NextResponse.json({ success: true, message: `+${val} dinheiro limpo dado` });
    }
    case "take_cash": {
      const val = Math.max(0, Number(amount) || 0);
      const newVal = Math.max(0, player.cash - val);
      await supabase.from("crime_players").update({ cash: newVal }).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, amount: val });
      return NextResponse.json({ success: true, message: `-${val} dinheiro limpo removido` });
    }
    case "give_dirty_cash": {
      const val = Math.max(0, Number(amount) || 0);
      await supabase.from("crime_players").update({ dirty_cash: player.dirty_cash + val }).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, amount: val });
      return NextResponse.json({ success: true, message: `+${val} dinheiro sujo dado` });
    }
    case "take_dirty_cash": {
      const val = Math.max(0, Number(amount) || 0);
      const { data: fresh } = await supabase.from("crime_players").select("dirty_cash").eq("id", id).single();
      const newVal = Math.max(0, (fresh?.dirty_cash ?? 0) - val);
      await supabase.from("crime_players").update({ dirty_cash: newVal }).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, amount: val });
      return NextResponse.json({ success: true, message: `-${val} dinheiro sujo removido` });
    }
    case "heal": {
      await supabase.from("crime_players").update({ hp: player.max_hp }).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action });
      return NextResponse.json({ success: true, message: "Player curado ao máximo de HP" });
    }
    case "free_jail": {
      await supabase.from("crime_players").update({ in_jail: false, jail_release_at: null }).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action });
      return NextResponse.json({ success: true, message: "Player libertado da prisão" });
    }
    case "set_addiction": {
      const val = Math.min(100, Math.max(0, Number(amount) || 0));
      await supabase.from("crime_players").update({ addiction: val }).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, addiction: val });
      return NextResponse.json({ success: true, message: `Adição definida para ${val}` });
    }
    case "give_item": {
      if (!itemId) return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });
      const { data: existing } = await supabase
        .from("player_inventory")
        .select("id, quantity")
        .eq("player_id", id)
        .eq("item_id", itemId)
        .single();

      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      if (existing) {
        await supabase.from("player_inventory").update({ quantity: existing.quantity + qty }).eq("id", existing.id);
      } else {
        await supabase.from("player_inventory").insert({ player_id: id, item_id: itemId, quantity: qty });
      }
      const { data: item } = await supabase.from("items").select("name").eq("id", itemId).single();
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, item: item?.name, quantity: qty });
      return NextResponse.json({ success: true, message: `${qty}x "${item?.name}" dado ao player` });
    }
    case "remove_item": {
      if (!inventoryId) return NextResponse.json({ error: "inventoryId obrigatório" }, { status: 400 });
      const { data: invEntry } = await supabase
        .from("player_inventory")
        .select("id, quantity, item_id")
        .eq("id", inventoryId)
        .eq("player_id", id)
        .single();
      if (!invEntry) return NextResponse.json({ error: "Item não encontrado no inventário" }, { status: 404 });
      const { data: itemData } = await supabase.from("items").select("name").eq("id", invEntry.item_id).single();
      await supabase.from("player_inventory").delete().eq("id", inventoryId);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, item: itemData?.name });
      return NextResponse.json({ success: true, message: `Item "${itemData?.name}" removido do inventário` });
    }
    case "edit_stats": {
      if (!stats || typeof stats !== "object") return NextResponse.json({ error: "stats obrigatório" }, { status: 400 });
      const allowed = ["level", "xp", "power", "intelligence", "charisma", "hp", "max_hp", "stamina", "max_stamina", "respect"];
      const update: Record<string, number> = {};
      for (const [k, v] of Object.entries(stats as Record<string, unknown>)) {
        if (allowed.includes(k) && typeof v === "number" && isFinite(v)) {
          update[k] = Math.max(0, Math.floor(v));
        }
      }
      if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 });
      await supabase.from("crime_players").update(update).eq("id", id);
      await writeAuditLog(admin, "player_action", "player", id, player.username, { action, changes: update });
      return NextResponse.json({ success: true, message: "Stats atualizadas com sucesso" });
    }
    default:
      return NextResponse.json({ error: "Acção desconhecida" }, { status: 400 });
  }
}
