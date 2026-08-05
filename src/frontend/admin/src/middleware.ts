/**
 * middleware.ts
 * =============
 * The first of three checks, and the only one that runs before any page code
 * does:
 *
 *   1. middleware      — server-side; a stale bookmark never renders
 *   2. RoleGuard       — in the page tree; gives a readable explanation
 *   3. the services    — the real boundary; every API verifies the token itself
 *
 * This layer is about not showing people doors they cannot open. It is not
 * what keeps data safe — that is the backend's job, and it does it whether
 * this file exists or not.
 */

import { NextRequest, NextResponse } from 'next/server'

import { COOKIE_NAME, IGNORED_PREFIXES, PUBLIC_PATHS } from '@/lib/constants'
import { decodeToken, isExpired } from '@/lib/auth'
import { permissionForRoute, permissionsFor } from '@/lib/permissions'
import { canUseConsole, homeFor, roleFromGroups } from '@/lib/roles'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (IGNORED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token  = request.cookies.get(COOKIE_NAME)?.value
  const claims = token ? decodeToken(token) : null
  const live   = Boolean(claims) && !isExpired(claims)
  const role   = live ? roleFromGroups(claims!['cognito:groups'] ?? []) : null

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // ── Already signed in, standing at the login page ─────────────────
  if (pathname.startsWith('/login')) {
    if (role && canUseConsole(role)) {
      return NextResponse.redirect(new URL(homeFor(role), request.url))
    }
    return NextResponse.next()
  }

  if (isPublic) return NextResponse.next()

  // ── No session ────────────────────────────────────────────────────
  if (!live) {
    const url = new URL('/login', request.url)
    // Distinguish "your session ran out" from "you were never signed in";
    // the first deserves an explanation, the second does not.
    if (token) url.searchParams.set('reason', 'expired')
    return NextResponse.redirect(url)
  }

  // ── Signed in, but this console is not for them (kitchen staff) ───
  if (!canUseConsole(role)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // ── Route needs a permission this role does not have ──────────────
  const needed = permissionForRoute(pathname)
  if (needed && !permissionsFor(role).includes(needed)) {
    // Send them to their own dashboard rather than a dead end — the usual
    // cause is a link shared between two people with different roles.
    return NextResponse.redirect(new URL(homeFor(role), request.url))
  }

  // ── Root ──────────────────────────────────────────────────────────
  if (pathname === '/') {
    return NextResponse.redirect(new URL(homeFor(role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
