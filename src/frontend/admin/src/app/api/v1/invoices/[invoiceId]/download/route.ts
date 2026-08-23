import { NextRequest, NextResponse } from 'next/server';
import { getValidIdToken } from '@/lib/cognito';

const PAYMENT_SVC_BASE = process.env.NEXT_PUBLIC_PAYMENT_SVC_API_BASE || 'http://localhost:8003';

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

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(
      `${PAYMENT_SVC_BASE}/api/v1/invoices/${invoiceId}/download`,
      {
        headers,
      }
    );

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: error || 'Failed to download invoice' },
        { status: res.status }
      );
    }

    // Get the PDF blob
    const blob = await res.blob();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${invoiceId}.pdf`,
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