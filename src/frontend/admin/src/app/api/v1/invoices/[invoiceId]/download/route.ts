import { NextRequest, NextResponse } from 'next/server';
import { getValidIdToken } from '@/lib/cognito';

const INVOICE_SVC_BASE = process.env.NEXT_PUBLIC_INVOICE_SVC_API_BASE;

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

    const token = await getValidIdToken();

    if (!token) {
      console.error('❌ No valid Cognito token found');
      return NextResponse.json(
        { error: 'Unauthorized: No valid session/token found' },
        { status: 401 }
      );
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    const tenantId = request.nextUrl.searchParams.get('tenant_id');
    if (tenantId) {
      headers['X-Tenant-Id'] = tenantId;
    }

    // invoice_svc's /download route doesn't stream a PDF itself — it
    // returns JSON with a fresh presigned S3 URL. We fetch that JSON,
    // then send the browser straight to S3 for the actual PDF bytes,
    // instead of (incorrectly) treating the JSON response body itself
    // as if it were the file.
    const backendUrl = `${INVOICE_SVC_BASE}/invoices/${invoiceId}/download`;
    console.log(`📡 Fetching invoice download URL from: ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Invoice Service returned ${res.status}:`, errorText);

      return NextResponse.json(
        { error: errorText || 'Failed to download invoice' },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (!data?.downloadUrl) {
      console.error('❌ No downloadUrl in response:', data);
      return NextResponse.json(
        { error: 'No download URL returned by invoice service' },
        { status: 502 }
      );
    }

    // Redirect the browser straight to the presigned S3 URL — S3 serves
    // the actual PDF bytes directly, no need to buffer the whole file
    // through this server.
    return NextResponse.redirect(data.downloadUrl);

  } catch (error: any) {
    console.error('❌ Download invoice error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}