import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/* ── Auth helper ───────────────────────────────────────────── */
async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    return { id: session.id, username: session.login, display_name: session.display_name, avatar: session.profile_image_url };
  } catch {
    return null;
  }
}

/* ── GET - Get or create player profile ──────────────────────── */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Check if player exists
  const { data: player, error } = await supabase
    .from("crime_players")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (player) {
    // Update stamina based on time passed
    const now = new Date();
    const lastUpdate = new Date(player.last_stamina_update);
    const hoursPassed = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    const staminaToAdd = Math.floor(hoursPassed * 10); // +10 per hour
    const newStamina = Math.min(player.max_stamina, player.stamina + staminaToAdd);

    // Check if still in jail
    const inJail = player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > now;

    // Update player
    if (staminaToAdd > 0 || player.stamina !== newStamina || (player.in_jail && !inJail)) {
      await supabase
        .from("crime_players")
        .update({
          stamina: newStamina,
          last_stamina_update: now.toISOString(),
          in_jail: inJail,
          last_login: now.toISOString(),
        })
        .eq("id", player.id);

      player.stamina = newStamina;
      player.in_jail = inJail;
    }

    return NextResponse.json({
      player: {
        ...player,
        boost_active: false,
      },
    });
  }

  // Player doesn't exist - return null (will trigger character creation)
  return NextResponse.json({ player: null });
}

/* ── POST - Create new player ─────────────────────────────── */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { class: playerClass } = body;

  const validClasses = ['thief', 'hooligan', 'businessman', 'hitman', 'scammer', 'brute', 'dealer', 'pimp'];
  if (!playerClass || !validClasses.includes(playerClass)) {
    return NextResponse.json({ error: "Invalid class" }, { status: 400 });
  }

  // Check if player already exists
  const { data: existing } = await supabase
    .from("crime_players")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Player already exists" }, { status: 400 });
  }

  // Create player
  const { data: player, error } = await supabase
    .from("crime_players")
    .insert({
      user_id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar,
      class: playerClass,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating player:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create player stats record
  await supabase.from("player_stats").insert({ player_id: player.id });

  return NextResponse.json({ player });
}
