import { NextRequest, NextResponse } from 'next/server';
import { getValidIdToken } from '@/lib/cognito';

const PAYMENT_SVC_BASE = process.env.NEXT_PUBLIC_PAYMENT_SVC_API_BASE;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId is required' },
        { status: 400 }
      );
    }

    // 1. Get Auth Token
    const token = await getValidIdToken();

    // 🔴 FIX 1: Token missing ho to aage request na bhejen
    if (!token) {
      console.error('❌ No valid Cognito token found');
      return NextResponse.json(
        { error: 'Unauthorized: No valid session/token found' },
        { status: 401 }
      );
    }

    // 🔴 FIX 2: Request Headers fix (Content-Type ki bajaye Accept use karein)
    const headers: Record<string, string> = {
      'Accept': 'application/pdf',
      'Authorization': `Bearer ${token}`,
    };

    // Optional: Agar backend tenant-id bi expect kar raha hai to query se pass karein
    const tenantId = request.nextUrl.searchParams.get('tenant_id');
    if (tenantId) {
      headers['X-Tenant-Id'] = tenantId;
    }

    const backendUrl = `${PAYMENT_SVC_BASE}/api/v1/invoices/${invoiceId}/download`;
    console.log(`📡 Fetching PDF from: ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Payment Service returned ${res.status}:`, errorText);
      
      return NextResponse.json(
        { error: errorText || 'Failed to download invoice' },
        { status: res.status }
      );
    }

    // 🔴 FIX 3: Buffer arrayBuffer convert karke return karein (Server-side reliability ke liye)
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceId}.pdf"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('❌ Download invoice error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}