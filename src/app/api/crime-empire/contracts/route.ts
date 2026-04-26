import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { generateEscapeToken } from "@/lib/crime-empire/arrest-helpers";
import { grantXP } from "@/lib/crime-empire/xp";
import { trackMissionEvent } from "@/lib/crime-empire/missions";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
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

  // Prevent completing the same contract twice
  const { data: alreadyDone } = await supabase
    .from("player_contracts")
    .select("id")
    .eq("player_id", player.id)
    .eq("contract_id", contractId)
    .eq("status", "completed")
    .limit(1);

  if ((alreadyDone ?? []).length > 0) {
    return NextResponse.json({ error: "Já completaste este contrato" }, { status: 400 });
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

  // Roadmap level scaling: each phase above 1 is harder but more rewarding
  const levelIndex = Math.max(0, (contract.roadmap_level || 1) - 1);
  const levelSuccessPenalty = levelIndex * 0.05; // -5% success rate per phase
  const scaledRate = Math.max(0.03, effectiveRate - levelSuccessPenalty);

  const success = Math.random() <= scaledRate;

  // Deduct stamina regardless
  const newStamina = player.stamina - contract.stamina_cost;

  if (success) {
    // Reward — higher phases pay more to compensate for increased difficulty
    const rewardMultiplier = 1 + levelIndex * 0.30; // +30% per phase above 1
    const cash = Math.floor((Math.random() * (contract.max_cash - contract.min_cash + 1) + contract.min_cash) * rewardMultiplier);
    const respectEarned = Math.round(contract.respect_reward * rewardMultiplier);

    await supabase.from("crime_players").update({
      stamina: newStamina,
      cash: player.cash + cash,
      respect: player.respect + respectEarned,
    }).eq("id", player.id);

    // Upsert so that retrying a previously-failed contract works
    await supabase.from("player_contracts").upsert({
      player_id: player.id,
      contract_id: contractId,
      status: "completed",
      cash_reward: cash,
      respect_reward: respectEarned,
    }, { onConflict: "player_id,contract_id" });

    const xpRaw = contract.xp_reward ?? Math.max(10, Math.floor(cash / 500));
    const xpEarned = Math.floor(xpRaw * (1 + 0.01 * (player.level ?? 1)));
    await grantXP(player.id, xpEarned, "contract");
    void trackMissionEvent(player.id, "onContractCompleted", 1, { difficulty: contract.difficulty });

    return NextResponse.json({
      success: true,
      message: `Contrato concluído! Alvo eliminado.`,
      cash_earned: cash,
      respect_earned: respectEarned,
      xp_earned: xpEarned,
      new_stamina: newStamina,
    });
  } else {
    // Failure — player goes to hospital with 0 HP
    // Hitman has reduced arrest chance; higher phases have increased arrest chance
    const baseArrest = contract.arrest_chance ?? 0.3;
    const levelArrestBonus = levelIndex * 0.08; // +8% arrest chance per phase above 1
    const scaledArrest = Math.min(0.90, baseArrest + levelArrestBonus);
    const arrestChance = player.class === "hitman"
      ? scaledArrest * (1 - (contract.hitman_arrest_reduction ?? 0.5))
      : scaledArrest;

    const arrested = Math.random() <= arrestChance;

    const updates: Record<string, unknown> = {
      hp: 0,
      stamina: newStamina,
    };

    let jailMsg = "";
    let contractJailMinutes = 0;
    if (arrested) {
      contractJailMinutes = (30 + Math.floor(Math.random() * 60)) + levelIndex * 15; // +15 min per phase
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

    // Upsert so that retrying a previously-failed contract works
    await supabase.from("player_contracts").upsert({
      player_id: player.id,
      contract_id: contractId,
      status: "failed",
      cash_reward: 0,
      respect_reward: 0,
    }, { onConflict: "player_id,contract_id" });

    void trackMissionEvent(player.id, "onContractFailed", 1);

    return NextResponse.json({
      success: false,
      arrested,
      escape_token: arrested ? (updates.escape_token as string) : null,
      jail_time_minutes: contractJailMinutes,
      roadmap_level: contract.roadmap_level,
      message: `O alvo escapou! Foste enviado para o Hospital com 0 HP.${jailMsg}`,
      new_stamina: newStamina,
    });
  }
}
