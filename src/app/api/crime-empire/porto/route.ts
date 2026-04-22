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

function getISOWeekInfo(date: Date): { week: number; year: number; weekStart: Date } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  const ws = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const wsDay = ws.getUTCDay() || 7;
  ws.setUTCDate(ws.getUTCDate() - wsDay + 1);
  ws.setUTCHours(0, 0, 0, 0);

  return { week, year: d.getUTCFullYear(), weekStart: ws };
}

const BOAT_NAMES = [
  "Santa Maria", "Vasco da Gama", "Fernão de Magalhães",
  "Pedro Álvares", "Diogo Cão", "Gil Eanes",
  "Bartolomeu Dias", "Dom Henrique", "Nuno Tristão", "João Gonçalves",
];

const DESTINATIONS = [
  "Marrocos", "Brasil", "Cabo Verde", "Angola",
  "Moçambique", "Guiné-Bissau", "São Tomé", "Timor-Leste",
  "Colômbia", "Venezuela", "Jamaica", "Panamá",
];

async function generateWeekBoats(weekNumber: number, weekYear: number, weekStart: Date): Promise<void> {
  const { data: existing } = await supabase
    .from("porto_boats")
    .select("id, docks_at, boat_name")
    .eq("week_number", weekNumber)
    .eq("week_year", weekYear);

  const needed = 4 - (existing?.length ?? 0);
  if (needed <= 0) return;

  const usedDays = new Set<number>(
    (existing || []).map((e: any) => {
      const d = new Date(e.docks_at);
      return d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
    })
  );
  const usedNames = new Set<string>((existing || []).map((e: any) => e.boat_name));
  const availableNames = BOAT_NAMES.filter((n) => !usedNames.has(n));

  const now = new Date();

  for (let i = 0; i < needed; i++) {
    let day = Math.floor(Math.random() * 7);
    let attempts = 0;
    while (usedDays.has(day) && attempts < 20) {
      day = Math.floor(Math.random() * 7);
      attempts++;
    }
    usedDays.add(day);

    const hour = 6 + Math.floor(Math.random() * 16); // 6h–22h
    const minute = Math.floor(Math.random() * 60);
    const docksAt = new Date(weekStart.getTime() + day * 86400000 + hour * 3600000 + minute * 60000);
    const dockingHours = 8 + Math.floor(Math.random() * 9); // 8–16h docking window
    const departsBy = new Date(docksAt.getTime() + dockingHours * 3600000);
    const maxCargo = 150 + Math.floor(Math.random() * 251); // 150–400 units

    const boatName =
      availableNames.length > 0
        ? availableNames.splice(Math.floor(Math.random() * availableNames.length), 1)[0]
        : `Barco ${weekNumber}-${i + 1}`;
    const destination = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];

    let status: string;
    let departs_at: string | null = null;
    let payment_at: string | null = null;

    if (docksAt > now) {
      status = "upcoming";
    } else if (departsBy > now) {
      status = "docked";
    } else {
      // Already past docking window during generation — mark departed
      status = "departed";
      departs_at = departsBy.toISOString();
      payment_at = new Date(departsBy.getTime() + 72 * 3600000).toISOString();
    }

    await supabase.from("porto_boats").insert({
      week_number: weekNumber,
      week_year: weekYear,
      boat_name: boatName,
      destination,
      docks_at: docksAt.toISOString(),
      departs_by: departsBy.toISOString(),
      departs_at,
      payment_at,
      max_cargo: maxCargo,
      current_cargo: 0,
      status,
    });
  }
}

