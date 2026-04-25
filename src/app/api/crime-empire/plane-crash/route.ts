import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTRY_COST = 10_000; // crypto
const SHOTS_TOTAL = 10;
const HEAT_PER_SHOT_MIN = 4;
const HEAT_PER_SHOT_MAX = 10;
const RAID_THRESHOLD = 80;

const LOCATIONS = [
  "Serra da Estrela", "Planície do Alentejo", "Costa Vicentina",
  "Vale do Douro", "Montanha do Gerês", "Estuário do Tejo",
  "Litoral Algarvio", "Planícies de Trás-os-Montes", "Vale do Minho",
  "Serra de Sintra", "Lagoa de Óbidos", "Marismas do Sado",
];

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── ISO week helpers ─────────────────────────────────────────────────────────

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

// ─── Wreck geometry generator ─────────────────────────────────────────────────

interface Tile { x: number; y: number }

function generateWreckSegments(): Tile[] {
  const segments: Tile[] = [];
  const occupied = new Set<string>();
  const clusterCount = 1 + Math.floor(Math.random() * 3); // 1–3 clusters

  for (let c = 0; c < clusterCount; c++) {
    const length = 3 + Math.floor(Math.random() * 4); // 3–6
    const horizontal = Math.random() < 0.5;
    let placed = false;

    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const startX = horizontal
        ? Math.floor(Math.random() * (10 - length))
        : Math.floor(Math.random() * 10);
      const startY = horizontal
        ? Math.floor(Math.random() * 10)
        : Math.floor(Math.random() * (10 - length));

      const tiles: Tile[] = [];
      let collision = false;

      for (let i = 0; i < length; i++) {
        const tx = horizontal ? startX + i : startX;
        const ty = horizontal ? startY : startY + i;
        if (occupied.has(`${tx},${ty}`)) { collision = true; break; }
        tiles.push({ x: tx, y: ty });
      }

      if (!collision) {
        tiles.forEach((t) => { occupied.add(`${t.x},${t.y}`); segments.push(t); });
        placed = true;
      }
    }
  }

  return segments;
}

// ─── Intel hint generator ─────────────────────────────────────────────────────

function generateIntelHint(segments: Tile[]): string {
  if (segments.length === 0) return "Sinal fraco. Destroços podem estar em qualquer lugar.";

  const avgX = segments.reduce((s, t) => s + t.x, 0) / segments.length;
  const avgY = segments.reduce((s, t) => s + t.y, 0) / segments.length;

  const noisyX = Math.max(0, Math.min(9, avgX + (Math.random() * 2 - 1)));
  const noisyY = Math.max(0, Math.min(9, avgY + (Math.random() * 2 - 1)));

  const hDir = noisyX < 4 ? "OESTE" : noisyX > 6 ? "LESTE" : "CENTRAL";
  const vDir = noisyY < 4 ? "NORTE" : noisyY > 6 ? "SUL" : "CENTRAL";
  const sector = hDir === "CENTRAL" && vDir === "CENTRAL"
    ? "CENTRAL"
    : vDir === "CENTRAL" ? hDir : hDir === "CENTRAL" ? vDir : `${vDir}-${hDir}`;

  const minRow = Math.max(1, Math.round(Math.min(...segments.map((t) => t.y)) + 1 - Math.random()));
  const maxRow = Math.min(10, Math.round(Math.max(...segments.map((t) => t.y)) + 1 + Math.random()));

  const hints = [
    `O sinal é mais forte na região ${sector}. Destroços espalhados entre as linhas ${minRow}–${maxRow}.`,
    `Emissão de frequência detetada no setor ${sector}. Concentração entre colunas ${Math.round(noisyX + 1)}–${Math.min(10, Math.round(noisyX + 3))}.`,
    `Destroços provavelmente na zona ${sector}. Altitude da queda indica linhas ${minRow}–${maxRow}.`,
  ];

  return hints[Math.floor(Math.random() * hints.length)];
}

// ─── Loot generator ──────────────────────────────────────────────────────────

