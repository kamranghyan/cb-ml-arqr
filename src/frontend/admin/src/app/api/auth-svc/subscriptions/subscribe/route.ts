import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE;

export async function POST(request: NextRequest) {
  try {
    if (!SUBS_SVC_BASE) {
      console.error(
        '❌ Missing NEXT_PUBLIC_SUBS_SVC_API_BASE in environment variables'
      );

      return NextResponse.json(
        {
          error:
            'Server configuration error: Subscription Service Base URL missing',
        },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization') ?? '';

    const tenantId =
      request.headers.get('x-tenant-id') ||
      request.headers.get('X-Tenant-Id') ||
      '';

    const body = await request.json().catch(() => ({}));

    // Frontend uses camelCase
    if (!body.planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const cleanBase = SUBS_SVC_BASE.replace(/\/+$/, '');
    const upstreamUrl = `${cleanBase}/api/v1/subscriptions/subscribe`;

    console.log('📤 Proxying Subscribe Request:');
    console.log('  URL:', upstreamUrl);
    console.log('  Tenant ID:', tenantId);
    console.log('  Payload:', body);

    // BE currently expects snake_case
    const upstreamBody = {
      plan_id: body.planId,
    };

    const res = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify(upstreamBody),
      cache: 'no-store',
    });

    console.log('📡 Subscribe response status:', res.status);

    const rawText = await res.text();

    let data: any = {};

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { message: rawText };
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            data?.error ||
            data?.detail ||
            data?.message ||
            'Failed to subscribe',
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data, {
      status: res.status || 201,
    });
  } catch (error: any) {
    console.error('❌ Subscribe proxy crash:', error);

    return NextResponse.json(
      {
        error:
          error?.message || 'Internal server error',
      },
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
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Tenant-Id, x-tenant-id',
    },
  });
}