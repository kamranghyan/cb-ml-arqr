// src/middleware.ts  —  MenuLay Console
//
// One app, one login. After signing in, a person lands in the section their
// role owns:
//
//   menulay_admin   → /admin/*    platform: tenants, plans, users
//   menulay_tenant  → /tenant/*   their company: restaurants, menus, staff
//
// Landing on the wrong section is not an error — it usually means a stale or
// shared link, so we send them to their own home rather than a dead end.

import { NextRequest, NextResponse } from 'next/server'

const HOME = {
  admin:  '/admin/dashboard',
  tenant: '/tenant/dashboard',
} as const

type Role = keyof typeof HOME

function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}

function isExpired(claims: Record<string, unknown>): boolean {
  const exp = claims['exp'] as number
  return !exp || Date.now() / 1000 > exp
}

function roleOf(groups: string[]): Role | null {
  if (groups.includes('menulay_admin'))  return 'admin'
  if (groups.includes('menulay_tenant')) return 'tenant'
  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next()
  }

  const idToken  = request.cookies.get('menulay_token_console')?.value
  const claims   = idToken ? parseJwt(idToken) : {}
  const signedIn = Boolean(idToken) && !isExpired(claims)
  const role     = signedIn ? roleOf((claims['cognito:groups'] as string[]) ?? []) : null

  // ── The login page ───────────────────────────────────────────────
  if (pathname.startsWith('/login')) {
    // Already signed in? Skip the form and go home.
    if (role) return NextResponse.redirect(new URL(HOME[role], request.url))
    return NextResponse.next()
  }

  // ── Everything else needs a session ──────────────────────────────
  if (!signedIn) {
    const url = new URL('/login', request.url)
    if (idToken) url.searchParams.set('reason', 'expired')
    return NextResponse.redirect(url)
  }

  // Signed in, but neither an admin nor a tenant owner (a kitchen login,
  // say) — this console has nothing for them.
  if (!role) {
    return NextResponse.redirect(new URL('/login?reason=unauthorized', request.url))
  }

  // ── Section guards ───────────────────────────────────────────────
  if (pathname.startsWith('/admin')  && role !== 'admin') {
    return NextResponse.redirect(new URL(HOME[role], request.url))
  }
  if (pathname.startsWith('/tenant') && role !== 'tenant') {
    return NextResponse.redirect(new URL(HOME[role], request.url))
  }

  // ── Root sends each role to its own home ─────────────────────────
  if (pathname === '/') {
    return NextResponse.redirect(new URL(HOME[role], request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
