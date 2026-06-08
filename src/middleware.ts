import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, getAuthToken } from '@/lib/auth'

/**
 * Gate every page and API route behind the shared password, except the login
 * page/endpoint and Next.js internals/static assets (handled by the matcher).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow the login flow through
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/api/logout') {
    return NextResponse.next()
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (token && token === getAuthToken()) {
    return NextResponse.next()
  }

  // Unauthenticated API calls get a clean 401 (no HTML redirect)
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  // Everything else redirects to the login page, remembering where to return
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = pathname !== '/' ? `?from=${encodeURIComponent(pathname)}` : ''
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Protect everything except Next internals and common static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
