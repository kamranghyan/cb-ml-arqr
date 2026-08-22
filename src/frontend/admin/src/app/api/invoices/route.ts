// app/api/v1/invoices/route.ts

import { NextRequest, NextResponse } from 'next/server';

const PAYMENT_SVC_BASE = process.env.NEXT_PUBLIC_PAYMENT_SVC_API_BASE || 'http://localhost:8003';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    const res = await fetch(`${PAYMENT_SVC_BASE}/api/v1/invoices?tenant_id=${tenantId}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
      },
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch invoices' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}