/**
 * Menu API service
 * All calls go through /api/menu proxy — avoids CORS, adds X-Tenant-Id server-side.
 * Authorization token injected client-side before proxying.
 */

import { MENU_API, AR_API, RESTAURANT_ID, ADMIN_RESTAURANT_ID } from './api-config'
import { getValidIdToken } from './cognito'

export interface ApiMenuItem {
  id:          string
  name:        string
  description: string
  price:       number
  category:    string
  categoryId?: string
  status:      'active' | 'inactive' | 'draft'
  imageUrl?:   string
  emoji?:      string
  tags?:       string[]
  prepTime?:   string
  calories?:   number
  protein?:    number
  fat?:        number
  carbs?:      number
  rating?:     number
  reviewCount?: number
  allergens?:  { name: string; emoji: string; status: 'present' | 'free' }[]
  subtitle?:   string
  customisations?: {
    doneness?: string[]
    sides?:    string[]
    sauces?:   string[]
  }
  restaurantId?: string
  createdAt?:    string
  updatedAt?:    string
}

export interface ApiMenuResponse {
  items:  ApiMenuItem[]
  total?: number
  page?:  number
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
  const rid  = restaurantId?.trim() || RESTAURANT_ID
  const data = await menuFetch<ApiMenuResponse | ApiMenuItem[]>(MENU_API.items(rid))
  let items: any[] = []
  if (Array.isArray(data))           items = data
  else if (data && 'items' in data)  items = (data as ApiMenuResponse).items
  return items.map(normaliseItem)
}

// ── Fetch single item + AR model ──────────────────────────────────────────────
export async function fetchMenuItem(itemId: string, restaurantId?: string): Promise<ApiMenuItem> {
  const rid  = restaurantId?.trim() || RESTAURANT_ID
  const item = await menuFetch<any>(MENU_API.item(itemId, rid))

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
    body:   JSON.stringify(apiPayload),
  })
}

// ── Update menu item ──────────────────────────────────────────────────────────
export async function updateMenuItem(
  itemId:   string,
  payload:  Partial<ApiMenuItem>,
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
    body:   JSON.stringify(apiPayload),
  })
}

// ── Delete menu item ──────────────────────────────────────────────────────────
export async function deleteMenuItem(itemId: string): Promise<void> {
  await menuFetch<void>(MENU_API.item(itemId, ADMIN_RESTAURANT_ID), { method: 'DELETE' })
}

// ── Normalise raw API response ────────────────────────────────────────────────
export function normaliseItem(raw: any): ApiMenuItem {
  const id = raw.id ?? raw.itemId ?? raw.item_id ?? raw._id ?? crypto.randomUUID()

  const price = raw.priceMinorUnits != null
    ? Number(raw.priceMinorUnits) / 100
    : Number(raw.price ?? raw.unitPrice ?? 0)

  const status: 'active' | 'inactive' | 'draft' =
    raw.status ?? (raw.isActive === true ? 'active' : raw.isActive === false ? 'inactive' : 'active')

  const rawAllergens = raw.allergens ?? []
  const allergens = Array.isArray(rawAllergens) && typeof rawAllergens[0] === 'string'
    ? rawAllergens.map((a: string) => ({
        name:   a.charAt(0) + a.slice(1).toLowerCase(),
        emoji:  a === 'GLUTEN' ? '🌾' : a === 'DAIRY' ? '🥛' : a === 'NUTS' ? '🥜' : a === 'EGG' ? '🥚' : a === 'FISH' ? '🐟' : '⚠️',
        status: 'present' as const,
      }))
    : rawAllergens

  const hasArModel = !!(raw.arModelUrl || raw.arModelKey)

  const KNOWN_CATS: Record<string, string> = {
    'e933848e-0d18-4e3a-b0a8-d70275c2fa54': 'Main Course',
  }
  const rawCategory      = raw.category ?? raw.categoryId ?? 'other'
  const categoryDisplay  = raw.categoryName
    ?? KNOWN_CATS[raw.categoryId ?? '']
    ?? (rawCategory && !rawCategory.includes('-') ? rawCategory : `Cat-${rawCategory.slice(0, 6)}`)

  return {
    ...raw,
    id, price, status, allergens, hasArModel,
    emoji:       raw.emoji       ?? '🍽️',
    tags:        raw.tags        ?? [],
    rating:      raw.rating      ?? 4.5,
    reviewCount: raw.reviewCount ?? 0,
    prepTime:    raw.prepTime    ?? raw.prep_time ?? '20 min',
    calories:    raw.calories    ?? 0,
    protein:     raw.protein     ?? 0,
    fat:         raw.fat         ?? 0,
    carbs:       raw.carbs       ?? 0,
    subtitle:    raw.subtitle    ?? raw.subTitle ?? '',
    name:        raw.name        ?? raw.itemName ?? 'Unnamed Item',
    description: raw.description ?? raw.desc     ?? '',
    category:    categoryDisplay,
    categoryId:  raw.categoryId  ?? raw.category  ?? '',
    imageUrl:    raw.imageUrl    ?? null,
    arModelUrl:  raw.arModelUrl  ?? null,
    arModelKey:  raw.arModelKey  ?? null,
    imageKey:    raw.imageKey    ?? null,
    version:     raw.version     ?? 1,
  }
}

export interface ApiCategory { id: string; name: string; slug?: string }

export async function fetchCategories(): Promise<ApiCategory[]> {
  return []
}

export function extractCategoriesFromItems(items: ApiMenuItem[]): ApiCategory[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const id   = (item as any).categoryId ?? item.category
    const name = item.category ?? id
    if (id && !seen.has(id)) seen.set(id, name)
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
}