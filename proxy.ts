import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '')
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/admin')
  const isAdminPage =
    request.nextUrl.pathname.startsWith('/admin/dashboard') ||
    request.nextUrl.pathname.startsWith('/admin/settings')

  if (!token) {
    if (isApiRoute) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (isAdminPage) return NextResponse.redirect(new URL('/admin', request.url))
    return NextResponse.next()
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    if (isApiRoute) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (isAdminPage) return NextResponse.redirect(new URL('/admin', request.url))
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/admin/dashboard/:path*',
    '/admin/settings/:path*',
    '/api/admin/settings/:path*',
  ],
}
