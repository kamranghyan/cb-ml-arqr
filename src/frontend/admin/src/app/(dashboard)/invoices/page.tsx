'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Calendar,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Clock,
  Zap,
  Crown,
  Star,
} from 'lucide-react';
import { getTheme } from '@/lib/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchMyTenant } from '@/lib/auth-api';
import { fetchInvoices, downloadInvoice } from '@/lib/invoice-api';
import type { Invoice } from '@/types/invoice';

const BRAND = '#ff5723';
const PAGE_SIZE = 10;

// ── Theme Colors ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
});

const getAccents = (isDark: boolean) => ({
  green: {
    bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
    border: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
    text: isDark ? '#4ade80' : '#16a34a'
  },
  orange: {
    bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
    border: isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A',
    text: isDark ? '#fb923c' : '#d97706'
  },
  danger: {
    bg: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
    border: isDark ? 'rgba(220,38,38,0.3)' : '#FECACA',
    text: isDark ? '#f87171' : '#dc2626'
  },
});

interface InvoiceWithId extends Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  plan_name: string;
  payment_method: string;
  currency: string;
  status: Invoice['status'];
  paid_at: string | null;
}

export default function InvoicesPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useCurrentUser();
  const [invoices, setInvoices] = useState<InvoiceWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithId | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Theme ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };
    updateTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);

    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  const colors = getColors(isDark);
  const accents = getAccents(isDark);

  // ── Role Check ──
  useEffect(() => {
    if (!authLoading && role !== 'tenant') {
      router.replace('/dashboard');
    }
  }, [role, authLoading, router]);

  // ── Load Invoices ──
  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const tenantData = await fetchMyTenant().catch(() => null);
      
      if (!tenantData) {
        setError('Could not load tenant information');
        setLoading(false);
        return;
      }

      const data = await fetchInvoices(tenantData.tenantId);
      
      const mappedInvoices: InvoiceWithId[] = data.map((inv: any) => ({
        id: inv.invoiceId || inv.id || `inv_${Date.now()}`,
        invoiceId: inv.invoiceId || inv.id || `inv_${Date.now()}`,
        invoice_number: inv.invoiceId || inv.invoice_number || `INV-${Date.now()}`,
        order_id: inv.orderId || inv.order_id || `ORD-${Date.now()}`,
        orderId: inv.orderId || inv.order_id || `ORD-${Date.now()}`,
        plan_id: inv.planId || inv.plan_id || 'monthly',
        plan_name: inv.planName || inv.plan_name || 'Monthly',
        amount: String(inv.amount ?? '0'),
        currency: inv.currency || 'USD',
        status: inv.status || 'PAID',
        payment_method: inv.paymentMethod || inv.payment_method || 'EasyPaisa',
        created_at: inv.createdAt || inv.created_at || new Date().toISOString(),
        createdAt: inv.createdAt || inv.created_at || new Date().toISOString(),
        paid_at: inv.paidAt || inv.paid_at || null,
        tenant_id: inv.tenantId || inv.tenant_id || tenantData.tenantId,
        downloadUrl: inv.downloadUrl || '',
        s3Key: inv.s3Key || '',
      }));

      setInvoices(mappedInvoices);
      setCurrentPage(1);
    } catch (e: any) {
      console.error('❌ Error loading invoices:', e);
      setError(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'tenant') {
      loadInvoices();
    }
  }, [role, loadInvoices]);

  // ── Pagination ──
  const totalPages = Math.ceil(invoices.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedInvoices = invoices.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // ── Format helpers ──
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(price);
    } catch {
      return `$${price.toFixed(2)}`;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      'PAID': { label: 'Paid', color: '#16a34a', bg: isDark ? 'rgba(34,197,94,0.15)' : '#F0FFF4' },
      'PENDING': { label: 'Pending', color: '#d97706', bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB' },
      'FAILED': { label: 'Failed', color: '#dc2626', bg: isDark ? 'rgba(220,38,38,0.15)' : '#FEF2F2' },
      'REFUNDED': { label: 'Refunded', color: '#6b7280', bg: isDark ? 'rgba(107,114,128,0.15)' : '#F3F4F6' },
    };
    return statusMap[status] || statusMap['PENDING'];
  };

  const getPlanIcon = (planId: string) => {
    const icons: Record<string, React.ReactNode> = {
      'weekly': <Clock size={16} />,
      'monthly': <Calendar size={16} />,
      'quarterly': <Zap size={16} />,
      'semi_annual': <Star size={16} />,
      'annual': <Crown size={16} />,
    };
    return icons[planId] || <CreditCard size={16} />;
  };

  // ── Download handler ──
  const handleDownload = async (invoice: InvoiceWithId) => {
    setDownloading(true);
    setError('');

    try {
      if (invoice.downloadUrl) {
        window.open(invoice.downloadUrl, '_blank');
      } else {
        await downloadInvoice(invoice.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };

  // ── If not tenant ──
  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: colors.bg,
        }}
      >
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color={BRAND} />
      </div>
    );
  }

  if (role !== 'tenant') {
    return null;
  }

  return (
    <div
      style={{
        background: colors.bg,
        padding: '20px 24px 40px',
        maxWidth: 1100,
        margin: '0 auto',
        minHeight: '100vh',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(20px, 2.5vw, 26px)',
              fontWeight: 800,
              color: colors.text,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <FileText size={24} color={BRAND} />
            Invoices
          </h1>
          <p
            style={{
              color: colors.muted,
              fontSize: 13,
              margin: '4px 0 0',
            }}
          >
            View all your payment invoices and receipts
          </p>
        </div>
        <button
          onClick={loadInvoices}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            border: `1.5px solid ${colors.border}`,
            borderRadius: 10,
            background: colors.card2,
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
            color: colors.text,
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
        >
          <RefreshCw
            size={14}
            style={loading ? { animation: 'spin 1s linear infinite' } : {}}
          />
          Refresh
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: colors.muted,
          }}
        >
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading invoices…</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '16px 20px',
            background: accents.danger.bg,
            border: `1px solid ${accents.danger.border}`,
            borderRadius: 12,
            color: accents.danger.text,
            marginBottom: 16,
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Invoices List ── */}
      {!loading && !error && (
        <>
          {/* Stats Summary */}
          {invoices.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Total
                </p>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: colors.text,
                    margin: 2,
                  }}
                >
                  {invoices.length}
                </p>
              </div>
              <div
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Paid
                </p>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: accents.green.text,
                    margin: 2,
                  }}
                >
                  {invoices.filter((i) => i.status === 'PAID').length}
                </p>
              </div>
              <div
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Pending
                </p>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: accents.orange.text,
                    margin: 2,
                  }}
                >
                  {invoices.filter((i) => i.status === 'PENDING').length}
                </p>
              </div>
            </div>
          )}

          {/* Invoice List */}
          {invoices.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: colors.muted,
              }}
            >
              <FileText size={48} style={{ opacity: 0.2 }} />
              <p style={{ marginTop: 12, fontSize: 14 }}>No invoices found</p>
              <p style={{ fontSize: 13, color: colors.subtle }}>
                Your invoices will appear here after your first payment
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {paginatedInvoices.map((invoice) => {
                  const statusBadge = getStatusBadge(invoice.status || 'PENDING');
                  return (
                    <div
                      key={invoice.id}
                      className="fade-in"
                      style={{
                        background: colors.card,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = BRAND;
                        e.currentTarget.style.boxShadow = `0 4px 12px ${
                          isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'
                        }`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setShowDetail(true);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: `${BRAND}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: BRAND,
                          }}
                        >
                          {getPlanIcon(invoice.planId || 'monthly')}
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: colors.text,
                              margin: 0,
                            }}
                          >
                            {invoice.invoice_number || invoice.id}
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: colors.muted,
                              margin: 0,
                            }}
                          >
                            {invoice.plan_name || 'Plan'} ·{' '}
                            {formatDate(invoice.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: colors.text,
                          }}
                        >
                          {formatPrice(Number(invoice.amount || 0), invoice.currency || 'USD')}
                        </span>
                        <span
                          style={{
                            padding: '2px 12px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            color: statusBadge.color,
                            background: statusBadge.bg,
                          }}
                        >
                          {statusBadge.label}
                        </span>
                        <ChevronRight size={18} color={colors.muted} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 4px',
                    marginTop: 16,
                    gap: 8,
                    flexWrap: 'wrap',
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: colors.subtle,
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    Showing {startIndex + 1}–{Math.min(endIndex, invoices.length)} of {invoices.length} invoices
                  </div>
                  
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: `1.5px solid ${colors.border}`,
                        background: colors.card,
                        color: currentPage === 1 ? colors.subtle : colors.text,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      const isActive = pageNum === currentPage;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          style={{
                            minWidth: 36,
                            height: 36,
                            padding: '0 8px',
                            borderRadius: 8,
                            border: `1.5px solid ${isActive ? BRAND : colors.border}`,
                            background: isActive ? BRAND : colors.card,
                            color: isActive ? '#fff' : colors.text,
                            fontWeight: isActive ? 700 : 500,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: `1.5px solid ${colors.border}`,
                        background: colors.card,
                        color: currentPage === totalPages ? colors.subtle : colors.text,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Invoice Detail Modal ── */}
      {showDetail && selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowDetail(false)}
        >
          <div
            style={{
              background: colors.card,
              borderRadius: 16,
              maxWidth: 500,
              width: '100%',
              padding: 28,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDetail(false)}
              style={{
                float: 'right',
                background: 'none',
                border: 'none',
                fontSize: 20,
                color: colors.muted,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ✕
            </button>

            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: colors.text,
                margin: '0 0 4px',
              }}
            >
              Invoice Details
            </h2>
            <p
              style={{
                fontSize: 13,
                color: colors.muted,
                marginBottom: 20,
              }}
            >
              {selectedInvoice.invoice_number || selectedInvoice.id}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Plan
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.text,
                    margin: 2,
                  }}
                >
                  {selectedInvoice.plan_name || '—'}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Amount
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: colors.text,
                    margin: 2,
                  }}
                >
                  {formatPrice(Number(selectedInvoice.amount || 0), selectedInvoice.currency || 'USD')}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Status
                </p>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    color: getStatusBadge(selectedInvoice.status || 'PENDING').color,
                    background: getStatusBadge(selectedInvoice.status || 'PENDING').bg,
                    marginTop: 2,
                  }}
                >
                  {getStatusBadge(selectedInvoice.status || 'PENDING').label}
                </span>
              </div>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Payment Method
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.text,
                    margin: 2,
                  }}
                >
                  {selectedInvoice.payment_method || '—'}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Created
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    margin: 2,
                  }}
                >
                  {formatDate(selectedInvoice.createdAt)}
                </p>
              </div>
              {selectedInvoice.paid_at && (
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      color: colors.subtle,
                      margin: 0,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Paid On
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: colors.text,
                      margin: 2,
                    }}
                  >
                    {formatDate(selectedInvoice.paid_at)}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 16,
                borderTop: `1px solid ${colors.border}`,
                paddingTop: 16,
              }}
            >
              <button
                onClick={() => handleDownload(selectedInvoice)}
                disabled={downloading}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: `1.5px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: downloading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!downloading) {
                    e.currentTarget.style.borderColor = BRAND;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!downloading) {
                    e.currentTarget.style.borderColor = colors.border;
                  }
                }}
              >
                {downloading ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Download size={16} />
                )}
                Download PDF
              </button>
              <button
                onClick={() => {
                  if (selectedInvoice.downloadUrl) {
                    window.open(selectedInvoice.downloadUrl, '_blank');
                  } else {
                    handleDownload(selectedInvoice);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  background: BRAND,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e64a1a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = BRAND;
                }}
              >
                <Eye size={16} />
                View Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}