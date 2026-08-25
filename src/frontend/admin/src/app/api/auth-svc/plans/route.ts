import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE 
  || 'https://j024yuqlaa.execute-api.ap-south-1.amazonaws.com/dev';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active_only') || 'true';

    const res = await fetch(
      `${SUBS_SVC_BASE}/api/v1/plans?active_only=${activeOnly}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
        },
      }
    );

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