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
  ADMIN_RESTAURANT_ID,
} from './api-config'
import { getValidIdToken } from './cognito'



export interface ApiAddon {
  addOnId: string;
  tenantId?: string;
  restaurantId?: string;
  categoryId?: string;
  menuItemId: string;
  name: string;
  priceMinorUnits: number;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
}

export interface ApiMenuSize {
  id?: string;
  name: string;
  priceMinorUnits?: number;
  price?: number;
  isActive?: boolean;
}

export interface ApiMenuSlide {
  position: number;
  imageKey?: string;
  imageUrl?: string;
}

export interface ApiMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  categoryId?: string;
  categoryName?: string;

  status: 'active' | 'inactive' | 'draft';

  imageUrl?: string;
  emoji?: string;

  tags?: string[];
  prepTime?: string;
  calories?: number;
  rating?: number;
  reviewCount?: number;
  subtitle?: string;

  restaurantId?: string;
  createdAt?: string;
  updatedAt?: string;

  addons?: ApiAddon[];

  // ✅ CHANGE THESE
  slides?: ApiMenuSlide[];
  sizes?: ApiMenuSize[] | null;
}

export interface ApiMenuResponse {
  items: ApiMenuItem[]
  total?: number
  page?: number
}

// ── Auth-aware fetch — injects token for protected routes ─────────────────────
// src/lib/menu-api.ts

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
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 🔥 FIX: Change from 'x-tenant-id' to 'X-Tenant-Id'
  headers['X-Tenant-Id'] = TENANT_ID;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
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

  let addons: ApiAddon[] = [];

  try {
    addons = await fetchMenuItemAddons(itemId, rid);
  } catch (error) {
    console.warn('Failed to load item addons:', error);
  }

  try {
    const arData = await menuFetch<any>(AR_API.model(itemId, rid))
    return normaliseItem({
      ...item,
      addons,
      arModelUrl: arData.presignedUrl,
    })
  } catch {
    return normaliseItem(item)
  }
}

// ── Create menu item ──────────────────────────────────────────────────────────
export async function createMenuItem(
  payload: Partial<ApiMenuItem> | FormData,
  restaurantId?: string
): Promise<ApiMenuItem> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  // Multipart request — files included
  if (payload instanceof FormData) {
    return menuFetch<ApiMenuItem>(
      MENU_API.items(rid),
      {
        method: 'POST',
        body: payload,
      }
    );
  }

  // JSON request
  const { price, status, ...rest } = payload as any;

  const apiPayload = {
    ...rest,

    ...(price != null && {
      priceMinorUnits: Math.round(Number(price) * 100),
    }),

    ...(status != null && {
      isActive: status === 'active',
    }),
  };

  return menuFetch<ApiMenuItem>(
    MENU_API.items(rid),
    {
      method: 'POST',
      body: JSON.stringify(apiPayload),
    }
  );
}

// ── Update menu item ──────────────────────────────────────────────────────────
// ── Update menu item ──────────────────────────────────────────────────────────
export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  payload: Partial<ApiMenuItem>,
  version?: number
): Promise<any> {
  const token = await getValidIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': TENANT_ID,  // ✅ Add this
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const body: any = {
    ...payload,
  };

  // Add version if provided
  if (version !== undefined) {
    body.version = version;
  }

  // Convert price to priceMinorUnits if price is provided
  if (payload.price !== undefined) {
    body.priceMinorUnits = Math.round(Number(payload.price) * 100);
    delete body.price;
  }

  // Map status to isActive
  if (payload.status) {
    body.isActive = payload.status === 'active';
    delete body.status;
  }

  // Remove any fields that shouldn't be sent
  delete body.addons;
  delete body.slides;
  delete body.sizes;
  delete body.imageUrl;
  delete body.emoji;
  delete body.rating;
  delete body.reviewCount;
  delete body.createdAt;
  delete body.updatedAt;

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `Update failed (${res.status}): ${errorText || res.statusText}`
    );
  }

  const data = await res.json();
  return data;
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

    category:
      item.category ??
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

    addons: item.addons ?? item.addOns ?? [],

    slides: Array.isArray(item.slides)
      ? item.slides.map((slide: any, index: number) => ({
        position: slide.position ?? index + 1,
        imageKey: slide.imageKey ?? '',
        imageUrl: slide.imageUrl ?? '',
      }))
      : [],


    sizes: Array.isArray(item.sizes)
      ? item.sizes.map((size: any) => ({
        id: size.id,
        name: size.name,
        priceMinorUnits: size.priceMinorUnits ?? 0,
        price: (size.priceMinorUnits ?? 0) / 100,
        isActive: size.isActive ?? true,
      }))
      : null,
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

export async function fetchMenuItemAddons(
  itemId: string,
  restaurantId?: string
): Promise<ApiAddon[]> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  const data: any = await menuFetch(
    `${MENU_API.items(rid)}/${itemId}/addons`
  );

  if (Array.isArray(data)) {
    return data;
  }

  return data?.items ?? [];
}

export function extractCategoriesFromItems(
  items: ApiMenuItem[]
): ApiCategory[] {
  const seen = new Map<string, string>()

  for (const item of items) {
    const id = item.categoryId ?? item.category
    const name = item.categoryName ?? item.category ?? id

    if (id && !seen.has(id)) {
      seen.set(id, name)
    }
  }

  return Array.from(seen.entries()).map(([id, name]) => ({
    id,
    name,
  }))
}