/**
 * Menu API service
 * All calls go through /api/menu proxy — avoids CORS, adds X-Tenant-Id server-side.
 * Authorization token injected client-side before proxying.
 */

import {
  MENU_API,
  AR_API,
  RESTAURANT_ID,
  TENANT_ID,
} from './api-config'
import { getValidIdToken } from './cognito'



export interface ApiMenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  categoryId?: string
  categoryName?: string
  status: 'active' | 'inactive' | 'draft'
  imageUrl?: string
  emoji?: string
  tags?: string[]
  prepTime?: string
  calories?: number
  protein?: number
  fat?: number
  carbs?: number
  rating?: number
  reviewCount?: number
  allergens?: { name: string; emoji: string; status: 'present' | 'free' }[]
  subtitle?: string
  customisations?: {
    doneness?: string[]
    sides?: string[]
    sauces?: string[]
  }
  restaurantId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ApiMenuResponse {
  items: ApiMenuItem[]
  total?: number
  page?: number
}

// ── Auth-aware fetch — injects token for protected routes ─────────────────────
async function menuFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidIdToken();

  const headers: Record<string, string> = {
    ...(options.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = token;
  }

  headers['x-tenant-id'] = TENANT_ID;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    throw new Error(
      `API ${res.status}: ${text || res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

// ── Fetch all menu items ───────────────────────────────────────────────────────
export async function fetchMenuItems(
  restaurantId?: string
): Promise<ApiMenuItem[]> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  const data = await menuFetch<ApiMenuResponse | ApiMenuItem[]>(
    MENU_API.items(rid)
  );

  const items = Array.isArray(data)
    ? data
    : data?.items ?? [];

  return items.map(normaliseItem);
}

// ── Fetch single item + AR model ──────────────────────────────────────────────
export async function fetchMenuItem(
  itemId: string,
  restaurantId?: string
): Promise<any> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  const item = await menuFetch(
    MENU_API.item(itemId, rid)
  );

  try {
    const arData = await menuFetch<any>(AR_API.model(itemId, rid))
    return normaliseItem({ ...item, arModelUrl: arData.presignedUrl })
  } catch {
    return normaliseItem(item)
  }
}

// ── Create menu item ──────────────────────────────────────────────────────────
export async function createMenuItem(payload: Partial<ApiMenuItem>): Promise<ApiMenuItem> {
  const { price, status, ...rest } = payload as any
  const apiPayload = {
    ...rest,
    priceMinorUnits: Math.round((price ?? 0) * 100),
    ...(status != null && { isActive: status === 'active' }),
  }
  return menuFetch<ApiMenuItem>(MENU_API.items(ADMIN_RESTAURANT_ID), {
    method: 'POST',
    body: JSON.stringify(apiPayload),
  })
}

// ── Update menu item ──────────────────────────────────────────────────────────
export async function updateMenuItem(
  itemId: string,
  payload: Partial<ApiMenuItem>,
  version?: number,
  restaurantId?: string,
): Promise<any> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  const { price, status, ...rest } = payload as any;

  const apiPayload = {
    ...rest,

    ...(price != null && {
      priceMinorUnits: Math.round(Number(price) * 100),
    }),

    ...(status != null && {
      isActive: status === 'active',
    }),

    ...(version != null && {
      version,
    }),
  };

  return menuFetch(
    MENU_API.item(itemId, rid),
    {
      method: 'PUT',
      body: JSON.stringify(apiPayload),
    }
  );
}

// ── Delete menu item ──────────────────────────────────────────────────────────
export async function deleteMenuItem(
  itemId: string,
  restaurantId?: string,
): Promise<void> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  await menuFetch(
    MENU_API.item(itemId, rid),
    {
      method: 'DELETE',
    }
  );
}

// ── Normalise raw API response ────────────────────────────────────────────────
export function normaliseItem(item: any): ApiMenuItem {
  return {
    ...item,

    id: item.id ?? item.itemId,

    categoryId:
      item.categoryId ??
      item.category?.id ??
      '',

    categoryName:
      item.categoryName ??
      item.category?.name ??
      '',

    name: item.name ?? '',
    description: item.description ?? '',
    price:
      item.price ??
      ((item.priceMinorUnits ?? 0) / 100),

    status:
      item.status ??
      (item.isActive ? 'active' : 'inactive'),
  };
}

export interface ApiCategory { id: string; name: string; slug?: string }

export async function fetchCategories(
  restaurantId?: string
): Promise<ApiCategory[]> {

  const rid = restaurantId?.trim() || RESTAURANT_ID;

  const data: any = await menuFetch(
    MENU_API.categories(rid)
  );

  if (Array.isArray(data)) {
    return data;
  }

  if (data?.items) {
    return data.items;
  }

  return [];
}

export function extractCategoriesFromItems(items: ApiMenuItem[]): ApiCategory[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const id = (item as any).categoryId ?? item.category
    const name = item.category ?? id
    if (id && !seen.has(id)) seen.set(id, name)
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
}