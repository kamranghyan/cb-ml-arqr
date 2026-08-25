import { NextRequest, NextResponse } from 'next/server';

const PAYMENT_SVC_BASE =
  process.env.NEXT_PUBLIC_PAYMENT_SVC_API_BASE ||
  'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const authHeader =
      request.headers.get('authorization');

    const tenantId =
      request.headers.get('X-Tenant-Id');

    const targetUrl =
      `${PAYMENT_SVC_BASE}/payment/initiate`;

    console.log('====================================');
    console.log('📤 PAYMENT PROXY');
    console.log('Target:', targetUrl);
    console.log('Tenant:', tenantId);
    console.log('Has Authorization:', !!authHeader);
    console.log('====================================');

    if (!authHeader) {
      return NextResponse.json(
        {
          error: 'Authorization token is required',
        },
        { status: 401 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        {
          error: 'X-Tenant-Id is required',
        },
        { status: 400 }
      );
    }

    const res = await fetch(targetUrl, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'X-Tenant-Id': tenantId,
      },

      body: JSON.stringify(body),

      cache: 'no-store',
    });

    const text = await res.text();

    let data: any;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch {
      data = {
        raw: text,
      };
    }

    console.log('====================================');
    console.log('📥 PAYMENT SERVICE RESPONSE');
    console.log('Status:', res.status);
    console.log('Data:', data);
    console.log('====================================');

    return NextResponse.json(
      data || {},
      {
        status: res.status,
      }
    );

  } catch (error: any) {

    console.error(
      '❌ PAYMENT PROXY ERROR:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Internal server error',
      },
      {
        status: 500,
      }
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
        'Content-Type, Authorization, X-Tenant-Id',
    },
  });
}