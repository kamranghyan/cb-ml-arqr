// lib/admin-api.ts

import { RESTAURANT_ID } from './api-config'
import { getValidIdToken } from './cognito'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiAddress {
  street:   string
  city:     string
  country:  string
  postcode: string
}

export interface ApiRestaurant {
  restaurantId: string
  tenantId?:    string
  name:         string
  address:      ApiAddress
  timezone:     string
  currencyCode: string
  isActive:     boolean
  logoKey?:     string | null
  logoUrl?:     string | null
  createdAt?:   string
  updatedAt?:   string
}

export interface ApiCategory {
  categoryId:   string
  restaurantId: string
  tenantId?:    string
  name:         string
  description?: string
  displayOrder: number
  isActive:     boolean
  imageKey?:    string | null
  imageUrl?:    string | null
  createdAt?:   string
  updatedAt?:   string
}

export interface ApiTable {
  tableId:      string
  restaurantId: string
  tenantId?:    string
  tableNumber:  string
  zone:         string
  outlet:       string
  capacity:     number
  isActive?:    boolean
  qrCode?:      string
  createdAt?:   string
  updatedAt?:   string
}

export interface ApiMenuItem {
  menuItemId:   string
  categoryId:   string
  restaurantId: string
  tenantId?:    string
  name:         string
  description?: string
  price:        number
  imageKey?:    string | null
  imageUrl?:    string | null
  isAvailable:  boolean
  displayOrder: number
  createdAt?:   string
  updatedAt?:   string
}

interface Paginated<T> {
  items: T[]
  count: number
  lastEvaluatedKey?: string | null
}

// ── Auth-aware fetch ────────────────────────────────────────────────────────────

