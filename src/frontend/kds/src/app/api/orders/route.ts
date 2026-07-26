import { NextRequest, NextResponse } from 'next/server';

const BASE      = process.env.NEXT_PUBLIC_ORDERS_API_BASE ?? 'https://s4qafzisc6.execute-api.ap-south-1.amazonaws.com/dev';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID_KDS     || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const REST_ID   = process.env.NEXT_PUBLIC_RESTAURANT_ID_KDS || 'eea190fd-b8dd-470d-aff1-7d75be5c2efb';

// ── GET /api/orders — public ───────────────────────────────────────────────────
export async function GET() {
  try {
    const url = `${BASE}/orders?tenantId=${TENANT_ID}&restaurantId=${REST_ID}`;
    const res  = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: text, url }, { status: res.status });
    return NextResponse.json(JSON.parse(text), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// ── POST /api/orders — public (no auth) ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res  = await fetch(`${BASE}/orders`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id':  TENANT_ID,
        ...(() => {
          let a = req.headers.get('authorization') ?? '';
          if (a && !a.startsWith('Bearer ')) a = `Bearer ${a}`;
          return a ? { Authorization: a } : {};
        })(),
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

// ── PATCH /api/orders/[id] — public (no auth) ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body    = await req.json();
    const url     = req.nextUrl.pathname;
    const orderId = url.split('/').pop();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const res = await fetch(`${BASE}/orders/${orderId}`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id':  TENANT_ID,
        ...(() => {
          let a = req.headers.get('authorization') ?? '';
          if (a && !a.startsWith('Bearer ')) a = `Bearer ${a}`;
          return a ? { Authorization: a } : {};
        })(),
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