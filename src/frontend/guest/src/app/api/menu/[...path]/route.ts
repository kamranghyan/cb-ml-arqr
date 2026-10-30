// src/app/api/menu/[...path]/route.ts  —  GUEST
//
// A guest arrives from a QR code that carries only ?rid=<restaurantId>.
// The tenant is not in the QR (and should not be), so this proxy looks it up
// from the restaurant itself and then forwards it as X-Tenant-Id.
//
// Nothing about the tenant is hardcoded here — one build serves every branch
// of every company.

import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE

// restaurantId → tenantId. Restaurants rarely change owners, so a short-lived
// in-memory cache saves a lookup on every menu request.
const tenantCache = new Map<string, { tenantId: string; at: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

/** Pull the restaurant id out of /restaurants/{rid}/... or the query string. */
function restaurantIdFrom(path: string[], req: NextRequest): string {
  const i = path.indexOf('restaurants')
  if (i !== -1 && path[i + 1]) return path[i + 1]
  return req.nextUrl.searchParams.get('rid') ?? ''
}

async function resolveTenant(restaurantId: string): Promise<string> {
  if (!restaurantId) return ''

  const hit = tenantCache.get(restaurantId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenantId

  try {
    // This endpoint is public and does not need a tenant header.
    const res = await fetch(`${API_BASE}/menus/restaurants/${restaurantId}`, {
      cache: 'no-store',
    })
    if (!res.ok) return ''

    const body = await res.json()
    const tenantId: string = body?.tenantId ?? ''
    if (tenantId) tenantCache.set(restaurantId, { tenantId, at: Date.now() })
    return tenantId
  } catch {
    return ''
  }
}

async function forward(req: NextRequest, path: string[]) {
  const isRestaurantCreate =
    req.method === 'POST' &&
    path.length === 1 &&
    path[0] === 'restaurants'

  let tenantId = ''

  // Restaurant create ke waqt restaurantId abhi exist nahi karta.
  // Isliye tenant lookup skip karo.
  if (!isRestaurantCreate) {
    const restaurantId = restaurantIdFrom(path, req)
    tenantId = await resolveTenant(restaurantId)

    if (!tenantId) {
      return NextResponse.json(
        {
          error:
            'We could not find that restaurant. Please scan the QR code on ' +
            'your table again.',
        },
        { status: 404 },
      )
    }
  }

  const upstream =
    `${API_BASE}/menus/${path.join('/')}${req.nextUrl.search}`

  // API Gateway drops a bare token — keep Bearer scheme.
  let auth = req.headers.get('authorization') ?? ''

  if (auth && !auth.startsWith('Bearer ')) {
    auth = `Bearer ${auth}`
  }

  const ct = req.headers.get('content-type') ?? ''

  const headers: Record<string, string> = {
    ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
    ...(auth ? { Authorization: auth } : {}),
    ...(!ct.includes('multipart')
      ? { 'Content-Type': ct || 'application/json' }
      : {}),
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    init.body = ct.includes('multipart')
      ? await req.blob()
      : await req.text()
  }

  const res = await fetch(upstream, init)
  const text = await res.text()

  try {
    return NextResponse.json(
      text ? JSON.parse(text) : {},
      { status: res.status }
    )
  } catch {
    return new NextResponse(text, { status: res.status })
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
