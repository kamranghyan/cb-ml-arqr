/**
 * Menu API service
 * All calls go through /api/menu proxy — avoids CORS, adds X-Tenant-Id server-side.
 * Authorization token injected client-side before proxying.
 */

import { MENU_API, AR_API, ADDON_API, RESTAURANT_ID, ADMIN_RESTAURANT_ID } from './api-config'
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
  
  // ✅ Added slides and sizes
  slides?: { position: number; imageUrl: string; imageKey?: string }[]
  sizes?: { name: string; price: number; priceMinorUnits?: number }[]
  
  // AR properties
  arModelUrl?: string
  arModelKey?: string
  imageKey?: string
  hasArModel?: boolean
  version?: number
}

export interface ApiMenuResponse {
  items: ApiMenuItem[]
  total?: number
  page?: number
}

// ── Add-on ("Extra Toppings") ────────────────────────────────────────────────
export interface ApiAddOn {
  addOnId: string
  menuItemId: string
  name: string
  price: number      // major units (Rs.), normalised from priceMinorUnits if present
  isActive: boolean
  sortOrder: number
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

  timezone?: string;
  currencyCode?: string;
  isActive?: boolean;

  createdAt?: string;
  updatedAt?: string;

  logoKey?: string | null;
  bannerKey?: string | null;

  logoUrl?: string | null;
  bannerUrl?: string | null;

  cuisineTags?: string[];
  openingHours?: string;

  ratingValue?: number;
  ratingCount?: number;

  deliveryNote?: string;