async function generateSessionLoot(
  seed: number,
  coverage: number,
  forcedDrugId?: string | null,
): Promise<{ item_id: string; item_name: string; quantity: number; unit_value: number; category: string; rarity: string; image_url: string | null }[]> {
  const tier = coverage >= 0.9 ? 1.0 : coverage >= 0.6 ? 0.7 : coverage >= 0.3 ? 0.4 : 0.15;

  let drugsQuery = supabase
    .from("items")
    .select("id, name, base_price, rarity, image_url")
    .eq("category", "drug")
    .order("base_price", { ascending: false });

  if (forcedDrugId) {
    drugsQuery = supabase
      .from("items")
      .select("id, name, base_price, rarity, image_url")
      .eq("id", forcedDrugId);
  }

  const { data: drugs } = await drugsQuery;

  const { data: luxury } = await supabase
    .from("items")
    .select("id, name, base_price, rarity, image_url")
    .in("rarity", ["rare", "epic", "legendary"])
    .neq("category", "drug")
    .order("base_price", { ascending: false })
    .limit(10);

  let rng = seed;
  const nextRand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };

  const items: { item_id: string; item_name: string; quantity: number; unit_value: number; category: string; rarity: string; image_url: string | null }[] = [];

  if (drugs && drugs.length > 0) {
    const drug = drugs[Math.floor(nextRand() * drugs.length)];
    const qty = Math.max(1, Math.round((10 + nextRand() * 40) * tier));
    items.push({ item_id: drug.id, item_name: drug.name, quantity: qty, unit_value: drug.base_price, category: "drug", rarity: drug.rarity ?? "common", image_url: drug.image_url ?? null });
  }

  if (luxury && luxury.length > 0 && nextRand() < 0.5 + tier * 0.3) {
    const item = luxury[Math.floor(nextRand() * luxury.length)];
    items.push({ item_id: item.id, item_name: item.name, quantity: 1, unit_value: item.base_price, category: "luxury", rarity: item.rarity ?? "rare", image_url: item.image_url ?? null });
  }

  if (drugs && drugs.length > 1 && tier >= 0.7) {
    const drug2 = drugs[Math.floor(nextRand() * drugs.length)];
    const qty2 = Math.max(1, Math.round((5 + nextRand() * 20) * tier));
    items.push({ item_id: drug2.id, item_name: drug2.name, quantity: qty2, unit_value: drug2.base_price, category: "drug", rarity: drug2.rarity ?? "common", image_url: drug2.image_url ?? null });
  }

  return items;
}

// ─── Week crash generator ─────────────────────────────────────────────────────

