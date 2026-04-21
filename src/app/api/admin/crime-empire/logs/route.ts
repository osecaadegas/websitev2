import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAdminUser } from "@/lib/ce-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q           = searchParams.get("q") || "";
  const entityType  = searchParams.get("entity_type") || "";
  const adminFilter = searchParams.get("admin_id") || "";
  const dateFrom    = searchParams.get("date_from") || "";
  const dateTo      = searchParams.get("date_to") || "";
  const page        = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit       = 50;
  const offset      = (page - 1) * limit;

  let query = supabase
    .from("ce_admin_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q)           query = query.or(`entity_name.ilike.%${q}%,admin_username.ilike.%${q}%`);
  if (entityType)  query = query.eq("entity_type", entityType);
  if (adminFilter) query = query.eq("admin_id", adminFilter);
  if (dateFrom)    query = query.gte("created_at", dateFrom);
  if (dateTo)      query = query.lte("created_at", dateTo);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data || [], total: count || 0, page, limit });
}
