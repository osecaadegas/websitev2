import { supabase } from "./supabase";
import { cookies } from "next/headers";

export interface AdminUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  role: string;
}

/** Returns the authenticated user only if they have admin or configurador role. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AdminUser;
    if (!user.role || !["configurador", "admin"].includes(user.role)) return null;
    return user;
  } catch {
    return null;
  }
}

/** Write an entry to ce_admin_logs. Fire-and-forget — does not throw. */
export function writeAuditLog(
  admin: AdminUser,
  action: string,
  entityType: string,
  entityId?: string | null,
  entityName?: string | null,
  details?: Record<string, unknown> | null
) {
  supabase.from("ce_admin_logs").insert({
    admin_id: admin.id,
    admin_username: admin.login || admin.display_name,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    entity_name: entityName ?? null,
    details: details ?? null,
  }).then(() => {}, () => {});
}

