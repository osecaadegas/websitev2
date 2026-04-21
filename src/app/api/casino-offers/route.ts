import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** POST /api/casino-offers — quick-add a casino from admin (minimal fields) */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let session: { id: string; role: string };
  try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid session" }, { status: 401 }); }

  if (session.role !== "admin" && session.role !== "configurador") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const affiliateUrl = (body.affiliate_url || "#").trim();
  const logoUrl = (body.logo_url || "").trim() || null;

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if slug already exists
  const { data: existing } = await supabase
    .from("casino_offers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Já existe um casino com este nome" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("casino_offers")
    .insert({
      slug,
      name,
      logo_url: logoUrl,
      logo_bg: body.logo_bg || "#333",
      headline: body.headline || name,
      bonus_value: body.bonus_value || "—",
      free_spins: "",
      min_deposit: "—",
      code: "",
      affiliate_url: affiliateUrl,
      rating: 4.5,
      visible: true,
      sort_order: 999,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ casino: data }, { status: 201 });
}
