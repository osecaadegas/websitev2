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
    return session as { id: string; role: string };
  } catch {
    return null;
  }
}

/* ── Canonical pages — auto-seeded if missing ──────────────── */
const CANONICAL_PAGES: { slug: string; name: string }[] = [
  { slug: "home", name: "Página Inicial" },
  { slug: "ofertas", name: "Ofertas" },
  { slug: "destaques", name: "Destaques" },
  { slug: "stream", name: "Stream" },
  { slug: "comunidade", name: "Comunidade" },
  { slug: "liga-dos-secas", name: "Liga dos Secas" },
  { slug: "loja", name: "Loja" },
  { slug: "sobre", name: "Sobre" },
  { slug: "bonus-hunt", name: "Bonus Hunt" },
  { slug: "roda-diaria", name: "Roda Diária" },
  { slug: "giveaways", name: "Giveaways" },
  { slug: "calendario", name: "Calendário" },
  { slug: "daily-session", name: "Sessão do Dia" },
  { slug: "adivinha-o-resultado", name: "Adivinha o Resultado" },
  { slug: "moderador", name: "Moderador" },
  { slug: "hall-of-victories", name: "Bruta do Mês" },
  { slug: "perfil", name: "Perfil" },
  { slug: "politica-de-privacidade", name: "Política de Privacidade" },
  { slug: "politica-de-cookies", name: "Política de Cookies" },
  { slug: "termos-e-condicoes", name: "Termos e Condições" },
];

/* ── GET — fetch all page settings (auto-seeds missing) ────── */
export async function GET() {
  const { data, error } = await supabase
    .from("page_settings")
    .select("*")
    .order("page_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const existing = data ?? [];
  const existingSlugs = new Set(existing.map((s) => s.page_slug));
  const missing = CANONICAL_PAGES.filter((p) => !existingSlugs.has(p.slug));

  if (missing.length > 0) {
    const rows = missing.map((p) => ({ page_slug: p.slug, page_name: p.name }));
    const { data: inserted } = await supabase
      .from("page_settings")
      .upsert(rows, { onConflict: "page_slug", ignoreDuplicates: true })
      .select();

    if (inserted) existing.push(...inserted);
    existing.sort((a, b) => a.page_name.localeCompare(b.page_name));
  }

  return NextResponse.json({ settings: existing });
}

/* ── PUT — update a single page setting ────────────────────── */
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, background_image, hero_image, effect, effect_intensity, overlay_opacity, bg_brightness, bg_saturation, bg_contrast, bg_position_x, bg_position_y, bg_zoom, bg_color } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const validEffects = ["none", "snow", "rain", "thunder", "fireflies", "embers"];
  if (effect && !validEffects.includes(effect)) {
    return NextResponse.json({ error: "Invalid effect" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (background_image !== undefined) updates.background_image = background_image || null;
  if (hero_image !== undefined) updates.hero_image = hero_image || null;
  if (effect !== undefined) updates.effect = effect;
  if (effect_intensity !== undefined) updates.effect_intensity = Math.min(2, Math.max(0, Number(effect_intensity)));
  if (overlay_opacity !== undefined) updates.overlay_opacity = Math.min(1, Math.max(0, Number(overlay_opacity)));
  if (bg_brightness !== undefined) updates.bg_brightness = Math.min(1, Math.max(0, Number(bg_brightness)));
  if (bg_saturation !== undefined) updates.bg_saturation = Math.min(2, Math.max(0, Number(bg_saturation)));
  if (bg_contrast !== undefined) updates.bg_contrast = Math.min(2, Math.max(0, Number(bg_contrast)));
  if (bg_position_x !== undefined) updates.bg_position_x = Math.min(100, Math.max(0, Math.round(Number(bg_position_x))));
  if (bg_position_y !== undefined) updates.bg_position_y = Math.min(100, Math.max(0, Math.round(Number(bg_position_y))));
  if (bg_zoom !== undefined) updates.bg_zoom = Math.min(200, Math.max(50, Number(bg_zoom)));
  if (bg_color !== undefined) updates.bg_color = typeof bg_color === "string" ? bg_color.slice(0, 7) : "#000000";

  const { data, error } = await supabase
    .from("page_settings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ setting: data });
}
