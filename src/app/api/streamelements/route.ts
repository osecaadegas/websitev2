import { NextResponse } from "next/server";

const SE_API = "https://api.streamelements.com/kappa/v2";

function getHeaders() {
  const token = process.env.STREAMELEMENTS_JWT_TOKEN;
  if (!token) return null;
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function getChannelId() {
  return process.env.STREAMELEMENTS_CHANNEL_ID || "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  const headers = getHeaders();
  const channelId = getChannelId();

  if (!headers || !channelId) {
    return NextResponse.json(
      { error: "StreamElements not configured" },
      { status: 503 }
    );
  }

  try {
    switch (endpoint) {
      case "leaderboard": {
        const res = await fetch(
          `${SE_API}/points/${channelId}/top?limit=50`,
          { headers, next: { revalidate: 60 } }
        );
        if (!res.ok) throw new Error(`SE API ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
      }

      case "tips": {
        const res = await fetch(
          `${SE_API}/tips/${channelId}?sort=createdAt&limit=30`,
          { headers, next: { revalidate: 30 } }
        );
        if (!res.ok) throw new Error(`SE API ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
      }

      case "activities": {
        const res = await fetch(
          `${SE_API}/activities/${channelId}?limit=30&types=follow,subscriber,cheer,tip`,
          { headers, next: { revalidate: 15 } }
        );
        if (!res.ok) throw new Error(`SE API ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
      }

      case "store": {
        const res = await fetch(
          `${SE_API}/store/${channelId}/items?source=loyalty`,
          { headers, next: { revalidate: 120 } }
        );
        if (!res.ok) throw new Error(`SE API ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
      }

      case "channel": {
        return NextResponse.json({ channelId });
      }

      case "user-points": {
        const username = searchParams.get("username");
        if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
        const res = await fetch(
          `${SE_API}/points/${channelId}/${encodeURIComponent(username)}`,
          { headers, next: { revalidate: 10 } }
        );
        if (!res.ok) throw new Error(`SE API ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json(
          { error: "Invalid endpoint. Use: leaderboard, tips, activities, store, channel" },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from StreamElements" },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  const headers = getHeaders();
  const channelId = getChannelId();

  if (!headers || !channelId) {
    return NextResponse.json({ error: "StreamElements not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { username, amount } = body;

    if (!username || amount === undefined) {
      return NextResponse.json({ error: "username and amount required" }, { status: 400 });
    }

    // Use the SE API to set points (PUT adjusts points by amount)
    const res = await fetch(
      `${SE_API}/points/${channelId}/${encodeURIComponent(username)}/${Math.abs(amount)}`,
      {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );

    if (!res.ok) throw new Error(`SE API ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to update points" }, { status: 502 });
  }
}
