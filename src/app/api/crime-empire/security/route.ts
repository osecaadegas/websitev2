import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const BROTHEL_TYPES = ["brothel_basic", "brothel_upgraded", "brothel_luxury", "brothel_exclusive", "brothel_empire"];

export const SECURITY_COSTS: Record<string, number> = {
  basic: 3500,
  advanced: 9000,
  elite: 22000,
};

// Multiplier applied to base 15%/day event chance
const SECURITY_MULT: Record<string, number> = {
  none: 1.0,
  basic: 0.40,
  advanced: 0.20,
  elite: 0.05,
};

// Fraction of sick workers healed per security check-in
const HEAL_RATE: Record<string, number> = {
  basic: 0.50,
  advanced: 0.75,
  elite: 1.00,
};

async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ─────────── GET — fetch state + run worker events ─────────── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, cash, dirty_cash, level, class")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const { data: ownedBusinesses } = await supabase
    .from("player_businesses")
    .select("*, business:businesses(*)")
    .eq("player_id", player.id);

  const { data: brothelWorkers } = await supabase
    .from("brothel_workers")
    .select("*")
    .eq("player_id", player.id);

  const now = new Date();
  const firedEvents: Array<{ businessName: string; eventType: string; message: string }> = [];

  // Mutable copy so we can reflect changes within the loop
  const workers = [...(brothelWorkers || [])];

  for (const pb of ownedBusinesses || []) {
    const business = pb.business;
    if (!business) continue;

    const isBrothel = BROTHEL_TYPES.includes(business.type);
    const lastVisited = new Date(pb.last_visited_at || pb.purchased_at || now);
    const hoursAbsent = (now.getTime() - lastVisited.getTime()) / (1000 * 60 * 60);
    const daysAbsent = Math.floor(hoursAbsent / 24);

    const securityActive = pb.security_expires_at && new Date(pb.security_expires_at) > now;
    const tier = securityActive ? (pb.security_tier || "none") : "none";
    const mult = SECURITY_MULT[tier] ?? 1.0;

    let employeesDelta = 0;
    let sickDelta = 0;

    // Roll one event per absent day (grace: first 24h free, cap at 7 days)
    const rollDays = Math.min(Math.max(0, daysAbsent - 1), 7);
    const baseChance = 0.15;

    for (let d = 0; d < rollDays; d++) {
      if (Math.random() >= baseChance * mult) continue;

      const roll = Math.random();

      if (isBrothel) {
        const healthy = workers.filter((w) => w.status === "healthy");
        if (healthy.length === 0) break;
        const target = healthy[Math.floor(Math.random() * healthy.length)];

        if (roll < 0.55) {
          await supabase.from("brothel_workers").update({ status: "sick" }).eq("id", target.id);
          target.status = "sick";
          firedEvents.push({ businessName: business.name, eventType: "sick", message: `${target.name} ficou doente em ${business.name}` });
        } else if (roll < 0.85) {
          await supabase.from("brothel_workers").update({ status: "leaving" }).eq("id", target.id);
          target.status = "leaving";
          firedEvents.push({ businessName: business.name, eventType: "left", message: `${target.name} quer abandonar ${business.name}` });
        } else {
          await supabase.from("brothel_workers").delete().eq("id", target.id);
          const idx = workers.findIndex((w) => w.id === target.id);
          if (idx !== -1) workers.splice(idx, 1);
          firedEvents.push({ businessName: business.name, eventType: "died", message: `${target.name} morreu em ${business.name}` });
        }
      } else {
        if (pb.employees <= 0 && (pb.sick_workers || 0) <= 0) continue;

        if (roll < 0.55) {
          sickDelta++;
          firedEvents.push({ businessName: business.name, eventType: "sick", message: `Um trabalhador ficou doente em ${business.name}` });
        } else if (roll < 0.85) {
          if (pb.employees > 0) {
            employeesDelta--;
            firedEvents.push({ businessName: business.name, eventType: "left", message: `Um trabalhador abandonou ${business.name}` });
          }
        } else {
          if (pb.employees > 0) {
            employeesDelta--;
            firedEvents.push({ businessName: business.name, eventType: "died", message: `Um trabalhador morreu em ${business.name}` });
          }
        }
      }
    }

    // Security active: heal sick workers
    if (securityActive) {
      const healRate = HEAL_RATE[tier] ?? 0;
      if (isBrothel) {
        const sickW = workers.filter((w) => w.status === "sick");
        for (const w of sickW) {
          if (Math.random() < healRate) {
            await supabase.from("brothel_workers").update({ status: "healthy" }).eq("id", w.id);
            w.status = "healthy";
          }
        }
      } else {
        const currentSick = (pb.sick_workers || 0) + sickDelta;
        const healed = Math.min(currentSick, Math.ceil(currentSick * healRate));
        if (healed > 0) {
          sickDelta -= healed;
          firedEvents.push({ businessName: business.name, eventType: "healed", message: `${healed} trabalhador(es) recuperaram em ${business.name}` });
        }
      }
    }

    // Apply deltas for regular businesses
    if (!isBrothel && (employeesDelta !== 0 || sickDelta !== 0)) {
      const newEmployees = Math.max(0, pb.employees + employeesDelta);
      const newSick = Math.max(0, Math.min(newEmployees, (pb.sick_workers || 0) + sickDelta));
      await supabase
        .from("player_businesses")
        .update({ employees: newEmployees, sick_workers: newSick })
        .eq("id", pb.id);
      pb.employees = newEmployees;
      pb.sick_workers = newSick;
    }
  }

  // Update last_visited_at for all businesses
  if (ownedBusinesses && ownedBusinesses.length > 0) {
    await supabase
      .from("player_businesses")
      .update({ last_visited_at: now.toISOString() })
      .in("id", ownedBusinesses.map((b) => b.id));
  }

  // Push significant worker events to player_notifications
  const criticalEvents = firedEvents.filter((e) => e.eventType === "left" || e.eventType === "died");
  if (criticalEvents.length > 0) {
    await supabase.from("player_notifications").insert(
      criticalEvents.map((e) => ({
        player_id: player.id,
        type: "worker_event",
        title: e.eventType === "died" ? "💀 Trabalhador Morreu!" : "🚪 Trabalhador Abandonou!",
        message: e.message,
      }))
    );
  }

  return NextResponse.json({
    businesses: ownedBusinesses || [],
    brothelWorkers: workers,
    player,
    events: firedEvents,
    securityCosts: SECURITY_COSTS,
  });
}

