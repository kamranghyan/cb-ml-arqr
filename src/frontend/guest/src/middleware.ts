// src/middleware.ts
// Route protection — runs at the edge before every request

import { NextRequest, NextResponse } from 'next/server'

// ── Parse JWT without a lib (edge-compatible) ────────────────────────────────
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

  // ── Public routes — always allow ──────────────────────────────────────────
  if (
    pathname.startsWith('/guest') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/' ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next()
  }

  // ── Get token from cookie ─────────────────────────────────────────────────
  const idToken = request.cookies.get('menulay_id_token')?.value

  // ── Admin routes — allow menulay_admin AND menulay_tenant ─────────────────
  if (pathname.startsWith('/admin')) {
    if (!idToken) {
      return NextResponse.redirect(new URL('/login/admin', request.url))
    }
    const claims = parseJwt(idToken)
    if (isTokenExpired(claims)) {
      return NextResponse.redirect(new URL('/login/admin?reason=expired', request.url))
    }
    const groups = (claims['cognito:groups'] as string[]) ?? []
    if (
      !groups.includes('menulay_admin') &&
      !groups.includes('menulay_tenant')
    ) {
      return NextResponse.redirect(new URL('/login/admin?reason=unauthorized', request.url))
    }
    return NextResponse.next()
  }

  // ── KDS routes — allow menulay_kitchen_staff AND menulay_admin ────────────
  if (pathname.startsWith('/kds')) {
    if (!idToken) {
      return NextResponse.redirect(new URL('/login/kds', request.url))
    }
    const claims = parseJwt(idToken)
    if (isTokenExpired(claims)) {
      return NextResponse.redirect(new URL('/login/kds?reason=expired', request.url))
    }
    const groups = (claims['cognito:groups'] as string[]) ?? []
    if (
      !groups.includes('menulay_kitchen_staff') &&
      !groups.includes('menulay_admin')
    ) {
      return NextResponse.redirect(new URL('/login/kds?reason=unauthorized', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/kds/:path*',
  ],
}