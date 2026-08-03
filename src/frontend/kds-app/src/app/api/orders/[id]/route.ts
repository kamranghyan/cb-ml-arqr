import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_ORDERS_API_BASE ?? 'https://s4qafzisc6.execute-api.ap-south-1.amazonaws.com/dev';

type Scope = { tenantId: string; auth: string }

/** Read (not verify) the token payload — the backend verifies it properly. */
function parseJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch { return {} }
}

function getScope(req: NextRequest): Scope | null {
  let auth = req.headers.get('authorization') ?? ''
  if (!auth) return null
  if (!auth.startsWith('Bearer ')) auth = `Bearer ${auth}`
  const tenantId = (parseJwt(auth.slice(7))['custom:tenant_id'] as string) ?? ''
  if (!tenantId) return null
  return { tenantId, auth }
}

// ── PATCH /api/orders/[id] — public ───────────────────────────────────────────
const NO_SCOPE = NextResponse.json(
  { error: 'This account is not linked to a restaurant.' },
  { status: 403 },
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = getScope(req);
  if (!scope) return NO_SCOPE;

  try {
    const { id: orderId } = await params;
    const body = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const res = await fetch(`${BASE}/orders/${orderId}`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': scope.tenantId,
        Authorization: scope.auth,
      },
      body:    JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// ── GET /api/orders/[id] — public ─────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = getScope(req);
  if (!scope) return NO_SCOPE;

  try {
    const { id: orderId } = await params;
    const qs  = req.nextUrl.searchParams.toString();
    const url = `${BASE}/orders/${orderId}${qs ? `?${qs}` : ''}`;

    const res  = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-Tenant-Id': scope.tenantId, Authorization: scope.auth },
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}