import { NextRequest, NextResponse } from 'next/server';

// ✅ Use deployed AWS URL
const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE;

export async function POST(request: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    console.log('📤 Forwarding to subscription service:', {
      url: `${SUBS_SVC_BASE}/api/v1/plans/admin`,
      body,
      hasAuth: !!authHeader,
    });

    // Forward to AWS deployed subscription service
    const res = await fetch(
      `${SUBS_SVC_BASE}/api/v1/plans/admin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
          'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
        },
        body: JSON.stringify(body),
      }
    );

    const text = await res.text();
    let data;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }

    console.log('📥 Response from subscription service:', {
      status: res.status,
      data,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.message || 'Failed to create plan' },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('❌ Create plan proxy error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ✅ OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    },
  });
}