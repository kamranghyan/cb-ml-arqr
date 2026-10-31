// src/app/api/orders/route.ts  —  GUEST
//
// The guest's restaurant comes from the QR code (?rid=), never from config.
// The tenant is looked up from that restaurant, so one build serves every
// branch of every company.

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
  { error: 'Please scan the QR code on your table to start an order.' },
  { status: 400 },
)

// ── GET /api/orders?rid=… — orders for one restaurant ─────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('rid') ?? ''
  const tenantId     = await resolveTenant(restaurantId)
  if (!tenantId) {
    console.error('❌ ORDER REJECTED: tenant resolution failed', {
      restaurantId,
    })

    return UNKNOWN_RESTAURANT
  }

  try {
    const res = await fetch(`${ORDERS_BASE}/orders?restaurantId=${restaurantId}`, {
      cache: 'no-store',
      headers: { 'X-Tenant-Id': tenantId },
    })
    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })
    return NextResponse.json(JSON.parse(text), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// ── POST /api/orders — place an order ─────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Added debug logs from image
    console.log('====================================')
    console.log('📩 /api/orders RECEIVED BODY:')
    console.log(JSON.stringify(body, null, 2))
    console.log('👤 guestSessionId:', body?.guestSessionId)
    console.log('====================================')
    
    const guestSessionId = body?.guestSessionId ?? ''

    if (!guestSessionId) {
      console.error('❌ ORDER REJECTED: missing guestSessionId', body)

      return NextResponse.json(
        { error: 'Guest session required.' },
        { status: 400 },
      )
    }

    // The restaurant must come from the order itself (the cart fills it in
    // from the QR code). No fallback — a guest with no QR has no restaurant.
    const restaurantId: string = body?.restaurantId ?? ''
    const tenantId = await resolveTenant(restaurantId)
    if (!tenantId) return UNKNOWN_RESTAURANT

    // Combine existing body properties with the validated session token
    const orderBody = {
      ...body,
      guestSessionId,
    }

    console.log('🚀 POSTING ORDER TO ORDERS API', {
      restaurantId,
      tenantId,
      guestSessionId,
      orderBody,
    })

    const res = await fetch(`${ORDERS_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify(orderBody),
    })
    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
