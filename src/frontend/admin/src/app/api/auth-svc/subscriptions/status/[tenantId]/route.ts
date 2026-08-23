import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE

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

    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    
    console.log('📡 Fetching subscription status for tenant:', tenantId);
    console.log('🔑 Auth header present:', !!authHeader);

    // Forward to AWS subscription service
    const res = await fetch(
      `${SUBS_SVC_BASE}/api/v1/subscriptions/status/${tenantId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
          'X-Tenant-Id': tenantId,
        },
      }
    );

    console.log('📡 Response status from subscription service:', res.status);

    // ✅ If 404, return null (no subscription)
    if (res.status === 404) {
      console.log('ℹ️ No subscription found for tenant:', tenantId);
      return NextResponse.json(null, { status: 200 });
    }

    // ✅ If 401, return error (invalid token)
    if (res.status === 401) {
      return NextResponse.json(
        { error: 'Session expired. Please login again.' },
        { status: 401 }
      );
    }

    // Handle other errors
    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch subscription' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ Subscription status proxy error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ✅ OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    },
  });
}