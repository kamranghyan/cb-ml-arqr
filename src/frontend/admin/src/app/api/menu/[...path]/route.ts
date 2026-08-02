// /app/api/menu/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const AWS_BASE = process.env.NEXT_PUBLIC_API_BASE
  ?? 'https://oh9dbidjq1.execute-api.ap-south-1.amazonaws.com/dev'

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID
  ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const qs = req.nextUrl.searchParams.toString()
  const upstream = `${AWS_BASE}/menus/${path.join('/')}${qs ? `?${qs}` : ''}`
  const ct = req.headers.get('content-type') ?? ''
  let auth = req.headers.get('authorization') ?? ''
  if (auth && !auth.startsWith('Bearer ')) auth = `Bearer ${auth}`

  const tenantId = TENANT_ID

  console.log(`[menu-proxy] ${req.method} ${upstream}`)

  const hdrs: HeadersInit = {
    'X-Tenant-Id': tenantId,
    ...(auth ? { Authorization: auth } : {}),
    ...(!ct.includes('multipart') ? { 'Content-Type': ct || 'application/json' } : {}),
  }

  // ✅ FIX: DELETE should NOT have a body
  let body: BodyInit | undefined
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = ct.includes('multipart') ? await req.formData() : await req.text()
  }
  // DELETE - no body

  try {
    const res = await fetch(upstream, { method: req.method, headers: hdrs, body })
    const text = await res.text()
    console.log('[proxy] ->', res.status)
    
    // ✅ Handle 204 No Content (DELETE success)
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 })
    }
    
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (e: any) {
    console.error('[proxy] Error:', e)
    return NextResponse.json({ error: 'Proxy error', message: e?.message }, { status: 502 })
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler  // ✅ DELETE handler
export const PATCH = handler
export const OPTIONS = () => new NextResponse(null, { status: 204 })