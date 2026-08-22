// app/api/v1/payment/initiate/route.ts

import { NextRequest, NextResponse } from 'next/server';

const PAYMENT_SVC_BASE = process.env.NEXT_PUBLIC_PAYMENT_SVC_API_BASE || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${PAYMENT_SVC_BASE}/api/v1/payment/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: error || 'Payment initiation failed' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}