async function generateWeekCrashes(weekNumber: number, weekYear: number, weekStart: Date): Promise<void> {
  const now = new Date();

  const { data: existing } = await supabase
    .from("plane_crashes")
    .select("id, scheduled_at")
    .eq("week_number", weekNumber)
    .eq("week_year", weekYear);

  // Only count crashes that are still active or upcoming (not already expired)
  const nonExpiredExisting = (existing || []).filter((e: any) =>
    new Date(e.scheduled_at).getTime() + 6 * 3600_000 > now.getTime()
  );
  const needed = 3 - nonExpiredExisting.length;
  if (needed <= 0) return;

  const usedDays = new Set<number>(
    (existing || []).map((e: any) => {
      const d = new Date(e.scheduled_at);
      return d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
    })
  );

  for (let i = 0; i < needed; i++) {
    let day = Math.floor(Math.random() * 7);
    let attempts = 0;
    while (usedDays.has(day) && attempts < 20) { day = Math.floor(Math.random() * 7); attempts++; }
    usedDays.add(day);

    const hour   = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    let scheduledAt = new Date(weekStart.getTime() + day * 86400000 + hour * 3600000 + minute * 60000);

    // If this slot is already expired (or will expire immediately), push it to the near future
    if (new Date(scheduledAt.getTime() + 6 * 3600_000) <= now) {
      const hoursAhead = 2 + Math.floor(Math.random() * 22); // 2–24 hours from now
      scheduledAt = new Date(now.getTime() + hoursAhead * 3600_000);
    }

    const activeUntil = new Date(scheduledAt.getTime() + 6 * 3600000);
    const wreckSegments = generateWreckSegments();
    const lootSeed = Math.floor(Math.random() * 0x7fffffff);
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
      info_cost: ENTRY_COST,
      loot: [],
      total_loot_value: 0,
      status,
      wreck_segments: wreckSegments,
      total_segments: wreckSegments.length,
      loot_seed: lootSeed,
      entry_cost: ENTRY_COST,
    });
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, dirty_cash, in_jail, jail_release_at, hp, crypto")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const now = new Date();

  await supabase.from("plane_crashes").update({ status: "active" })
    .eq("status", "upcoming").lte("scheduled_at", now.toISOString()).gt("active_until", now.toISOString());
  await supabase.from("plane_crashes").update({ status: "expired" })
    .neq("status", "expired").lte("active_until", now.toISOString());

  const { week, year, weekStart } = getISOWeekInfo(now);
  await generateWeekCrashes(week, year, weekStart);
  const nextWeekStart = new Date(weekStart.getTime() + 7 * 86400000);
  const nwInfo = getISOWeekInfo(nextWeekStart);
  await generateWeekCrashes(nwInfo.week, nwInfo.year, nextWeekStart);

  const twoWeeksEnd = new Date(weekStart.getTime() + 14 * 86400000).toISOString();
  const { data: crashes } = await supabase
    .from("plane_crashes")
    .select("id, week_number, week_year, scheduled_at, active_until, location_name, status, total_segments, entry_cost, loot_seed")
    .gte("scheduled_at", weekStart.toISOString())
    .lt("scheduled_at", twoWeeksEnd)
    .order("scheduled_at", { ascending: true });

  const activeCrash = (crashes || []).find((c: any) => c.status === "active");
  let activeSession = null;
  if (activeCrash) {
    const { data: sess } = await supabase
      .from("crash_sessions")
      .select("id, shots_left, hits, misses, heat_level, revealed_tiles, completed, extracted, final_coverage, loot_received, raid_triggered, intel_hint")
      .eq("player_id", player.id)
      .eq("crash_id", activeCrash.id)
      .maybeSingle();
    activeSession = sess ?? null;
  }

  const { count: weekCrashCount } = await supabase
    .from("plane_crashes")
    .select("id", { count: "exact", head: true })
    .eq("week_number", week)
    .eq("week_year", year);

  return NextResponse.json({
    crashes: crashes || [],
    activeCrash: activeCrash ?? null,
    activeSession,
    weekCrashCount: weekCrashCount ?? 0,
    player: { id: player.id, dirty_cash: player.dirty_cash, in_jail: player.in_jail, hp: player.hp, crypto: player.crypto ?? 0 },
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
    .select("id, in_jail, jail_release_at, hp, crypto, dirty_cash")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail) {
    if (new Date(player.jail_release_at) > new Date())
      return NextResponse.json({ error: "Estás na prisão" }, { status: 403 });
  }
  if (player.hp <= 0) return NextResponse.json({ error: "Estás no hospital" }, { status: 403 });

  // ── START SESSION ────────────────────────────────────────────────────────────
  if (action === "start_session") {
    const { crashId } = body;
    if (!crashId) return NextResponse.json({ error: "crashId obrigatório" }, { status: 400 });

    const { data: crash } = await supabase
      .from("plane_crashes")
      .select("id, status, entry_cost, wreck_segments, total_segments, loot_seed, location_name")
      .eq("id", crashId)
      .single();

    if (!crash) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    if (crash.status !== "active") return NextResponse.json({ error: "Este evento não está ativo" }, { status: 400 });

    const { data: existing } = await supabase
      .from("crash_sessions")
      .select("id, completed, extracted, shots_left, hits, misses, heat_level, revealed_tiles, intel_hint, raid_triggered")
      .eq("player_id", player.id)
      .eq("crash_id", crashId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, session: existing, alreadyStarted: true });
    }

    const cost = crash.entry_cost ?? ENTRY_COST;
    if ((player.crypto ?? 0) < cost) {
      return NextResponse.json({ error: `Precisas de ${cost.toLocaleString("pt-PT")} 💎 de crypto para subornar o controlador` }, { status: 403 });
    }

    await supabase.from("crime_players").update({ crypto: (player.crypto ?? 0) - cost }).eq("id", player.id);

    const segments: Tile[] = crash.wreck_segments ?? [];
    const intelHint = generateIntelHint(segments);

    const { data: session } = await supabase
      .from("crash_sessions")
      .insert({
        player_id: player.id,
        crash_id: crashId,
        shots_left: SHOTS_TOTAL,
        heat_level: 0,
        hits: 0,
        misses: 0,
        revealed_tiles: {},
        intel_hint: intelHint,
      })
      .select()
      .single();

    return NextResponse.json({ success: true, session, intelHint, alreadyStarted: false });
  }

  // ── FIRE SHOT ────────────────────────────────────────────────────────────────
  if (action === "fire_shot") {
    const { crashId, x, y } = body;
    if (crashId == null || x == null || y == null)
      return NextResponse.json({ error: "crashId, x, y obrigatórios" }, { status: 400 });
    if (x < 0 || x > 9 || y < 0 || y > 9)
      return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });

    const { data: crash } = await supabase
      .from("plane_crashes")
      .select("id, status, wreck_segments, total_segments, loot_seed")
      .eq("id", crashId)
      .single();

    if (!crash) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    if (crash.status !== "active") return NextResponse.json({ error: "Evento não está ativo" }, { status: 400 });

    const { data: session } = await supabase
      .from("crash_sessions")
      .select("*")
      .eq("player_id", player.id)
      .eq("crash_id", crashId)
      .maybeSingle();

    if (!session) return NextResponse.json({ error: "Inicia uma sessão primeiro" }, { status: 400 });
    if (session.completed || session.extracted) return NextResponse.json({ error: "Sessão já terminada" }, { status: 400 });
    if (session.shots_left <= 0) return NextResponse.json({ error: "Sem disparos restantes" }, { status: 400 });

    const tileKey = `${x},${y}`;
    const revealedTiles = (session.revealed_tiles ?? {}) as Record<string, string>;
    if (revealedTiles[tileKey]) return NextResponse.json({ error: "Tile já disparado" }, { status: 400 });

    const segments: Tile[] = crash.wreck_segments ?? [];
    const isHit = segments.some((t) => t.x === x && t.y === y);
    const isNear = !isHit && segments.some(
      (t) => Math.abs(t.x - x) <= 1 && Math.abs(t.y - y) <= 1
    );

    const result: "hit" | "near" | "miss" = isHit ? "hit" : isNear ? "near" : "miss";
    const heatGain = HEAT_PER_SHOT_MIN + Math.floor(Math.random() * (HEAT_PER_SHOT_MAX - HEAT_PER_SHOT_MIN + 1));
    const newHeat = Math.min(100, (session.heat_level ?? 0) + heatGain);
    const raidTriggered = newHeat >= RAID_THRESHOLD;

    const newShotsLeft = session.shots_left - 1;
    const newHits   = session.hits   + (isHit ? 1 : 0);
    const newMisses = session.misses + (isHit ? 0 : 1);
    revealedTiles[tileKey] = result;
    const completed = newShotsLeft <= 0;

    await supabase.from("crash_sessions").update({
      shots_left: newShotsLeft,
      hits: newHits,
      misses: newMisses,
      heat_level: newHeat,
      revealed_tiles: revealedTiles,
      completed,
      raid_triggered: session.raid_triggered || raidTriggered,
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);

    return NextResponse.json({ result, x, y, newHeat, newShotsLeft, raidTriggered, hits: newHits, completed });
  }

  // ── EXTRACT ──────────────────────────────────────────────────────────────────
  if (action === "extract") {
    const { crashId } = body;
    if (!crashId) return NextResponse.json({ error: "crashId obrigatório" }, { status: 400 });

    const { data: crash } = await supabase
      .from("plane_crashes")
      .select("id, status, wreck_segments, total_segments, loot_seed, forced_drug_id")
      .eq("id", crashId)
      .single();

    if (!crash) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    if (crash.status !== "active") return NextResponse.json({ error: "Evento não está ativo" }, { status: 400 });

    const { data: session } = await supabase
      .from("crash_sessions")
      .select("*")
      .eq("player_id", player.id)
      .eq("crash_id", crashId)
      .maybeSingle();

    if (!session) return NextResponse.json({ error: "Sem sessão ativa" }, { status: 400 });
    if (session.extracted) return NextResponse.json({ error: "Já extraíste o saque" }, { status: 400 });

    const totalSegs = crash.total_segments > 0 ? crash.total_segments : 1;
    const coverage = session.hits / totalSegs;
    const items = await generateSessionLoot(crash.loot_seed, coverage, crash.forced_drug_id);

    for (const item of items) {
      const { data: inv } = await supabase
        .from("player_inventory")
        .select("id, quantity")
        .eq("player_id", player.id)
        .eq("item_id", item.item_id)
        .maybeSingle();

      if (inv) {
        await supabase.from("player_inventory").update({ quantity: inv.quantity + item.quantity }).eq("id", inv.id);
      } else {
        await supabase.from("player_inventory").insert({ player_id: player.id, item_id: item.item_id, quantity: item.quantity });
      }
    }

    await supabase.from("crash_sessions").update({
      extracted: true,
      completed: true,
      final_coverage: coverage,
      loot_received: items,
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);

    await supabase.from("crash_loot_log").insert({
      player_id: player.id,
      crash_id: crashId,
      hits: session.hits,
      coverage,
      loot: items,
      raid_triggered: session.raid_triggered,
    });

    return NextResponse.json({ success: true, coverage, items, raidTriggered: session.raid_triggered });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
