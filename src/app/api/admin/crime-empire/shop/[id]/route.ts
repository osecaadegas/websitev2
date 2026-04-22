import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { getAdminUser, writeAuditLog } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["price_override","stock","rotation_type","rotation_ends_at","enabled"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("ce_shop_listings")
    .update(updates)
    .eq("id", id)
    .select("*, item:items(name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "update", "shop", id, (data.item as any)?.name, updates);
  return NextResponse.json({ listing: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: listing } = await supabase
    .from("ce_shop_listings")
    .select("item:items(name)")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("ce_shop_listings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, "delete", "shop", id, (listing?.item as any)?.name);
  return NextResponse.json({ success: true });
}
