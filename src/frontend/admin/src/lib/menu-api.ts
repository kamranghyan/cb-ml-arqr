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

export interface ApiMenuItemSize {
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
  slides?: ApiMenuSlide[];
  sizes?: ApiMenuItemSize[] | null;
  arModelKey?: string;
  arModelUrl?: string;
  imageKey?: string;
}

export interface ApiMenuResponse {
  items: ApiMenuItem[];
}

export interface CreateAddonPayload {
  name: string;
  description?: string;
  priceMinorUnits: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateMenuItemPayload {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  isActive?: boolean;
  prepTime?: string;
  calories?: number;
  allergens?: string[];
  sizes?: { name: string; priceMinorUnits: number }[];
  slides?: { position: number; imageKey?: string }[];
}

// lib/menu-api.ts

export async function createMenuItemWithFiles(
  restaurantId: string,
  payload: {
    name: string;
    description: string;
    price: number;
    categoryId: string;
    isActive: boolean;
    allergens?: string[];
    prepTime?: string;
    calories?: number;
    sizes?: { name: string; price: number }[];
    slides?: { position: number; imageKey?: string }[];
  },
  imageFile?: File | null,
  glbFile?: File | null,
  imageFiles: File[] = [],
): Promise<any> {
  const fd = new FormData();

  // ── Required fields ──
  fd.append('name', payload.name);
  fd.append('description', payload.description);
  fd.append('priceMinorUnits', String(Math.round(payload.price * 100)));
  fd.append('categoryId', payload.categoryId);
  fd.append('isActive', String(payload.isActive));
  fd.append('restaurantId', restaurantId);

  // ── Optional fields ──
  if (payload.allergens?.length) {
    fd.append('allergens', payload.allergens.join(','));
  }

  // ✅ Fix: Convert prepTime to number (backend expects integer)
  if (payload.prepTime) {
    // Extract number from "20 min" -> "20"
    const prepTimeNumber = parseInt(payload.prepTime.replace(/\D/g, ''));
    if (!isNaN(prepTimeNumber)) {
      fd.append('prepTime', String(prepTimeNumber));
    } else {
      fd.append('prepTime', '20'); // Default fallback
    }
  }

  if (payload.calories !== undefined) {
    fd.append('calories', String(payload.calories));
  }

  // ✅ Sizes - send as JSON string
  if (payload.sizes?.length) {
    const sizesPayload = payload.sizes.map(size => ({
      name: size.name,
      priceMinorUnits: Math.round(size.price * 100),
    }));
    fd.append('sizes', JSON.stringify(sizesPayload));
    console.log('📤 Sizes payload:', JSON.stringify(sizesPayload));
  }

  // ✅ Slides - send as JSON string
  if (payload.slides?.length) {
    // Only send slides that have images
    const slidesPayload = payload.slides.map((slide, index) => ({
      position: slide.position || index + 1,
      imageKey: slide.imageKey || '',
    }));
    fd.append('slides', JSON.stringify(slidesPayload));
    console.log('📤 Slides payload:', JSON.stringify(slidesPayload));
  }

  // ── Files ──
  if (imageFile) {
    fd.append('file', imageFile);
    console.log('📎 Main image:', imageFile.name, imageFile.size);
  }

  if (glbFile) {
    fd.append('arFile', glbFile);
    console.log('📎 AR model:', glbFile.name, glbFile.size);
  }

  // Multiple images for slides
  imageFiles.forEach((file, index) => {
    fd.append('images', file);
    console.log(`📎 Slide image ${index + 1}:`, file.name, file.size);
  });

  // ── Debug: Log all FormData entries ──
  console.log('📤 FormData entries:');
  for (const [key, value] of fd.entries()) {
    if (value instanceof File) {
      console.log(`   ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
    } else {
      console.log(`   ${key}: ${value}`);
    }
  }

  const { getValidIdToken } = await import('@/lib/cognito');
  const token = await getValidIdToken();

  if (!token) {
    throw new Error('Authentication token missing.');
  }

  const headers: Record<string, string> = {
    Authorization: token,
    'x-tenant-id': TENANT_ID,
  };

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items`,
    {
      method: 'POST',
      headers,
      body: fd,
    }
  );

  const responseText = await res.text();
  console.log('📥 Response Status:', res.status);
  console.log('📥 Response Body:', responseText);

  if (!res.ok) {
    let errorMessage = `Create failed (${res.status})`;
    try {
      const errorData = JSON.parse(responseText);
      errorMessage = errorData?.detail ||
        errorData?.message ||
        errorData?.error?.message ||
        responseText;
    } catch {
      errorMessage = responseText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

// ── Update Menu Item ─────────────────────────────────────────────────────────

export async function updateMenuItemWithFiles(
  restaurantId: string,
  itemId: string,
  payload: {
    name?: string;
    description?: string;
    price?: number;
    categoryId?: string;
    isActive?: boolean;
    prepTime?: string;
    calories?: number;
    allergens?: string[];
    sizes?: { name: string; price: number }[];
    slides?: { position: number; imageKey?: string }[];
    version?: number;
  },
  imageFile?: File | null,
  glbFile?: File | null,
  imageFiles: File[] = [],
): Promise<ApiMenuItem> {
  const fd = new FormData();

  // ── Text fields ──
  if (payload.name) fd.append('name', payload.name);
  if (payload.description) fd.append('description', payload.description);
  if (payload.price !== undefined) {
    fd.append('priceMinorUnits', String(Math.round(payload.price * 100)));
  }
  if (payload.categoryId) fd.append('categoryId', payload.categoryId);
  if (payload.isActive !== undefined) {
    fd.append('isActive', String(payload.isActive));
  }
  if (payload.prepTime) fd.append('prepTime', String(payload.prepTime));
  if (payload.calories !== undefined) {
    fd.append('calories', String(payload.calories));
  }
  if (payload.allergens?.length) {
    fd.append('allergens', payload.allergens.join(','));
  }

  // ✅ Sizes - send as JSON string
  if (payload.sizes?.length) {
    const sizesPayload = payload.sizes.map(size => ({
      name: size.name,
      priceMinorUnits: Math.round(size.price * 100),
    }));
    fd.append('sizes', JSON.stringify(sizesPayload));
  }

  // ✅ Slides - send as JSON string
  if (payload.slides?.length) {
    const slidesPayload = payload.slides.map((slide, index) => ({
      position: slide.position || index + 1,
      imageKey: slide.imageKey || '',
    }));
    fd.append('slides', JSON.stringify(slidesPayload));
  }

  // ✅ Version for optimistic locking
  if (payload.version !== undefined) {
    fd.append('version', String(payload.version));
  }

  // ── Files ──
  if (imageFile) fd.append('file', imageFile);
  if (glbFile) fd.append('arFile', glbFile);
  imageFiles.forEach(file => fd.append('images', file));

  const token = await getValidIdToken();
  if (!token) throw new Error('Authentication token missing.');

  const headers: Record<string, string> = {
    Authorization: token,
    'X-Tenant-Id': TENANT_ID,
  };

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}`,
    {
      method: 'PUT',
      headers,
      body: fd,
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Update failed (${res.status}): ${txt}`);
  }

  return res.json();
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

// ── Update AddOn ──────────────────────────────────────────────────────────────
export async function updateAddon(
  restaurantId: string,
  itemId: string,
  addOnId: string,
  payload: {
    name: string;
    description?: string;
    priceMinorUnits: number;
    isActive?: boolean;
    sortOrder?: number;
  }
): Promise<ApiAddon> {
  const token = await getValidIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': TENANT_ID,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}/addons/${addOnId}`,
    {
      method: 'PATCH',  // ✅ PUT se PATCH karein
      headers,
      body: JSON.stringify({
        ...payload,
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Addon update failed (${res.status}): ${errorText}`);
  }

  return res.json();
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

// ── Delete AddOn ──────────────────────────────────────────────────────────────
export async function deleteAddon(
  restaurantId: string,
  itemId: string,
  addOnId: string
): Promise<void> {
  const token = await getValidIdToken();

  const headers: Record<string, string> = {
    'X-Tenant-Id': TENANT_ID,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}/addons/${addOnId}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Addon delete failed (${res.status}): ${errorText}`);
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




export async function createAddon(
  restaurantId: string,
  itemId: string,
  payload: CreateAddonPayload
): Promise<ApiAddon> {
  const token = await getValidIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': TENANT_ID,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}/addons`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Addon creation failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

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

    addons: item.addOns ?? item.addOns ?? [],

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