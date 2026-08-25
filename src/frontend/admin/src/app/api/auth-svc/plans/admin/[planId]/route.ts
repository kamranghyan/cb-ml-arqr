import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE = process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE 
  || 'https://j024yuqlaa.execute-api.ap-south-1.amazonaws.com/dev'

// ✅ PUT - Update Plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    console.log('📤 Updating plan:', { planId, body });

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${SUBS_SVC_BASE}/api/v1/plans/admin/${planId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
          'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
        },
        body: JSON.stringify(body),
      }
    );

    const text = await res.text();
    let data;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }

    console.log('📥 Update response:', { status: res.status, data });

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.message || 'Failed to update plan' },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ Update plan error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ✅ DELETE - Soft Delete Plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const authHeader = request.headers.get('authorization');

    console.log('🗑️ Deleting plan:', planId);

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${SUBS_SVC_BASE}/api/v1/plans/admin/${planId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
          'X-Tenant-Id': request.headers.get('X-Tenant-Id') || '',
        },
      }
    );

    const text = await res.text();
    let data;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }

    console.log('🗑️ Delete response:', { status: res.status, data });

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.message || 'Failed to delete plan' },
        { status: res.status }
      );
    }

    return NextResponse.json(data || { message: 'Plan deleted successfully' });
  } catch (error: any) {
    console.error('❌ Delete plan error:', error);
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
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    },
  });
}