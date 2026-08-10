/**
 * Admin API service — restaurants, categories, tables CRUD.
 *
 * All calls go through the /api/menu proxy (which adds X-Tenant-Id server-side
 * and forwards the Authorization token). Mutations require an admin/tenant
 * token; the token is injected client-side, mirroring menu-api.ts.
 */

import { RESTAURANT_ID } from './api-config'
import { getValidIdToken } from './cognito'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiAddress {
  street: string
  city: string
  country: string
  postcode: string
}

export interface ApiSocialMedia {
  x?: string | null
  youtube?: string | null
  instagram?: string | null
  linkedin?: string | null
  tiktok?: string | null
  facebook?: string | null
}

export interface ApiRestaurant {

  restaurantId: string
  tenantId?: string

  name: string

  address: ApiAddress

  timezone: string
  currencyCode: string
  isActive: boolean


  logoKey?: string | null
  logoUrl?: string | null

  bannerKey?: string | null
  bannerUrl?: string | null


  ratingValue?: number | null
  ratingCount?: number | null


  tagline?: string
  openingHours?: string
  deliveryNote?: string
  cuisineTags?: string[]


  // ADD
  socialMedia?: ApiSocialMedia


  createdAt?: string
  updatedAt?: string
}

export interface ApiCategory {
  categoryId: string
  restaurantId: string
  tenantId?: string
  name: string
  displayOrder: number
  isActive: boolean

  imageKey?: string | null
  imageUrl?: string | null

  createdAt?: string
  updatedAt?: string
}

export interface ApiTable {
  tableId: string
  restaurantId: string
  tenantId?: string
  tableNumber: string
  zone: string
  outlet: string
  capacity: number
  createdAt?: string
  updatedAt?: string
}

interface Paginated<T> {
  items: T[]
  count: number
  lastEvaluatedKey?: string | null
}

