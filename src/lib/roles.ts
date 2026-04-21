import type { UserRole } from "./supabase";

/**
 * Role hierarchy — higher index = more privileges.
 * admin ≥ configurador ≥ moderador ≥ viewer
 */
const HIERARCHY: UserRole[] = ["viewer", "moderador", "configurador", "admin"];

/** Returns true if `userRole` is at least `requiredRole` in the hierarchy. */
export function hasRole(userRole: UserRole | undefined | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return HIERARCHY.indexOf(userRole) >= HIERARCHY.indexOf(requiredRole);
}

/** Route prefix → minimum role required */
export const ROUTE_ROLES: { prefix: string; role: UserRole }[] = [
  { prefix: "/admin", role: "configurador" },
  { prefix: "/moderador", role: "moderador" },
];
