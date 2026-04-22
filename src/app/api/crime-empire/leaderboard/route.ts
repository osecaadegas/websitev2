import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("crime_players")
    .select("id, username, display_name, class, level, xp, respect, prestige_level, avatar_url")
    .order("level", { ascending: false })
    .order("respect", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: "Erro ao carregar leaderboard" }, { status: 500 });

  return NextResponse.json({ players: data ?? [] });
}
