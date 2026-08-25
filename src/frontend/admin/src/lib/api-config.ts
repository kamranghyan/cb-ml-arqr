/**
 * Central API configuration
 * MENU_API uses /api/menu proxy — no direct browser-to-AWS calls.
 */

// ─── Dynamic values from token (fallback only) ───

export const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''

export const ADMIN_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID ?? ''

export const TENANT_ID =
  process.env.NEXT_PUBLIC_TENANT_ID ?? ''

// ─── Static values (don't come from token) ───

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  'https://j024yuqlaa.execute-api.ap-south-1.amazonaws.com/Stage'

export const AR_BASE =
  process.env.NEXT_PUBLIC_AR_API_BASE ??
  'https://j024yuqlaa.execute-api.ap-south-1.amazonaws.com/Stage'

// ─── Warnings ───

if (typeof window !== 'undefined') {
  if (!RESTAURANT_ID) {
    console.warn('[API] NEXT_PUBLIC_RESTAURANT_ID not set - will use from token')
  }
  if (!TENANT_ID) {
    console.warn('[API] NEXT_PUBLIC_TENANT_ID not set - will use from token')
  }
  if (!process.env.NEXT_PUBLIC_API_BASE) {
    console.warn('[API] Using default API_BASE:', API_BASE)
  }
}

// ─── MENU API ───

export const MENU_API = {
  items: (rid: string) => `/api/menu/restaurants/${rid}/items`,
  item: (id: string, rid: string) => `/api/menu/restaurants/${rid}/items/${id}`,
  categories: (rid: string) => `/api/menu/restaurants/${rid}/categories`,
  addons: (rid: string, itemId: string) => `/api/menu/restaurants/${rid}/items/${itemId}/addons`,
}

// ─── AR API ───

export const AR_API = {
  model: (itemId: string, rid = RESTAURANT_ID) => `/api/ar/${rid}/${itemId}`,
}

// ─── QR API ───

export const QR_API = {
  generate: '/api/qr/generate',
}

// ─── Generic API fetch ───

export const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }

  return res.json() as Promise<T>
}

// ─── KDS / Orders ───

export const TENANT_ID_KDS =
  process.env.NEXT_PUBLIC_TENANT_ID_KDS ?? 't123'

export const RESTAURANT_ID_KDS =
  process.env.NEXT_PUBLIC_RESTAURANT_ID_KDS ?? 'r456'

export const ORDERS_API_BASE =
  process.env.NEXT_PUBLIC_ORDERS_API_BASE

export const ORDERS_API = {
  list: () => '/api/orders',
  get: (orderId: string) => `/api/orders/${orderId}`,
  create: () => '/api/orders',
  patch: (orderId: string) => `/api/orders/${orderId}`,
}