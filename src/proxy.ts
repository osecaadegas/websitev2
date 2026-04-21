import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Role = "admin" | "configurador" | "moderador" | "viewer";

const HIERARCHY: Role[] = ["viewer", "moderador", "configurador", "admin"];

function hasRole(userRole: Role | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  return HIERARCHY.indexOf(userRole) >= HIERARCHY.indexOf(requiredRole);
}

/** Route prefix → minimum role required */
const PROTECTED: { prefix: string; role: Role }[] = [
  { prefix: "/admin", role: "configurador" },
  { prefix: "/moderador", role: "moderador" },
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Find matching protection rule
  const rule = PROTECTED.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  // Read the httpOnly session cookie
  const sessionCookie = request.cookies.get("twitch_session")?.value;
  if (!sessionCookie) {
    // Not logged in → redirect to login
    const loginUrl = new URL("/api/auth/twitch", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const session = JSON.parse(sessionCookie);
    const role: Role = session.role ?? "viewer";

    if (!hasRole(role, rule.role)) {
      // Logged in but insufficient role → redirect home
      const homeUrl = new URL("/?auth_error=insufficient_role", request.url);
      return NextResponse.redirect(homeUrl);
    }
  } catch {
    // Corrupt cookie → redirect to login
    const loginUrl = new URL("/api/auth/twitch", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/moderador/:path*"],
};
