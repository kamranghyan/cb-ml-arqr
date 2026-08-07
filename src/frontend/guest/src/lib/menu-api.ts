/**
 * Menu API service
 * All calls go through /api/menu proxy — avoids CORS, adds X-Tenant-Id server-side.
 * Authorization token injected client-side before proxying.
 */

import { MENU_API, AR_API, RESTAURANT_ID, ADMIN_RESTAURANT_ID } from './api-config'
import { getValidIdToken } from './cognito'

export interface ApiMenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  categoryId?: string
  categoryName?: string;
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

// ── Restaurant Data Types ──────────────────────────────────────────────────────
export interface RestaurantData {
  restaurantId: string;
  tenantId: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
    postcode?: string;
  };
  timezone: string;
  currencyCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  logoKey: string | null;
  bannerKey: string | null;
  logoUrl?: string | null;
}

export interface RestaurantsResponse {
  items: RestaurantData[];
  count: number;
  lastEvaluatedKey?: string | null;
}

export interface TenantData {
  tenantId: string;
  companyName?: string;
  email?: string;
  planTier?: string;
  maxRestaurants?: number;
  restaurantCount?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantsResponse {
  tenants: TenantData[];
  count: number;
}

// ── Auth-aware fetch — injects token for protected routes ─────────────────────
async function menuFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getValidIdToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) headers['Authorization'] = token

  const res = await fetch(url, { ...options, headers })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }

  return res.json() as Promise<T>
}

// ── Fetch all menu items ───────────────────────────────────────────────────────
export async function fetchMenuItems(restaurantId?: string): Promise<ApiMenuItem[]> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  const data = await menuFetch<ApiMenuResponse | ApiMenuItem[]>(MENU_API.items(rid));

  console.log("RAW MENU API RESPONSE:", data);
  let items: any[] = []
  if (Array.isArray(data)) items = data
  else if (data && 'items' in data) items = (data as ApiMenuResponse).items
  console.log("ITEMS BEFORE NORMALIZE:", items);
  return items.map(normaliseItem)
}

// ── Fetch single item + AR model ──────────────────────────────────────────────
export async function fetchMenuItem(itemId: string, restaurantId?: string): Promise<ApiMenuItem> {
  const rid = restaurantId?.trim() || RESTAURANT_ID

  const item = await menuFetch<any>(MENU_API.item(itemId, rid))

  const arData = await fetchARModel(itemId, rid)

  if (arData && arData.presignedUrl) {
    return normaliseItem({ ...item, arModelUrl: arData.presignedUrl, hasArModel: true })
  }

  return normaliseItem({ ...item, hasArModel: false })
}

