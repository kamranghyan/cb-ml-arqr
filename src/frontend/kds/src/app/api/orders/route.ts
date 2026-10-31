// src/app/api/orders/route.ts — KDS Proxy Route
import { NextRequest, NextResponse } from 'next/server'

const BASE = process.env.NEXT_PUBLIC_ORDERS_API_BASE

type Scope = { tenantId: string; restaurantId: string; auth: string }

function parseJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

function getScope(req: NextRequest): Scope | null {
  let auth = req.headers.get('authorization') ?? ''
  if (!auth) return null
  if (!auth.startsWith('Bearer ')) auth = `Bearer ${auth}`

  const claims = parseJwt(auth.slice(7))

  // Flexible Extraction (Cognito Attributes or standard claims)
  const tenantId =
    (claims['custom:tenant_id'] as string) ||
    (claims['tenantId'] as string) ||
    (claims['tenant_id'] as string) || ''

  const restaurantId =
    (claims['custom:restaurant_id'] as string) ||
    (claims['restaurantId'] as string) ||
    (claims['restaurant_id'] as string) || ''

  console.log('[KDS Route Scope] Extracted Claims:', { tenantId, restaurantId })

  if (!tenantId || !restaurantId) return null
  return { tenantId, restaurantId, auth }
}

const NO_SCOPE = NextResponse.json(
  {
    error:
      'This account is not linked to a restaurant. Ask your manager to ' +
      're-create the kitchen login for a specific branch.',
  },
  { status: 403 },
)

// Clean Up GET List Request
export async function GET(req: NextRequest) {
  const scope = getScope(req)
  if (!scope) return NO_SCOPE

  try {
    const url = `${BASE}/orders?restaurantId=${scope.restaurantId}`
    console.log('[KDS GET] Forwarding to Downstream URL:', url)

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'X-Tenant-Id': scope.tenantId,
        Authorization: scope.auth,
      },
    })

    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })
    return NextResponse.json(JSON.parse(text), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// ── POST /api/orders — rarely used from KDS, kept for parity ──────────

export async function POST(req: NextRequest) {
  const scope = getScope(req)
  if (!scope) return NO_SCOPE

  try {
    const body = await req.json()
    // Never trust a restaurantId sent by the client.
    const payload = { ...body, restaurantId: scope.restaurantId }

    const res = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': scope.tenantId,
        Authorization: scope.auth,
      },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// ── PATCH /api/orders — status change ─────────────────────────────────

export async function PATCH(req: NextRequest) {
  const scope = getScope(req)
  if (!scope) return NO_SCOPE

  try {
    const body = await req.json()
    const orderId = body.orderId
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const res = await fetch(`${BASE}/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': scope.tenantId,
        Authorization: scope.auth,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
