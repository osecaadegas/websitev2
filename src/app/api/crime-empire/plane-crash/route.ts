import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { deductDirtyMoney } from "@/lib/dirty-money";

export const dynamic = "force-dynamic";

interface LootItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_value: number;
  category: string;
  rarity: string;
  image_url?: string | null;
}

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getISOWeekInfo(date: Date): { week: number; year: number; weekStart: Date } {
  // ISO week: week starts Monday
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  // Week start = Monday 00:00 UTC
  const ws = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const wsDay = ws.getUTCDay() || 7;
  ws.setUTCDate(ws.getUTCDate() - wsDay + 1);
  ws.setUTCHours(0, 0, 0, 0);

  return { week, year: d.getUTCFullYear(), weekStart: ws };
}

const LOCATIONS = [
  "Serra da Estrela",
  "Planície do Alentejo",
  "Costa Vicentina",
  "Vale do Douro",
  "Montanha do Gerês",
  "Estuário do Tejo",
  "Litoral Algarvio",
  "Planícies de Trás-os-Montes",
  "Vale do Minho",
  "Serra de Sintra",
  "Lagoa de Óbidos",
  "Marismas do Sado",
];

function generateLoot(items: any[], infoCost: number): LootItem[] {
  if (!items.length) return [];

  // Guarantee at least 10% profit over info_cost
  const minValue = Math.ceil(infoCost * 1.10);
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const count = 4 + Math.floor(Math.random() * 5); // 4–8 stacks
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  const loot: LootItem[] = selected.map((item) => {
    const isDrug = item.category === "drug";
    const qty = isDrug
      ? 10 + Math.floor(Math.random() * 40) // 10–50 units of drugs
      : 1 + Math.floor(Math.random() * 2);  // 1–2 legendary items
    return {
      item_id: item.id,
      item_name: item.name,
      quantity: qty,
      unit_value: item.base_price,
      category: item.category,
      rarity: item.rarity,
      image_url: item.image_url ?? null,
    };
  });

  // Boost drug quantities until minimum value is met
  let totalValue = loot.reduce((s, l) => s + l.unit_value * l.quantity, 0);
  if (totalValue < minValue) {
    const drugs = loot.filter((l) => l.category === "drug");
    if (drugs.length > 0) {
      const deficit = minValue - totalValue;
      const drug = drugs[0];
      drug.quantity += Math.ceil(deficit / Math.max(1, drug.unit_value));
    } else if (loot.length > 0) {
      const deficit = minValue - totalValue;
      loot[0].quantity += Math.ceil(deficit / Math.max(1, loot[0].unit_value));
    }
  }

  return loot;
}

async function generateWeekCrashes(weekNumber: number, weekYear: number, weekStart: Date): Promise<void> {
  const { data: existing } = await supabase
    .from("plane_crashes")
    .select("id, scheduled_at")
    .eq("week_number", weekNumber)
    .eq("week_year", weekYear);

  const needed = 3 - (existing?.length ?? 0);
  if (needed <= 0) return;

  // Fetch drug + legendary items for loot pool
  const { data: lootItems } = await supabase
    .from("items")
    .select("id, name, category, rarity, base_price, image_url")
    .or("category.eq.drug,rarity.eq.legendary")
    .gt("base_price", 0);

  // Track used days to avoid two crashes on same day
  const usedDays = new Set<number>(
    (existing || []).map((e: any) => {
      const d = new Date(e.scheduled_at);
      return d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1; // Mon=0 … Sun=6
    })
  );

  const now = new Date();

  for (let i = 0; i < needed; i++) {
    let day = Math.floor(Math.random() * 7);
    let attempts = 0;
    while (usedDays.has(day) && attempts < 20) {
      day = Math.floor(Math.random() * 7);
      attempts++;
    }
    usedDays.add(day);

    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const scheduledAt = new Date(weekStart.getTime() + day * 86400000 + hour * 3600000 + minute * 60000);
    const activeUntil = new Date(scheduledAt.getTime() + 6 * 3600000); // 6h window

    const infoCost = 500 + Math.floor(Math.random() * 1500); // 500–2000
    const loot = generateLoot(lootItems || [], infoCost);
    const totalLootValue = loot.reduce((s, l) => s + l.unit_value * l.quantity, 0);
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    let status: string;
    if (scheduledAt > now) status = "upcoming";
    else if (activeUntil > now) status = "active";
    else status = "expired";

    await supabase.from("plane_crashes").insert({
      week_number: weekNumber,
      week_year: weekYear,
      scheduled_at: scheduledAt.toISOString(),
      active_until: activeUntil.toISOString(),
      location_name: location,
      info_cost: infoCost,
      loot,
      total_loot_value: totalLootValue,
      status,
    });
  }
}

