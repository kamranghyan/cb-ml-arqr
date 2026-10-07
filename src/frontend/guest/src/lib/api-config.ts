/**
 * Central API configuration — calls API Gateway directly.
 * Relative /api/* proxy paths only work with next.config.js rewrites(),
 * which can't run in a static export (no server), and there's no CloudFront
 * path-routing set up as an alternative yet either — so direct calls are
 * the only thing that actually works while serving from S3.
 */

import { resolveTenantId } from './tenant'

export const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''


export const MENU_API_BASE = process.env.NEXT_PUBLIC_API_BASE!
export const ORDER_API_BASE = process.env.NEXT_PUBLIC_API_ORDER!
export const AR_API_BASE = process.env.NEXT_PUBLIC_API_AR!

if (typeof window !== 'undefined') {
  if (!MENU_API_BASE) console.error('[API] NEXT_PUBLIC_API_BASE is not set — API calls will be broken')
}

// ── order_svc (get_tenant_id): accepts header OR query param — query param used here ──
async function withTenant(url: string, rid: string): Promise<string> {
  const tenantId = await resolveTenantId(rid)
  const sep = url.includes('?') ? '&' : '?'
  return tenantId ? `${url}${sep}tenantId=${tenantId}` : url
}

export async function tenantHeaders(rid: string): Promise<Record<string, string>> {
  const tenantId = await resolveTenantId(rid)
  return tenantId ? { 'X-Tenant-Id': tenantId } : {}
}


export const RESTAURANT_API = {
  get: (rid: string) => `${MENU_API_BASE}/menus/restaurants/${rid}`,
  list: () => `${MENU_API_BASE}/menus/restaurants`,
}

// ── Menu ──────────────────────────────────────────────────────────────────
export const MENU_API = {
  items: (rid = RESTAURANT_ID) => `${MENU_API_BASE}/menus/restaurants/${rid}/items`,
  item: (itemId: string, rid = RESTAURANT_ID) => `${MENU_API_BASE}/menus/restaurants/${rid}/items/${itemId}`,
  categories: (rid = RESTAURANT_ID) => `${MENU_API_BASE}/menus/restaurants/${rid}/categories`,
}

export const ADDON_API = {
  list: (itemId: string, rid = RESTAURANT_ID) => `${MENU_API_BASE}/menus/restaurants/${rid}/items/${itemId}/addons`,
}

// ── AR — ar_svc's tenant dependency hasn't been checked yet, see note below ──
export const AR_API = {
  model: async (itemId: string, rid = RESTAURANT_ID) => withTenant(`${AR_API_BASE}/ar/${rid}/${itemId}`, rid),
}


export const DEFAULT_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' }


export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...DEFAULT_HEADERS, ...options?.headers } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ── Orders — confirmed: order_svc's get_tenant_id accepts ?tenantId=, query param is correct ──
export const ORDERS_API = {
  list: (rid = RESTAURANT_ID) => withTenant(`${ORDER_API_BASE}/orders`, rid),
  get: (orderId: string, rid = RESTAURANT_ID) => withTenant(`${ORDER_API_BASE}/orders/${orderId}/guest`, rid),
  create: (rid = RESTAURANT_ID) => withTenant(`${ORDER_API_BASE}/orders`, rid),
  cancel: (orderId: string, rid = RESTAURANT_ID) => withTenant(`${ORDER_API_BASE}/orders/${orderId}/guest`, rid),
  feedback: (orderId: string, rid = RESTAURANT_ID) => withTenant(`${ORDER_API_BASE}/orders/${orderId}/feedback`, rid),
}