/* ─────────── POST — hire security / dismiss worker ─────────── */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: player } = await supabase
    .from("crime_players")
    .select("id, cash")
    .eq("user_id", user.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  /* ── Hire security ── */
  if (action === "hire_security") {
    const { playerBusinessId, tier, weeks = 1 } = body;
    const costPerWeek = SECURITY_COSTS[tier];
    if (!costPerWeek) return NextResponse.json({ error: "Tier inválido" }, { status: 400 });

    const { data: pb } = await supabase
      .from("player_businesses")
      .select("id, security_expires_at, security_tier")
      .eq("id", playerBusinessId)
      .eq("player_id", player.id)
      .single();
    if (!pb) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

    const cost = costPerWeek * weeks;
    if (player.cash < cost) {
      return NextResponse.json({ error: `Precisas de $${cost.toLocaleString()} limpos` }, { status: 403 });
    }

    const now = new Date();
    const currentExpiry = pb.security_expires_at ? new Date(pb.security_expires_at) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    await supabase
      .from("player_businesses")
      .update({ security_tier: tier, security_expires_at: newExpiry.toISOString() })
      .eq("id", pb.id);

    await supabase
      .from("crime_players")
      .update({ cash: player.cash - cost })
      .eq("id", player.id);

    return NextResponse.json({
      success: true,
      message: `Segurança ${tier} activa até ${newExpiry.toLocaleDateString("pt-PT")}`,
      cost,
      newExpiry: newExpiry.toISOString(),
    });
  }

  /* ── Dismiss leaving/sick brothel worker ── */
  if (action === "dismiss_worker") {
    const { workerId } = body;
    const { data: w } = await supabase
      .from("brothel_workers")
      .select("id, status")
      .eq("id", workerId)
      .eq("player_id", player.id)
      .single();
    if (!w) return NextResponse.json({ error: "Worker não encontrado" }, { status: 404 });

    await supabase.from("brothel_workers").delete().eq("id", workerId);
    return NextResponse.json({ success: true, message: "Worker dispensado" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