async function syncBoatStatuses(): Promise<void> {
  const now = new Date();

  // upcoming → docked
  await supabase
    .from("porto_boats")
    .update({ status: "docked" })
    .eq("status", "upcoming")
    .lte("docks_at", now.toISOString())
    .gt("departs_by", now.toISOString());

  // docked → departed (docking window expired)
  const { data: toDepart } = await supabase
    .from("porto_boats")
    .select("id, departs_by")
    .eq("status", "docked")
    .lte("departs_by", now.toISOString());

  if (toDepart && toDepart.length > 0) {
    for (const boat of toDepart) {
      const departsAt = new Date(boat.departs_by);
      const paymentAt = new Date(departsAt.getTime() + 72 * 3600000);
      await supabase
        .from("porto_boats")
        .update({
          status: "departed",
          departs_at: departsAt.toISOString(),
          payment_at: paymentAt.toISOString(),
        })
        .eq("id", boat.id);
    }
  }

  // departed → paid (process payments when payment_at has passed)
  const { data: toPayBoats } = await supabase
    .from("porto_boats")
    .select("id")
    .eq("status", "departed")
    .lte("payment_at", now.toISOString());

  if (toPayBoats && toPayBoats.length > 0) {
    for (const boat of toPayBoats) {
      const { data: cargoRows } = await supabase
        .from("porto_cargo")
        .select("id, player_id, payout")
        .eq("boat_id", boat.id)
        .eq("paid", false);

      if (cargoRows && cargoRows.length > 0) {
        // Group payouts by player
        const playerPayouts: Record<string, number> = {};
        for (const row of cargoRows) {
          playerPayouts[row.player_id] = (playerPayouts[row.player_id] || 0) + row.payout;
        }

        // Credit each player's clean cash
        for (const [playerId, amount] of Object.entries(playerPayouts)) {
          const { data: pd } = await supabase
            .from("crime_players")
            .select("cash")
            .eq("id", playerId)
            .single();
          if (pd) {
            await supabase
              .from("crime_players")
              .update({ cash: pd.cash + amount })
              .eq("id", playerId);
          }
        }

        // Mark cargo rows paid
        await supabase
          .from("porto_cargo")
          .update({ paid: true })
          .eq("boat_id", boat.id)
          .eq("paid", false);
      }

      // Mark boat paid
      await supabase.from("porto_boats").update({ status: "paid" }).eq("id", boat.id);
    }
  }
}

