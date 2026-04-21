import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { parseClipUrl, sanitizeText } from "@/lib/clipParser";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS = ["Stake", "BC.Game", "Pragmatic", "Betano", "ESC Online", "Solverde", "Outro"] as const;
const PAGE_SIZE = 20;

/* ── Session helper ─────────────────────────────────────────── */
async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw) as { id: string; login: string; display_name: string; profile_image_url: string }; }
  catch { return null; }
}

/* ── GET — paginated clip feed ──────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const sort  = searchParams.get("sort") === "honors" ? "honors" : "created_at";

  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  const query = supabase
    .from("user_clips")
    .select("*", { count: "exact" })
    .order(sort, { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    clips: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}

/* ── POST — submit a new clip ───────────────────────────────── */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Pedido inválido" }, { status: 400 }); }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const { url, title, description, provider } = body as Record<string, unknown>;

  /* Validate URL */
  if (typeof url !== "string" || url.trim() === "") {
    return NextResponse.json({ error: "URL é obrigatório" }, { status: 400 });
  }

  /* Validate provider */
  const safeProvider = ALLOWED_PROVIDERS.includes(provider as typeof ALLOWED_PROVIDERS[number])
    ? (provider as string)
    : "Outro";

  /* Parse embed */
  const { type: embedType, embedUrl } = parseClipUrl(url);
  if (embedUrl === "#") {
    return NextResponse.json({ error: "URL inválido ou não suportado" }, { status: 400 });
  }

  /* Sanitize text fields */
  const safeTitle       = sanitizeText(title, 120)       || "Vitória";
  const safeDescription = sanitizeText(description, 500) || "";

  /* Insert */
  const { data, error } = await supabase
    .from("user_clips")
    .insert({
      twitch_id:    session.id,
      username:     session.login,
      avatar_url:   session.profile_image_url,
      title:        safeTitle,
      description:  safeDescription,
      url:          url.trim().slice(0, 2048),
      provider:     safeProvider,
      embed_type:   embedType,
      embed_url:    embedUrl,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clip: data }, { status: 201 });
}
