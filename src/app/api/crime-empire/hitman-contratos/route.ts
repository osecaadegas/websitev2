import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { grantXP } from "@/lib/crime-empire/xp";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Minimum bounty price based on target level */
function minBounty(targetLevel: number): number {
  return Math.max(10_000, targetLevel * 3_000);
}

/** Hit success rate: 50% base ± 2% per level difference, clamped [20%, 80%] */
function hitSuccessRate(executorLevel: number, targetLevel: number): number {
  const raw = 0.50 + (executorLevel - targetLevel) * 0.02;
  return Math.min(0.80, Math.max(0.20, raw));
}

/* ── GET — list bounties + player info ──────────────────────── */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase() ?? "";

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, level, cash, dirty_cash, class, display_name, username, in_jail, hp")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Open bounties that have not expired and are not placed by/targeting self
  const { data: openBounties } = await supabase
    .from("hitman_contracts")
    .select("*")
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .neq("requester_id", player.id)
    .neq("target_id", player.id)
    .order("reward_cash", { ascending: false })
    .limit(50);

  // Player's own placed bounties
  const { data: myBounties } = await supabase
    .from("hitman_contracts")
    .select("*")
    .eq("requester_id", player.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Player search (for placing bounty)
  let searchResults: { id: string; username: string; display_name: string; level: number; class: string }[] = [];
  if (search.length >= 2) {
    const { data } = await supabase
      .from("crime_players")
      .select("id, username, display_name, level, class")
      .ilike("username", `%${search}%`)
      .neq("user_id", user.id)
      .limit(8);
    searchResults = data ?? [];
  }

  return NextResponse.json({
    player: {
      id: player.id,
      level: player.level,
      cash: player.cash,
      dirty_cash: player.dirty_cash,
      class: player.class,
      display_name: player.display_name,
      username: player.username,
      in_jail: player.in_jail,
      hp: player.hp,
    },
    openBounties: openBounties ?? [],
    myBounties: myBounties ?? [],
    searchResults,
  });
}

