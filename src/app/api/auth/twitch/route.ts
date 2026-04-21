import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/constants";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET() {
  const clientId = process.env.TWITCH_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "TWITCH_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${SITE_URL}/api/auth/twitch/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie for CSRF protection
  const cookieStore = await cookies();
  cookieStore.set("twitch_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });

  const scopes = ["user:read:email"].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
  });

  return NextResponse.redirect(
    `https://id.twitch.tv/oauth2/authorize?${params.toString()}`
  );
}
