import { NextRequest, NextResponse } from 'next/server';

const API_BASE  = `${process.env.NEXT_PUBLIC_AR_API_BASE ?? 'https://xn1byphl3m.execute-api.ap-south-1.amazonaws.com/dev'}/ar`;
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rid = searchParams.get('rid');
  const iid = searchParams.get('iid');
  if (!rid || !iid) return NextResponse.json({ error: 'Missing rid or iid' }, { status: 400 });

  try {
    const res = await fetch(`${API_BASE}/${rid}/${iid}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'x-tenant-id': TENANT_ID },
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
      headers: { 'x-tenant-id': TENANT_ID, 'Content-Type': contentType },
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
      headers: { 'x-tenant-id': TENANT_ID },
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `AR API ${res.status}`, detail: text }, { status: res.status });
    return NextResponse.json(text ? JSON.parse(text) : { success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}