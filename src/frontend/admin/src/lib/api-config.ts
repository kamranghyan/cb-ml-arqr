/**
 * Central API configuration
 * MENU_API uses /api/menu proxy — no direct browser-to-AWS calls.
 */

export const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ?? '53591ab9-ac4e-4841-958b-d38853a90f0b'

export const ADMIN_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID ?? '2687382e-3b00-4f57-9014-f484df89e3fe'

export const TENANT_ID =
  process.env.NEXT_PUBLIC_TENANT_ID ?? ''

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  'https://oh9dbidjq1.execute-api.ap-south-1.amazonaws.com/dev'

export const AR_BASE =
  process.env.NEXT_PUBLIC_AR_API_BASE ??
  'https://xn1byphl3m.execute-api.ap-south-1.amazonaws.com/dev'

if (typeof window !== 'undefined') {
  if (!RESTAURANT_ID) console.warn('[API] NEXT_PUBLIC_RESTAURANT_ID is not set')
}

// ── MENU_API — ALL calls go through /api/menu proxy (NOT direct to AWS) ───────
export const MENU_API = {

 items:(rid:string)=>
 `/api/menu/restaurants/${rid}/items`,

 item:(id:string,rid:string)=>
 `/api/menu/restaurants/${rid}/items/${id}`,

 categories:(rid:string)=>
 `/api/menu/restaurants/${rid}/categories`

}

// ── AR_API — proxied through /api/ar ─────────────────────────────────────────
export const AR_API = {
  model: (itemId: string, rid = RESTAURANT_ID) =>
    `/api/ar/${rid}/${itemId}`,
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

export const TENANT_ID_KDS     = process.env.NEXT_PUBLIC_TENANT_ID_KDS     ?? 't123'
export const RESTAURANT_ID_KDS = process.env.NEXT_PUBLIC_RESTAURANT_ID_KDS ?? 'r456'
export const ORDERS_API_BASE   =
  process.env.NEXT_PUBLIC_ORDERS_API_BASE ??
  'https://s4qafzisc6.execute-api.ap-south-1.amazonaws.com/dev'

export const ORDERS_API = {
  list:   () => `/api/orders`,
  get:    (orderId: string) => `/api/orders/${orderId}`,
  create: () => `/api/orders`,
  patch:  (orderId: string) => `/api/orders/${orderId}`,
}