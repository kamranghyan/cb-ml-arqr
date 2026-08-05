/**
 * lib/permissions.ts
 * ==================
 * What each role may do.
 *
 * This is a UI-side matrix: it decides which menu items appear and which
 * pages render. It is *not* the security boundary — every service checks the
 * caller's token and tenant on its own. Treat this as "what should this
 * person be shown", and the backend as "what may this person actually do".
 *
 * Keeping it in code rather than in Cognito means changing what a role can
 * see is a pull request, not a user-pool migration.
 */

import type { Permission, Role } from '@/types/auth'

const ADMIN_PERMISSIONS: Permission[] = [
  // Runs the platform: customers, their accounts, and the platform's own view.
  'tenants:read', 'tenants:write',
  'users:read',   'users:write',
  'platform:analytics',
  'platform:settings',
  // Read-only reach into a customer's data, for support.
  'dashboard:read',
  'orders:read',
  'analytics:read',
  'settings:read',
]

const TENANT_PERMISSIONS: Permission[] = [
  // Runs their own company: branches, what those branches sell, and who works there.
  'restaurants:read', 'restaurants:write',
  'menu:read',        'menu:write',
  'tables:read',      'tables:write',
  'qr:generate',
  'staff:read',       'staff:write',
  'dashboard:read',
  'orders:read',
  'analytics:read',
  'settings:read',
]

// Kitchen staff have their own app; nothing in this console is for them.
const KITCHEN_PERMISSIONS: Permission[] = []

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin:   ADMIN_PERMISSIONS,
  tenant:  TENANT_PERMISSIONS,
  kitchen: KITCHEN_PERMISSIONS,
}

export function permissionsFor(role: Role | null): Permission[] {
  return role ? ROLE_PERMISSIONS[role] : []
}

export function can(permissions: Permission[], needed: Permission): boolean {
  return permissions.includes(needed)
}

export function canAny(permissions: Permission[], needed: Permission[]): boolean {
  return needed.some(p => permissions.includes(p))
}

export function canAll(permissions: Permission[], needed: Permission[]): boolean {
  return needed.every(p => permissions.includes(p))
}

/**
 * Which permission a route needs. The middleware uses this to turn people
 * away before a page ever renders, so a stale bookmark does not flash a
 * screen someone should not see.
 *
 * Longest prefix wins, so a nested route can be stricter than its parent.
 */
export const ROUTE_PERMISSIONS: [string, Permission][] = [
  ['/dashboard',   'dashboard:read'],
  ['/analytics',   'analytics:read'],
  ['/orders',      'orders:read'],
  ['/history',     'orders:read'],
  ['/settings',    'settings:read'],
  ['/tenants',     'tenants:read'],
  ['/users',       'users:read'],
  ['/restaurants', 'restaurants:read'],
  ['/staff',       'staff:read'],
  // The shared routes still need a permission — otherwise anyone who somehow
  // reached the console would see them simply because nothing said no.
]

export function permissionForRoute(pathname: string): Permission | null {
  const match = ROUTE_PERMISSIONS
    .filter(([prefix]) => pathname.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0]

  return match ? match[1] : null
}
