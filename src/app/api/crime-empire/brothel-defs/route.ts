import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { WORKER_DEFS } from "@/lib/crime-empire/worker-defs";

export const dynamic = "force-dynamic";

export async function GET() {
  // Require auth
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("brothel_worker_defs")
    .select("*")
    .eq("enabled", true)
    .order("hire_price", { ascending: true });

  // If table exists and has data, return it; otherwise fall back to static defs
  if (!error && data && data.length > 0) {
    const defs = data.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      description: d.description,
      image: `/images/hooker/${d.slug}.jpg`,
      hire_price: d.hire_price,
      hire_uses_crypto: d.hire_uses_crypto,
      earnings_per_hour: d.earnings_per_hour,
      traits: d.traits,
      rarity: d.rarity,
      stats: {
        attractiveness: d.stat_attractiveness,
        stamina: d.stat_stamina,
        mood: d.stat_mood,
        charisma: d.stat_charisma,
      },
      order: d.sort_order,
    }));
    return NextResponse.json({ defs });
  }

  // Fallback to static definitions
  const defs = [...WORKER_DEFS].sort((a, b) => a.hire_price - b.hire_price);
  return NextResponse.json({ defs });
}
