/**
 * lib/roles.ts
 * ============
 * Turns Cognito group membership into a single role, and says where each role
 * belongs when it first signs in.
 *
 * One role per person by design. A user could technically sit in two groups,
 * so the order below is the tie-breaker: the wider scope wins, because an
 * administrator who is also listed as a tenant is still an administrator.
 */

import { GROUPS, type Role } from '@/types/auth'

const GROUP_TO_ROLE: [string, Role][] = [
  [GROUPS.ADMIN,   'admin'],    // widest scope — checked first
  [GROUPS.TENANT,  'tenant'],
  [GROUPS.KITCHEN, 'kitchen'],
]

export function roleFromGroups(groups: string[] = []): Role | null {
  for (const [group, role] of GROUP_TO_ROLE) {
    if (groups.includes(group)) return role
  }
  return null
}

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  admin:   '/dashboard',
  tenant:  '/dashboard',
  // The kitchen screen is a separate app; this console has nothing for it.
  kitchen: '/unauthorized',
}

export function homeFor(role: Role | null): string {
  return role ? ROLE_HOME[role] : '/login'
}

export const ROLE_LABEL: Record<Role, string> = {
  admin:   'Platform Administrator',
  tenant:  'Company Owner',
  kitchen: 'Kitchen Staff',
}

/** Roles this console serves. Kitchen staff use the KDS app instead. */
export const CONSOLE_ROLES: Role[] = ['admin', 'tenant']

export function canUseConsole(role: Role | null): boolean {
  return role !== null && CONSOLE_ROLES.includes(role)
}
