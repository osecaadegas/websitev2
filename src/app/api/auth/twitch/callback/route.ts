import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/constants";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("twitch_oauth_state")?.value;

  // Clean up the state cookie
  cookieStore.delete("twitch_oauth_state");

  // User denied or error
  if (error) {
    return NextResponse.redirect(`${SITE_URL}/?auth_error=${error}`);
  }

  // Validate CSRF state
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${SITE_URL}/?auth_error=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${SITE_URL}/?auth_error=no_code`);
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${SITE_URL}/?auth_error=not_configured`);
  }

  const redirectUri = `${SITE_URL}/api/auth/twitch/callback`;

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${SITE_URL}/?auth_error=token_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;

    // Fetch user profile from Twitch
    const userRes = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${SITE_URL}/?auth_error=user_fetch_failed`);
    }

    const userData = await userRes.json();
    const user = userData.data?.[0];

    if (!user) {
      return NextResponse.redirect(`${SITE_URL}/?auth_error=no_user`);
    }

    // Upsert user into Supabase users table
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || null;

    let role: UserRole = "viewer";
    const { data: existingUser } = await supabase
      .from("users")
      .select("role, role_expires_at")
      .eq("twitch_id", user.id)
      .single();

    if (existingUser) {
      // Check if temporary role has expired
      role = existingUser.role as UserRole;
      if (existingUser.role_expires_at && new Date(existingUser.role_expires_at) < new Date()) {
        role = "viewer"; // expired → revert
      }

      await supabase
        .from("users")
        .update({
          login: user.login,
          display_name: user.display_name,
          profile_image_url: user.profile_image_url,
          email: user.email || null,
          ip_address: clientIp,
          role,
          ...(role === "viewer" ? { role_expires_at: null } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("twitch_id", user.id);
    } else {
      // New user — insert with default "viewer" role
      await supabase.from("users").insert({
        twitch_id: user.id,
        login: user.login,
        display_name: user.display_name,
        profile_image_url: user.profile_image_url,
        email: user.email || null,
        ip_address: clientIp,
        role: "viewer",
      });
    }

    // Build session payload (stored in httpOnly cookie)
    const session = {
      id: user.id,
      login: user.login,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url,
      email: user.email || null,
      role,
      created_at: new Date().toISOString(),
    };

    // Set session cookie (JSON-encoded, httpOnly, secure)
    cookieStore.set("twitch_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Set a client-readable cookie with minimal info for the UI
    cookieStore.set(
      "twitch_user",
      JSON.stringify({
        login: user.login,
        display_name: user.display_name,
        profile_image_url: user.profile_image_url,
        role,
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      }
    );

    return NextResponse.redirect(`${SITE_URL}/`);
  } catch {
    return NextResponse.redirect(`${SITE_URL}/?auth_error=unexpected`);
  }
}