/* ── GET — crashes + player status ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, dirty_cash, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const now = new Date();

  // Sync stale statuses
  await supabase
    .from("plane_crashes")
    .update({ status: "active" })
    .eq("status", "upcoming")
    .lte("scheduled_at", now.toISOString())
    .gt("active_until", now.toISOString());

  await supabase
    .from("plane_crashes")
    .update({ status: "expired" })
    .neq("status", "expired")
    .lte("active_until", now.toISOString());

  // Ensure current + next week have 3 crashes each
  const { week, year, weekStart } = getISOWeekInfo(now);
  await generateWeekCrashes(week, year, weekStart);

  const nextWeekStart = new Date(weekStart.getTime() + 7 * 86400000);
  const nwInfo = getISOWeekInfo(nextWeekStart);
  await generateWeekCrashes(nwInfo.week, nwInfo.year, nextWeekStart);

  // Fetch crashes: current week + next week
  const twoWeeksEnd = new Date(weekStart.getTime() + 14 * 86400000).toISOString();
  const { data: crashes } = await supabase
    .from("plane_crashes")
    .select("*")
    .gte("scheduled_at", weekStart.toISOString())
    .lt("scheduled_at", twoWeeksEnd)
    .order("scheduled_at", { ascending: true });

  // Fetch player interactions
  const { data: interactions } = await supabase
    .from("plane_crash_players")
    .select("*")
    .eq("player_id", player.id);

  return NextResponse.json({
    crashes: crashes || [],
    interactions: interactions || [],
    player: {
      id: player.id,
      dirty_cash: player.dirty_cash,
      in_jail: player.in_jail,
      hp: player.hp,
    },
  });
}

/* ── POST — buy_info | scrape ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action, crashId } = await req.json();
  if (!action || !crashId) return NextResponse.json({ error: "action e crashId obrigatórios" }, { status: 400 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, dirty_cash, in_jail, jail_release_at, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail) {
    const releaseAt = new Date(player.jail_release_at);
    if (releaseAt > new Date()) return NextResponse.json({ error: "Estás na prisão" }, { status: 403 });
  }
  if (player.hp <= 0) return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });

  const { data: crash } = await supabase
    .from("plane_crashes")
    .select("*")
    .eq("id", crashId)
    .single();

  if (!crash) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

  // Sync status
  const now = new Date();
  let currentStatus = crash.status;
  if (currentStatus === "upcoming" && new Date(crash.scheduled_at) <= now && new Date(crash.active_until) > now) {
    currentStatus = "active";
    await supabase.from("plane_crashes").update({ status: "active" }).eq("id", crashId);
  } else if (currentStatus !== "expired" && new Date(crash.active_until) <= now) {
    currentStatus = "expired";
    await supabase.from("plane_crashes").update({ status: "expired" }).eq("id", crashId);
  }

  const { data: interaction } = await supabase
    .from("plane_crash_players")
    .select("*")
    .eq("crash_id", crashId)
    .eq("player_id", player.id)
    .maybeSingle();

  /* ── BUY INFO ── */
  if (action === "buy_info") {
    if (interaction?.info_purchased) {
      return NextResponse.json({ error: "Já compraste as informações" }, { status: 400 });
    }
    if (currentStatus !== "active") {
      return NextResponse.json({
        error: currentStatus === "upcoming"
          ? "O avião ainda não caiu. Aguarda o acidente."
          : "Este acidente já expirou",
      }, { status: 400 });
    }
    if (player.dirty_cash < crash.info_cost) {
      return NextResponse.json({ error: "Dinheiro sujo insuficiente" }, { status: 400 });
    }

    // Deduct info cost
    await deductDirtyMoney(player.id, crash.info_cost);

    if (interaction) {
      await supabase
        .from("plane_crash_players")
        .update({ info_purchased: true, info_purchased_at: now.toISOString() })
        .eq("id", interaction.id);
    } else {
      await supabase.from("plane_crash_players").insert({
        crash_id: crashId,
        player_id: player.id,
        info_purchased: true,
        info_purchased_at: now.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Informações compradas! Localização: ${crash.location_name}`,
      location: crash.location_name,
      new_dirty_cash: player.dirty_cash - crash.info_cost,
    });
  }

  /* ── SCRAPE ── */
  if (action === "scrape") {
    if (!interaction?.info_purchased) {
      return NextResponse.json({ error: "Primeiro tens de comprar as informações" }, { status: 400 });
    }
    if (interaction.scraped) {
      return NextResponse.json({ error: "Já saqueaste este acidente" }, { status: 400 });
    }
    if (currentStatus !== "active") {
      return NextResponse.json({
        error: currentStatus === "upcoming"
          ? "O acidente ainda não aconteceu"
          : "O acidente expirou — chegaste tarde demais",
      }, { status: 400 });
    }

    const loot: LootItem[] = crash.loot || [];
    const receivedItems: LootItem[] = [];

    for (const lootItem of loot) {
      // ±20% quantity variance per player
      const variance = 0.8 + Math.random() * 0.4;
      const qty = Math.max(1, Math.round(lootItem.quantity * variance));

      const { data: existing } = await supabase
        .from("player_inventory")
        .select("id, quantity")
        .eq("player_id", player.id)
        .eq("item_id", lootItem.item_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("player_inventory")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("player_inventory")
          .insert({ player_id: player.id, item_id: lootItem.item_id, quantity: qty });
      }

      receivedItems.push({ ...lootItem, quantity: qty });
    }

    const totalReceived = receivedItems.reduce((s, l) => s + l.unit_value * l.quantity, 0);

    await supabase
      .from("plane_crash_players")
      .update({
        scraped: true,
        scraped_at: now.toISOString(),
        items_received: receivedItems,
      })
      .eq("crash_id", crashId)
      .eq("player_id", player.id);

    return NextResponse.json({
      success: true,
      message: "Saque completo! Mercadoria encontrada.",
      items_received: receivedItems,
      total_value: totalReceived,
    });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
