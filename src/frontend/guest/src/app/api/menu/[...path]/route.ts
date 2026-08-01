import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const AWS_BASE  = process.env.NEXT_PUBLIC_API_BASE
  ?? 'https://oh9dbidjq1.execute-api.ap-south-1.amazonaws.com/dev'

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID
  ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function getJwtClaim(t: string, c: string): string | null {
  try {
    return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())[c] ?? null
  } catch { return null }
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const qs       = req.nextUrl.searchParams.toString()
  const upstream = `${AWS_BASE}/menus/${path.join('/')}${qs ? `?${qs}` : ''}`
  const ct       = req.headers.get('content-type') ?? ''
  let   auth     = req.headers.get('authorization') ?? ''
  // API Gateway can drop a bare token; always forward with the Bearer scheme.
  if (auth && !auth.startsWith('Bearer ')) auth = `Bearer ${auth}`

  // Always use env TENANT_ID — ignore JWT tenant (guest menu is public)
  const tenantId = TENANT_ID

  console.log(`[menu-proxy] ${req.method} ${upstream} | tenant:${tenantId} | ct:${ct.slice(0,30)}`)

  const hdrs: HeadersInit = {
    'X-Tenant-Id': tenantId,
    ...(auth ? { Authorization: auth } : {}),
    ...(!ct.includes('multipart') ? { 'Content-Type': ct || 'application/json' } : {}),
  }

  let body: BodyInit | undefined
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    body = ct.includes('multipart') ? await req.formData() : await req.text()
  }

  try {
    const res  = await fetch(upstream, { method: req.method, headers: hdrs, body })
    const text = await res.text()
    console.log('[proxy] ->', res.status, text.slice(0, 100))
    return new NextResponse(text, {
      status:  res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Proxy error', message: e?.message }, { status: 502 })
  }
}

export const GET     = handler
export const POST    = handler
export const PUT     = handler
export const DELETE  = handler
export const PATCH   = handler
export const OPTIONS = () => new NextResponse(null, { status: 204 })