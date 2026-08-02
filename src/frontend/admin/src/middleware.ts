// src/middleware.ts  —  ADMIN APP (platform administrators)
//
// This app is the platform console: tenants, plans, support. Only
// menulay_admin belongs here. A tenant owner who lands on it is sent to the
// tenant app instead of being shown a console they cannot use.

import { NextRequest, NextResponse } from 'next/server'

const TENANT_APP_URL = process.env.NEXT_PUBLIC_TENANT_APP_URL ?? 'http://localhost:3003'

function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return {} }
}

function isTokenExpired(claims: Record<string, unknown>): boolean {
  const exp = claims['exp'] as number
  if (!exp) return true
  return Date.now() / 1000 > exp
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next()
  }

  if (!pathname.startsWith('/admin')) return NextResponse.next()

  const idToken = request.cookies.get('menulay_id_token')?.value
  if (!idToken) {
    return NextResponse.redirect(new URL('/login/admin', request.url))
  }

  const claims = parseJwt(idToken)
  if (isTokenExpired(claims)) {
    return NextResponse.redirect(new URL('/login/admin?reason=expired', request.url))
  }

  const groups = (claims['cognito:groups'] as string[]) ?? []

  // A tenant owner has their own console — send them there rather than
  // bouncing them back to a login screen they just passed.
  if (groups.includes('menulay_tenant')) {
    return NextResponse.redirect(new URL(TENANT_APP_URL))
  }

  if (!groups.includes('menulay_admin')) {
    return NextResponse.redirect(new URL('/login/admin?reason=unauthorized', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}