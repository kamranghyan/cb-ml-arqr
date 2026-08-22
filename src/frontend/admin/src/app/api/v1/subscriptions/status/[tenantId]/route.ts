// app/api/v1/subscriptions/status/[tenantId]/route.ts

import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE || 'http://localhost:8002';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('🔑 Auth header:', authHeader ? '✅ Found' : '❌ Not found');

    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Please login to view subscription' },
        { status: 401 }
      );
    }

    console.log('🔑 Token preview:', token.substring(0, 30) + '...');

    // Forward to subscription service with proper headers
    const res = await fetch(`${SUBS_SVC_BASE}/api/v1/subscriptions/status/${tenantId}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Id': tenantId,
      },
    });

    console.log('📡 Response status from subscription service:', res.status);

    // Handle 401 specifically
    if (res.status === 401) {
      console.log('🔄 Token validation failed in subscription service');
      
      // Return 401 to frontend so it can handle token refresh
      return NextResponse.json(
        { error: 'Session expired. Please login again.' },
        { status: 401 }
      );
    }

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(null, { status: 200 });
      }
      const error = await res.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch subscription' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ API Route Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}