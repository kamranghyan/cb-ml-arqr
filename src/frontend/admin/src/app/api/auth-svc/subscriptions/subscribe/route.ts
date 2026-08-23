import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    if (!body.plan_id) {
      return NextResponse.json(
        { error: 'plan_id is required' },
        { status: 400 }
      );
    }

    console.log('📤 Subscribing to plan:', body);

    const res = await fetch(
      `${SUBS_SVC_BASE}/api/v1/subscriptions/subscribe`,
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

    const data = await res.json();

    console.log('📡 Subscribe response status:', res.status);

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || data?.detail || 'Failed to subscribe' },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('❌ Subscribe proxy error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    },
  });
}