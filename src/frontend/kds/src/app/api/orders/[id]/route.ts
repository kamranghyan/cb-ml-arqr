import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_ORDERS_API_BASE ?? 'https://s4qafzisc6.execute-api.ap-south-1.amazonaws.com/dev';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID_KDS || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ── PATCH /api/orders/[id] — public ───────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

// ── GET /api/orders/[id] — public ─────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const qs  = req.nextUrl.searchParams.toString();
    const url = `${BASE}/orders/${orderId}${qs ? `?${qs}` : ''}`;

    const res  = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-Tenant-Id': TENANT_ID },
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}