import { NextRequest, NextResponse } from 'next/server';

const INVOICE_SVC_BASE = process.env.NEXT_PUBLIC_INVOICE_SVC_API_BASE;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const orderId = searchParams.get('orderId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      'Authorization': `Bearer ${token}`,
    };

    // Agar orderId hai to single invoice URL, warna query with tenant_id
    const backendUrl = orderId 
      ? `${INVOICE_SVC_BASE}/invoices/${orderId}`
      : `${INVOICE_SVC_BASE}/invoices?tenantId=${tenantId}`;

    const res = await fetch(backendUrl, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText || 'Failed to fetch' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}