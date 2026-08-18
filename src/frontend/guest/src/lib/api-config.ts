/**
 * Central API configuration
 * MENU_API uses /api/menu proxy — no direct browser-to-AWS calls.
 */

export const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''

export const ADMIN_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID ?? ''

export const TENANT_ID =
  process.env.NEXT_PUBLIC_TENANT_ID ?? ''

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE

export const AR_BASE =
  process.env.NEXT_PUBLIC_AR_API_BASE

if (typeof window !== 'undefined') {
  if (!RESTAURANT_ID) console.warn('[API] NEXT_PUBLIC_RESTAURANT_ID is not set')
}

// ── MENU_API — ALL calls go through /api/menu proxy (NOT direct to AWS) ───────
export const MENU_API = {
  items: (rid = RESTAURANT_ID) =>
    `/api/menu/restaurants/${rid}/items`,
  item: (itemId: string, rid = RESTAURANT_ID) =>
    `/api/menu/restaurants/${rid}/items/${itemId}`,
  categories: (rid = RESTAURANT_ID) =>
    `/api/menu/restaurants/${rid}/categories`,
}

// ── ADDON_API — Extra Toppings / add-ons per menu item ─────────────────────
// NOTE: inferred from addons.py's route decorators, not a confirmed schema
// (the service/model files weren't in what was shared) — same /api/menu
// proxy, same /menus/ prefix convention as everything else.
export const ADDON_API = {
  list: (itemId: string, rid = RESTAURANT_ID) =>
    `/api/menu/restaurants/${rid}/items/${itemId}/addons`,
}

// ── AR_API — proxied through /api/ar ─────────────────────────────────────────
export const AR_API = {
  model: (itemId: string, rid = RESTAURANT_ID) =>
     `/api/ar?rid=${rid}&iid=${itemId}`,
}

export const QR_API = {
  generate: '/api/qr/generate',
}

export const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...DEFAULT_HEADERS, ...options?.headers },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const TENANT_ID_KDS     = process.env.NEXT_PUBLIC_TENANT_ID_KDS     ?? ''
export const RESTAURANT_ID_KDS = process.env.NEXT_PUBLIC_RESTAURANT_ID_KDS ?? 'r456'
export const ORDERS_API_BASE   =
  process.env.NEXT_PUBLIC_ORDERS_API_BASE

export const ORDERS_API = {
  list:   () => `/api/orders`,
  get:    (orderId: string) => `/api/orders/${orderId}`,
  create: () => `/api/orders`,
  patch:  (orderId: string) => `/api/orders/${orderId}`,
}