import { NextRequest, NextResponse } from 'next/server';

const API_BASE  = `${process.env.NEXT_PUBLIC_AR_API_BASE ?? 'https://xn1byphl3m.execute-api.ap-south-1.amazonaws.com/dev'}/ar`;
const MENU_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  'https://oh9dbidjq1.execute-api.ap-south-1.amazonaws.com/dev';

// restaurantId → tenantId, resolved from the restaurant itself so nothing
// about the tenant has to be configured in the guest build.
const tenantCache = new Map<string, { tenantId: string; at: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveTenant(restaurantId: string): Promise<string> {
  if (!restaurantId) return '';
  const hit = tenantCache.get(restaurantId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenantId;
  try {
    const r = await fetch(`${MENU_BASE}/menus/restaurants/${restaurantId}`, { cache: 'no-store' });
    if (!r.ok) return '';
    const tenantId: string = (await r.json())?.tenantId ?? '';
    if (tenantId) tenantCache.set(restaurantId, { tenantId, at: Date.now() });
    return tenantId;
  } catch { return ''; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rid = searchParams.get('rid');
  const iid = searchParams.get('iid');
  if (!rid || !iid) return NextResponse.json({ error: 'Missing rid or iid' }, { status: 400 });

  try {
    const res = await fetch(`${API_BASE}/${rid}/${iid}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'x-tenant-id': await resolveTenant(rid) },
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `AR API ${res.status}`, detail: text }, { status: res.status });
    return NextResponse.json(JSON.parse(text), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rid = searchParams.get('rid');
  const iid = searchParams.get('iid');
  if (!rid || !iid) return NextResponse.json({ error: 'Missing rid or iid' }, { status: 400 });

  try {
    const contentType = req.headers.get('content-type') ?? 'model/gltf-binary';
    const body = await req.arrayBuffer();
    const res = await fetch(`${API_BASE}/${rid}/${iid}`, {
      method: 'PUT',
      headers: { 'x-tenant-id': await resolveTenant(rid), 'Content-Type': contentType },
      body: body.byteLength > 0 ? body : undefined,
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `AR API ${res.status}`, detail: text }, { status: res.status });
    return NextResponse.json(text ? JSON.parse(text) : { success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rid = searchParams.get('rid');
  const iid = searchParams.get('iid');
  if (!rid || !iid) return NextResponse.json({ error: 'Missing rid or iid' }, { status: 400 });

  try {
    const res = await fetch(`${API_BASE}/${rid}/${iid}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': await resolveTenant(rid) },
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `AR API ${res.status}`, detail: text }, { status: res.status });
    return NextResponse.json(text ? JSON.parse(text) : { success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}