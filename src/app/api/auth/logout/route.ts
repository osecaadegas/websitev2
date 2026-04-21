import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("twitch_session");
  cookieStore.delete("twitch_user");

  return NextResponse.json({ success: true });
}
