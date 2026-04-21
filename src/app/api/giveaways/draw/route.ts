import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/* ── Auth helper ───────────────────────────────────────────── */
async function requireAdmin() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.role !== "admin" && session.role !== "configurador") return null;
    return session as { id: string; role: string; login: string };
  } catch {
    return null;
  }
}

/* ── POST — draw winner ────────────────────────────────────── */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { giveaway_id } = await request.json();
  if (!giveaway_id) return NextResponse.json({ error: "giveaway_id required" }, { status: 400 });

  // Fetch giveaway
  const { data: giveaway } = await supabase
    .from("giveaways")
    .select("*")
    .eq("id", giveaway_id)
    .single();

  if (!giveaway) return NextResponse.json({ error: "Giveaway não encontrado" }, { status: 404 });

  // Fetch participants
  const { data: participants } = await supabase
    .from("giveaway_participants")
    .select("*")
    .eq("giveaway_id", giveaway_id);

  if (!participants || participants.length === 0) {
    return NextResponse.json({ error: "Sem participantes" }, { status: 400 });
  }

  // Get existing winners to exclude from reroll
  const { data: existingWinners } = await supabase
    .from("giveaway_winners")
    .select("twitch_id")
    .eq("giveaway_id", giveaway_id);

  const winnerIds = new Set((existingWinners ?? []).map((w) => w.twitch_id));
  const eligibleParticipants = participants.filter((p) => !winnerIds.has(p.twitch_id));

  if (eligibleParticipants.length === 0) {
    return NextResponse.json({ error: "Todos os participantes já ganharam" }, { status: 400 });
  }

  let winner;

  if (giveaway.mode === "tickets") {
    // Weighted random: more tickets = higher chance
    const totalTickets = eligibleParticipants.reduce((sum, p) => sum + p.tickets, 0);
    let random = Math.random() * totalTickets;

    for (const participant of eligibleParticipants) {
      random -= participant.tickets;
      if (random <= 0) {
        winner = participant;
        break;
      }
    }
    if (!winner) winner = eligibleParticipants[eligibleParticipants.length - 1];
  } else {
    // Uniform random
    const idx = Math.floor(Math.random() * eligibleParticipants.length);
    winner = eligibleParticipants[idx];
  }

  // Save winner
  const { data: savedWinner, error: winErr } = await supabase
    .from("giveaway_winners")
    .insert({
      giveaway_id,
      twitch_id: winner.twitch_id,
      twitch_username: winner.twitch_username,
    })
    .select()
    .single();

  if (winErr) return NextResponse.json({ error: winErr.message }, { status: 500 });

  // End the giveaway
  await supabase
    .from("giveaways")
    .update({ is_active: false, is_ended: true, end_time: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", giveaway_id);

  // Send notification to winner
  await supabase.from("notifications").insert({
    user_twitch_id: winner.twitch_id,
    type: "giveaway_win",
    title: "Conquistaste a Arena!",
    message: `Parabéns! Foste o vencedor do giveaway "${giveaway.title}". Prémio: ${giveaway.prize || "A definir"}`,
  });

  return NextResponse.json({
    winner: savedWinner,
    total_participants: participants.length,
    total_tickets: participants.reduce((s, p) => s + p.tickets, 0),
    winner_tickets: winner.tickets,
  });
}
