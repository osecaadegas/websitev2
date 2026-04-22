import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export type ActivityItem = {
  id: string;
  type: "gambling" | "crime" | "pvp" | "jail";
  player_id: string;
  player_username: string;
  player_display_name: string;
  summary: string;
  amount: number;
  profit: number | null;
  created_at: string;
  details: Record<string, unknown>;
};

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = (searchParams.get("q") || "").toLowerCase();
  const typeFilter = searchParams.get("type") || "all";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo   = searchParams.get("date_to") || "";
  const LIMIT    = 150; // per source before merge

  const results: ActivityItem[] = [];

  const promises: Promise<void>[] = [];

  // ── Gambling ──────────────────────────────────────────────
  if (typeFilter === "all" || typeFilter === "gambling") {
    promises.push((async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("gambling_history")
        .select("id, game_type, bet_amount, payout, profit, created_at, player:crime_players!player_id(id, username, display_name)")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo)   q = q.lte("created_at", dateTo);
      const { data } = await q;
      if (!data) return;
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = row.player as any;
        if (search && !(p?.username ?? "").toLowerCase().includes(search)) continue;
        const profitVal = Number(row.profit);
        results.push({
          id: row.id,
          type: "gambling",
          player_id: p?.id ?? "",
          player_username: p?.username ?? "?",
          player_display_name: p?.display_name ?? p?.username ?? "?",
          summary: `${row.game_type} — aposta $${Number(row.bet_amount).toLocaleString()} → payout $${Number(row.payout).toLocaleString()}`,
          amount: Number(row.bet_amount),
          profit: profitVal,
          created_at: row.created_at,
          details: { game_type: row.game_type, bet_amount: row.bet_amount, payout: row.payout, profit: row.profit },
        });
      }
    })());
  }

  // ── Crimes ────────────────────────────────────────────────
  if (typeFilter === "all" || typeFilter === "crime") {
    promises.push((async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("crime_attempts")
        .select("id, success, went_to_jail, dirty_cash_earned, xp_earned, created_at, player:crime_players!player_id(id, username, display_name), crime:crimes!crime_id(name)")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo)   q = q.lte("created_at", dateTo);
      const { data } = await q;
      if (!data) return;
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = row.player as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = row.crime as any;
        if (search && !(p?.username ?? "").toLowerCase().includes(search)) continue;
        results.push({
          id: row.id,
          type: "crime",
          player_id: p?.id ?? "",
          player_username: p?.username ?? "?",
          player_display_name: p?.display_name ?? p?.username ?? "?",
          summary: `${c?.name ?? "Crime"} — ${row.success ? "✅ sucesso" : "❌ falhou"}${row.went_to_jail ? " 🔒 preso" : ""} · +$${Number(row.dirty_cash_earned).toLocaleString()}`,
          amount: Number(row.dirty_cash_earned),
          profit: null,
          created_at: row.created_at,
          details: { crime: c?.name, success: row.success, went_to_jail: row.went_to_jail, dirty_cash_earned: row.dirty_cash_earned, xp_earned: row.xp_earned },
        });
      }
    })());
  }

  // ── PvP ───────────────────────────────────────────────────
  if (typeFilter === "all" || typeFilter === "pvp") {
    promises.push((async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("pvp_battles")
        .select("id, winner_id, dirty_cash_stolen, respect_gained, xp_gained, created_at, attacker:crime_players!attacker_id(id, username, display_name), defender:crime_players!defender_id(id, username, display_name)")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo)   q = q.lte("created_at", dateTo);
      const { data } = await q;
      if (!data) return;
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const atk = row.attacker as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const def = row.defender as any;
        const atkName = atk?.username ?? "?";
        const defName = def?.username ?? "?";
        if (search && !atkName.toLowerCase().includes(search) && !defName.toLowerCase().includes(search)) continue;
        const attackerWon = row.winner_id === atk?.id;
        results.push({
          id: row.id,
          type: "pvp",
          player_id: atk?.id ?? "",
          player_username: atkName,
          player_display_name: atk?.display_name ?? atkName,
          summary: `${atkName} atacou ${defName} — ${attackerWon ? `✅ vitória · roubou $${Number(row.dirty_cash_stolen).toLocaleString()}` : "❌ derrota"}`,
          amount: Number(row.dirty_cash_stolen),
          profit: null,
          created_at: row.created_at,
          details: { attacker: atkName, defender: defName, winner: attackerWon ? atkName : defName, dirty_cash_stolen: row.dirty_cash_stolen, respect_gained: row.respect_gained, xp_gained: row.xp_gained },
        });
      }
    })());
  }

  // ── Jail ──────────────────────────────────────────────────
  if (typeFilter === "all" || typeFilter === "jail") {
    promises.push((async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("jail_records")
        .select("id, jail_time_minutes, release_method, amount_paid, released_early, created_at, player:crime_players!player_id(id, username, display_name), crime:crimes!crime_id(name)")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo)   q = q.lte("created_at", dateTo);
      const { data } = await q;
      if (!data) return;
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = row.player as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = row.crime as any;
        if (search && !(p?.username ?? "").toLowerCase().includes(search)) continue;
        const release = row.released_early
          ? `saiu cedo (${row.release_method ?? "?"}${row.amount_paid ? ` · $${Number(row.amount_paid).toLocaleString()}` : ""})`
          : `${row.jail_time_minutes}min preso`;
        results.push({
          id: row.id,
          type: "jail",
          player_id: p?.id ?? "",
          player_username: p?.username ?? "?",
          player_display_name: p?.display_name ?? p?.username ?? "?",
          summary: `🔒 Preso${c?.name ? ` por "${c.name}"` : ""} · ${release}`,
          amount: Number(row.amount_paid ?? 0),
          profit: null,
          created_at: row.created_at,
          details: { crime: c?.name, jail_time_minutes: row.jail_time_minutes, released_early: row.released_early, release_method: row.release_method, amount_paid: row.amount_paid },
        });
      }
    })());
  }

  await Promise.all(promises);

  // Sort merged results by created_at descending
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ activities: results.slice(0, 200) });
}
