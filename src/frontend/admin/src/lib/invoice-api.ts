import { getValidIdToken, getValidToken, loadUser } from './cognito';

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

// AWS Cloud API Gateway Base URL
const BASE_URL = process.env.NEXT_PUBLIC_INVOICE_API_URL || 'https://o4m6177cp9.execute-api.ap-south-1.amazonaws.com/Prod';

// 🟢 Base Helper Function
async function invoiceFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = await getValidIdToken();
  if (!token) token = await getValidToken();

  const user = loadUser();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (user?.tenantId) headers['X-Tenant-Id'] = user.tenantId;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${BASE_URL}${cleanPath}`;

  const res = await fetch(fullUrl, {
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

    if (res.status === 401) throw new Error('Session expired — please log in again.');
    if (res.status === 403) throw new Error(message || 'Access Forbidden (403).');

    throw new Error(message || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;

  const body = await res.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

// 1️⃣ Get All Invoices for Tenant (Robust Response Parsing)
export async function fetchInvoices(tenantId: string): Promise<Invoice[]> {
  try {
    if (!tenantId) {
      console.warn('⚠️ fetchInvoices called without tenantId');
      return [];
    }

    // Both query parameter patterns added for safety
    const path = `/invoices?tenantId=${encodeURIComponent(tenantId)}&tenant_id=${encodeURIComponent(tenantId)}`;
    const data = await invoiceFetch<any>(path);

    console.log('📡 Raw Invoice API Response:', data);

    // 🔴 Multi-format check for API responses
    if (Array.isArray(data)) {
      return data;
    } else if (Array.isArray(data?.invoices)) {
      return data.invoices;
    } else if (Array.isArray(data?.data)) {
      return data.data;
    } else if (Array.isArray(data?.items)) {
      return data.items;
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    return [];
  }
}

// 2️⃣ Get Single Invoice Details
export async function fetchInvoiceDetails(invoiceId: string): Promise<Invoice | null> {
  try {
    const data = await invoiceFetch<any>(`/invoices/${encodeURIComponent(invoiceId)}`);
    return data?.invoice || data || null;
  } catch (error) {
    console.error('Failed to fetch invoice details:', error);
    return null;
  }
}


// 3️⃣ Download Invoice PDF
export async function downloadInvoice(invoiceId: string): Promise<void> {
  try {
    let token = await getValidIdToken();
    if (!token) token = await getValidToken();

    const user = loadUser();

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (user?.tenantId) headers['X-Tenant-Id'] = user.tenantId;

    const res = await fetch(`${BASE_URL}/invoices/${encodeURIComponent(invoiceId)}/download`, {
      headers,
    });

    if (!res.ok) throw new Error('Failed to download invoice');

    // This endpoint returns JSON { downloadUrl: <fresh presigned S3 URL> },
    // never the PDF bytes directly — fetch that JSON first, then open the
    // real PDF straight from S3 in a new tab (view), same behavior as the
    // direct-downloadUrl path above. Never force a "Save As" download.
    const data = await res.json();
    if (!data?.downloadUrl) throw new Error('No download URL returned');

    window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Failed to download invoice:', error);
    throw error;
  }
}