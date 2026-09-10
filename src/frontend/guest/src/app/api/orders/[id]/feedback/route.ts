// src/app/api/orders/[id]/feedback/route.ts  —  GUEST
//
// Guest submits a rating + feedback for their own order. The tenant is
// resolved from the restaurant the guest came from (?rid=), same as the
// other guest order routes — never from config.

import { NextRequest, NextResponse } from 'next/server'

const ORDERS_BASE =
  process.env.NEXT_PUBLIC_ORDERS_API_BASE

const MENU_BASE =
  process.env.NEXT_PUBLIC_API_BASE

const tenantCache = new Map<string, { tenantId: string; at: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

async function resolveTenant(restaurantId: string): Promise<string> {
  if (!restaurantId) return ''

  const hit = tenantCache.get(restaurantId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenantId

  try {
    const res = await fetch(`${MENU_BASE}/menus/restaurants/${restaurantId}`, {
      cache: 'no-store',
    })
    if (!res.ok) return ''
    const tenantId: string = (await res.json())?.tenantId ?? ''
    if (tenantId) tenantCache.set(restaurantId, { tenantId, at: Date.now() })
    return tenantId
  } catch {
    return ''
  }
}

const UNKNOWN_RESTAURANT = NextResponse.json(
  { error: 'Please scan the QR code on your table again.' },
  { status: 400 },
)

// ── POST /api/orders/[id]/feedback — guest submits rating + feedback ─────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const restaurantId: string =
      body?.restaurantId ?? req.nextUrl.searchParams.get('rid') ?? ''

    const tenantId = await resolveTenant(restaurantId)
    if (!tenantId) return UNKNOWN_RESTAURANT

    const res = await fetch(`${ORDERS_BASE}/orders/${orderId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}