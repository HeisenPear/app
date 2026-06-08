import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, AUTH_MAX_AGE, getAuthToken, getSitePassword } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let password = ''
  try {
    const body = await req.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  if (password !== getSitePassword()) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, getAuthToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_MAX_AGE,
  })
  return res
}
