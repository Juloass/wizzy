import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect('/login');
  }

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? '',
    client_secret: process.env.TWITCH_CLIENT_SECRET ?? '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
  });

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: params,
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect('/login');
  }

  const token = await tokenRes.json();

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID ?? '',
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  if (!userRes.ok) {
    return NextResponse.redirect('/login');
  }

  const data = await userRes.json();
  const info = data.data?.[0];
  if (!info) {
    return NextResponse.redirect('/login');
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

  cookies().set('wizzyUserId', user.id, { path: '/', httpOnly: true });
  return NextResponse.redirect('/dashboard');
}
