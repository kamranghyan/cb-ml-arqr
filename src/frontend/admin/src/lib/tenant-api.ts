/**
 * tenant-api.ts
 * =============
 * Company-wide views for an owner.
 *
 * The company itself comes from the signed-in token, so nothing here asks for
 * a tenant. What an owner does need is the ability to look at one branch or
 * at all of them at once — something a platform admin never does, since they
 * always work on one company's behalf.
 */

import { getValidIdToken } from './cognito'
import {
  derivedStatus, isLive, orderTypeOf,
  type SupportOrder, type OrderStatus, type OrderType,
} from './support-api'

export type { SupportOrder, OrderStatus, OrderType }
export { derivedStatus, isLive, orderTypeOf }
export interface TenantOrderEvent {
  type?: string
  eventType?: string
  action?: string
  order?: SupportOrder
  data?: SupportOrder
  orderId?: string
  restaurantId?: string
  status?: string
  [key: string]: unknown
}

export function parseTenantOrderEvent(
  raw: string,
): TenantOrderEvent | null {
  try {
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed as TenantOrderEvent
  } catch {
    console.error('[Tenant WS] Invalid JSON message:', raw)
    return null
  }
}

export interface Branch {
  restaurantId: string
  name: string
  currencyCode: string
  isActive: boolean
  address?: { city?: string; country?: string }
}

/** An order plus which branch it came from — needed once branches are mixed. */
export interface BranchOrder extends SupportOrder {
  branchName: string
  currency: string
}

// tenant-api.ts

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  'wss://x0ev8z7gwg.execute-api.ap-south-1.amazonaws.com/dev'

export async function connectTenantWebSocket(): Promise<WebSocket> {
  const token = await getValidIdToken()

  if (!token) {
    throw new Error('No authentication token found.')
  }

  const url =
    `${WS_URL}?token=${encodeURIComponent(token)}`

  console.log('[Tenant WS] Connecting')

  return new WebSocket(url)
}

// ── Fetch helper ──────────────────────────────────────────────────────

async function tenantFetch<T>(path: string): Promise<T> {
  const token = await getValidIdToken()

  const res = await fetch(path, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const body = JSON.parse(text)
      message = body?.error?.message ?? body?.error ?? body?.message ?? text
    } catch { /* keep raw */ }
    if (res.status === 401) throw new Error('Session expired — please sign in again.')
    throw new Error(message || `Request failed (${res.status})`)
  }

  const body = await res.text()
  return (body ? JSON.parse(body) : undefined) as T
}

// ── Branches ──────────────────────────────────────────────────────────

export async function fetchMyBranches(): Promise<Branch[]> {
  const data = await tenantFetch<{ items: Branch[] }>('/api/menu/restaurants')
  return data.items ?? []
}

// ── Orders ────────────────────────────────────────────────────────────

async function ordersForBranch(
  branch: Branch,
  hours: number,
): Promise<BranchOrder[]> {
  try {
    const data = await tenantFetch<{ orders: SupportOrder[] }>(
      `/api/orders?restaurantId=${branch.restaurantId}&hours=${hours}`,
    )
    return (data.orders ?? []).map(o => ({
      ...o,
      branchName: branch.name,
      currency: branch.currencyCode || 'PKR',
    }))
  } catch {
    // One branch failing should not blank the whole view.
    return []
  }
}

/**
 * Orders for one branch, or for every branch when `restaurantId` is empty.
 *
 * There is no cross-branch endpoint, so "all branches" means one call per
 * branch, run together. That is fine for the handful of branches a plan
 * allows; if that ever grows, this is the place to add a real endpoint.
 */
export async function fetchOrders(
  branches: Branch[],
  restaurantId: string,
  hours = 4,
): Promise<BranchOrder[]> {
  const targets = restaurantId
    ? branches.filter(b => b.restaurantId === restaurantId)
    : branches

  if (targets.length === 0) return []

  const results = await Promise.all(targets.map(b => ordersForBranch(b, hours)))
  return results.flat()
}

// ── Small aggregations the pages share ────────────────────────────────

export function revenueOf(orders: BranchOrder[]): number {
  return orders
    .filter(o => derivedStatus(o) !== 'cancelled')
    .reduce((sum, o) => sum + (o.totalAmountMinorUnits ?? 0), 0)
}

export function countByStatus(orders: BranchOrder[]): Record<string, number> {
  const out: Record<string, number> = {}
  orders.forEach(o => {
    const s = derivedStatus(o)
    out[s] = (out[s] ?? 0) + 1
  })
  return out
}

/** Busiest branches by order count, highest first. */
export function byBranch(orders: BranchOrder[]): {
  branchName: string; orders: number; revenue: number;
}[] {
  const map = new Map<string, { orders: number; revenue: number }>()

  orders.forEach(o => {
    const row = map.get(o.branchName) ?? { orders: 0, revenue: 0 }
    row.orders += 1
    if (derivedStatus(o) !== 'cancelled') {
      row.revenue += o.totalAmountMinorUnits ?? 0
    }
    map.set(o.branchName, row)
  })

  return Array.from(map.entries())
    .map(([branchName, v]) => ({ branchName, ...v }))
    .sort((a, b) => b.orders - a.orders)
}

/** Most-ordered items across whatever orders were passed in. */
export function topItems(
  orders: BranchOrder[],
  limit = 5,
): { name: string; qty: number }[] {
  const counts = new Map<string, number>()

  orders
    .filter(o => derivedStatus(o) !== 'cancelled')
    .forEach(o => (o.lineItems ?? []).forEach(li => {
      counts.set(li.name, (counts.get(li.name) ?? 0) + li.quantity)
    }))

  return Array.from(counts.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
}

/** Orders per hour of the day — shows when a branch is busy. */
export function ordersByHour(orders: BranchOrder[]): { hour: number; count: number }[] {
  const buckets = new Array(24).fill(0)

  orders.forEach(o => {
    const iso = o.placedAt ?? o.createdAt
    if (!iso) return
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) buckets[d.getHours()] += 1
  })

  return buckets.map((count, hour) => ({ hour, count }))
}

/** How the company's orders split across dine-in, pickup and delivery. */
export function byOrderType(orders: BranchOrder[]): {
  type: OrderType; orders: number; revenue: number;
}[] {
  const map = new Map<OrderType, { orders: number; revenue: number }>()

  orders.forEach(o => {
    const t = orderTypeOf(o)
    const row = map.get(t) ?? { orders: 0, revenue: 0 }
    row.orders += 1
    if (derivedStatus(o) !== 'cancelled') row.revenue += o.totalAmountMinorUnits ?? 0
    map.set(t, row)
  })

  return Array.from(map.entries())
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.orders - a.orders)
}
