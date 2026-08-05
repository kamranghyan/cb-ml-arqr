// src/app/api/orders/[...]/route.ts  —  CONSOLE (support view)
//
// Read-only orders for a chosen company + branch. The console never places or
// changes orders — that belongs to the guest app and the kitchen screen. This
// exists so an administrator (or an owner) can see what a branch is serving
// when someone calls for help.
//
// Scope rules mirror the menu proxy:
//   company owner  → always their own tenant, whatever they ask for
//   platform admin → the tenant named in X-Tenant-Id (they have none of their own)

import { NextRequest, NextResponse } from 'next/server'

const ORDERS_BASE =
  process.env.NEXT_PUBLIC_ORDERS_API_BASE ??
  'https://s4qafzisc6.execute-api.ap-south-1.amazonaws.com/dev'

function parseJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  let auth = req.headers.get('authorization') ?? ''
  if (!auth) {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  }
  if (!auth.startsWith('Bearer ')) auth = `Bearer ${auth}`

  const claims    = parseJwt(auth.slice(7))
  const groups    = (claims['cognito:groups'] as string[]) ?? []
  const ownTenant = (claims['custom:tenant_id'] as string) ?? ''

  let tenantId = ownTenant
  if (!tenantId) {
    if (!groups.includes('menulay_admin')) {
      return NextResponse.json(
        { error: 'Your session does not identify a company.' },
        { status: 401 },
      )
    }
    tenantId = req.headers.get('x-tenant-id') ?? ''
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Choose a company first.' },
        { status: 400 },
      )
    }
  }

  const restaurantId = req.nextUrl.searchParams.get('restaurantId') ?? ''
  if (!restaurantId) {
    return NextResponse.json(
      { error: 'Choose a restaurant to see its orders.' },
      { status: 400 },
    )
  }

  const hours = req.nextUrl.searchParams.get('hours') ?? '4'

  try {
    const url = `${ORDERS_BASE}/orders?restaurantId=${restaurantId}&hours=${hours}`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-Tenant-Id': tenantId, Authorization: auth },
    })
    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })
    return NextResponse.json(JSON.parse(text), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
