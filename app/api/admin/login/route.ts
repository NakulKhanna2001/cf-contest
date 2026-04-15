import { NextRequest } from 'next/server'
import { signAdminToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = await signAdminToken()

  const response = Response.json({ ok: true })
  const headers = new Headers(response.headers)
  headers.set(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`
  )
  return new Response(response.body, { status: 200, headers })
}
