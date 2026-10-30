import { NextRequest, NextResponse } from 'next/server';

const PAYMENT_SVC_BASE =
  process.env.NEXT_PUBLIC_PAYMENT_SVC_API_BASE ||
  'https://r343gbr2dh.execute-api.ap-south-1.amazonaws.com/dev';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const authorization = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id');

    console.log('====================================');
    console.log('[PAYMENT PROXY]');
    console.log('Target:', `${PAYMENT_SVC_BASE}/payment/initiate`);
    console.log('Tenant:', tenantId);
    console.log('Has Authorization:', !!authorization);
    console.log('====================================');

    if (!authorization) {
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

    const targetUrl =
      `${PAYMENT_SVC_BASE.replace(/\/+$/, '')}/payment/initiate`;

    const response = await fetch(targetUrl, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authorization,
        'X-Tenant-Id': tenantId,
      },

      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const responseText = await response.text();

    let data: unknown;

    try {
      data = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      data = {
        raw: responseText,
      };
    }

    console.log('====================================');
    console.log('[PAYMENT SERVICE RESPONSE]');
    console.log('Status:', response.status);
    console.log('Body:', data);
    console.log('====================================');

    return NextResponse.json(data, {
      status: response.status,
    });

  } catch (error) {
    console.error(
      '❌ [PAYMENT PROXY ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Payment service request failed',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Tenant-Id',
    },
  });
}