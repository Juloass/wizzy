import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  cookies().set('wizzyUserId', '', { path: '/', maxAge: 0 });
  return NextResponse.redirect('/');
}
