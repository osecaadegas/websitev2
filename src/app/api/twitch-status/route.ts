import { NextResponse } from "next/server";

/**
 * Twitch status API — checks if a channel is currently live.
 *
 * Uses Twitch Helix API with app access token.
 * Falls back to false if credentials are not configured.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");

  if (!channel) {
    return NextResponse.json({ error: "Missing channel" }, { status: 400 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // No Twitch credentials — return offline
    return NextResponse.json({ is_live: false, fallback: true });
  }

  try {
    // Get app access token
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    const tokenData = await tokenRes.json();

    // Check stream status
    const streamRes = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );
    const streamData = await streamRes.json();
    const isLive = streamData.data && streamData.data.length > 0;

    return NextResponse.json({ is_live: isLive });
  } catch {
    return NextResponse.json({ is_live: false });
  }
}
