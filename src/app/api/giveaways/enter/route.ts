import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SE_API = "https://api.streamelements.com/kappa/v2";

function getSeHeaders() {
  const token = process.env.STREAMELEMENTS_JWT_TOKEN;
  if (!token) return null;
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
}

/* ── POST — enter a giveaway ───────────────────────────────── */
export async function POST(request: Request) {
  // Auth: user must be logged in
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Inicia sessão para participar" }, { status: 401 });

  let user: { id: string; login: string; display_name: string };
  try {
    user = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  const body = await request.json();
  const { giveaway_id, ticket_count } = body;
  const requestedTickets = Math.max(1, Math.floor(ticket_count || 1));

  if (!giveaway_id) return NextResponse.json({ error: "giveaway_id required" }, { status: 400 });

  // Fetch giveaway
  const { data: giveaway, error: gErr } = await supabase
    .from("giveaways")
    .select("*")
    .eq("id", giveaway_id)
    .single();

  if (gErr || !giveaway) return NextResponse.json({ error: "Giveaway não encontrado" }, { status: 404 });
  if (!giveaway.is_active) return NextResponse.json({ error: "Este giveaway não está ativo" }, { status: 400 });
  if (giveaway.is_ended) return NextResponse.json({ error: "Este giveaway já terminou" }, { status: 400 });

  // Check end time
  if (giveaway.end_time && new Date(giveaway.end_time) < new Date()) {
    return NextResponse.json({ error: "O tempo expirou" }, { status: 400 });
  }

  // Check existing participation
  const { data: existing } = await supabase
    .from("giveaway_participants")
    .select("*")
    .eq("giveaway_id", giveaway_id)
    .eq("twitch_id", user.id)
    .maybeSingle();

  // Single mode: no re-entry
  if (giveaway.mode === "single" && existing) {
    return NextResponse.json({ error: "Já estás inscrito neste giveaway" }, { status: 400 });
  }

  // Ticket mode: check max entries
  const currentTickets = existing?.tickets ?? 0;
  const newTotal = currentTickets + requestedTickets;

  if (giveaway.max_entries_per_user && newTotal > giveaway.max_entries_per_user) {
    return NextResponse.json({
      error: `Máximo de ${giveaway.max_entries_per_user} tickets. Já tens ${currentTickets}.`,
    }, { status: 400 });
  }

  // Calculate cost
  const totalCost = giveaway.ticket_cost * requestedTickets;

  // Deduct SE points if cost > 0
  if (totalCost > 0) {
    const headers = getSeHeaders();
    const channelId = process.env.STREAMELEMENTS_CHANNEL_ID;
    if (!headers || !channelId) {
      return NextResponse.json({ error: "StreamElements não configurado" }, { status: 503 });
    }

    // Check balance
    const balRes = await fetch(`${SE_API}/points/${channelId}/${encodeURIComponent(user.login)}`, { headers });
    if (!balRes.ok) return NextResponse.json({ error: "Não foi possível verificar pontos" }, { status: 502 });
    const balData = await balRes.json();
    const currentPoints = balData.points ?? 0;

    if (currentPoints < totalCost) {
      return NextResponse.json({
        error: `Pontos insuficientes. Precisas de ${totalCost} mas tens ${currentPoints}.`,
      }, { status: 400 });
    }

    // Deduct points
    const deductRes = await fetch(
      `${SE_API}/points/${channelId}/${encodeURIComponent(user.login)}/-${totalCost}`,
      { method: "PUT", headers: { ...headers, "Content-Type": "application/json" } }
    );
    if (!deductRes.ok) return NextResponse.json({ error: "Falha ao deduzir pontos" }, { status: 502 });
  }

  // Upsert participation
  if (existing) {
    const { error } = await supabase
      .from("giveaway_participants")
      .update({
        tickets: newTotal,
        total_points_spent: (existing.total_points_spent ?? 0) + totalCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("giveaway_participants")
      .insert({
        giveaway_id,
        twitch_id: user.id,
        twitch_username: user.display_name || user.login,
        tickets: giveaway.mode === "single" ? 1 : requestedTickets,
        total_points_spent: totalCost,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tickets: existing ? newTotal : (giveaway.mode === "single" ? 1 : requestedTickets),
    points_spent: totalCost,
  });
}