/* ── GET ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, cash, dirty_cash, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  await syncBoatStatuses();

  // Ensure 4 boats for current + next week
  const now = new Date();
  const { week, year, weekStart } = getISOWeekInfo(now);
  await generateWeekBoats(week, year, weekStart);
  const nextWeekStart = new Date(weekStart.getTime() + 7 * 86400000);
  const nwInfo = getISOWeekInfo(nextWeekStart);
  await generateWeekBoats(nwInfo.week, nwInfo.year, nextWeekStart);

  // Fetch boats: current + next 2 weeks
  const twoWeeksEnd = new Date(weekStart.getTime() + 14 * 86400000).toISOString();
  const { data: boats } = await supabase
    .from("porto_boats")
    .select("*")
    .gte("docks_at", weekStart.toISOString())
    .lt("docks_at", twoWeeksEnd)
    .order("docks_at", { ascending: true });

  // Fetch player cargo
  const { data: playerCargo } = await supabase
    .from("porto_cargo")
    .select("*")
    .eq("player_id", player.id);

  // Fetch player's drug inventory (two-step to avoid PostgREST join filter issues)
  const { data: drugItems } = await supabase
    .from("items")
    .select("id, name, base_price, image_url")
    .eq("category", "drug");

  const drugItemIds = (drugItems || []).map((i: any) => i.id);
  let drugInventory: any[] = [];

  if (drugItemIds.length > 0) {
    const { data: inventory } = await supabase
      .from("player_inventory")
      .select("item_id, quantity")
      .eq("player_id", player.id)
      .in("item_id", drugItemIds)
      .gt("quantity", 0);

    drugInventory = (inventory || []).map((inv: any) => {
      const item = (drugItems || []).find((i: any) => i.id === inv.item_id);
      return {
        item_id: inv.item_id,
        item_name: item?.name ?? "Desconhecido",
        quantity: inv.quantity,
        unit_value: item?.base_price ?? 0,
        image_url: item?.image_url ?? null,
      };
    });
  }

  return NextResponse.json({
    boats: boats || [],
    playerCargo: playerCargo || [],
    drugInventory,
    player: {
      id: player.id,
      cash: player.cash,
      dirty_cash: player.dirty_cash,
      in_jail: player.in_jail,
      hp: player.hp,
    },
  });
}

/* ── POST ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action, boatId, itemId, quantity } = await req.json();
  if (!action || !boatId) return NextResponse.json({ error: "action e boatId obrigatórios" }, { status: 400 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail) {
    const releaseAt = new Date(player.jail_release_at);
    if (releaseAt > new Date()) return NextResponse.json({ error: "Estás na prisão" }, { status: 403 });
  }
  if (player.hp <= 0) return NextResponse.json({ error: "Estás no hospital." }, { status: 403 });

  /* ── LOAD DRUGS ── */
  if (action === "load_drugs") {
    const qty = parseInt(quantity);
    if (!itemId || !qty || qty <= 0) {
      return NextResponse.json({ error: "itemId e quantity obrigatórios" }, { status: 400 });
    }

    const { data: boat } = await supabase
      .from("porto_boats")
      .select("*")
      .eq("id", boatId)
      .single();

    if (!boat) return NextResponse.json({ error: "Barco não encontrado" }, { status: 404 });

    // Sync this boat's status inline
    const now = new Date();
    if (boat.status === "upcoming" && new Date(boat.docks_at) <= now) {
      if (new Date(boat.departs_by) > now) {
        await supabase.from("porto_boats").update({ status: "docked" }).eq("id", boatId);
        boat.status = "docked";
      } else {
        const depAt = new Date(boat.departs_by);
        const payAt = new Date(depAt.getTime() + 72 * 3600000);
        await supabase.from("porto_boats").update({
          status: "departed",
          departs_at: depAt.toISOString(),
          payment_at: payAt.toISOString(),
        }).eq("id", boatId);
        boat.status = "departed";
      }
    }

    if (boat.status !== "docked") {
      const msg =
        boat.status === "upcoming" ? "O barco ainda não atracou" :
        boat.status === "departed" || boat.status === "paid" ? "O barco já partiu" :
        "Barco indisponível";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const remaining = boat.max_cargo - boat.current_cargo;
    if (remaining <= 0) return NextResponse.json({ error: "O barco está cheio" }, { status: 400 });

    // Cap at remaining capacity
    const actualQty = Math.min(qty, remaining);

    const { data: item } = await supabase
      .from("items")
      .select("id, name, category, base_price, image_url")
      .eq("id", itemId)
      .single();

    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (item.category !== "drug") return NextResponse.json({ error: "Só podes carregar drogas" }, { status: 400 });

    const { data: invRow } = await supabase
      .from("player_inventory")
      .select("id, quantity")
      .eq("player_id", player.id)
      .eq("item_id", itemId)
      .maybeSingle();

    if (!invRow || invRow.quantity < actualQty) {
      return NextResponse.json({ error: "Inventário insuficiente" }, { status: 400 });
    }

    // Deduct from inventory
    if (invRow.quantity === actualQty) {
      await supabase.from("player_inventory").delete().eq("id", invRow.id);
    } else {
      await supabase
        .from("player_inventory")
        .update({ quantity: invRow.quantity - actualQty })
        .eq("id", invRow.id);
    }

    const payout = Math.floor(actualQty * item.base_price * 0.70);

    // Upsert cargo row (player may add same drug multiple times)
    const { data: existingCargo } = await supabase
      .from("porto_cargo")
      .select("id, quantity, payout")
      .eq("boat_id", boatId)
      .eq("player_id", player.id)
      .eq("item_id", itemId)
      .maybeSingle();

    if (existingCargo) {
      await supabase
        .from("porto_cargo")
        .update({
          quantity: existingCargo.quantity + actualQty,
          payout: existingCargo.payout + payout,
        })
        .eq("id", existingCargo.id);
    } else {
      await supabase.from("porto_cargo").insert({
        boat_id: boatId,
        player_id: player.id,
        item_id: itemId,
        item_name: item.name,
        image_url: item.image_url ?? null,
        quantity: actualQty,
        unit_value: item.base_price,
        payout,
      });
    }

    // Update boat cargo, depart if now full
    const newCargo = boat.current_cargo + actualQty;
    const isFull = newCargo >= boat.max_cargo;

    if (isFull) {
      const departsAt = new Date();
      const paymentAt = new Date(departsAt.getTime() + 72 * 3600000);
      await supabase.from("porto_boats").update({
        current_cargo: newCargo,
        status: "departed",
        departs_at: departsAt.toISOString(),
        payment_at: paymentAt.toISOString(),
      }).eq("id", boatId);
    } else {
      await supabase.from("porto_boats").update({ current_cargo: newCargo }).eq("id", boatId);
    }

    const cappedNote = actualQty < qty ? ` (reduzido de ${qty} — barco ficou cheio)` : "";
    return NextResponse.json({
      success: true,
      message: isFull
        ? `Carregaste ${actualQty} unidades${cappedNote}. O barco encheu e partiu! Recebe 💵 ${payout.toLocaleString("pt-PT")} em 3 dias.`
        : `Carregaste ${actualQty} unidades${cappedNote}. Recebes 💵 ${payout.toLocaleString("pt-PT")} em dinheiro limpo em 3 dias.`,
      actual_quantity: actualQty,
      payout,
      boat_full: isFull,
    });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
