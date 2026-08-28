/**
 * Orders API — KDS integration
 * All routes public — no auth required
 */

import type { KdsOrder, KdsStatus } from './types';

const PROXY = {
  list: () => '/api/orders',
  patch: (id: string) => `/api/orders/${id}`,
  post: () => '/api/orders',
};

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL
  ?? 'wss://x0ev8z7gwg.execute-api.ap-south-1.amazonaws.com/dev';

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID_KDS

interface ApiLineItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceMinorUnits: number;
  totalPriceMinorUnits: number;
}

interface ApiOrder {
  orderId: string;
  status: string;
  tableId?: string;
  tenantId?: string;
  restaurantId?: string;
  lineItems: ApiLineItem[];
  placedAt?: string;
  updatedAt?: string;
  currencyCode?: string;
  totalAmountMinorUnits?: number;
  ttl?: number;
  PK?: string;
  SK?: string;
  stepFunctionsExecutionArn?: string;
  flags?: {
    kitchenAccepted: boolean;
    foodReady: boolean;
    delivered: boolean;
    cancelled: boolean;
  };
}

interface ApiOrdersResponse {
  orders: ApiOrder[];
  count: number;
}

// ── tenantId included in payload ───────────────────────────────────────────────
export function toFlagPayload(orderId: string, status: KdsStatus) {
  const base = {
    orderId,
    tenantId: TENANT_ID,
    kitchenAccepted: false,
    foodReady: false,
    delivered: false,
    cancelled: false,
  };
  switch (status) {
    case 'preparing': return { ...base, kitchenAccepted: true };
    case 'ready': return { ...base, kitchenAccepted: true, foodReady: true };
    case 'delivered': return { ...base, kitchenAccepted: true, foodReady: true, delivered: true };
    default: return base;
  }
}

export function toKdsStatus(apiStatus: string, flags?: ApiOrder['flags']): KdsStatus {
  if (flags) {
    if (flags.cancelled) return 'new';
    if (flags.delivered) return 'delivered';
    if (flags.foodReady) return 'ready';
    if (flags.kitchenAccepted) return 'preparing';
    return 'new';
  }
  const s = (apiStatus ?? '').toUpperCase();
  if (s === 'RECEIVED' || s === 'PENDING' || s === 'NEW') return 'new';
  if (s === 'PREPARING' || s === 'IN_PROGRESS') return 'preparing';
  if (s === 'READY' || s === 'READY_TO_SERVE') return 'ready';
  if (s === 'DELIVERED' || s === 'COMPLETED' || s === 'TIMED_OUT' || s === 'CANCELLED') return 'delivered';
  return 'new';
}

function guessEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('burger')) return '🍔';
  if (n.includes('pizza')) return '🍕';
  if (n.includes('pasta') || n.includes('carbonara')) return '🍝';
  if (n.includes('rice')) return '🍚';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('fish') || n.includes('sea bass')) return '🐟';
  if (n.includes('steak') || n.includes('beef') || n.includes('wagyu')) return '🥩';
  if (n.includes('soup') || n.includes('ramen')) return '🍜';
  if (n.includes('salad')) return '🥗';
  if (n.includes('cake') || n.includes('tiramisu') || n.includes('fondant')) return '🍰';
  if (n.includes('soda') || n.includes('juice') || n.includes('drink')) return '🥤';
  if (n.includes('coffee') || n.includes('tea')) return '☕';
  if (n.includes('lobster')) return '🦞';
  if (n.includes('prawn') || n.includes('shrimp')) return '🍤';
  if (n.includes('bread') || n.includes('naan')) return '🍞';
  return '🍽️';
}

