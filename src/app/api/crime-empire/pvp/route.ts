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

function calcCombatScore(p: {
  power: number; intelligence: number; charisma: number;
  level: number; prestige_level: number; class: string;
  hp: number; max_hp: number; addiction?: number;
}): number {
  const isBrute = p.class === "brute";
  // Brute gets +50% power — their class speciality
  const effectivePower = p.power * (isBrute ? 1.5 : 1.0);
  let score = effectivePower * 3 + p.intelligence * 1.5 + p.charisma * 0.5 + p.level * 10 + (p.prestige_level ?? 0) * 50;
  // Addiction reduces combat effectiveness up to 50%
  const addictionPenalty = 1 - ((p.addiction ?? 0) / 100) * 0.5;
  score *= addictionPenalty;
  // Low HP means less fight
  const hpRatio = Math.max(0.1, p.hp / Math.max(1, p.max_hp));
  score *= (0.5 + 0.5 * hpRatio);
  // ±15% random variance
  score *= (0.85 + Math.random() * 0.30);
  return score;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: self } = await supabase
    .from("crime_players")
    .select("id, last_pvp_at")
    .eq("user_id", user.id)
    .single();
  if (!self) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const [playersRes, battlesRes, chatRes, settingsRes] = await Promise.all([
    supabase
      .from("crime_players")
      .select("id, display_name, username, avatar_url, level, prestige_level, class, power, intelligence, charisma, max_hp, hp, last_login")
      .order("level", { ascending: false })
      .limit(100),
    supabase
      .from("pvp_battles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("pvp_chat")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("pvp_settings").select("*").eq("id", 1).single(),
  ]);

  return NextResponse.json({
    players: (playersRes.data ?? []).filter((p) => p.id !== self.id),
    selfId: self.id,
    selfLastPvpAt: self.last_pvp_at,
    battles: battlesRes.data ?? [],
    chat: (chatRes.data ?? []).reverse(),
    settings: settingsRes.data ?? {
      pvp_enabled: true,
      cooldown_minutes: 10,
      min_loot_percent: 5,
      max_loot_percent: 20,
      hp_after_loss_percent: 10,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: attacker } = await supabase
    .from("crime_players")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!attacker) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  // ── CHAT ──────────────────────────────────────────────────────────────
  if (action === "chat") {
    const { message } = body;
    if (!message || typeof message !== "string") return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    const trimmed = message.trim().slice(0, 200);
    if (!trimmed) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

    await supabase.from("pvp_chat").insert({
      player_id: attacker.id,
      player_name: attacker.display_name || attacker.username,
      avatar_url: attacker.avatar_url,
      message: trimmed,
    });

    // Keep chat lean — delete messages older than 24h
    await supabase
      .from("pvp_chat")
      .delete()
      .lt("created_at", new Date(Date.now() - 86400000).toISOString());

    return NextResponse.json({ success: true });
  }

  // ── ATTACK ────────────────────────────────────────────────────────────
  if (action === "attack") {
    const { targetId } = body;
    if (!targetId) return NextResponse.json({ error: "Alvo inválido" }, { status: 400 });
    if (targetId === attacker.id) return NextResponse.json({ error: "Não podes atacar-te a ti mesmo" }, { status: 400 });

    if (attacker.in_jail && attacker.jail_release_at && new Date(attacker.jail_release_at) > new Date()) {
      return NextResponse.json({ error: "Estás na prisão. Não podes atacar." }, { status: 403 });
    }
    if (attacker.hp <= 0) {
      return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
    }

    // Settings
    const { data: settings } = await supabase.from("pvp_settings").select("*").eq("id", 1).single();
    if (settings && !settings.pvp_enabled) return NextResponse.json({ error: "PvP está desativado de momento" }, { status: 403 });

    // Cooldown check
    const cooldownMin = settings?.cooldown_minutes ?? 10;
    if (attacker.last_pvp_at) {
      const msSince = Date.now() - new Date(attacker.last_pvp_at).getTime();
      if (msSince < cooldownMin * 60 * 1000) {
        const secsLeft = Math.ceil((cooldownMin * 60 * 1000 - msSince) / 1000);
        return NextResponse.json({ error: `Cooldown ativo: aguarda ${secsLeft}s antes do próximo ataque` }, { status: 429 });
      }
    }

    // Fetch defender (fresh)
    const { data: defender } = await supabase
      .from("crime_players")
      .select("*")
      .eq("id", targetId)
      .single();
    if (!defender) return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });

    // Fetch equipped items for stat bonuses
    const [atkItemsRes, defItemsRes] = await Promise.all([
      supabase.from("player_inventory").select("items(power_bonus,intelligence_bonus,charisma_bonus)").eq("player_id", attacker.id).eq("equipped", true),
      supabase.from("player_inventory").select("items(power_bonus,intelligence_bonus,charisma_bonus)").eq("player_id", defender.id).eq("equipped", true),
    ]);
    function sumItemStats(rows: any[], playerClass: string) {
      const mult = playerClass === "hooligan" ? 1.15 : 1.0;
      return (rows || []).reduce((acc: any, r: any) => ({
        power: acc.power + (r.items?.power_bonus || 0) * mult,
        intelligence: acc.intelligence + (r.items?.intelligence_bonus || 0) * mult,
        charisma: acc.charisma + (r.items?.charisma_bonus || 0) * mult,
      }), { power: 0, intelligence: 0, charisma: 0 });
    }
    const atkItemBonus = sumItemStats(atkItemsRes.data || [], attacker.class);
    const defItemBonus = sumItemStats(defItemsRes.data || [], defender.class);

    // Combat calculation
    const atkScore = calcCombatScore({ ...attacker, power: attacker.power + atkItemBonus.power, intelligence: attacker.intelligence + atkItemBonus.intelligence, charisma: attacker.charisma + atkItemBonus.charisma });
    const defScore = calcCombatScore({ ...defender, power: defender.power + defItemBonus.power, intelligence: defender.intelligence + defItemBonus.intelligence, charisma: defender.charisma + defItemBonus.charisma });
    const attackerWon = atkScore >= defScore;
    const winner = attackerWon ? attacker : defender;
    const loser = attackerWon ? defender : attacker;

    // Determine loot
    const minPct = (settings?.min_loot_percent ?? 5) / 100;
    const maxPct = (settings?.max_loot_percent ?? 20) / 100;
    const lootPct = minPct + Math.random() * (maxPct - minPct);

    // Fetch fresh balances to avoid race conditions
    const { data: freshLoser } = await supabase.from("crime_players").select("cash, crypto, hp").eq("id", loser.id).single();
    const { data: freshWinner } = await supabase.from("crime_players").select("cash, crypto").eq("id", winner.id).single();

    const loserCash = freshLoser?.cash ?? loser.cash ?? 0;
    const loserCrypto = freshLoser?.crypto ?? loser.crypto ?? 0;
    const winnerCash = freshWinner?.cash ?? winner.cash ?? 0;
    const winnerCrypto = freshWinner?.crypto ?? winner.crypto ?? 0;

    let lootType: "cash" | "crypto";
    if (loserCash <= 0) lootType = "crypto";
    else if (loserCrypto <= 0) lootType = "cash";
    else lootType = Math.random() < 0.5 ? "cash" : "crypto";

    const lootSource = lootType === "cash" ? loserCash : loserCrypto;
    const lootAmount = Math.max(0, Math.floor(lootSource * lootPct));

    // Hospital for loser — HP drops to configured %
    const hpAfterPct = (settings?.hp_after_loss_percent ?? 10) / 100;
    const loserNewHp = Math.max(1, Math.floor(loser.max_hp * hpAfterPct));

    await Promise.all([
      // Loser takes damage and loses loot
      supabase.from("crime_players").update({
        hp: loserNewHp,
        cash: lootType === "cash" ? Math.max(0, loserCash - lootAmount) : loserCash,
        crypto: lootType === "crypto" ? Math.max(0, loserCrypto - lootAmount) : loserCrypto,
        last_pvp_at: new Date().toISOString(),
      }).eq("id", loser.id),

      // Winner gains loot
      supabase.from("crime_players").update({
        cash: lootType === "cash" ? winnerCash + lootAmount : winnerCash,
        crypto: lootType === "crypto" ? winnerCrypto + lootAmount : winnerCrypto,
        last_pvp_at: new Date().toISOString(),
      }).eq("id", winner.id),

      // Log the battle
      supabase.from("pvp_battles").insert({
        attacker_id: attacker.id,
        defender_id: defender.id,
        winner_id: winner.id,
        attacker_name: attacker.display_name || attacker.username,
        attacker_avatar: attacker.avatar_url,
        defender_name: defender.display_name || defender.username,
        defender_avatar: defender.avatar_url,
        attacker_score: Math.round(atkScore),
        defender_score: Math.round(defScore),
        loot_type: lootType,
        loot_amount: lootAmount,
      }),

      // Notify the loser (D4)
      supabase.from("player_notifications").insert({
        player_id: loser.id,
        type: "pvp_attacked",
        title: "⚔️ Foste atacado!",
        message: `${attacker.display_name || attacker.username} atacou-te e levou ${lootType === "cash" ? "$" : "₿"}${lootAmount.toLocaleString()} em ${lootType === "cash" ? "dinheiro limpo" : "crypto"}.`,
        data: { attackerId: attacker.id, attackerName: attacker.display_name || attacker.username, lootType, lootAmount },
      }),
    ]);

    // E8: Grant XP to winner
    const pvpXP = 50 + (loser.level ?? 1) * 2;
    const { data: wp } = await supabase.from("crime_players").select("xp, level, xp_to_next_level").eq("id", winner.id).single();
    if (wp) {
      let newXP = wp.xp + pvpXP;
      let newLevel = wp.level;
      while (newXP >= wp.xp_to_next_level) { newXP -= wp.xp_to_next_level; newLevel++; }
      const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));
      await supabase.from("crime_players").update({ xp: newXP, level: newLevel, xp_to_next_level: newXPToNext }).eq("id", winner.id);
    }

    // Degrade attacker's equipped items with durability after PvP
    // Loss scales with item tier: base 5 + floor(crypto_price / 150), min 4, max 20
    const { data: atkDurItems } = await supabase
      .from("player_inventory")
      .select("id, durability, items(crypto_price)")
      .eq("player_id", attacker.id)
      .eq("equipped", true)
      .not("durability", "is", null);

    for (const di of atkDurItems || []) {
      const tier = Math.min(20, Math.max(4, 5 + Math.floor(((di as any).items?.crypto_price ?? 0) / 150)));
      const newDur = Math.max(0, (di.durability ?? 100) - tier);
      await supabase
        .from("player_inventory")
        .update(newDur <= 0 ? { durability: 0, equipped: false } : { durability: newDur })
        .eq("id", di.id);
    }

    return NextResponse.json({
      success: true,
      attackerWon,
      atkScore: Math.round(atkScore),
      defScore: Math.round(defScore),
      lootType,
      lootAmount,
      loserName: loser.display_name || loser.username,
      winnerName: winner.display_name || winner.username,
      loserNewHp,
    });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
