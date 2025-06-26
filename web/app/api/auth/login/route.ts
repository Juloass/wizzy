import { NextResponse } from 'next/server';

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? '',
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'user:read:email',
  });
  return NextResponse.redirect(
    `https://id.twitch.tv/oauth2/authorize?${params.toString()}`
  );
}
