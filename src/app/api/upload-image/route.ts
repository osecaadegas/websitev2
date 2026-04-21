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

/* Max 5 MB */
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/* ── POST — upload image to Supabase Storage ───────────────── */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const pageSlug = formData.get("page_slug") as string | null;
  const fieldName = formData.get("field") as string | null;

  if (!file || !pageSlug || !fieldName) {
    return NextResponse.json({ error: "file, page_slug, and field are required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de ficheiro não suportado. Use JPG, PNG, WebP ou GIF." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ficheiro demasiado grande. Máximo 5 MB." }, { status: 400 });
  }

  // Generate a clean filename
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = `${pageSlug}-${fieldName}-${Date.now()}.${ext}`;
  const path = `page-backgrounds/${safeName}`;

  // Read file into buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("images")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from("images").getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