/* ── POST — place or execute a hitman contract ──────────────── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  const { data: player } = await supabase
    .from("crime_players")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  /* ── PLACE BOUNTY ── */
  if (action === "place") {
    const { targetId, reward, message } = body as { targetId: string; reward: number; message?: string };

    if (!targetId || !reward) {
      return NextResponse.json({ error: "targetId e reward são obrigatórios" }, { status: 400 });
    }

    // Can't target self
    if (targetId === player.id) {
      return NextResponse.json({ error: "Não podes colocar um contrato em ti mesmo" }, { status: 400 });
    }

    // Fetch target
    const { data: target } = await supabase
      .from("crime_players")
      .select("id, level, username, display_name")
      .eq("id", targetId)
      .single();

    if (!target) return NextResponse.json({ error: "Alvo não encontrado" }, { status: 404 });

    // Minimum price check
    const minimum = minBounty(target.level);
    if (reward < minimum) {
      return NextResponse.json({
        error: `Recompensa mínima para nível ${target.level} é $${minimum.toLocaleString()}`,
      }, { status: 400 });
    }

    // Player must have enough cash
    if (player.cash < reward) {
      return NextResponse.json({ error: "Dinheiro insuficiente" }, { status: 400 });
    }

    // Deduct reward from player's cash
    await supabase
      .from("crime_players")
      .update({ cash: player.cash - reward })
      .eq("id", player.id);

    // Create bounty
    const { data: bounty, error: insertErr } = await supabase
      .from("hitman_contracts")
      .insert({
        requester_id: player.id,
        target_id: target.id,
        target_username: target.username,
        target_display_name: target.display_name ?? target.username,
        target_level: target.level,
        reward_cash: reward,
        message: message ?? null,
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Notify target that a bounty was placed on them
    await supabase.from("player_notifications").insert({
      player_id: target.id,
      type: "hitman_bounty",
      title: "⚠️ Contrato na tua cabeça!",
      message: `Alguém colocou um contrato de $${reward.toLocaleString()} na tua cabeça. Tem cuidado nas ruas.`,
    });

    return NextResponse.json({
      success: true,
      message: `Contrato colocado! $${reward.toLocaleString()} em jogo.`,
      bounty,
    });
  }

  /* ── EXECUTE BOUNTY ── */
  if (action === "execute") {
    const { contractId } = body as { contractId: string };
    if (!contractId) return NextResponse.json({ error: "contractId obrigatório" }, { status: 400 });

    // Player must not be in jail or at 0 HP
    if (player.in_jail) return NextResponse.json({ error: "Estás na prisão" }, { status: 403 });
    if (player.hp <= 0) return NextResponse.json({ error: "Estás no hospital" }, { status: 403 });

    // Fetch contract
    const { data: contract } = await supabase
      .from("hitman_contracts")
      .select("*")
      .eq("id", contractId)
      .eq("status", "open")
      .single();

    if (!contract) return NextResponse.json({ error: "Contrato não encontrado ou já encerrado" }, { status: 404 });

    // Can't execute own bounty or target self
    if (contract.requester_id === player.id) {
      return NextResponse.json({ error: "Não podes executar o teu próprio contrato" }, { status: 400 });
    }
    if (contract.target_id === player.id) {
      return NextResponse.json({ error: "Não podes ser o alvo do teu próprio contrato" }, { status: 400 });
    }

    // Check not expired
    if (new Date(contract.expires_at) < new Date()) {
      await supabase.from("hitman_contracts").update({ status: "cancelled" }).eq("id", contract.id);
      return NextResponse.json({ error: "Este contrato expirou" }, { status: 400 });
    }

    // Fetch target
    const { data: target } = await supabase
      .from("crime_players")
      .select("id, level, hp, max_hp, cash, dirty_cash, in_jail")
      .eq("id", contract.target_id)
      .single();

    if (!target) return NextResponse.json({ error: "Alvo não encontrado" }, { status: 404 });

    // Roll success
    const successRate = hitSuccessRate(player.level, target.level);
    const success = Math.random() <= successRate;

    if (success) {
      // Mark contract completed
      await supabase.from("hitman_contracts").update({
        status: "completed",
        executed_by: player.id,
        executed_at: new Date().toISOString(),
      }).eq("id", contract.id);

      // Damage target — drop to 0 HP (hospital)
      const newTargetHp = 0;
      await supabase.from("crime_players").update({ hp: newTargetHp }).eq("id", target.id);

      // Pay executor
      await supabase.from("crime_players").update({
        cash: player.cash + contract.reward_cash,
        dirty_cash: player.dirty_cash,
      }).eq("id", player.id);

      // XP for executor
      const xpEarned = Math.max(200, Math.floor(contract.reward_cash / 1000));
      await grantXP(player.id, xpEarned);

      // Notify target
      await supabase.from("player_notifications").insert({
        player_id: target.id,
        type: "hitman_hit",
        title: "🔫 Foste eliminado!",
        message: `Um assassino completou um contrato contra ti. Foste enviado para o hospital com 0 HP.`,
      });

      return NextResponse.json({
        success: true,
        message: "Alvo eliminado. Contrato completo.",
        cash_earned: contract.reward_cash,
        xp_earned: xpEarned,
        success_rate: Math.round(successRate * 100),
      });
    } else {
      // Failure — mark failed, executor takes some damage
      await supabase.from("hitman_contracts").update({
        status: "failed",
        executed_by: player.id,
        executed_at: new Date().toISOString(),
      }).eq("id", contract.id);

      const executorDamage = Math.floor(player.hp * 0.40);
      const newExecutorHp = Math.max(0, player.hp - executorDamage);
      await supabase.from("crime_players").update({ hp: newExecutorHp }).eq("id", player.id);

      // Refund half the bounty to the requester
      const { data: requester } = await supabase
        .from("crime_players")
        .select("id, cash")
        .eq("id", contract.requester_id)
        .single();

      if (requester) {
        const refund = Math.floor(contract.reward_cash * 0.5);
        await supabase.from("crime_players").update({ cash: requester.cash + refund }).eq("id", requester.id);
        await supabase.from("player_notifications").insert({
          player_id: requester.id,
          type: "hitman_failed",
          title: "❌ Contrato falhado",
          message: `O assassino falhou o contrato. Recebeste um reembolso de $${refund.toLocaleString()}.`,
        });
      }

      return NextResponse.json({
        success: false,
        message: "O alvo escapou. Foste ferido.",
        hp_lost: executorDamage,
        success_rate: Math.round(successRate * 100),
      });
    }
  }

  /* ── CANCEL BOUNTY ── */
  if (action === "cancel") {
    const { contractId } = body as { contractId: string };
    if (!contractId) return NextResponse.json({ error: "contractId obrigatório" }, { status: 400 });

    const { data: contract } = await supabase
      .from("hitman_contracts")
      .select("*")
      .eq("id", contractId)
      .eq("requester_id", player.id)
      .eq("status", "open")
      .single();

    if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });

    // Refund 75% of the bounty
    const refund = Math.floor(contract.reward_cash * 0.75);
    await supabase.from("crime_players").update({ cash: player.cash + refund }).eq("id", player.id);
    await supabase.from("hitman_contracts").update({ status: "cancelled" }).eq("id", contract.id);

    return NextResponse.json({
      success: true,
      message: `Contrato cancelado. Reembolso de $${refund.toLocaleString()}.`,
      refund,
    });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