const API_BASE = '/api/menu';

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getValidIdToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  
  if (token) headers['Authorization'] = token
  
  // ✅ FIX: Add X-Tenant-Id header
  // Get tenantId from token or use default
  let tenantId = '';
  try {
    if (token) {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      tenantId = decoded?.['custom:tenant_id'] || decoded?.tenantId || '';
    }
  } catch (e) {
    console.warn('Could not extract tenantId from token');
  }
  
  // If no tenantId in token, use RESTAURANT_ID as fallback
  if (!tenantId && RESTAURANT_ID) {
    tenantId = RESTAURANT_ID;
  }
  
  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }

  const url = `${API_BASE}${path}`;
  console.log(`📤 ${options.method || 'GET'} ${url}`);
  console.log('📤 Headers:', headers);

  if (options.body) {
    try {
      console.log('📦 Request body:', JSON.parse(options.body as string));
    } catch {
      console.log('📦 Request body:', options.body);
    }
  }

  const res = await fetch(url, { ...options, headers })

  if (!res.ok) {
    let errorText = '';
    let errorData = null;
    try {
      errorData = await res.json();
      errorText = JSON.stringify(errorData);
      console.error('❌ API Error Response:', errorData);
      
      if (errorData?.error?.message) {
        console.error('❌ Error Message:', errorData.error.message);
      }
      if (errorData?.error?.details) {
        console.error('❌ Error Details:', errorData.error.details);
      }
    } catch {
      errorText = await res.text().catch(() => '');
      console.error('❌ API Error Text:', errorText);
    }
    
    if (res.status === 401 || res.status === 403) {
      throw new Error('Not authorised — please log in as an admin or tenant.')
    }
    
    const message = errorData?.error?.message || errorData?.message || errorText || res.statusText;
    throw new Error(`API ${res.status}: ${message}`)
  }

  if (res.status === 204) return undefined as T
  const body = await res.text()
  return (body ? JSON.parse(body) : undefined) as T
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
  payload: {
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
    tenantId?: string;
  }
): Promise<ApiRestaurant> {
  const requestBody = {
    name: payload.name.trim(),
    address: {
      street: payload.address?.street?.trim() || '',
      city: payload.address?.city?.trim() || '',
      country: payload.address?.country?.trim() || 'Pakistan',
      postcode: payload.address?.postcode?.trim() || '',
    },
    timezone: payload.timezone || 'Asia/Karachi',
    currencyCode: payload.currencyCode?.toUpperCase().trim() || 'PKR',
    isActive: payload.isActive ?? true,
    tenantId: payload.tenantId,
  };

  console.log('📤 Creating restaurant with payload:', JSON.stringify(requestBody, null, 2));

  return adminFetch<ApiRestaurant>('/restaurants', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
}

export async function updateRestaurant(
  restaurantId: string,
  payload: Partial<{
    name: string;
    address: ApiAddress;
    timezone: string;
    currencyCode: string;
    isActive: boolean;
  }>
): Promise<ApiRestaurant> {
  const requestBody = {
    ...payload,
    ...(payload.address && {
      address: {
        street: payload.address.street || '',
        city: payload.address.city || '',
        country: payload.address.country || 'Pakistan',
        postcode: payload.address.postcode || '',
      }
    })
  };

  return adminFetch<ApiRestaurant>(`/restaurants/${restaurantId}`, {
    method: 'PUT',
    body: JSON.stringify(requestBody),
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
  const data = await adminFetch<Paginated<ApiCategory>>(
    `/restaurants/${restaurantId}/categories`,
  )
  return data.items ?? []
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
    description?: string;
    displayOrder?: number; 
    isActive?: boolean;
    imageKey?: string | null;
  },
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiCategory> {
  const requestBody = {
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    displayOrder: payload.displayOrder ?? 0,
    isActive: payload.isActive ?? true,
    ...(payload.imageKey && { imageKey: payload.imageKey }),
  };

  console.log('📤 Creating category:', {
    restaurantId,
    body: requestBody
  });

  return adminFetch<ApiCategory>(`/restaurants/${restaurantId}/categories`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
}

export async function updateCategory(
  categoryId: string,
  payload: Partial<{ 
    name: string; 
    description?: string;
    displayOrder: number; 
    isActive: boolean;
    imageKey?: string | null;
  }>,
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiCategory> {
  const requestBody = {
    ...payload,
    ...(payload.name && { name: payload.name.trim() }),
    ...(payload.description !== undefined && { description: payload.description?.trim() || '' }),
  };

  return adminFetch<ApiCategory>(
    `/restaurants/${restaurantId}/categories/${categoryId}`,
    { method: 'PUT', body: JSON.stringify(requestBody) },
  )
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
// Menu Items
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchMenuItems(
  categoryId?: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiMenuItem[]> {
  let path = `/restaurants/${restaurantId}/items`;
  if (categoryId) {
    path += `?categoryId=${categoryId}`;
  }
  const data = await adminFetch<Paginated<ApiMenuItem>>(path);
  return data.items ?? [];
}

export async function fetchMenuItem(
  itemId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiMenuItem> {
  return adminFetch<ApiMenuItem>(
    `/restaurants/${restaurantId}/items/${itemId}`,
  )
}

export async function createMenuItem(
  payload: {
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    imageKey?: string | null;
    isAvailable?: boolean;
    displayOrder?: number;
  },
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiMenuItem> {
  const requestBody = {
    categoryId: payload.categoryId,
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    price: payload.price,
    isAvailable: payload.isAvailable ?? true,
    displayOrder: payload.displayOrder ?? 0,
    ...(payload.imageKey && { imageKey: payload.imageKey }),
  };

  console.log('📤 Creating menu item:', requestBody);

  return adminFetch<ApiMenuItem>(`/restaurants/${restaurantId}/items`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
}

// /lib/admin-api.ts

export async function updateMenuItem(
  itemId: string,
  payload: Partial<{
    name: string;
    description?: string;
    price: number;
    imageKey?: string | null;
    isAvailable: boolean;
    displayOrder: number;
    status?: string;
    tags?: string[];
    prepTime?: string;
    calories?: number;
    restaurantId?: string;
  }>,
  version?: number,  // ✅ Add version parameter
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiMenuItem> {
  const requestBody: any = {
    ...payload,
    ...(payload.name && { name: payload.name.trim() }),
    ...(payload.description !== undefined && { description: payload.description?.trim() || '' }),
  };
  
  // ✅ Add version to body if provided
  if (version !== undefined && version > 0) {
    requestBody.version = version;
  }
  
  console.log('📤 Update payload:', requestBody);
  console.log('📤 Version:', version);

  return adminFetch<ApiMenuItem>(
    `/restaurants/${restaurantId}/items/${itemId}`,
    { method: 'PUT', body: JSON.stringify(requestBody) },
  )
}

export async function deleteMenuItem(
  itemId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<void> {
  await adminFetch<void>(
    `/restaurants/${restaurantId}/items/${itemId}`,
    { method: 'DELETE' },
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tables
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchTables(
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiTable[]> {
  const data = await adminFetch<{ tables?: ApiTable[]; items?: ApiTable[] }>(
    `/restaurants/${restaurantId}/tables`,
  )
  return data.tables ?? data.items ?? []
}

export async function fetchTable(
  tableId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiTable> {
  return adminFetch<ApiTable>(
    `/restaurants/${restaurantId}/tables/${tableId}`,
  )
}

export async function createTable(
  payload: {
    tableNumber: string;
    zone?: string;
    outlet?: string;
    capacity?: number;
    isActive?: boolean;
  },
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiTable> {
  const requestBody = {
    tableNumber: payload.tableNumber.trim(),
    zone: payload.zone?.trim() || 'Main Hall',
    outlet: payload.outlet?.trim() || 'Main Hall',
    capacity: payload.capacity || 4,
    isActive: payload.isActive ?? true,
  };

  console.log('📤 Creating table:', requestBody);

  return adminFetch<ApiTable>(`/restaurants/${restaurantId}/tables`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
}

export async function updateTable(
  tableId: string,
  payload: Partial<{
    tableNumber: string;
    zone: string;
    outlet: string;
    capacity: number;
    isActive: boolean;
  }>,
  restaurantId: string = RESTAURANT_ID,
): Promise<ApiTable> {
  const requestBody = {
    ...payload,
    ...(payload.tableNumber && { tableNumber: payload.tableNumber.trim() }),
    ...(payload.zone && { zone: payload.zone.trim() }),
    ...(payload.outlet && { outlet: payload.outlet.trim() }),
  };

  return adminFetch<ApiTable>(
    `/restaurants/${restaurantId}/tables/${tableId}`,
    { method: 'PUT', body: JSON.stringify(requestBody) },
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
// Uploads
// ══════════════════════════════════════════════════════════════════════════════

export async function uploadRestaurantLogo(
  file: File,
  restaurantId: string = RESTAURANT_ID,
): Promise<{ s3Key: string; url: string }> {
  const token = await getValidIdToken()
  const form  = new FormData()
  form.append('file', file)

  const res = await fetch(
    `/api/menu/upload/restaurants/${restaurantId}/logo`,
    {
      method:  'POST',
      headers: token ? { Authorization: token } : {},
      body:    form,
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Logo upload ${res.status}: ${text}`)
  }
  return res.json()
}

export async function uploadCategoryImage(
  file: File,
  categoryId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<{ s3Key: string; url: string }> {
  const token = await getValidIdToken()
  const form  = new FormData()
  form.append('file', file)

  const res = await fetch(
    `/api/menu/upload/restaurants/${restaurantId}/categories/${categoryId}/image`,
    {
      method:  'POST',
      headers: token ? { Authorization: token } : {},
      body:    form,
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Category image upload ${res.status}: ${text}`)
  }
  return res.json()
}

export async function uploadMenuItemImage(
  file: File,
  itemId: string,
  restaurantId: string = RESTAURANT_ID,
): Promise<{ s3Key: string; url: string }> {
  const token = await getValidIdToken()
  const form  = new FormData()
  form.append('file', file)

  const res = await fetch(
    `/api/menu/upload/restaurants/${restaurantId}/items/${itemId}/image`,
    {
      method:  'POST',
      headers: token ? { Authorization: token } : {},
      body:    form,
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Item image upload ${res.status}: ${text}`)
  }
  return res.json()
}

// ══════════════════════════════════════════════════════════════════════════════
// Export all types
// ══════════════════════════════════════════════════════════════════════════════

export type {
  ApiAddress as Address,
  ApiRestaurant as Restaurant,
  ApiCategory as Category,
  ApiTable as Table,
  ApiMenuItem as MenuItem,
}