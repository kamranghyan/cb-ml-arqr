import { NextRequest, NextResponse } from 'next/server';
import { getValidIdToken } from '@/lib/cognito';

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

    // Get auth token
    const token = await getValidIdToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${PAYMENT_SVC_BASE}/api/v1/invoices?tenant_id=${tenantId}`, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch invoices' },
        { status: res.status }
      );
    }

    const data = await res.json();
    
    // ✅ Ensure we return array
    const invoices = Array.isArray(data) ? data : data?.invoices || [];
    
    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error('❌ Invoices API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}