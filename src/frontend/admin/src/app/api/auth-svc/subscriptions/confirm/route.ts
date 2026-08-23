import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE

export async function POST(request: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    console.log('📤 Confirming payment:', body);

    // Validate required fields
    if (!body.plan_id || !body.payment_id) {
      return NextResponse.json(
        { error: 'plan_id and payment_id are required' },
        { status: 400 }
      );
    }

    // ✅ Call the payment confirmation webhook on subscription service
    const res = await fetch(
      `${SUBS_SVC_BASE}/api/v1/webhooks/payment/confirm`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
          'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
        },
        body: JSON.stringify({
          tenant_id: request.headers.get('X-Tenant-Id') || '',
          plan_id: body.plan_id,
          payment_id: body.payment_id,
          payment_status: 'succeeded',
          amount: body.amount || 0,
          currency: body.currency || 'USD',
        }),
      }
    );

    const data = await res.json();

    console.log('📡 Confirm response:', { status: res.status, data });

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.message || 'Payment confirmation failed' },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ Confirm payment error:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    },
  });
}