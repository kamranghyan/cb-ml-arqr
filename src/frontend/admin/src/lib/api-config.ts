// Sab API base URLs yahan se aate hain (.env se)
export const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''
export const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? ''

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!
export const AR_BASE = process.env.NEXT_PUBLIC_AR_API_BASE!
export const ORDERS_API_BASE = process.env.NEXT_PUBLIC_ORDERS_API_BASE!
export const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_BASE!
export const SUBS_API_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE!
export const SUBS_API = `${SUBS_API_BASE}/api/v1`
export const PAYMENT_API_BASE = process.env.NEXT_PUBLIC_PAYMENT_SVC_API_BASE!

export const MENU_API = {
  items: (rid: string) => `${API_BASE}/restaurants/${rid}/items`,
  item: (id: string, rid: string) => `${API_BASE}/restaurants/${rid}/items/${id}`,
  categories: (rid: string) => `${API_BASE}/restaurants/${rid}/categories`,
  addons: (rid: string, itemId: string) => `${API_BASE}/restaurants/${rid}/items/${itemId}/addons`,
}

export const AR_API = {
  model: (itemId: string, rid = RESTAURANT_ID) => `${AR_BASE}/${rid}/${itemId}`,
}

export const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
}