import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
}

interface TwitchVideo {
  id: string;
  stream_id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  language: string;
  type: string;
  duration: string;
}

async function getAppAccessToken(clientId: string, clientSecret: string) {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json();
  return data.access_token as string;
}

async function getBroadcasterId(
  login: string,
  clientId: string,
  token: string
): Promise<string | null> {
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await res.json();
  return data.data?.[0]?.id ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");
  const type = searchParams.get("type") || "clips"; // "clips" or "videos"
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);

  if (!channel) {
    return NextResponse.json({ error: "Missing channel" }, { status: 400 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      clips: [],
      videos: [],
      fallback: true,
      message: "Twitch API credentials not configured. Add TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET to .env.local",
    });
  }

  try {
    const token = await getAppAccessToken(clientId, clientSecret);
    const broadcasterId = await getBroadcasterId(channel, clientId, token);

    if (!broadcasterId) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    if (type === "videos") {
      const res = await fetch(
        `https://api.twitch.tv/helix/videos?user_id=${broadcasterId}&first=${limit}&type=archive`,
        {
          headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      const videos: TwitchVideo[] = data.data || [];

      return NextResponse.json(
        { videos, lastUpdated: new Date().toISOString() },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    // Default: clips
    const res = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=${limit}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await res.json();
    const clips: TwitchClip[] = data.data || [];

    return NextResponse.json(
      { clips, lastUpdated: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch from Twitch", detail: String(err) },
      { status: 500 }
    );
  }
}
