// lib/api-client.ts
import { getValidIdToken } from './cognito';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const ORDERS_BASE = process.env.NEXT_PUBLIC_ORDERS_API_BASE;
const AR_BASE = process.env.NEXT_PUBLIC_AR_API_BASE;

// ---- Tenant Cache (shared) ----
const tenantCache = new Map<string, { tenantId: string; at: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveTenant(restaurantId: string): Promise<string> {
  if (!restaurantId) return '';
  const hit = tenantCache.get(restaurantId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenantId;
  try {
    const res = await fetch(`${API_BASE}/menus/restaurants/${restaurantId}`, { cache: 'no-store' });
    if (!res.ok) return '';
    const tenantId = (await res.json())?.tenantId ?? '';
    if (tenantId) tenantCache.set(restaurantId, { tenantId, at: Date.now() });
    return tenantId;
  } catch { return ''; }
}

// ---- Centralized fetch with auth & tenant ----
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  restaurantId?: string,
  tenantId?: string
): Promise<T> {
  const token = await getValidIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = token;
  
  // Auto-resolve tenant if not provided
  let finalTenantId = tenantId;
  if (restaurantId && !finalTenantId) {
    finalTenantId = await resolveTenant(restaurantId);
  }
  if (finalTenantId) headers['X-Tenant-Id'] = finalTenantId;

  const res = await fetch(path, {
    ...options,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as T;
}

// ---- Specific APIs ----
export const menuApi = {
  items: (restaurantId: string) => `/api/menu/restaurants/${restaurantId}/items`,
  item: (restaurantId: string, itemId: string) => `/api/menu/restaurants/${restaurantId}/items/${itemId}`,
  categories: (restaurantId: string) => `/api/menu/restaurants/${restaurantId}/categories`,
  restaurant: (restaurantId: string) => `/api/menu/restaurants/${restaurantId}`,
  tables: (restaurantId: string) => `/api/menu/restaurants/${restaurantId}/tables`,
};

export const ordersApi = {
  list: (restaurantId: string) => `/api/orders?rid=${restaurantId}`,
  get: (orderId: string) => `/api/orders/${orderId}`,
  create: () => `/api/orders`,
  patch: (orderId: string) => `/api/orders/${orderId}`,
};

export const arApi = {
  model: (restaurantId: string, itemId: string) => `/api/ar?rid=${restaurantId}&iid=${itemId}`,
};