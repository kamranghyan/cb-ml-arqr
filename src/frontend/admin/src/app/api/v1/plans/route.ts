// app/api/v1/plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getValidIdToken } from '@/lib/cognito';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE || 'http://localhost:8002';

export async function GET(request: NextRequest) {
  try {
    // ✅ Get auth token (optional for plans - public read)
    const token = await getValidIdToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active_only') || 'true';

    const res = await fetch(`${SUBS_SVC_BASE}/api/v1/plans?active_only=${activeOnly}`, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch plans' },
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