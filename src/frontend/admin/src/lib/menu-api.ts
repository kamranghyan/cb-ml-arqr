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
import { getValidIdToken, loadUser } from './cognito'

export interface ApiAddon {
  addOnId: string
  tenantId?: string
  restaurantId?: string
  categoryId?: string
  menuItemId: string
  name: string
  priceMinorUnits: number
  isActive: boolean
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
  description?: string
}

export interface ApiMenuItemSize {
  id?: string
  name: string
  priceMinorUnits?: number
  price?: number
  isActive?: boolean
}

export interface ApiMenuSlide {
  position: number
  imageKey?: string
  imageUrl?: string
}

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
  allergens?: string[]
  prepTime?: string
  calories?: number
  rating?: number
  reviewCount?: number
  subtitle?: string
  restaurantId?: string
  createdAt?: string
  updatedAt?: string
  addons?: ApiAddon[]
  slides?: ApiMenuSlide[]
  sizes?: ApiMenuItemSize[] | null
  arModelKey?: string
  arModelUrl?: string
  imageKey?: string
  version?: number
}

export interface ApiMenuResponse {
  items: ApiMenuItem[]
}

export interface CreateAddonPayload {
  name: string
  description?: string
  priceMinorUnits: number
  isActive?: boolean
  sortOrder?: number
}

export interface CreateMenuItemPayload {
  name: string
  description: string
  price: number
  categoryId: string
  isActive?: boolean
  prepTime?: string
  calories?: number
  allergens?: string[]
  sizes?: { name: string; priceMinorUnits: number }[]
  slides?: { position: number; imageKey?: string }[]
}

// ── Centralised Menu Fetch Helper ─────────────────────────────────────────────

