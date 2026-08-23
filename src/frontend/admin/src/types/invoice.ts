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

export interface InvoiceResponse {
  invoices: Invoice[];
  total: number;
}