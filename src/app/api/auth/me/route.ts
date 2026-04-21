import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("twitch_session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ user: null });
  }

  try {
    const session = JSON.parse(sessionCookie);
    return NextResponse.json({
      user: {
        id: session.id,
        login: session.login,
        display_name: session.display_name,
        profile_image_url: session.profile_image_url,
        role: session.role ?? "viewer",
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
