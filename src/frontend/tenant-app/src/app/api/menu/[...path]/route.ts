// src/app/api/menu/[...path]/route.ts  —  TENANT CONSOLE
//
// The company is whoever is signed in. Their token carries custom:tenant_id,
// so nothing about the tenant is configured here — one build serves every
// company that logs in.

import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  'https://oh9dbidjq1.execute-api.ap-south-1.amazonaws.com/dev'

/** Read (not verify) the token payload — the backend verifies it properly. */
function parseJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

const NO_TENANT = NextResponse.json(
  {
    error:
      'Your session does not identify a company. Please sign in again.',
  },
  { status: 401 },
)

async function forward(req: NextRequest, path: string[]) {
  // API Gateway drops a bare token — always forward with the Bearer scheme.
  let auth = req.headers.get('authorization') ?? ''
  if (!auth) return NO_TENANT
  if (!auth.startsWith('Bearer ')) auth = `Bearer ${auth}`

  const tenantId = (parseJwt(auth.slice(7))['custom:tenant_id'] as string) ?? ''
  if (!tenantId) return NO_TENANT

  const upstream = `${API_BASE}/menus/${path.join('/')}${req.nextUrl.search}`
  const ct = req.headers.get('content-type') ?? ''

  const headers: Record<string, string> = {
    'X-Tenant-Id': tenantId,
    Authorization: auth,
  }

  const init: RequestInit = { method: req.method, headers, cache: 'no-store' }

  if (!['GET', 'HEAD'].includes(req.method)) {
    if (ct.includes('multipart')) {
      // The multipart boundary lives inside the Content-Type header, so it has
      // to be forwarded verbatim — dropping it makes the server read the whole
      // body as one field. Send the bytes untouched.
      headers['Content-Type'] = ct
      init.body = await req.arrayBuffer()
    } else {
      headers['Content-Type'] = ct || 'application/json'
      init.body = await req.text()
    }
  }

  const res  = await fetch(upstream, init)
  const text = await res.text()

  try {
    return NextResponse.json(text ? JSON.parse(text) : {}, { status: res.status })
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
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}