async function menuFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidIdToken()
  const user = loadUser()

  const headers: Record<string, string> = {
    ...(options.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (user?.tenantId) {
    headers['X-Tenant-Id'] = user.tenantId
  } else if (TENANT_ID) {
    headers['X-Tenant-Id'] = TENANT_ID
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const body = await res.text()

  return (body ? JSON.parse(body) : undefined) as T
}

// ── Fetch all menu items ──────────────────────────────────────────────────────

export async function fetchMenuItems(
  restaurantId?: string
): Promise<ApiMenuItem[]> {
  const user = loadUser()
  const rid =
    restaurantId?.trim() ||
    user?.restaurantId ||
    RESTAURANT_ID

  const data = await menuFetch<ApiMenuResponse | ApiMenuItem[]>(
    MENU_API.items(rid)
  )

  const items = Array.isArray(data)
    ? data
    : data?.items ?? []

  return items.map(normaliseItem)
}

// ── Fetch single item + AR model ──────────────────────────────────────────────

export async function fetchMenuItem(
  itemId: string,
  restaurantId?: string
): Promise<any> {
  const rid =
    restaurantId?.trim() ||
    RESTAURANT_ID

  const item = await menuFetch(
    MENU_API.item(itemId, rid)
  )

  let addons: ApiAddon[] = []

  try {
    addons = await fetchMenuItemAddons(
      itemId,
      rid
    )
  } catch (error) {
    console.warn(
      'Failed to load item addons:',
      error
    )
  }

  try {
    const arData = await menuFetch<any>(
      AR_API.model(itemId, rid)
    )

    return normaliseItem({
      ...item,
      addons,
      arModelUrl: arData.presignedUrl,
    })
  } catch {
    return normaliseItem(item)
  }
}

// ── Create Menu Item with Files ──────────────────────────────────────────────

export async function createMenuItemWithFiles(
  restaurantId: string,
  payload: {
    name: string
    description: string
    price: number
    categoryId: string
    isActive: boolean
    allergens?: string[]
    prepTime?: string
    calories?: number
    sizes?: {
      name: string
      price: number
    }[]
    slides?: {
      position: number
      imageKey?: string
    }[]
  },
  imageFile?: File | null,
  glbFile?: File | null,
  imageFiles: File[] = [],
): Promise<any> {
  const fd = new FormData()

  fd.append(
    'name',
    payload.name
  )

  fd.append(
    'description',
    payload.description
  )

  fd.append(
    'priceMinorUnits',
    String(
      Math.round(
        payload.price * 100
      )
    )
  )

  fd.append(
    'categoryId',
    payload.categoryId
  )

  fd.append(
    'isActive',
    String(payload.isActive)
  )

  fd.append(
    'restaurantId',
    restaurantId
  )

  if (payload.allergens?.length) {
    fd.append(
      'allergens',
      payload.allergens.join(',')
    )
  }

  if (payload.prepTime) {
    const prepTimeNumber = parseInt(
      payload.prepTime.replace(/\D/g, '')
    )

    fd.append(
      'prepTime',
      String(
        isNaN(prepTimeNumber)
          ? 20
          : prepTimeNumber
      )
    )
  }

  if (payload.calories !== undefined) {
    fd.append(
      'calories',
      String(payload.calories)
    )
  }

  if (payload.sizes?.length) {
    const sizesPayload =
      payload.sizes.map(size => ({
        name: size.name,
        priceMinorUnits:
          Math.round(
            size.price * 100
          ),
      }))

    fd.append(
      'sizes',
      JSON.stringify(sizesPayload)
    )
  }

  // ── Slides ────────────────────────────────────────────────────────────────

  if (payload.slides?.length) {
    const slidesPayload =
      payload.slides.map(
        (slide, index) => ({
          position:
            slide.position ||
            index + 1,
          imageKey:
            slide.imageKey ||
            `temp-${Date.now()}-${index}`,
        })
      )

    fd.append(
      'slides',
      JSON.stringify(
        slidesPayload
      )
    )

    console.log(
      '📤 Slides payload being sent:',
      JSON.stringify(slidesPayload)
    )
  }

  // Main image

  if (imageFile) {
    fd.append(
      'file',
      imageFile
    )

    console.log(
      '📎 Main image:',
      imageFile.name
    )
  }

  // AR model

  if (glbFile) {
    fd.append(
      'arFile',
      glbFile
    )

    console.log(
      '📎 AR model:',
      glbFile.name
    )
  }

  // Gallery images

  if (imageFiles.length > 0) {
    console.log(
      `📎 Adding ${imageFiles.length} slide images:`
    )

    imageFiles.forEach(
      (file, index) => {
        fd.append(
          'images',
          file
        )

        console.log(
          `  - Slide ${index + 1}: ${file.name} (${file.size} bytes)`
        )
      }
    )
  }

  const token =
    await getValidIdToken()

  if (!token) {
    throw new Error(
      'Authentication token missing.'
    )
  }

  const headers: Record<
    string,
    string
  > = {
    Authorization: token,
    'x-tenant-id': TENANT_ID,
  }

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items`,
    {
      method: 'POST',
      headers,
      body: fd,
    }
  )

  if (!res.ok) {
    const txt =
      await res
        .text()
        .catch(
          () =>
            res.statusText
        )

    console.error(
      '❌ Create failed:',
      res.status,
      txt
    )

    throw new Error(
      `Create failed (${res.status}): ${txt}`
    )
  }

  const responseData =
    await res.json()

  console.log(
    '✅ Item created with response:',
    JSON.stringify(
      responseData,
      null,
      2
    )
  )

  return responseData
}

// ── Create menu item (JSON or FormData) ───────────────────────────────────────

export async function createMenuItem(
  payload:
    | Partial<ApiMenuItem>
    | FormData,
  restaurantId?: string
): Promise<ApiMenuItem> {
  const rid =
    restaurantId?.trim() ||
    RESTAURANT_ID

  if (payload instanceof FormData) {
    return menuFetch<ApiMenuItem>(
      MENU_API.items(rid),
      {
        method: 'POST',
        body: payload,
      }
    )
  }

  const {
    price,
    status,
    ...rest
  } = payload as any

  const apiPayload = {
    ...rest,

    ...(price != null && {
      priceMinorUnits:
        Math.round(
          Number(price) * 100
        ),
    }),

    ...(status != null && {
      isActive:
        status === 'active',
    }),
  }

  return menuFetch<ApiMenuItem>(
    MENU_API.items(rid),
    {
      method: 'POST',
      body: JSON.stringify(
        apiPayload
      ),
    }
  )
}

// ── Update Menu Item ─────────────────────────────────────────────────────────

export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  payload: Partial<ApiMenuItem>,
  version?: number
): Promise<ApiMenuItem> {
  const body: any = {}

  // ---------------------------------------------------------------------------
  // Basic editable fields
  // ---------------------------------------------------------------------------

  if (payload.name !== undefined) {
    body.name = payload.name
  }

  if (payload.description !== undefined) {
    body.description = payload.description
  }

  if (payload.categoryId !== undefined) {
    body.categoryId = payload.categoryId
  }

  if (payload.status !== undefined) {
    body.isActive = payload.status === 'active'
  }

  if (payload.prepTime !== undefined) {
    body.prepTime = payload.prepTime
  }

  if (payload.calories !== undefined) {
    body.calories = payload.calories
  }

  if (payload.tags !== undefined) {
    body.tags = payload.tags
  }

  if (payload.allergens !== undefined) {
    body.allergens = payload.allergens
  }

  // ---------------------------------------------------------------------------
  // Price
  // ---------------------------------------------------------------------------

  if (payload.price !== undefined) {
    body.priceMinorUnits = Math.round(
      Number(payload.price) * 100
    )
  }

  // ---------------------------------------------------------------------------
  // Sizes
  // ---------------------------------------------------------------------------

  if (Array.isArray(payload.sizes)) {
    body.sizes = payload.sizes.map((size: any) => ({
      ...(size.id !== undefined && {
        id: size.id,
      }),
      name: size.name,
      priceMinorUnits:
        size.priceMinorUnits !== undefined
          ? size.priceMinorUnits
          : Math.round(Number(size.price ?? 0) * 100),
      ...(size.isActive !== undefined && {
        isActive: size.isActive,
      }),
    }))
  }

  // ---------------------------------------------------------------------------
  // IMPORTANT: Slides
  // ---------------------------------------------------------------------------
  //
  // Only send slides when they actually contain image keys.
  //
  // This prevents:
  //
  // {
  //   position: 1,
  //   imageKey: ""
  // }
  //
  // from overwriting existing DB slides.
  //
  if (Array.isArray(payload.slides)) {
    const validSlides = payload.slides
      .filter(
        (slide: any) =>
          typeof slide?.imageKey === 'string' &&
          slide.imageKey.trim() !== ''
      )
      .map((slide: any, index: number) => ({
        position: slide.position ?? index + 1,
        imageKey: slide.imageKey,
      }))

    if (validSlides.length > 0) {
      body.slides = validSlides
    }
  }

  // ---------------------------------------------------------------------------
  // Existing main image
  // ---------------------------------------------------------------------------
  //
  // Preserve imageKey if it is actually supplied.
  //
  if (
    typeof payload.imageKey === 'string' &&
    payload.imageKey.trim() !== ''
  ) {
    body.imageKey = payload.imageKey
  }

  // ---------------------------------------------------------------------------
  // Version
  // ---------------------------------------------------------------------------

  if (version !== undefined) {
    body.version = version
  } else if (payload.version !== undefined) {
    body.version = payload.version
  }

  // ---------------------------------------------------------------------------
  // Never send generated/read-only fields
  // ---------------------------------------------------------------------------

  delete body.id
  delete body.imageUrl
  delete body.arModelUrl
  delete body.addons
  delete body.emoji
  delete body.rating
  delete body.reviewCount
  delete body.createdAt
  delete body.updatedAt
  delete body.status
  delete body.category
  delete body.categoryName
  delete body.restaurantId
  delete body.arModelKey

  console.log(
    '📤 FINAL PUT payload:',
    JSON.stringify(body, null, 2)
  )

  return menuFetch<ApiMenuItem>(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  )
}


// ── Update Menu Item With Files ──────────────────────────────────────────────
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

  if (payload.name !== undefined) {
    fd.append('name', payload.name);
  }

  if (payload.description !== undefined) {
    fd.append('description', payload.description);
  }

  if (payload.price !== undefined) {
    fd.append(
      'priceMinorUnits',
      String(Math.round(payload.price * 100)),
    );
  }

  if (payload.categoryId !== undefined) {
    fd.append('categoryId', payload.categoryId);
  }

  if (payload.isActive !== undefined) {
    fd.append('isActive', String(payload.isActive));
  }

  if (payload.prepTime !== undefined) {
    const prepTimeNumber = parseInt(
      String(payload.prepTime).replace(/\D/g, ''),
      10,
    );

    fd.append(
      'prepTime',
      String(Number.isNaN(prepTimeNumber) ? 20 : prepTimeNumber),
    );
  }

  if (payload.calories !== undefined) {
    fd.append('calories', String(payload.calories));
  }

  if (payload.allergens !== undefined) {
    fd.append(
      'allergens',
      payload.allergens.join(','),
    );
  }

  // ------------------------------------------------------------
  // Sizes
  // ------------------------------------------------------------

  if (payload.sizes !== undefined) {
    const sizesPayload = payload.sizes.map(size => ({
      name: size.name,
      priceMinorUnits: Math.round(size.price * 100),
    }));

    fd.append(
      'sizes',
      JSON.stringify(sizesPayload),
    );
  }

  // ------------------------------------------------------------
  // Slides
  //
  // IMPORTANT:
  // Existing imageKey MUST be preserved.
  // Never automatically replace it with "".
  // ------------------------------------------------------------

  if (payload.slides !== undefined) {
    const slidesPayload = payload.slides.map(
      (slide, index) => ({
        position: slide.position || index + 1,

        ...(slide.imageKey
          ? { imageKey: slide.imageKey }
          : {}),
      }),
    );

    fd.append(
      'slides',
      JSON.stringify(slidesPayload),
    );

    console.log(
      '📤 UPDATE slides payload:',
      JSON.stringify(slidesPayload, null, 2),
    );
  }

  // ------------------------------------------------------------
  // Version
  // ------------------------------------------------------------

  if (payload.version !== undefined) {
    fd.append(
      'version',
      String(payload.version),
    );
  }

  // ------------------------------------------------------------
  // Main image
  // ------------------------------------------------------------

  if (imageFile) {
    fd.append(
      'file',
      imageFile,
      imageFile.name,
    );

    console.log(
      '📎 Updating main image:',
      imageFile.name,
    );
  }

  // ------------------------------------------------------------
  // AR model
  // ------------------------------------------------------------

  if (glbFile) {
    fd.append(
      'arFile',
      glbFile,
      glbFile.name,
    );

    console.log(
      '📎 Updating AR model:',
      glbFile.name,
    );
  }

  // ------------------------------------------------------------
  // New gallery images
  // ------------------------------------------------------------

  if (imageFiles.length > 0) {
    console.log(
      `📎 Uploading ${imageFiles.length} gallery image(s)`,
    );

    imageFiles.forEach((file, index) => {
      fd.append(
        'images',
        file,
        file.name,
      );

      console.log(
        `  Slide ${index + 1}: ${file.name}`,
      );
    });
  }

  // ------------------------------------------------------------
  // Token
  // ------------------------------------------------------------

  const token = await getValidIdToken();

  if (!token) {
    throw new Error(
      'Authentication token missing.',
    );
  }

  const user = loadUser();

  const tenantId =
    user?.tenantId || TENANT_ID;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId,
  };

  // ------------------------------------------------------------
  // IMPORTANT:
  // Do NOT set Content-Type for FormData.
  // Browser/fetch generates multipart boundary.
  // ------------------------------------------------------------

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}`,
    {
      method: 'PUT',
      headers,
      body: fd,
    },
  );

  if (!res.ok) {
    const txt = await res
      .text()
      .catch(() => res.statusText);

    console.error(
      '❌ Update failed:',
      res.status,
      txt,
    );

    throw new Error(
      `Update failed (${res.status}): ${txt}`,
    );
  }

  const responseData =
    await res.json();

  console.log(
    '✅ Updated item:',
    JSON.stringify(
      responseData,
      null,
      2,
    ),
  );

  return normaliseItem(
    responseData,
  );
}

// ── Delete menu item ──────────────────────────────────────────────────────────

export async function deleteMenuItem(
  itemId: string,
  restaurantId?: string,
): Promise<void> {
  const rid =
    restaurantId?.trim() ||
    RESTAURANT_ID

  await menuFetch(
    MENU_API.item(
      itemId,
      rid
    ),
    {
      method: 'DELETE',
    }
  )
}

// ── Addon Operations ──────────────────────────────────────────────────────────

export async function fetchMenuItemAddons(
  itemId: string,
  restaurantId?: string
): Promise<ApiAddon[]> {
  const rid =
    restaurantId?.trim() ||
    RESTAURANT_ID

  const data: any =
    await menuFetch(
      `${MENU_API.items(rid)}/${itemId}/addons`
    )

  if (Array.isArray(data)) {
    return data
  }

  return data?.items ?? []
}

export async function createAddon(
  restaurantId: string,
  itemId: string,
  payload: CreateAddonPayload
): Promise<ApiAddon> {
  return menuFetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}/addons`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        isActive:
          payload.isActive ??
          true,
        sortOrder:
          payload.sortOrder ??
          0,
      }),
    }
  )
}

export async function updateAddon(
  restaurantId: string,
  itemId: string,
  addOnId: string,
  payload: {
    name: string
    description?: string
    priceMinorUnits: number
    isActive?: boolean
    sortOrder?: number
  }
): Promise<ApiAddon> {
  return menuFetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}/addons/${addOnId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...payload,
        isActive:
          payload.isActive ??
          true,
        sortOrder:
          payload.sortOrder ??
          0,
      }),
    }
  )
}

export async function deleteAddon(
  restaurantId: string,
  itemId: string,
  addOnId: string
): Promise<void> {
  await menuFetch(
    `/api/menu/restaurants/${restaurantId}/items/${itemId}/addons/${addOnId}`,
    {
      method: 'DELETE',
    }
  )
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface ApiCategory {
  id: string
  name: string
  slug?: string
}

export async function fetchCategories(
  restaurantId?: string
): Promise<ApiCategory[]> {
  const rid =
    restaurantId?.trim() ||
    RESTAURANT_ID

  const data: any =
    await menuFetch(
      MENU_API.categories(rid)
    )

  if (Array.isArray(data)) {
    return data
  }

  if (data?.items) {
    return data.items
  }

  return []
}

export function extractCategoriesFromItems(
  items: ApiMenuItem[]
): ApiCategory[] {
  const seen =
    new Map<string, string>()

  for (const item of items) {
    const id =
      item.categoryId ??
      item.category

    const name =
      item.categoryName ??
      item.category ??
      id

    if (
      id &&
      !seen.has(id)
    ) {
      seen.set(
        id,
        name
      )
    }
  }

  return Array.from(
    seen.entries()
  ).map(
    ([id, name]) => ({
      id,
      name,
    })
  )
}

// ── Normalise raw API response ────────────────────────────────────────────────

export function normaliseItem(
  item: any
): ApiMenuItem {
  return {
    ...item,

    id:
      item.id ??
      item.itemId,

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

    name:
      item.name ??
      '',

    description:
      item.description ??
      '',

    price:
      item.price ??
      (
        (item.priceMinorUnits ??
          0) / 100
      ),

    status:
      item.status ??
      (
        item.isActive
          ? 'active'
          : 'inactive'
      ),

    addons:
      item.addOns ??
      item.addons ??
      [],

    slides:
      Array.isArray(
        item.slides
      )
        ? item.slides.map(
            (
              slide: any,
              index: number
            ) => ({
              position:
                slide.position ??
                index + 1,
              imageKey:
                slide.imageKey ??
                '',
              imageUrl:
                slide.imageUrl ??
                '',
            })
          )
        : [],

    sizes:
      Array.isArray(
        item.sizes
      )
        ? item.sizes.map(
            (size: any) => ({
              id: size.id,
              name: size.name,
              priceMinorUnits:
                size.priceMinorUnits ??
                0,
              price:
                (
                  size.priceMinorUnits ??
                  0
                ) / 100,
              isActive:
                size.isActive ??
                true,
            })
          )
        : null,
  }
}