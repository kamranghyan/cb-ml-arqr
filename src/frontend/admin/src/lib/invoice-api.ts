import { getValidIdToken } from './cognito';

export interface Invoice {
  invoiceId: string;
  orderId: string;
  amount: string;
  s3Key: string;
  downloadUrl: string;
  createdAt: string;
  tenantId?: string;
  planId?: string;
  planName?: string;
  status?: 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';
  paymentMethod?: string;
}

async function invoiceFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/v1/invoices${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;

    try {
      const body = JSON.parse(text);
      message = body?.error?.message ?? body?.message ?? body?.detail ?? text;
    } catch {
      // Keep raw text
    }

    if (res.status === 401) {
      throw new Error('Session expired — please log in again.');
    }

    if (res.status === 403) {
      throw new Error(message || 'You do not have access to this.');
    }

    throw new Error(message || `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

// ── Get Invoices for Tenant ──
export async function fetchInvoices(tenantId: string): Promise<Invoice[]> {
  try {
    const data = await invoiceFetch<{ invoices: Invoice[] }>(
      `?tenant_id=${encodeURIComponent(tenantId)}`
    );
    return data?.invoices || [];
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    return [];
  }
}

// ── Download Invoice PDF ──
export async function downloadInvoice(invoiceId: string): Promise<void> {
  try {
    const token = await getValidIdToken();
    
    const res = await fetch(`/api/v1/invoices/${invoiceId}/download`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    if (!res.ok) {
      throw new Error('Failed to download invoice');
    }

    // Get blob from response
    const blob = await res.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download invoice:', error);
    throw error;
  }
}

// ── Get Invoice Details ──
export async function fetchInvoiceDetails(invoiceId: string): Promise<Invoice | null> {
  try {
    return await invoiceFetch<Invoice>(`/${encodeURIComponent(invoiceId)}`);
  } catch (error) {
    console.error('Failed to fetch invoice details:', error);
    return null;
  }
}