/**
 * lib/auth.ts
 * ===========
 * Turning a Cognito ID token into the `AuthUser` the app reasons about.
 *
 * The decoding here is deliberately *unverified*: the token was just issued
 * by Cognito to this browser, and every request it goes on to make is
 * verified properly by the services. Verifying signatures in the browser
 * would buy nothing — an attacker editing their own token only fools their
 * own UI, and the API still says no.
 */

import { COOKIE_NAME } from './constants'
import { permissionsFor } from './permissions'
import { roleFromGroups } from './roles'
import type { AuthUser, CognitoClaims } from '@/types/auth'

/** Decode a JWT payload. Works in the browser and in middleware. */
export function decodeToken(token: string): CognitoClaims | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json =
      typeof atob === 'function'
        ? atob(payload)
        : Buffer.from(payload, 'base64').toString('utf8')
    return JSON.parse(json) as CognitoClaims
  } catch {
    return null
  }
}

export function isExpired(claims: CognitoClaims | null): boolean {
  if (!claims?.exp) return true
  return Date.now() / 1000 > claims.exp
}

/** Build the app's view of a person from their token claims. */
export function userFromClaims(claims: CognitoClaims): AuthUser {
  const groups = claims['cognito:groups'] ?? []
  const role   = roleFromGroups(groups)

  return {
    sub:          claims.sub,
    email:        claims.email ?? '',
    displayName:  claims['custom:display_name'] ?? '',
    role,
    // Absent for a platform admin — they belong to no company.
    tenantId:     claims['custom:tenant_id'] ?? '',
    restaurantId: claims['custom:restaurant_id'] ?? '',
    groups,
    permissions:  permissionsFor(role),
  }
}

export function userFromToken(token: string): AuthUser | null {
  const claims = decodeToken(token)
  if (!claims || isExpired(claims)) return null
  return userFromClaims(claims)
}

// ── Cookie (middleware reads this; localStorage is browser-only) ──────

export function setAuthCookie(token: string, days = 30): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${COOKIE_NAME}=${token}; expires=${expires}; path=/; SameSite=Lax`
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`
}
