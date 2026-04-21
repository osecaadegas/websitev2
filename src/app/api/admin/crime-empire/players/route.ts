import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q") || "";
  const cls    = searchParams.get("class") || "";
  const jailed = searchParams.get("jailed");
  const page   = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit  = 40;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("crime_players")
    .select(
      "id, user_id, username, display_name, avatar_url, class, level, xp, hp, max_hp, stamina, max_stamina, dirty_cash, cash, crypto, respect, power, intelligence, charisma, in_jail, jail_release_at, addiction, created_at",
      { count: "exact" }
    )
    .order("level", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q)      query = query.ilike("username", `%${q}%`);
  if (cls)    query = query.eq("class", cls);
  if (jailed === "true")  query = query.eq("in_jail", true);
  if (jailed === "false") query = query.eq("in_jail", false);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ players: data || [], total: count || 0, page, limit });
}
