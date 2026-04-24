import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { generateEscapeToken } from "@/lib/crime-empire/arrest-helpers";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function grantXP(playerId: string, xpEarned: number) {
  if (xpEarned <= 0) return;
  const { data: p } = await supabase.from("crime_players").select("xp, level, xp_to_next_level").eq("id", playerId).single();
  if (!p) return;
  let newXP = p.xp + xpEarned;
  let newLevel = p.level;
  while (newXP >= p.xp_to_next_level) { newXP -= p.xp_to_next_level; newLevel++; }
  const newXPToNext = Math.floor(100 * Math.pow(1.25, newLevel - 1));
  await supabase.from("crime_players").update({ xp: newXP, level: newLevel, xp_to_next_level: newXPToNext }).eq("id", playerId);
}

/* ── GET — roadmap + player progress ── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, cash, dirty_cash, hp, max_hp, stamina, max_stamina, class, addiction, in_jail")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // All enabled contracts ordered by roadmap_level, then difficulty
  const { data: contracts } = await supabase
    .from("contract_targets")
    .select("*")
    .eq("enabled", true)
    .order("roadmap_level", { ascending: true })
    .order("difficulty", { ascending: true });

  // Player's completed / active contracts
  const { data: playerContracts } = await supabase
    .from("player_contracts")
    .select("*")
    .eq("player_id", player.id);

  return NextResponse.json({
    contracts: contracts || [],
    playerContracts: playerContracts || [],
    player: {
      id: player.id,
      level: player.level,
      cash: player.cash,
      dirty_cash: player.dirty_cash,
      hp: player.hp,
      max_hp: player.max_hp,
      stamina: player.stamina,
      max_stamina: player.max_stamina,
      class: player.class,
      addiction: player.addiction ?? 0,
      in_jail: player.in_jail,
    },
  });
}

/* ── POST — attempt a contract ── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { contractId } = await req.json();
  if (!contractId) return NextResponse.json({ error: "contractId required" }, { status: 400 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.in_jail) {
    const releaseAt = new Date(player.jail_release_at);
    if (releaseAt > new Date()) {
      return NextResponse.json({ error: "Estás na prisão" }, { status: 403 });
    }
  }

  if (player.hp <= 0) {
    return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
  }

  const { data: contract } = await supabase
    .from("contract_targets")
    .select("*")
    .eq("id", contractId)
    .eq("enabled", true)
    .single();

  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });

  // Level requirement
  if (player.level < contract.required_level) {
    return NextResponse.json({ error: `Precisas de Nível ${contract.required_level} para este contrato` }, { status: 403 });
  }

  // Stamina check
  if (player.stamina < contract.stamina_cost) {
    return NextResponse.json({ error: "Stamina insuficiente" }, { status: 403 });
  }

  // Only allow one contract per roadmap level at a time — check if there's already a completed one at this level
  const { data: existing } = await supabase
    .from("player_contracts")
    .select("id, status, contract_id")
    .eq("player_id", player.id)
    .in("status", ["pending", "completed"])
    .limit(100);

  const completedAtLevel = (existing || []).some((pc: any) => {
    // We need to check roadmap_level — we'd need to join, but we have contracts list
    return pc.contract_id === contractId && pc.status === "completed";
  });
  if (completedAtLevel) {
    return NextResponse.json({ error: "Já completaste este contrato" }, { status: 400 });
  }

  // Check player hasn't already completed ANY contract at this roadmap_level
  const { data: sameLevel } = await supabase
    .from("player_contracts")
    .select("id, status, contract_targets(roadmap_level)")
    .eq("player_id", player.id)
    .eq("status", "completed");

  const alreadyDoneThisLevel = (sameLevel || []).some((pc: any) => {
    const ct = Array.isArray(pc.contract_targets) ? pc.contract_targets[0] : pc.contract_targets;
    return ct?.roadmap_level === contract.roadmap_level;
  });

  if (alreadyDoneThisLevel) {
    return NextResponse.json({ error: "Já completaste um contrato neste nível da rota" }, { status: 400 });
  }

  // Build success rate
  let successRate = contract.base_success_rate;

  // Hitman class bonus
  if (player.class === "hitman") {
    successRate = Math.min(0.95, successRate + (contract.hitman_bonus ?? 0.15));
  }

  // Prestige bonus
  const prestigeBonus = Math.min(player.prestige_level * 0.02, 0.20);
  successRate += prestigeBonus;

  // Addiction debuff
  const addictionPenalty = ((player.addiction || 0) / 100) * 0.5;
  const effectiveRate = Math.max(0.03, successRate * (1 - addictionPenalty));

  const success = Math.random() <= effectiveRate;

  // Deduct stamina regardless
  const newStamina = player.stamina - contract.stamina_cost;

  if (success) {
    // Reward
    const cash = Math.floor(Math.random() * (contract.max_cash - contract.min_cash + 1)) + contract.min_cash;

    await supabase.from("crime_players").update({
      stamina: newStamina,
      cash: player.cash + cash,
      respect: player.respect + contract.respect_reward,
    }).eq("id", player.id);

    await supabase.from("player_contracts").insert({
      player_id: player.id,
      contract_id: contractId,
      status: "completed",
      cash_reward: cash,
      respect_reward: contract.respect_reward,
    });

    const xpEarned = Math.max(10, Math.floor(cash / 500));
    await grantXP(player.id, xpEarned);

    return NextResponse.json({
      success: true,
      message: `Contrato concluído! Alvo eliminado.`,
      cash_earned: cash,
      respect_earned: contract.respect_reward,
      xp_earned: xpEarned,
      new_stamina: newStamina,
    });
  } else {
    // Failure — player goes to hospital with 0 HP
    // Hitman has reduced arrest chance
    const baseArrest = contract.arrest_chance ?? 0.3;
    const arrestChance = player.class === "hitman"
      ? baseArrest * (1 - (contract.hitman_arrest_reduction ?? 0.5))
      : baseArrest;

    const arrested = Math.random() <= arrestChance;

    const updates: Record<string, unknown> = {
      hp: 0,
      stamina: newStamina,
    };

    let jailMsg = "";
    let contractJailMinutes = 0;
    if (arrested) {
      contractJailMinutes = 30 + Math.floor(Math.random() * 60); // 30-90 min
      const releaseAt = new Date(Date.now() + contractJailMinutes * 60000).toISOString();
      const et = generateEscapeToken();
      updates.in_jail = true;
      updates.jail_release_at = releaseAt;
      updates.escape_token = et.escape_token;
      updates.escape_token_expires_at = et.escape_token_expires_at;
      jailMsg = ` Foste capturado e enviado para a prisão por ${contractJailMinutes} minutos.`;
    }

    await supabase.from("crime_players").update(updates).eq("id", player.id);

    if (arrested) {
      await supabase.from("player_notifications").insert({
        player_id: player.id,
        type: "jail_released",
        title: "🚔 Apanhado no Contrato!",
        message: `O teu alvo escapou.${jailMsg}`,
      });
    }

    await supabase.from("player_contracts").insert({
      player_id: player.id,
      contract_id: contractId,
      status: "failed",
      cash_reward: 0,
      respect_reward: 0,
    });

    return NextResponse.json({
      success: false,
      arrested,
      escape_token: arrested ? (updates.escape_token as string) : null,
      jail_time_minutes: contractJailMinutes,
      message: `O alvo escapou! Foste enviado para o Hospital com 0 HP.${jailMsg}`,
      new_stamina: newStamina,
    });
  }
}