  socialMedia?: {
    instagram?: string | null;
    facebook?: string | null;
    youtube?: string | null;
    linkedin?: string | null;
    tiktok?: string | null;
    x?: string | null;
  };
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

// ── Fetch add-ons ("Extra Toppings") for a menu item ──────────────────────────
export async function fetchAddOns(itemId: string, restaurantId?: string): Promise<ApiAddOn[]> {
  const rid = restaurantId?.trim() || RESTAURANT_ID
  try {
    const data = await menuFetch<any>(ADDON_API.list(itemId, rid))
    const raw: any[] = Array.isArray(data) ? data : (data?.items ?? [])

    console.log('🧩 Raw add-on data:', raw)

    return raw
      .map((a): ApiAddOn => ({
        addOnId:    a.addOnId ?? a.id ?? '',
        menuItemId: a.menuItemId ?? itemId,
        name:       a.name ?? 'Add-on',
        price:      a.priceMinorUnits != null ? Number(a.priceMinorUnits) / 100 : Number(a.price ?? 0),
        isActive:   a.isActive ?? true,
        sortOrder:  a.sortOrder ?? 0,
      }))
      .filter(a => a.isActive && a.addOnId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  } catch (err) {
    console.warn('No add-ons for this item (or fetch failed):', err)
    return []
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
export async function fetchRestaurantById(
  restaurantId: string
): Promise<RestaurantData | null> {
  try {
    const rid = restaurantId.trim();

    if (!rid) return null;

    const data = await menuFetch<RestaurantData>(
      `/api/menu/restaurants/${rid}`
    );

    console.log('🏪 Restaurant by ID:', data);

    return data;
  } catch (error) {
    console.error('❌ Failed to fetch restaurant by ID:', error);
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
  console.log("📦 RAW ITEM:", raw);
  
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

  const categoryId =
    raw.categoryId ??
    raw.category?.id ??
    '';

  const CATEGORY_MAP: Record<string, string> = {
    "c840f14d-fa93-40af-9f16-f4f35fc3f27a": "Fast Food",
    "567d9886-3c01-4ba9-9946-c3607f80091e": "Starter",
    "e933848e-0d18-4e3a-b0a8-d70275c2fa54": "Main Course",
  };

  const categoryName =
    raw.categoryName ??
    raw.category?.name ??
    CATEGORY_MAP[categoryId] ??
    'Other';

  // ✅ Parse slides
  let slides: { position: number; imageUrl: string; imageKey?: string }[] = [];
  if (raw.slides && Array.isArray(raw.slides)) {
    slides = raw.slides.map((slide: any) => ({
      position: slide.position ?? 0,
      imageUrl: slide.imageUrl ?? slide.url ?? '',
      imageKey: slide.imageKey ?? '',
    })).filter((s: { imageUrl: string }) => s.imageUrl); // Remove empty imageUrls
  }
  console.log("📸 Slides parsed:", slides);

  // ✅ Parse sizes
  let sizes: { name: string; price: number; priceMinorUnits?: number }[] = [];
  if (raw.sizes && Array.isArray(raw.sizes)) {
    sizes = raw.sizes.map((size: any) => ({
      name: size.name ?? '',
      price: size.price != null ? size.price : (size.priceMinorUnits != null ? size.priceMinorUnits / 100 : 0),
      priceMinorUnits: size.priceMinorUnits ?? (size.price != null ? Math.round(size.price * 100) : 0),
    }));
  }
  console.log("📏 Sizes parsed:", sizes);

  return {
    ...raw,
    id,
    price,
    status,
    allergens,
    hasArModel,
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
    // ✅ Include slides and sizes
    slides,
    sizes,
  }
}

export interface ApiCategory {
  categoryId: string;
  name: string;
  slug?: string;
  imageUrl?: string | null;
}

interface ApiCategoriesResponse {
  items: ApiCategory[];
}

export async function fetchCategories(
  restaurantId: string
): Promise<ApiCategory[]> {
  const res = await menuFetch<ApiCategory[] | ApiCategoriesResponse>(
    `/api/menu/restaurants/${restaurantId}/categories`
  );

  const categories = Array.isArray(res)
    ? res
    : res.items ?? [];

  return categories
    .map((category: any): ApiCategory => ({
      categoryId:
        category.categoryId ??
        category.id ??
        '',
      name: category.name ?? '',
      slug: category.slug,
      imageUrl: category.imageUrl ?? null,
    }))
    .filter(
      (category) =>
        Boolean(category.categoryId) &&
        Boolean(category.name)
    );
}
// app/restaurants/[restaurantId]/menu/page.tsx

async function createMenuItemWithFiles(
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
    slides?: { position: number; imageKey: string }[];
  },
  imageFile?: File | null,
  glbFile?: File | null,
  imageFiles: File[] = [],
): Promise<any> {
  const fd = new FormData();

  // ── Text fields ──
  fd.append('name', payload.name);
  fd.append('description', payload.description);
  fd.append('priceMinorUnits', String(Math.round(payload.price * 100)));
  fd.append('categoryId', payload.categoryId);
  fd.append('isActive', String(payload.isActive));
  fd.append('restaurantId', restaurantId);

  if (payload.allergens?.length) {
    fd.append('allergens', payload.allergens.join(','));
  }
  if (payload.prepTime) {
    fd.append('prepTime', payload.prepTime);
  }
  if (payload.calories !== undefined) {
    fd.append('calories', String(payload.calories));
  }

  // ✅ Sizes as JSON string
  if (payload.sizes?.length) {
    const sizesPayload = payload.sizes.map(size => ({
      name: size.name,
      priceMinorUnits: Math.round(size.price * 100),
    }));
    fd.append('sizes', JSON.stringify(sizesPayload));
  }

  // ✅ Slides as JSON string
  if (payload.slides?.length) {
    const slidesPayload = payload.slides.map((slide, index) => ({
      position: slide.position || index + 1,
      imageKey: slide.imageKey || '',
    }));
    fd.append('slides', JSON.stringify(slidesPayload));
    console.log('📤 Slides payload:', JSON.stringify(slidesPayload));
  }

  // ── Main image ──
  if (imageFile) {
    fd.append('file', imageFile);
  }

  // ── AR model ──
  if (glbFile) {
    fd.append('arFile', glbFile);
  }

  // ✅ Multiple images for slides - YAHAN CHANGES KARNI HAIN
  console.log(`📎 Sending ${imageFiles.length} slide images`);
  imageFiles.forEach((file, index) => {
    fd.append('images', file);
    console.log(`📎 Slide image ${index + 1}:`, file.name, file.size, file.type);
  });

  // 📤 Debug: Log all FormData entries
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
    'x-tenant-id': restaurantId,
  };

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items`,
    {
      method: 'POST',
      headers,
      body: fd,
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Create failed (${res.status}): ${txt}`);
  }

  return res.json();
}


export function extractCategoriesFromItems(
  items: ApiMenuItem[]
): ApiCategory[] {
  const seen = new Map<string, string>();

  for (const item of items) {
    const id = item.categoryId ?? item.category;
    const name = item.categoryName ?? item.category ?? id;

    if (id && !seen.has(id)) {
      seen.set(id, name);
    }
  }

  return Array.from(seen.entries()).map(
    ([categoryId, name]) => ({
      categoryId,
      name,
    })
  );
}