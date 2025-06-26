import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const baseUrl = req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? "",
    client_secret: process.env.TWITCH_CLIENT_SECRET ?? "",
    code,
    grant_type: "authorization_code",
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
  });

  console.log("📡 Requesting token from Twitch...");

  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const tokenRaw = await tokenRes.text();

  if (!tokenRes.ok) {
    console.error("❌ Twitch token error:", tokenRes.status, tokenRaw);
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const token = JSON.parse(tokenRaw);
  console.log("✅ Token received:", token);

  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID ?? "",
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  if (!userRes.ok) {
    console.error("❌ Twitch user fetch failed:", userRes.status);
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const data = await userRes.json();
  const info = data.data?.[0];

  if (!info) {
    console.error("❌ Twitch user data missing:", data);
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  const user = await prisma.user.upsert({
    where: { twitchId: info.id },
    update: {
      displayName: info.display_name,
      profileImageUrl: info.profile_image_url,
      email: info.email,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiry: expiresAt,
    },
    create: {
      twitchId: info.id,
      displayName: info.display_name,
      profileImageUrl: info.profile_image_url,
      email: info.email,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiry: expiresAt,
    },
  });

  (await cookies()).set("wizzyUserId", user.id, { path: "/", httpOnly: true });

  console.log("👤 User upserted and session cookie set:", user.id);
  return NextResponse.redirect(new URL("/dashboard", baseUrl));
}
