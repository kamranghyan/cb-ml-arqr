import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE =
  process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE;

export async function POST(request: NextRequest) {
  try {
    if (!SUBS_SVC_BASE) {
      return NextResponse.json(
        {
          error:
            'Subscription Service Base URL is missing',
        },
        { status: 500 }
      );
    }

    const authHeader =
      request.headers.get('authorization') ?? '';

    const tenantId =
      request.headers.get('x-tenant-id') ||
      request.headers.get('X-Tenant-Id') ||
      '';

    const body = await request.json();

    console.log('📤 Confirming payment:', body);

    // Frontend uses camelCase
    if (!body.planId || !body.paymentId) {
      return NextResponse.json(
        {
          error:
            'planId and paymentId are required',
        },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        {
          error: 'Tenant ID is required',
        },
        { status: 400 }
      );
    }

    const cleanBase = SUBS_SVC_BASE.replace(
      /\/+$/,
      ''
    );

    const upstreamUrl =
      `${cleanBase}/api/v1/webhooks/payment/confirm`;

    // BE currently expects snake_case
    const upstreamBody = {
      tenant_id: tenantId,
      plan_id: body.planId,
      payment_id: body.paymentId,
      payment_status: 'succeeded',
      amount: body.amount ?? 0,
      currency: body.currency ?? 'USD',
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

    const rawText = await res.text();

    let data: any = {};

    try {
      data = rawText
        ? JSON.parse(rawText)
        : {};
    } catch {
      data = {
        message: rawText,
      };
    }

    console.log('📡 Confirm response:', {
      status: res.status,
      data,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.error ||
            data?.message ||
            'Payment confirmation failed',
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data, {
      status: res.status,
    });
  } catch (error: any) {
    console.error(
      '❌ Confirm payment error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Internal server error',
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
      'Access-Control-Allow-Methods':
        'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Tenant-Id, x-tenant-id',
    },
  });
}