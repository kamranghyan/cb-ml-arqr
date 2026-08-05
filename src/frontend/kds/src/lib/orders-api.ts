/**
 * Orders API — KDS integration
 * All routes public — no auth required
 */

import type { KdsOrder, KdsStatus } from './types';

const PROXY = {
  list:  () => '/api/orders',
  patch: (id: string) => `/api/orders/${id}`,
  post:  () => '/api/orders',
};

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL
  ?? 'wss://opoa6rn0zf.execute-api.ap-south-1.amazonaws.com/dev';

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID_KDS
  ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface ApiLineItem {
  itemId:               string;
  name:                 string;
  quantity:             number;
  unitPriceMinorUnits:  number;
  totalPriceMinorUnits: number;
}

interface ApiOrder {
  orderId:                   string;
  status:                    string;
  tableId?:                  string;
  orderType?:                string;
  deliveryAddress?:          string;
  contactPhone?:             string;
  tenantId?:                 string;
  restaurantId?:             string;
  lineItems:                 ApiLineItem[];
  placedAt?:                 string;
  updatedAt?:                string;
  currencyCode?:             string;
  totalAmountMinorUnits?:    number;
  ttl?:                      number;
  PK?:                       string;
  SK?:                       string;
  stepFunctionsExecutionArn?: string;
  flags?: {
    kitchenAccepted: boolean;
    foodReady:       boolean;
    delivered:       boolean;
    cancelled:       boolean;
  };
}

interface ApiOrdersResponse {
  orders: ApiOrder[];
  count:  number;
}

// ── tenantId included in payload ───────────────────────────────────────────────
export function toFlagPayload(orderId: string, status: KdsStatus) {
  const base = {
    orderId,
    tenantId:        TENANT_ID,
    kitchenAccepted: false,
    foodReady:       false,
    delivered:       false,
    cancelled:       false,
  };
  switch (status) {
    case 'preparing': return { ...base, kitchenAccepted: true };
    case 'ready':     return { ...base, kitchenAccepted: true, foodReady: true };
    case 'delivered': return { ...base, kitchenAccepted: true, foodReady: true, delivered: true };
    default:          return base;
  }
}

export function toKdsStatus(apiStatus: string, flags?: ApiOrder['flags']): KdsStatus {
  if (flags) {
    if (flags.cancelled)       return 'new';
    if (flags.delivered)       return 'delivered';
    if (flags.foodReady)       return 'ready';
    if (flags.kitchenAccepted) return 'preparing';
    return 'new';
  }
  const s = (apiStatus ?? '').toUpperCase();
  if (s === 'RECEIVED' || s === 'PENDING' || s === 'NEW') return 'new';
  if (s === 'PREPARING' || s === 'IN_PROGRESS')           return 'preparing';
  if (s === 'READY' || s === 'READY_TO_SERVE')            return 'ready';
  if (s === 'DELIVERED' || s === 'COMPLETED' || s === 'TIMED_OUT' || s === 'CANCELLED') return 'delivered';
  return 'new';
}

function guessEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('burger'))                              return '🍔';
  if (n.includes('pizza'))                               return '🍕';
  if (n.includes('pasta') || n.includes('carbonara'))   return '🍝';
  if (n.includes('rice'))                                return '🍚';
  if (n.includes('chicken'))                             return '🍗';
  if (n.includes('fish') || n.includes('sea bass'))     return '🐟';
  if (n.includes('steak') || n.includes('beef') || n.includes('wagyu')) return '🥩';
  if (n.includes('soup') || n.includes('ramen'))        return '🍜';
  if (n.includes('salad'))                               return '🥗';
  if (n.includes('cake') || n.includes('tiramisu') || n.includes('fondant')) return '🍰';
  if (n.includes('soda') || n.includes('juice') || n.includes('drink')) return '🥤';
  if (n.includes('coffee') || n.includes('tea'))        return '☕';
  if (n.includes('lobster'))                             return '🦞';
  if (n.includes('prawn') || n.includes('shrimp'))      return '🍤';
  if (n.includes('bread') || n.includes('naan'))        return '🍞';
  return '🍽️';
}

export function normaliseOrder(raw: ApiOrder): KdsOrder & { _apiId: string } {
  const tableNum = (raw.tableId ?? 'T?').replace(/[^0-9]/g, '').padStart(2, '0') || '??';
  const placedAt = raw.placedAt
    ? new Date(raw.placedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';

  const items = (raw.lineItems ?? []).map(li => ({
    emoji: guessEmoji(li.name),
    name:  li.name,
    mods:  '',
    qty:   li.quantity,
    done:  false,
  }));

  const shortId = raw.orderId.slice(0, 6).toUpperCase();

  const orderType = (raw.orderType ?? 'dine_in') as 'dine_in' | 'pickup' | 'delivery';

  return {
    id:             `LM-${shortId}`,
    // Pickup and delivery have no table; show what the order actually is.
    table:          orderType === 'dine_in' ? tableNum : '—',
    zone:           'Main Hall',
    orderType,
    deliveryAddress: raw.deliveryAddress,
    contactPhone:    raw.contactPhone,
    status:         toKdsStatus(raw.status, raw.flags),
    elapsedSeconds: 0,
    maxSeconds:     1500,
    items,
    note:           '',
    placedAt,
    _apiId:         raw.orderId,
  } as any;
}

// ── GET — public ───────────────────────────────────────────────────────────────
/**
 * The orders proxy derives tenant + restaurant from this token, so every call
 * must carry it — the screen shows only the branch the user belongs to.
 */
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { getValidIdToken } = await import('@/lib/cognito');
    const token = await getValidIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function fetchOrders(): Promise<(KdsOrder & { _apiId: string })[]> {
  const res = await fetch(PROXY.list(), {
    cache: 'no-store',
    headers: await authHeaders(),
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
  return (data.orders ?? []).map(normaliseOrder);
}

// ── PATCH — public, tenantId auto-included ────────────────────────────────────
export async function patchOrderStatus(apiOrderId: string, newStatus: KdsStatus): Promise<void> {
  const payload = toFlagPayload(apiOrderId, newStatus);

  // PATCH requires a kitchen/admin token — the kitchen user is logged in.
  const res = await fetch(PROXY.patch(apiOrderId), {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body:    JSON.stringify(payload),
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
  try {
    const { getValidIdToken } = await import('@/lib/cognito');
    const token = await getValidIdToken();
    if (token) {
      return new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    }
  } catch {
    // No token — connect without auth
  }
  return new WebSocket(WS_URL);
}