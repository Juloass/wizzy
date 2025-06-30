import { prisma } from './prisma'
import { cookies } from 'next/headers'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const id = cookieStore.get('wizzyUserId')?.value
  if (!id) return null

  let user = await prisma.user.findUnique({ where: { id } })

  if (!user) {
    cookieStore.set('wizzyUserId', '', { path: '/', maxAge: 0 })
    return null
  }

  if (
    user.tokenExpiry &&
    user.refreshToken &&
    user.tokenExpiry.getTime() <= Date.now()
  ) {
    try {
      const params = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID ?? '',
        client_secret: process.env.TWITCH_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
      })

      const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)

      const token = await res.json()
      const expiresAt = new Date(Date.now() + token.expires_in * 1000)

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          tokenExpiry: expiresAt,
        },
      })
    } catch (err) {
      console.error('Token refresh failed:', err)
      cookieStore.set('wizzyUserId', '', { path: '/', maxAge: 0 })
      return null
    }
  }

  return user
}