async function fetchARModel(itemId: string, rid: string): Promise<any | null> {
  try {
    const res = await fetch(AR_API.model(itemId, rid), {
      headers: { 'x-tenant-id': rid }
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── Restaurant APIs ───────────────────────────────────

/**
 * Fetch all restaurants for a tenant
 * GET /api/menu/restaurants
 */
export async function fetchRestaurants(restaurantId?: string): Promise<RestaurantsResponse> {
  const rid = restaurantId?.trim() || RESTAURANT_ID;

  try {
    console.log('🏪 Fetching restaurants with rid:', rid);

    // ✅ Use the proxy endpoint
    const response = await fetch(`/api/menu/restaurants?rid=${rid}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': rid,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`Failed to fetch restaurants: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Restaurants fetched:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching restaurants:', error);
    throw error;
  }
}

/**
 * Fetch a single restaurant by ID
 * GET /api/menu/restaurants/{restaurantId}
 */
export async function fetchRestaurantById(restaurantId: string): Promise<RestaurantData | null> {
  try {
    console.log(`🔍 Fetching restaurant by ID: ${restaurantId}`);

    const response = await fetch(`/api/menu/restaurants/${restaurantId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': restaurantId,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ Restaurant ${restaurantId} not found`);
        return null;
      }
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`Failed to fetch restaurant: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Restaurant fetched:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching restaurant:', error);
    return null;
  }
}

/**
 * Fetch all tenants (for company name lookup)
 * GET /api/auth-svc/auth/tenants
 */
export async function fetchTenants(): Promise<TenantsResponse> {
  try {
    console.log('🏢 Fetching tenants...');

    const response = await fetch(`/api/auth-svc/auth/tenants`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`Failed to fetch tenants: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Tenants fetched:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching tenants:', error);
    throw error;
  }
}

/**
 * Fetch company name by tenant ID
 */
export async function fetchCompanyName(tenantId: string): Promise<string | null> {
  try {
    console.log(`🏢 Fetching company name for tenant: ${tenantId}`);

    const response = await fetchTenants();
    const tenant = response.tenants.find((t: TenantData) => t.tenantId === tenantId);

    if (!tenant) {
      console.warn(`⚠️ Tenant with ID ${tenantId} not found`);
      return null;
    }

    console.log(`✅ Company name found: "${tenant.companyName}"`);
    return tenant.companyName || null;
  } catch (error) {
    console.error('❌ Error fetching company name:', error);
    return null;
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
): Promise<ApiMenuItem> {
  const { price, status, ...rest } = payload as any
  const apiPayload = {
    ...rest,
    priceMinorUnits: Math.round((price ?? 0) * 100),
    ...(status != null && { isActive: status === 'active' }),
    ...(version != null && { version }),
  }
  return menuFetch<ApiMenuItem>(MENU_API.item(itemId, ADMIN_RESTAURANT_ID), {
    method: 'PUT',
    body: JSON.stringify(apiPayload),
  })
}

// ── Delete menu item ──────────────────────────────────────────────────────────
export async function deleteMenuItem(itemId: string): Promise<void> {
  await menuFetch<void>(MENU_API.item(itemId, ADMIN_RESTAURANT_ID), { method: 'DELETE' })
}

// ── Normalise raw API response ────────────────────────────────────────────────
export function normaliseItem(raw: any): ApiMenuItem {
  console.log("RAW ITEM:", raw);
  const id = raw.id ?? raw.itemId ?? raw.item_id ?? raw._id ?? crypto.randomUUID()

  const price = raw.priceMinorUnits != null
    ? Number(raw.priceMinorUnits) / 100
    : Number(raw.price ?? raw.unitPrice ?? 0)

  const status: 'active' | 'inactive' | 'draft' =
    raw.status ?? (raw.isActive === true ? 'active' : raw.isActive === false ? 'inactive' : 'active')

  const rawAllergens = raw.allergens ?? []
  const allergens = Array.isArray(rawAllergens) && typeof rawAllergens[0] === 'string'
    ? rawAllergens.map((a: string) => ({
      name: a.charAt(0) + a.slice(1).toLowerCase(),
      emoji: a === 'GLUTEN' ? '🌾' : a === 'DAIRY' ? '🥛' : a === 'NUTS' ? '🥜' : a === 'EGG' ? '🥚' : a === 'FISH' ? '🐟' : '⚠️',
      status: 'present' as const,
    }))
    : rawAllergens

  const hasArModel = !!(raw.arModelUrl || raw.arModelKey)

  const KNOWN_CATS: Record<string, string> = {
    'e933848e-0d18-4e3a-b0a8-d70275c2fa54': 'Main Course',
  }
  const rawCategory = raw.category ?? raw.categoryId ?? 'other'
  const CATEGORY_MAP: Record<string, string> = {
    "c840f14d-fa93-40af-9f16-f4f35fc3f27a": "Fast Food",
    "567d9886-3c01-4ba9-9946-c3607f80091e": "Starter",
    "e933848e-0d18-4e3a-b0a8-d70275c2fa54": "Main Course",
  };


  const categoryId =
    raw.categoryId ??
    raw.category?.id ??
    '';

  const categoryName =
    raw.categoryName ??
    raw.category?.name ??
    CATEGORY_MAP[categoryId] ??
    'Other';

  console.log("CATEGORY DEBUG:", {
    rawCategory: raw.category,
    categoryId,
    categoryName
  });

  return {
    ...raw,
    id, price, status, allergens, hasArModel,
    emoji: raw.emoji ?? '🍽️',
    tags: raw.tags ?? [],
    rating: raw.rating ?? 4.5,
    reviewCount: raw.reviewCount ?? 0,
    prepTime: raw.prepTime ?? raw.prep_time ?? '20 min',
    calories: raw.calories ?? 0,
    protein: raw.protein ?? 0,
    fat: raw.fat ?? 0,
    carbs: raw.carbs ?? 0,
    subtitle: raw.subtitle ?? raw.subTitle ?? '',
    name: raw.name ?? raw.itemName ?? 'Unnamed Item',
    description: raw.description ?? raw.desc ?? '',
    categoryId,
    categoryName,
    category: categoryName,
    imageUrl: raw.imageUrl ?? null,
    arModelUrl: raw.arModelUrl ?? null,
    arModelKey: raw.arModelKey ?? null,
    imageKey: raw.imageKey ?? null,
    version: raw.version ?? 1,
  }
}

export interface ApiCategory {
  id?: string;
  categoryId?: string;
  name: string;
  slug?: string;
}

export async function fetchCategories(restaurantId: string): Promise<ApiCategory[]> {

  const res = await menuFetch<any>(
    `/api/menu/restaurants/${restaurantId}/categories`
  );

  return res.items ?? res;
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