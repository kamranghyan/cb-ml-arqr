/**
 * types/auth.ts
 * =============
 * The shapes the whole app agrees on for identity and access.
 *
 * A note on the token: Cognito does not hand us a `role` or a `permissions`
 * array. It gives group membership and custom attributes. Roles and
 * permissions are derived from those in `lib/roles.ts` and
 * `lib/permissions.ts` — which is the better place for them anyway, since
 * changing what a role may do should not mean editing a user pool.
 */

/** What Cognito actually puts in the ID token. */
export interface CognitoClaims {
  sub:                     string
  email?:                  string
  'cognito:groups'?:       string[]
  'custom:tenant_id'?:     string
  'custom:restaurant_id'?: string
  'custom:display_name'?:  string
  exp?:                    number
}

/** Cognito group names — the only place these strings should appear. */
export const GROUPS = {
  ADMIN:   'menulay_admin',
  TENANT:  'menulay_tenant',
  KITCHEN: 'menulay_kitchen_staff',
} as const

export type Role = 'admin' | 'tenant' | 'kitchen'

/**
 * Everything a page needs to know about who is asking.
 *
 * `tenantId` is empty for a platform admin — that absence is meaningful, not
 * missing data: an admin belongs to no company.
 */
export interface AuthUser {
  sub:          string
  email:        string
  displayName:  string
  role:         Role | null
  tenantId:     string
  restaurantId: string
  groups:       string[]
  permissions:  Permission[]
}

/**
 * What someone may do. Named after the action, not the page — pages come and
 * go, but "may this person suspend a company" stays meaningful.
 */
export type Permission =
  // Platform
  | 'tenants:read'      | 'tenants:write'
  | 'users:read'        | 'users:write'
  | 'platform:analytics'
  | 'platform:settings'
  // Company
  | 'restaurants:read'  | 'restaurants:write'
  | 'menu:read'         | 'menu:write'
  | 'tables:read'       | 'tables:write'
  | 'qr:generate'
  | 'staff:read'        | 'staff:write'
  // Shared, but scoped differently per role
  | 'dashboard:read'
  | 'orders:read'
  | 'analytics:read'
  | 'settings:read'

export interface NavItem {
  href:        string
  label:       string
  /**
   * A lucide icon. Typed loosely because lucide's components carry SVG props
   * that a narrower signature would reject for no benefit here.
   */
  icon:        React.ComponentType<any>
  /** Hidden unless the user has this permission. */
  permission?: Permission
  /** Hidden unless the user has one of these roles. */
  roles?:      Role[]
}

export interface NavSection {
  section: string
  items:   NavItem[]
}
