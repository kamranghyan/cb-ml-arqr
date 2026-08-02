/**
 * auth-api.ts — client for auth_svc.
 *
 * Covers tenant management (platform admin) and user creation (platform admin
 * or tenant owner). Login/refresh stay in cognito.ts, which posts to the
 * /api/auth proxy.
 *
 * All calls go through the /api/auth-svc proxy so the browser never talks to
 * the API Gateway directly.
 */

import { getValidIdToken } from './cognito'

// ── Types ─────────────────────────────────────────────────────────────

export type PlanTier = 'starter' | 'professional' | 'enterprise'

export interface ApiTenant {
  tenantId:        string
  companyName:     string
  email:           string
  isActive:        boolean
  planTier:        PlanTier
  maxRestaurants:  number      // -1 = unlimited
  restaurantCount: number
  createdAt?:      string
  updatedAt?:      string
}

export interface ApiUser {
  username:     string
  email:        string
  name:         string
  tenantId:     string
  restaurantId: string
  enabled:      boolean
  status:       string
}

export type UserRole = 'admin' | 'tenant' | 'staff'

export interface RegisterPayload {
  role:     UserRole
  email:    string
  password: string
  name?:    string
  /** role=tenant */
  companyName?: string
  planTier?:    PlanTier
  /** role=staff */
  tenantId?:     string
  restaurantId?: string
}

// ── Fetch helper ──────────────────────────────────────────────────────

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getValidIdToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api/auth-svc${path}`, { ...options, headers })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const body = JSON.parse(text)
      message = body?.error?.message ?? body?.message ?? text
    } catch { /* keep raw text */ }

    if (res.status === 401) throw new Error('Session expired — please log in again.')
    if (res.status === 403) throw new Error(message || 'You do not have access to this.')
    throw new Error(message || `Request failed (${res.status})`)
  }

  if (res.status === 204) return undefined as T
  const body = await res.text()
  return (body ? JSON.parse(body) : undefined) as T
}

// ══════════════════════════════════════════════════════════════════════
// Tenants  (platform admin, except myTenant)
// ══════════════════════════════════════════════════════════════════════

export async function fetchTenants(): Promise<ApiTenant[]> {
  const data = await authFetch<{ tenants: ApiTenant[] }>('/auth/tenants')
  return data.tenants ?? []
}

export async function fetchTenant(tenantId: string): Promise<ApiTenant> {
  return authFetch<ApiTenant>(`/auth/tenants/${tenantId}`)
}

/** The logged-in tenant owner's own company record. */
export async function fetchMyTenant(): Promise<ApiTenant> {
  return authFetch<ApiTenant>('/auth/tenants/me')
}

/**
 * Create a tenant company. This also creates its owner login in one call —
 * the platform admin shares those credentials with the customer.
 */
export async function createTenant(payload: {
  companyName: string
  email:       string
  password:    string
  name?:       string
  planTier?:   PlanTier
}): Promise<{ sub: string; email: string; tenantId: string }> {
  return authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role:        'tenant',
      email:       payload.email,
      password:    payload.password,
      name:        payload.name ?? '',
      companyName: payload.companyName,
      planTier:    payload.planTier ?? 'starter',
    } satisfies RegisterPayload),
  })
}

export async function updateTenant(
  tenantId: string,
  changes: { companyName?: string; isActive?: boolean; planTier?: PlanTier },
): Promise<ApiTenant> {
  return authFetch<ApiTenant>(`/auth/tenants/${tenantId}`, {
    method: 'PATCH',
    body:   JSON.stringify(changes),
  })
}

export async function suspendTenant(tenantId: string): Promise<ApiTenant> {
  return updateTenant(tenantId, { isActive: false })
}

export async function activateTenant(tenantId: string): Promise<ApiTenant> {
  return updateTenant(tenantId, { isActive: true })
}

export async function deleteTenant(tenantId: string): Promise<void> {
  await authFetch<void>(`/auth/tenants/${tenantId}`, { method: 'DELETE' })
}

// ══════════════════════════════════════════════════════════════════════
// Users
// ══════════════════════════════════════════════════════════════════════

/** Platform admin sees everyone; a tenant owner sees only its own people. */
export async function fetchUsers(): Promise<ApiUser[]> {
  const data = await authFetch<{ users: ApiUser[] }>('/auth/users')
  return data.users ?? []
}

/** Kitchen staff for one restaurant. */
export async function createStaff(payload: {
  email:        string
  password:     string
  name?:        string
  restaurantId: string
  tenantId?:    string
}): Promise<{ sub: string; email: string }> {
  return authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ role: 'staff', ...payload } satisfies RegisterPayload),
  })
}

/** Another platform admin. Platform admin only. */
export async function createAdmin(payload: {
  email:    string
  password: string
  name?:    string
}): Promise<{ sub: string; email: string }> {
  return authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ role: 'admin', ...payload } satisfies RegisterPayload),
  })
}

export async function deleteUser(username: string): Promise<void> {
  await authFetch<void>(`/auth/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  })
}

// ── Helpers ───────────────────────────────────────────────────────────

export const PLAN_LABELS: Record<PlanTier, string> = {
  starter:      'Starter — 1 restaurant',
  professional: 'Professional — up to 5 restaurants',
  enterprise:   'Enterprise — unlimited',
}

export function planUsage(tenant: ApiTenant): string {
  if (tenant.maxRestaurants === -1) {
    return `${tenant.restaurantCount} restaurants (unlimited)`
  }
  return `${tenant.restaurantCount} of ${tenant.maxRestaurants} restaurants`
}

export function isAtPlanLimit(tenant: ApiTenant): boolean {
  return tenant.maxRestaurants !== -1 &&
         tenant.restaurantCount >= tenant.maxRestaurants
}