// app/api/v1/subscriptions/subscribe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getValidIdToken } from '@/lib/cognito';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE || 'http://localhost:8002';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.plan_id) {
      return NextResponse.json(
        { error: 'plan_id is required' },
        { status: 400 }
      );
    }

    // ✅ Get auth token
    const token = await getValidIdToken();

    // ✅ Build headers with auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${SUBS_SVC_BASE}/api/v1/subscriptions/subscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      // ✅ Pass through auth errors
      if (res.status === 401) {
        return NextResponse.json(
          { error: 'Please log in to subscribe' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: data?.error || data?.detail || 'Failed to subscribe' },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}