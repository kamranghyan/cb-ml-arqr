// src/middleware.ts  —  TENANT APP (company owners)
//
// Only menulay_tenant belongs here. A platform admin who lands on this app is
// sent back to the admin console rather than shown a company view.

import { NextRequest, NextResponse } from 'next/server'

const ADMIN_APP_URL = process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? 'http://localhost:3001'

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

  if (!pathname.startsWith('/tenant')) return NextResponse.next()

  const idToken = request.cookies.get('menulay_id_token')?.value
  if (!idToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const claims = parseJwt(idToken)
  if (isTokenExpired(claims)) {
    return NextResponse.redirect(new URL('/login?reason=expired', request.url))
  }

  const groups = (claims['cognito:groups'] as string[]) ?? []

  // Platform admins have their own console.
  if (groups.includes('menulay_admin')) {
    return NextResponse.redirect(new URL(ADMIN_APP_URL))
  }

  if (!groups.includes('menulay_tenant')) {
    return NextResponse.redirect(new URL('/login?reason=unauthorized', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tenant/:path*'],
}
