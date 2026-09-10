/**
 * support-api.ts
 * ==============
 * Read-only views a platform admin uses to help a customer: pick a company,
 * pick one of its branches, look at what that branch is doing.
 *
 * A company owner can use the same calls — their tenant comes from their
 * token, so the tenantId argument is ignored for them server-side.
 */

import { getValidIdToken } from './cognito'

// ── Types ─────────────────────────────────────────────────────────────

export interface SupportRestaurant {
  restaurantId: string
  tenantId:     string
  name:         string
  address?:     { city?: string; country?: string }
  currencyCode: string
  isActive:     boolean
}

export type OrderStatus =
  | 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

export interface SupportOrderLine {
  itemId:               string
  name:                 string
  quantity:             number
  unitPriceMinorUnits:  number
  totalPriceMinorUnits: number
}

export type OrderType = 'dine_in' | 'pickup' | 'delivery'

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in:  'Dine in',
  pickup:   'Pickup',
  delivery: 'Delivery',
}

export const ORDER_TYPE_COLOR: Record<OrderType, string> = {
  dine_in:  '#687780',
  pickup:   '#B45309',
  delivery: '#1D4ED8',
}

export interface SupportOrder {
  orderId:               string
  restaurantId:          string
  tableId:               string
  orderType?:            string
  deliveryAddress?:      string
  contactPhone?:         string
  status:                string
  currencyCode:          string
  totalAmountMinorUnits: number
  lineItems:             SupportOrderLine[]
  placedAt?:             string
  createdAt?:            string
  updatedAt?:            string
  kitchenAccepted?:      boolean
  foodReady?:            boolean
  delivered?:            boolean
  cancelled?:            boolean
  rating?:               number    
  feedbackText?:         string
}

// ── Fetch helper ──────────────────────────────────────────────────────

async function scopedFetch<T>(
  path: string,
  tenantId: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getValidIdToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  }
  if (token)    headers['Authorization'] = `Bearer ${token}`
  // Ignored for a company owner; required for an admin acting on their behalf.
  if (tenantId) headers['X-Tenant-Id']   = tenantId

  const res = await fetch(path, { ...init, headers, cache: 'no-store' })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const body = JSON.parse(text)
      message = body?.error?.message ?? body?.error ?? body?.message ?? text
    } catch { /* keep the raw text */ }

    if (res.status === 401) throw new Error('Session expired — please sign in again.')
    throw new Error(message || `Request failed (${res.status})`)
  }

  const body = await res.text()
  return (body ? JSON.parse(body) : undefined) as T
}

// ── Restaurants of one company ────────────────────────────────────────

export async function fetchRestaurantsForTenant(
  tenantId: string,
): Promise<SupportRestaurant[]> {
  const data = await scopedFetch<{ items: SupportRestaurant[] }>(
    '/api/menu/restaurants',
    tenantId,
  )
  const all = data.items ?? []
  // A platform admin's list call returns every restaurant on the platform,
  // so narrow it to the company that was picked.
  return tenantId ? all.filter(r => !r.tenantId || r.tenantId === tenantId) : all
}

// ── Orders of one branch ──────────────────────────────────────────────

/**
 * `hours` is how far back to look. The kitchen view wants a short window;
 * history wants a long one.
 */
export async function fetchOrdersForRestaurant(
  tenantId: string,
  restaurantId: string,
  hours = 4,
): Promise<SupportOrder[]> {
  const data = await scopedFetch<{ orders: SupportOrder[] }>(
    `/api/orders?restaurantId=${restaurantId}&hours=${hours}`,
    tenantId,
  )
  return data.orders ?? []
}

// ── Presentation helpers ──────────────────────────────────────────────

/** Orders arrive with boolean flags; turn them into one readable status. */
export function derivedStatus(o: SupportOrder): OrderStatus {
  if (o.cancelled)       return 'cancelled'
  if (o.delivered)       return 'delivered'
  if (o.foodReady)       return 'ready'
  if (o.kitchenAccepted) return 'preparing'
  const raw = (o.status ?? '').toLowerCase()
  if (raw === 'received' || raw === 'placed') return 'pending'
  return (raw as OrderStatus) || 'pending'
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:   'Waiting',
  accepted:  'Accepted',
  preparing: 'Preparing',
  ready:     'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:   '#687780',
  accepted:  '#E1251B',
  preparing: '#E1251B',
  ready:     '#0F9D58',
  delivered: '#0F9D58',
  cancelled: '#9CA3AF',
}

/** An order still moving through the kitchen. */
export function isLive(o: SupportOrder): boolean {
  const s = derivedStatus(o)
  return s !== 'delivered' && s !== 'cancelled'
}

export function money(minorUnits: number, currency = 'PKR'): string {
  return `${currency} ${(minorUnits / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'

  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`

  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Orders placed before order types existed were all dine-in. */
export function orderTypeOf(o: SupportOrder): OrderType {
  const t = (o.orderType ?? 'dine_in') as OrderType
  return t in ORDER_TYPE_LABEL ? t : 'dine_in'
}

/** Where the food is going — table number, counter, or an address. */
export function destinationOf(o: SupportOrder): string {
  const t = orderTypeOf(o)
  if (t === 'delivery') return o.deliveryAddress || 'Delivery'
  if (t === 'pickup')   return 'Counter'
  return o.tableId ? `Table ${o.tableId}` : '—'
}