// ── Auth-aware fetch (same pattern as menu-api.ts) ────────────────────────────
async function adminFetch<T = any>(
  path: string,
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

  const res = await fetch(`/api/menu${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Not authorised — please log in as an admin or tenant.'
      );
    }

    throw new Error(
      `API ${res.status}: ${text || res.statusText}`
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.text();

  return (body ? JSON.parse(body) : undefined) as T;
}

// ══════════════════════════════════════════════════════════════════════════════
// Restaurants
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchRestaurants(): Promise<ApiRestaurant[]> {
  const data = await adminFetch<Paginated<ApiRestaurant>>('/restaurants')
  return data.items ?? []
}

export async function fetchRestaurant(
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiRestaurant> {
  return adminFetch<ApiRestaurant>(`/restaurants/${restaurantId}`)
}

export async function createRestaurant(
  payload: Omit<ApiRestaurant, 'restaurantId'>,
): Promise<ApiRestaurant> {
  return adminFetch<ApiRestaurant>('/restaurants', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateRestaurant(
  restaurantId: string,
  payload: Partial<Omit<ApiRestaurant, 'restaurantId'>>,
): Promise<ApiRestaurant> {
  return adminFetch<ApiRestaurant>(`/restaurants/${restaurantId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteRestaurant(restaurantId: string): Promise<void> {
  await adminFetch<void>(`/restaurants/${restaurantId}`, { method: 'DELETE' })
}

// ══════════════════════════════════════════════════════════════════════════════
// Categories
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchCategories(
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiCategory[]> {

  const data = await adminFetch<any>(
    `/restaurants/${restaurantId}/categories`
  );

  console.log('CATEGORY API RESPONSE:', data);

  return data.items ?? [];
}

export async function fetchCategory(
  categoryId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiCategory> {
  return adminFetch<ApiCategory>(
    `/restaurants/${restaurantId}/categories/${categoryId}`,
  )
}

export async function createCategory(
  payload: {
    name: string;
    displayOrder?: number;
    isActive?: boolean;
  },
  restaurantId: string,
  imageFile?: File | null
): Promise<ApiCategory> {

  const token = await getValidIdToken()

  const form = new FormData()

  form.append('name', payload.name)
  form.append(
    'displayOrder',
    String(payload.displayOrder ?? 0)
  )

  form.append(
    'isActive',
    String(payload.isActive ?? true)
  )


  if (imageFile) {
    form.append('file', imageFile)
  }


  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/categories`,
    {
      method: 'POST',
      headers: token
        ? { Authorization: token }
        : {},
      body: form
    }
  )


  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }


  return res.json()
}

export async function updateCategory(
  categoryId: string,
  payload: {
    name?: string
    displayOrder?: number
    isActive?: boolean
  },
  restaurantId: string = RESTAURANT_ID,
  imageFile?: File | null
): Promise<ApiCategory> {


  const token = await getValidIdToken()


  const form = new FormData()


  if (payload.name)
    form.append('name', payload.name)


  if (payload.displayOrder !== undefined)
    form.append(
      'displayOrder',
      String(payload.displayOrder)
    )


  if (payload.isActive !== undefined)
    form.append(
      'isActive',
      String(payload.isActive)
    )


  if (imageFile)
    form.append('file', imageFile)



  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/categories/${categoryId}`,
    {
      method: 'PUT',
      headers: token
        ? { Authorization: token }
        : {},
      body: form
    }
  )


  if (!res.ok) {
    throw new Error(await res.text())
  }


  return res.json()

}

export async function deleteCategory(
  categoryId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<void> {
  await adminFetch<void>(
    `/restaurants/${restaurantId}/categories/${categoryId}`,
    { method: 'DELETE' },
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tables
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchTables(
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiTable[]> {
  // NOTE: the tables endpoint returns { tables: [...] }, unlike restaurants
  // and categories which return { items: [...] }. Handle both to be safe.
  const data = await adminFetch<{ tables?: ApiTable[]; items?: ApiTable[] }>(
    `/restaurants/${restaurantId}/tables`,
  )
  return data.tables ?? data.items ?? []
}

export async function createTable(
  payload: {
    tableNumber: string
    zone?: string
    outlet?: string
    capacity?: number
  },
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiTable> {
  return adminFetch<ApiTable>(`/restaurants/${restaurantId}/tables`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTable(
  tableId: string,
  payload: Partial<{
    tableNumber: string
    zone: string
    outlet: string
    capacity: number
  }>,
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiTable> {
  return adminFetch<ApiTable>(
    `/restaurants/${restaurantId}/tables/${tableId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
}

export async function deleteTable(
  tableId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<void> {
  await adminFetch<void>(
    `/restaurants/${restaurantId}/tables/${tableId}`,
    { method: 'DELETE' },
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Uploads (multipart — logo / images)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Upload a restaurant logo. `file` is a File/Blob from an <input type=file>.
 * Returns the stored s3Key (save it onto the restaurant via updateRestaurant).
 */
export async function uploadRestaurantLogo(
  file: File,
  restaurantId: string = RESTAURANT_ID,
): Promise<{ s3Key: string; url: string }> {
  const token = await getValidIdToken()
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(
    `/api/menu/upload/restaurants/${restaurantId}/logo`,
    {
      method: 'POST',
      headers: token ? { Authorization: token } : {},
      body: form,
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Logo upload ${res.status}: ${text}`)
  }
  return res.json()
}
export async function uploadRestaurantBanner(
  file: File,
  restaurantId: string,
): Promise<{ s3Key: string; url: string }> {
  const token = await getValidIdToken();

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(
    `/api/menu/upload/restaurants/${restaurantId}/banner`,
    {
      method: 'POST',
      headers: token
        ? { Authorization: token }
        : {},
      body: form,
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Banner upload ${res.status}: ${text}`);
  }

  return res.json();
}
/**
 * Upload a category image. Field name must be `file`.
 */
export async function uploadCategoryImage(
  file: File,
  categoryId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<{ s3Key: string; url: string }> {
  const token = await getValidIdToken()
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(
    `/api/menu/upload/restaurants/${restaurantId}/categories/${categoryId}/image`,
    {
      method: 'POST',
      headers: token ? { Authorization: token } : {},
      body: form,
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Category image upload ${res.status}: ${text}`)
  }
  return res.json()
}