export function normaliseOrder(
  raw: ApiOrder
): KdsOrder & { _apiId: string } {
  const tableNum =
    (raw.tableId ?? 'T?').replace(/[^0-9]/g, '').padStart(2, '0') || '??';

  const placedAt = raw.placedAt
    ? new Date(raw.placedAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    : '—';

  // Support all possible backend naming variants
  const rawItems =
    raw.lineItems ||
    (raw as any).items ||
    (raw as any).line_items ||
    [];

  const items = rawItems.map((li: any) => {
    const addOns = li.addOns || li.addons || [];

    return {
      emoji: guessEmoji(li.name || 'Item'),
      name: li.name || 'Unknown Item',
      mods: '',
      qty: Number(li.quantity ?? li.qty ?? 1),
      done: false,

      addOns: addOns.map((addon: any) => ({
        id:
          addon.addOnId ||
          addon.id ||
          `addon_${addon.name || 'unknown'}`,

        name:
          addon.name ||
          addon.addOnName ||
          'Add-on',

        qty: Number(
          addon.quantity ??
          addon.qty ??
          1
        ),

        price:
          addon.priceMinorUnits != null
            ? Number(addon.priceMinorUnits) / 100
            : Number(addon.price ?? 0),
      })),
    };
  });

  /**
   * Merge duplicate items inside the SAME order.
   *
   * Example:
   * Burger x1
   * Burger x1
   * Burger x1
   *
   * becomes:
   * Burger x3
   *
   * But:
   * Burger + Cheese
   * Burger + Bacon
   *
   * remain separate because their add-ons differ.
   */
  const mergeKdsItems = (items: any[]) => {
    const merged = new Map<string, any>();

    for (const item of items) {
      const name = String(item.name ?? '')
        .trim()
        .toLowerCase();

      const addons = Array.isArray(item.addOns)
        ? item.addOns
        : [];

      /**
       * Create a stable key for add-ons.
       * Same item + same add-ons = same KDS item.
       */
      const addonKey = addons
        .map((addon: any) => ({
          id: String(addon.id ?? ''),
          name: String(addon.name ?? '')
            .trim()
            .toLowerCase(),
          qty: Number(addon.qty ?? 1),
        }))
        .sort(
          (
            a: { id: string; name: string; qty: number },
            b: { id: string; name: string; qty: number },
          ) => {
          if (a.id !== b.id) {
            return a.id.localeCompare(b.id);
          }

          return a.name.localeCompare(b.name);
          },
        );

      const key = `${name}|${JSON.stringify(addonKey)}`;

      const existing = merged.get(key);

      if (existing) {
        existing.qty += Number(item.qty ?? 1);
      } else {
        merged.set(key, {
          ...item,
          qty: Number(item.qty ?? 1),
          addOns: addons,
        });
      }
    }

    return Array.from(merged.values());
  };

  // IMPORTANT:
  // Actually use the merge function.
  const mergedItems = mergeKdsItems(items);

  const shortId = (raw.orderId || 'UNKNOWN')
    .slice(0, 6)
    .toUpperCase();

  return {
    id: `LM-${shortId}`,
    table: tableNum,
    zone: 'Main Hall',
    status: toKdsStatus(raw.status, raw.flags),
    elapsedSeconds: 0,
    maxSeconds: 1500,

    // IMPORTANT: merged items, NOT original items
    items: mergedItems,

    note: '',
    placedAt,
    _apiId: raw.orderId,
  } as KdsOrder & { _apiId: string };
}


export async function fetchOrders(): Promise<(KdsOrder & { _apiId: string })[]> {
  const headers = await authHeaders();
  console.log('[KDS] Fetching orders with headers:', Object.keys(headers));

  const res = await fetch(PROXY.list(), {
    cache: 'no-store',
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 403) {
      throw new Error(
        'This kitchen account is not linked to a restaurant. ' +
        'Ask your manager to re-create it for a specific branch.'
      );
    }
    throw new Error(`Orders API ${res.status}: ${text}`);
  }

  const data: ApiOrdersResponse = await res.json();
  console.log('[KDS] Raw orders response:', data);

  const rawOrders = data.orders || (Array.isArray(data) ? data : []);
  return rawOrders.map(normaliseOrder);
}

// ── GET — public ───────────────────────────────────────────────────────────────
/**
 * The orders proxy derives tenant + restaurant from this token, so every call
 * must carry it — the screen shows only the branch the user belongs to.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { getValidIdToken } = await import('@/lib/cognito');
    const token = await getValidIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}



// ── PATCH — public, tenantId auto-included ────────────────────────────────────
export async function patchOrderStatus(apiOrderId: string, newStatus: KdsStatus): Promise<void> {
  const payload = toFlagPayload(apiOrderId, newStatus);

  // PATCH requires a kitchen/admin token — the kitchen user is logged in.
  const res = await fetch(PROXY.patch(apiOrderId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('Not authorised — please log in as kitchen staff to update orders.');
    }
    throw new Error(`PATCH ${res.status}: ${text}`);
  }
}

// ── WebSocket connect ─────────────────────────────────────────────────────────

export async function connectWebSocket(): Promise<WebSocket> {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Try Cognito first
  //    KDS / admin / tenant users come through this path.
  // ───────────────────────────────────────────────────────────────────────────

  try {
    const { getValidIdToken } = await import('@/lib/cognito');

    const token = await getValidIdToken();

    if (token) {
      const url =
        `${WS_URL}?token=${encodeURIComponent(token)}`;

      console.log('[WS] Connecting as authenticated user');

      return new WebSocket(url);
    }
  } catch (error) {
    console.log(
      '[WS] No valid Cognito token, checking guest session...',
      error
    );
  }


  // ───────────────────────────────────────────────────────────────────────────
  // 2. Guest connection
  //    Guest session is created by /guest/session and stored in sessionStorage.
  // ───────────────────────────────────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    const guestSessionId =
      sessionStorage.getItem('guestSessionId');

    if (guestSessionId) {
      const url =
        `${WS_URL}?guestSessionId=${encodeURIComponent(guestSessionId)}`;

      console.log(
        '[WS] Connecting as guest:',
        guestSessionId
      );

      return new WebSocket(url);
    }
  }


  // ───────────────────────────────────────────────────────────────────────────
  // 3. No authentication/session
  //    Do NOT silently connect anymore.
  //
  //    Backend now rejects unauthenticated connections.
  // ───────────────────────────────────────────────────────────────────────────

  throw new Error(
    'Unable to connect WebSocket: no authentication or guest session found.'
  );
}