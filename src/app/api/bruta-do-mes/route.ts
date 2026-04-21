import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { parseClipUrl, sanitizeText } from "@/lib/clipParser";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS = ["Stake", "BC.Game", "Pragmatic", "Betano", "ESC Online", "Solverde", "Outro"] as const;

/* ── Session helper ─────────────────────────────────────────── */
async function getAdminSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as { id: string; login: string; display_name: string; role?: string };
    if (session.role !== "admin" && session.role !== "configurador") return null;
    return session;
  } catch { return null; }
}

/* ── GET — return current active featured win ───────────────── */
export async function GET() {
  const { data, error } = await supabase
    .from("bruta_do_mes")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ win: data ?? null });
}

/* ── POST — set a new featured win (admin only) ─────────────── */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Pedido inválido" }, { status: 400 }); }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const { url, title, description, provider, month_label } = body as Record<string, unknown>;

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "URL obrigatório" }, { status: 422 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Título obrigatório" }, { status: 422 });
  }
  if (typeof month_label !== "string" || !month_label.trim()) {
    return NextResponse.json({ error: "Mês obrigatório" }, { status: 422 });
  }

  const safeProvider =
    typeof provider === "string" && (ALLOWED_PROVIDERS as readonly string[]).includes(provider)
      ? provider
      : "Outro";

  const parsed = parseClipUrl(url.trim());
  if (!parsed) {
    return NextResponse.json({ error: "URL não suportado. Usa YouTube, Twitch ou um link de vídeo direto." }, { status: 422 });
  }

  /* Deactivate all previous featured wins */
  await supabase.from("bruta_do_mes").update({ is_active: false }).eq("is_active", true);

  const { data, error } = await supabase.from("bruta_do_mes").insert({
    month_label: sanitizeText(month_label as string, 60),
    title:       sanitizeText(title as string, 120),
    description: typeof description === "string" ? sanitizeText(description, 500) : null,
    url:         url.trim(),
    provider:    safeProvider,
    embed_type:  parsed.type,
    embed_url:   parsed.embedUrl,
    is_active:   true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ win: data }, { status: 201 });
}

/* ── DELETE — remove current featured win (admin only) ──────── */
export async function DELETE() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { error } = await supabase
    .from("bruta_do_mes")
    .update({ is_active: false })
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
