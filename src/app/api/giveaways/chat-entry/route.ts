import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SE_API = "https://api.streamelements.com/kappa/v2";

function getSeHeaders() {
  const token = process.env.STREAMELEMENTS_JWT_TOKEN;
  if (!token) return null;
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
}

/* Rate limit store (in-memory, per instance) */
const rateLimits = new Map<string, number>();

/**
 * POST — Process a chat command entry
 * 
 * This endpoint is called by the Twitch chat listener (bot or webhook).
 * Body: { twitch_id, twitch_username, command, args, secret }
 * 
 * The `secret` field must match GIVEAWAY_CHAT_SECRET env var to prevent abuse.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { twitch_id, twitch_username, command, args, secret } = body;

  // Validate secret
  const expectedSecret = process.env.GIVEAWAY_CHAT_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!twitch_id || !twitch_username) {
    return NextResponse.json({ error: "Missing user info" }, { status: 400 });
  }

  // Rate limit: 1 command per 5 seconds per user
  const now = Date.now();
  const lastCmd = rateLimits.get(twitch_id) ?? 0;
  if (now - lastCmd < 5000) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  rateLimits.set(twitch_id, now);

  // Cleanup old entries periodically
  if (rateLimits.size > 10000) {
    const cutoff = now - 60000;
    for (const [key, time] of rateLimits) {
      if (time < cutoff) rateLimits.delete(key);
    }
  }

  // Find active giveaway matching command
  const { data: giveaways } = await supabase
    .from("giveaways")
    .select("*")
    .eq("is_active", true)
    .eq("is_ended", false);

  const cmdStr = (command || "!enter").toLowerCase();
  const activeGiveaway = (giveaways ?? []).find(
    (g) => g.chat_command.toLowerCase() === cmdStr
  );

  if (!activeGiveaway) {
    return NextResponse.json({ error: "No active giveaway for this command" }, { status: 404 });
  }

  // Check end time
  if (activeGiveaway.end_time && new Date(activeGiveaway.end_time) < new Date()) {
    return NextResponse.json({ error: "Giveaway expired" }, { status: 400 });
  }

  // Parse ticket count from args (e.g., "!enter 5" → 5)
  const ticketCount = Math.max(1, Math.floor(parseInt(args?.[0]) || 1));

  // Check existing participation
  const { data: existing } = await supabase
    .from("giveaway_participants")
    .select("*")
    .eq("giveaway_id", activeGiveaway.id)
    .eq("twitch_id", twitch_id)
    .maybeSingle();

  // Single mode: no re-entry
  if (activeGiveaway.mode === "single" && existing) {
    return NextResponse.json({ error: "Already entered" }, { status: 400 });
  }

  // Ticket mode: check max
  const currentTickets = existing?.tickets ?? 0;
  const newTotal = currentTickets + ticketCount;

  if (activeGiveaway.max_entries_per_user && newTotal > activeGiveaway.max_entries_per_user) {
    return NextResponse.json({ error: "Max entries reached" }, { status: 400 });
  }

  // Deduct SE points if cost > 0
  const totalCost = activeGiveaway.ticket_cost * ticketCount;
  if (totalCost > 0) {
    const headers = getSeHeaders();
    const channelId = process.env.STREAMELEMENTS_CHANNEL_ID;
    if (!headers || !channelId) {
      return NextResponse.json({ error: "SE not configured" }, { status: 503 });
    }

    // Check balance
    const balRes = await fetch(`${SE_API}/points/${channelId}/${encodeURIComponent(twitch_username)}`, { headers });
    if (!balRes.ok) return NextResponse.json({ error: "Cannot check points" }, { status: 502 });
    const balData = await balRes.json();

    if ((balData.points ?? 0) < totalCost) {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
    }

    // Deduct
    await fetch(
      `${SE_API}/points/${channelId}/${encodeURIComponent(twitch_username)}/-${totalCost}`,
      { method: "PUT", headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // Upsert participation
  if (existing) {
    await supabase
      .from("giveaway_participants")
      .update({
        tickets: newTotal,
        total_points_spent: (existing.total_points_spent ?? 0) + totalCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("giveaway_participants")
      .insert({
        giveaway_id: activeGiveaway.id,
        twitch_id,
        twitch_username,
        tickets: activeGiveaway.mode === "single" ? 1 : ticketCount,
        total_points_spent: totalCost,
      });
  }

  return NextResponse.json({
    success: true,
    giveaway_title: activeGiveaway.title,
    tickets: existing ? newTotal : ticketCount,
  });
}
