import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import { WORKER_DEFS } from "@/lib/crime-empire/worker-defs";

export const dynamic = "force-dynamic";

const CRYPTO_BROTHEL_TYPES = ["brothel_luxury", "brothel_exclusive", "brothel_empire"];

const UPGRADE_COSTS: Record<string, number> = {
  vip_rooms: 75000,
  lighting: 30000,
  security: 50000,
  marketing: 40000,
};

// Strict purchase order — each upgrade requires the previous one
const UPGRADE_ORDER = ["lighting", "marketing", "security", "vip_rooms"];

// Worker slots unlocked per upgrade (cumulative on top of brothel base)
const UPGRADE_SLOT_BONUS: Record<string, number> = {
  lighting:  3,
  marketing: 3,
  security:  5,
  vip_rooms: 10,
};

const SUPPLY_REFILL_COST = 5000; // per supply type

const WORKER_TRAITS = ["Charmosa","Discreta","Ambiciosa","Extrovertida","Reservada","Elegante","CarismÃ¡tica"];
const WORKER_TRAITS2 = ["PreguiÃ§osa","Cara","Eficiente","SimpÃ¡tica","Teimosa","Criativa","ConfiÃ¡vel"];

const EVENTS = [
  {
    type: "vip_client",
    title: "ðŸ‘‘ Cliente VIP!",
    description: "Um cliente muito rico chegou. Escolhe a tua melhor worker.",
    choices: [
      { label: "Enviar melhor worker", action: "vip_accept", reward_cash: 15000, reward_xp: 20 },
      { label: "Ignorar", action: "vip_ignore", reward_cash: 0, reward_xp: 0 },
    ],
  },
  {
    type: "worker_unhappy",
    title: "ðŸ˜¤ Worker Insatisfeita",
    description: "Uma das tuas workers estÃ¡ a ameaÃ§ar sair se nÃ£o receber bÃ³nus.",
    choices: [
      { label: "Pagar bÃ³nus ($3,000)", action: "bonus_pay", reward_cash: -3000, reward_xp: 5 },
      { label: "Ignorar (risco de saÃ­da)", action: "ignore_unhappy", reward_cash: 0, reward_xp: 0 },
    ],
  },
  {
    type: "police",
    title: "ðŸš” AtenÃ§Ã£o Policial",
    description: "A polÃ­cia estÃ¡ a circular na zona. Reduz a atividade ou arrisca.",
    choices: [
      { label: "Fechar temporariamente (âˆ’20% income)", action: "police_close", reward_cash: 0, reward_xp: 0 },
      { label: "Continuar (risco de multa)", action: "police_risk", reward_cash: 0, reward_xp: 0 },
    ],
  },
  {
    type: "bonus",
    title: "ðŸŽ‰ Noite Especial!",
    description: "Esta noite houve uma festa privada. Receitas extra para todos.",
    choices: [
      { label: "Aproveitar!", action: "bonus_collect", reward_cash: 8000, reward_xp: 15 },
    ],
  },
];

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ GET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: player } = await supabase
      .from("crime_players").select("*").eq("user_id", user.id).single();
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    const { data: brothelTypes } = await supabase
      .from("brothel_types").select("*").eq("enabled", true).order("sort_order");

    const { data: ownedBrothels } = await supabase
      .from("player_brothels")
      .select("*, brothel_type:brothel_types(*)")
      .eq("player_id", player.id);

    const { data: workers } = await supabase
      .from("brothel_workers").select("*").eq("player_id", player.id);

    // Unresolved events for player
    const { data: events } = await supabase
      .from("brothel_events")
      .select("*")
      .eq("player_id", player.id)
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: true,
      brothelTypes: brothelTypes || [],
      ownedBrothels: ownedBrothels || [],
      workers: workers || [],
      events: events || [],
      playerClass: player.class,
      playerLevel: player.level,
      playerCash: player.cash,
      playerCrypto: player.crypto,
      playerDirtyCash: player.dirty_cash,
    });
  } catch (error) {
    console.error("GET /api/crime-empire/brothels error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ POST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: player } = await supabase
      .from("crime_players").select("*").eq("user_id", user.id).single();
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date())
      return NextResponse.json({ error: "EstÃ¡s na prisÃ£o." }, { status: 403 });
    if (player.hp <= 0)
      return NextResponse.json({ error: "EstÃ¡s no hospital." }, { status: 403 });

    const body = await req.json();
    const { action } = body;

    /* â”€â”€ PURCHASE â”€â”€ */
    if (action === "purchase") {
      const { brothelTypeId } = body;
      const { data: brothelType } = await supabase
        .from("brothel_types").select("*").eq("id", brothelTypeId).eq("enabled", true).single();
      if (!brothelType) return NextResponse.json({ error: "Estabelecimento nÃ£o encontrado." }, { status: 404 });
      if (player.level < brothelType.required_level)
        return NextResponse.json({ error: `Precisas de nÃ­vel ${brothelType.required_level}!` }, { status: 400 });
      const { data: existing } = await supabase
        .from("player_brothels").select("id")
        .eq("player_id", player.id).eq("brothel_type_id", brothelTypeId).single();
      if (existing) return NextResponse.json({ error: "JÃ¡ tens este estabelecimento!" }, { status: 400 });

      const usesCrypto = CRYPTO_BROTHEL_TYPES.includes(brothelType.type);
      if (usesCrypto && player.crypto < brothelType.purchase_price)
        return NextResponse.json({ error: `Precisas de ðŸª™${brothelType.purchase_price.toLocaleString()} crypto!` }, { status: 400 });
      if (!usesCrypto && player.cash < brothelType.purchase_price)
        return NextResponse.json({ error: `Precisas de $${brothelType.purchase_price.toLocaleString()}!` }, { status: 400 });

      const maxWorkers = player.class === "pimp" ? brothelType.max_employees * 2 : brothelType.max_employees;
      await supabase.from("crime_players")
        .update(usesCrypto ? { crypto: player.crypto - brothelType.purchase_price } : { cash: player.cash - brothelType.purchase_price })
        .eq("id", player.id);
      await supabase.from("player_brothels").insert({
        player_id: player.id, brothel_type_id: brothelTypeId, max_employees: maxWorkers,
      });
      return NextResponse.json({ success: true, message: `Compraste ${brothelType.name}!` });
    }

    /* â”€â”€ HIRE WORKER â”€â”€ */
    if (action === "hire") {
      const {
        playerBrothelId,
        workerName,
        workerSlug,
        incomePerHour,
        attractiveness: defAttr,
        stamina: defStamina,
        mood: defMood,
        trait1,
        trait2,
        hireCost,
        hireCostCrypto,
      } = body;

      const { data: pb } = await supabase
        .from("player_brothels").select("*, brothel_type:brothel_types(*)")
        .eq("id", playerBrothelId).eq("player_id", player.id).single();
      if (!pb) return NextResponse.json({ error: "Estabelecimento não encontrado." }, { status: 404 });

      const { data: currentWorkers } = await supabase
        .from("brothel_workers").select("id").eq("player_brothel_id", playerBrothelId);
      if ((currentWorkers?.length || 0) >= pb.max_employees)
        return NextResponse.json({ error: `Capacidade máxima! (${pb.max_employees} workers)` }, { status: 400 });

      // Validate hire cost is within sane range to prevent manipulation
      const cost = Math.max(5000, Math.min(200000, hireCost ?? 10000));
      const usesCrypto = !!hireCostCrypto;

      // Server-side level check: look up worker def by slug
      if (workerSlug) {
        const def = WORKER_DEFS.find((d) => d.slug === workerSlug);
        if (def && player.level < def.required_level)
          return NextResponse.json({ error: `Precisas de nível ${def.required_level} para contratar esta worker!` }, { status: 400 });
      }

      if (usesCrypto && player.crypto < cost)
        return NextResponse.json({ error: `Precisas de 🪙${cost.toLocaleString()} crypto!` }, { status: 400 });
      if (!usesCrypto && player.cash < cost)
        return NextResponse.json({ error: `Precisas de $${cost.toLocaleString()}!` }, { status: 400 });

      await supabase.from("crime_players")
        .update(usesCrypto ? { crypto: player.crypto - cost } : { cash: player.cash - cost })
        .eq("id", player.id);

      const finalIncome = incomePerHour ?? (100 + Math.floor((defAttr ?? 50) * 2.5));
      const finalAttr   = defAttr   ?? (40 + Math.floor(Math.random() * 50));
      const finalSta    = defStamina ?? (60 + Math.floor(Math.random() * 40));
      const finalMood   = defMood   ?? (50 + Math.floor(Math.random() * 50));

      await supabase.from("brothel_workers").insert({
        player_id: player.id,
        player_brothel_id: playerBrothelId,
        name: workerName || `Worker #${(currentWorkers?.length || 0) + 1}`,
        slug: workerSlug ?? null,
        status: "healthy",
        income_per_hour: finalIncome,
        charisma_bonus: 1,
        intelligence_bonus: 1,
        respect_bonus: 1,
        attractiveness: finalAttr,
        stamina: finalSta,
        mood: finalMood,
        happiness: 70,
        trait_1: trait1 ?? WORKER_TRAITS[Math.floor(Math.random() * WORKER_TRAITS.length)],
        trait_2: trait2 ?? WORKER_TRAITS2[Math.floor(Math.random() * WORKER_TRAITS2.length)],
      });
      return NextResponse.json({ success: true, message: `Contrataste ${workerName || "nova worker"}!` });
    }

    /* â”€â”€ FIRE WORKER â”€â”€ */
    if (action === "fire") {
      const { workerId } = body;
      await supabase.from("brothel_workers").delete().eq("id", workerId).eq("player_id", player.id);
      return NextResponse.json({ success: true, message: "Worker despedida." });
    }

    /* â”€â”€ ASSIGN WORKER TO ROOM â”€â”€ */
    if (action === "assign") {
      const { workerId, playerBrothelId, room } = body;
      await supabase.from("brothel_workers")
        .update({ player_brothel_id: playerBrothelId, assigned_room: room })
        .eq("id", workerId).eq("player_id", player.id);
      return NextResponse.json({ success: true });
    }

    /* â”€â”€ REFILL SUPPLIES â”€â”€ */
    if (action === "refill_supplies") {
      const { playerBrothelId, supplyType } = body; // 'drinks' | 'hygiene' | 'security'
      if (!["drinks", "hygiene", "security"].includes(supplyType))
        return NextResponse.json({ error: "Tipo de supply invÃ¡lido." }, { status: 400 });
      if (player.cash < SUPPLY_REFILL_COST)
        return NextResponse.json({ error: `Precisas de $${SUPPLY_REFILL_COST.toLocaleString()}!` }, { status: 400 });
      await supabase.from("crime_players").update({ cash: player.cash - SUPPLY_REFILL_COST }).eq("id", player.id);
      await supabase.from("player_brothels")
        .update({ [`supply_${supplyType}`]: 100 }).eq("id", playerBrothelId).eq("player_id", player.id);
      return NextResponse.json({ success: true, message: `${supplyType} reabastecido!` });
    }

    /* â”€â”€ UPGRADE â”€â”€ */
    if (action === "upgrade") {
      const { playerBrothelId, upgradeType } = body; // 'lighting' | 'marketing' | 'security' | 'vip_rooms'
      const cost = UPGRADE_COSTS[upgradeType];
      if (!cost) return NextResponse.json({ error: "Upgrade invÃ¡lido." }, { status: 400 });
      const { data: pb } = await supabase
        .from("player_brothels").select("*").eq("id", playerBrothelId).eq("player_id", player.id).single();
      if (!pb) return NextResponse.json({ error: "Estabelecimento nÃ£o encontrado." }, { status: 404 });
      const col = `upgrade_${upgradeType}` as keyof typeof pb;
      if (pb[col]) return NextResponse.json({ error: "JÃ¡ tens este upgrade!" }, { status: 400 });

      // Enforce purchase order: must own all previous upgrades first
      const orderIdx = UPGRADE_ORDER.indexOf(upgradeType);
      for (let i = 0; i < orderIdx; i++) {
        const prevCol = `upgrade_${UPGRADE_ORDER[i]}` as keyof typeof pb;
        if (!pb[prevCol]) {
          const prevLabel = UPGRADE_ORDER[i].replace("_", " ");
          return NextResponse.json({ error: `Compra primeiro o upgrade "${prevLabel}"!` }, { status: 400 });
        }
      }

      if (player.cash < cost)
        return NextResponse.json({ error: `Precisas de ${cost.toLocaleString()}!` }, { status: 400 });
      await supabase.from("crime_players").update({ cash: player.cash - cost }).eq("id", player.id);
      const slotBonus = UPGRADE_SLOT_BONUS[upgradeType] ?? 0;
      const updatePayload: Record<string, unknown> = { [col]: true };
      if (slotBonus > 0) updatePayload.max_employees = pb.max_employees + slotBonus;
      await supabase.from("player_brothels").update(updatePayload).eq("id", playerBrothelId);
      const slotMsg = slotBonus > 0 ? ` (+${slotBonus} vagas de worker)` : "";
      return NextResponse.json({ success: true, message: `Upgrade aplicado!${slotMsg}` });
    }

    /* â”€â”€ COLLECT INCOME â”€â”€ */
    if (action === "collect") {
      const { playerBrothelId } = body;

      // Fetch brothel state
      const { data: pb } = await supabase
        .from("player_brothels").select("*, brothel_type:brothel_types(*)")
        .eq("id", playerBrothelId).eq("player_id", player.id).single();
      if (!pb) return NextResponse.json({ error: "Estabelecimento nÃ£o encontrado." }, { status: 404 });

      const { data: workers } = await supabase
        .from("brothel_workers").select("*")
        .eq("player_brothel_id", playerBrothelId).eq("status", "healthy");

      if (!workers || workers.length === 0)
        return NextResponse.json({ error: "Sem workers saudÃ¡veis neste estabelecimento!" }, { status: 400 });

      // Time-based (max 24h)
      const now = new Date();
      const lastRaw = pb.last_collection ?? pb.purchased_at ?? now.toISOString();
      const hoursPassed = Math.min((now.getTime() - new Date(lastRaw).getTime()) / 3_600_000, 24);
      if (hoursPassed < 1 / 60)
        return NextResponse.json({ error: "Aguarda um pouco antes de recolher novamente!" }, { status: 400 });

      // Compute income
      let baseIncome = workers.reduce((s, w) => s + w.income_per_hour, 0);

      // Supply multipliers
      const drinkMod    = 0.7 + (pb.supply_drinks    / 100) * 0.3;
      const hygieneMod  = 0.7 + (pb.supply_hygiene   / 100) * 0.3;
      const clientMod   = pb.client_satisfaction / 100;

      // Upgrade bonuses
      let upgradeMult = 1.0;
      if (pb.upgrade_vip_rooms)  upgradeMult += 0.25;
      if (pb.upgrade_lighting)   upgradeMult += 0.10;
      if (pb.upgrade_marketing)  upgradeMult += 0.15;

      baseIncome = Math.floor(baseIncome * drinkMod * hygieneMod * clientMod * upgradeMult);
      if (player.class === "pimp") baseIncome = Math.floor(baseIncome * 1.2);

      const collected = Math.floor(baseIncome * hoursPassed);

      // Degrade supplies after collection
      const newDrinks   = Math.max(0, pb.supply_drinks   - Math.floor(hoursPassed * 4));
      const newHygiene  = Math.max(0, pb.supply_hygiene  - Math.floor(hoursPassed * 3));
      const newSecurity = Math.max(0, pb.supply_security - Math.floor(hoursPassed * 2));

      // Degrade worker happiness slightly
      for (const w of workers) {
        const newHappiness = Math.max(10, w.happiness - Math.floor(hoursPassed * 2));
        await supabase.from("brothel_workers").update({ happiness: newHappiness }).eq("id", w.id);
      }

      // Update client satisfaction based on supplies avg
      const newSatisfaction = Math.floor((newDrinks + newHygiene + newSecurity) / 3);

      await supabase.from("crime_players").update({
        cash: player.cash + collected,
        last_brothel_collect_at: now.toISOString(),
      }).eq("id", player.id);

      await supabase.from("player_brothels").update({
        last_collection: now.toISOString(),
        supply_drinks:   newDrinks,
        supply_hygiene:  newHygiene,
        supply_security: newSecurity,
        client_satisfaction: newSatisfaction,
        total_earned: pb.total_earned + collected,
      }).eq("id", playerBrothelId);

      // XP
      const xpEarned = Math.max(5, Math.floor(collected / 1000));
      const { data: xpPlayer } = await supabase
        .from("crime_players").select("xp, level, xp_to_next_level").eq("id", player.id).single();
      if (xpPlayer) {
        let newXP = xpPlayer.xp + xpEarned;
        let newLevel = xpPlayer.level;
        while (newXP >= xpPlayer.xp_to_next_level) { newXP -= xpPlayer.xp_to_next_level; newLevel++; }
        await supabase.from("crime_players").update({
          xp: newXP, level: newLevel,
          xp_to_next_level: Math.floor(100 * Math.pow(1.25, newLevel - 1)),
        }).eq("id", player.id);
      }

      // Maybe spawn random event (20% chance)
      if (Math.random() < 0.20) {
        const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        await supabase.from("brothel_events").insert({
          player_id: player.id,
          player_brothel_id: playerBrothelId,
          event_type: ev.type,
          title: ev.title,
          description: ev.description,
          choices: ev.choices,
        });
      }

      return NextResponse.json({
        success: true, collected, xp_earned: xpEarned,
        supply_drinks: newDrinks, supply_hygiene: newHygiene, supply_security: newSecurity,
        message: `Recolheste $${collected.toLocaleString()}!`,
      });
    }

    /* â”€â”€ RESOLVE EVENT â”€â”€ */
    if (action === "resolve_event") {
      const { eventId, choice } = body;
      const { data: ev } = await supabase
        .from("brothel_events").select("*").eq("id", eventId).eq("player_id", player.id).single();
      if (!ev || ev.resolved) return NextResponse.json({ error: "Evento invÃ¡lido." }, { status: 404 });

      const choices = ev.choices as Array<{ label: string; action: string; reward_cash: number; reward_xp: number }>;
      const chosen = choices?.find((c) => c.action === choice);
      if (!chosen) return NextResponse.json({ error: "Escolha invÃ¡lida." }, { status: 400 });

      // Apply reward
      let message = "";
      if (chosen.reward_cash > 0) {
        const { data: fp } = await supabase.from("crime_players").select("dirty_cash").eq("id", player.id).single();
        await supabase.from("crime_players").update({ dirty_cash: (fp?.dirty_cash ?? 0) + chosen.reward_cash }).eq("id", player.id);
        message = `+$${chosen.reward_cash.toLocaleString()} ganhos!`;
      } else if (chosen.reward_cash < 0) {
        const { data: fp } = await supabase.from("crime_players").select("cash").eq("id", player.id).single();
        await supabase.from("crime_players").update({ cash: Math.max(0, (fp?.cash ?? 0) + chosen.reward_cash) }).eq("id", player.id);
        message = `Pagaste $${Math.abs(chosen.reward_cash).toLocaleString()}.`;
      }

      // Special consequences
      if (choice === "ignore_unhappy") {
        // Fire a random worker from that brothel
        const { data: ws } = await supabase.from("brothel_workers")
          .select("id").eq("player_brothel_id", ev.player_brothel_id).limit(1);
        if (ws && ws.length > 0) {
          await supabase.from("brothel_workers").delete().eq("id", ws[0].id);
          message = "Uma worker foi embora por estar insatisfeita!";
        }
      }
      if (choice === "police_risk") {
        // Increase heat
        const { data: pb } = await supabase.from("player_brothels").select("heat_level").eq("id", ev.player_brothel_id).single();
        await supabase.from("player_brothels").update({ heat_level: Math.min(100, (pb?.heat_level ?? 0) + 30) }).eq("id", ev.player_brothel_id);
        message = "A polÃ­cia aumentou a vigilÃ¢ncia!";
      }

      await supabase.from("brothel_events").update({ resolved: true, resolved_choice: choice }).eq("id", eventId);
      return NextResponse.json({ success: true, message: message || "Evento resolvido." });
    }

    /* ── PAY WORKER BONUS ── */
    if (action === "pay_worker_bonus") {
      const { workerId } = body;
      const bonus = 2000;
      if (player.cash < bonus) return NextResponse.json({ error: "Dinheiro insuficiente!" }, { status: 400 });
      await supabase.from("crime_players").update({ cash: player.cash - bonus }).eq("id", player.id);
      await supabase.from("brothel_workers")
        .update({ happiness: 100, mood: Math.min(100, 80) })
        .eq("id", workerId).eq("player_id", player.id);
      return NextResponse.json({ success: true, message: "Worker feliz novamente!" });
    }

    /* ── RAID RESULT ── */
    if (action === "raid_result") {
      const { playerBrothelId, escaped, cashAtRisk } = body as {
        playerBrothelId: string; escaped: boolean; cashAtRisk: number;
      };
      const { data: pb } = await supabase
        .from("player_brothels").select("*").eq("id", playerBrothelId).eq("player_id", player.id).single();
      if (!pb) return NextResponse.json({ error: "Estabelecimento não encontrado." }, { status: 404 });

      if (escaped) {
        // Heat drops, player earns bonus XP for escaping
        const newHeat = Math.max(0, pb.heat_level - 35);
        await supabase.from("player_brothels")
          .update({ heat_level: newHeat }).eq("id", playerBrothelId);

        const xpGain = 50;
        const { data: xpPlayer } = await supabase
          .from("crime_players").select("xp, level, xp_to_next_level").eq("id", player.id).single();
        if (xpPlayer) {
          let newXP = xpPlayer.xp + xpGain;
          let newLevel = xpPlayer.level;
          while (newXP >= xpPlayer.xp_to_next_level) { newXP -= xpPlayer.xp_to_next_level; newLevel++; }
          await supabase.from("crime_players").update({
            xp: newXP, level: newLevel,
            xp_to_next_level: Math.floor(100 * Math.pow(1.25, newLevel - 1)),
          }).eq("id", player.id);
        }
        return NextResponse.json({
          success: true,
          message: `Fugiste! +${xpGain} XP. Calor: ${pb.heat_level}% → ${newHeat}%`,
        });
      } else {
        // Arrested: lose pending cash, reset heat, tank satisfaction
        const cashLost = Math.min(Math.max(0, cashAtRisk), player.cash);
        await supabase.from("crime_players")
          .update({ cash: player.cash - cashLost }).eq("id", player.id);
        await supabase.from("player_brothels").update({
          heat_level: 0,
          client_satisfaction: Math.max(10, pb.client_satisfaction - 30),
        }).eq("id", playerBrothelId);
        return NextResponse.json({
          success: true,
          cashLost,
          message: `Foste preso! -$${cashLost.toLocaleString()} confiscado. Estabelecimento penalizado.`,
        });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/crime-empire/brothels error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

