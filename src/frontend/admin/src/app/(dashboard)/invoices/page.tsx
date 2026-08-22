// app/tenant/invoices/page.tsx

'use client';

import { useState, useEffect } from 'react';
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

const BRAND = '#ff5723';
const PAGE_SIZE = 10; // ✅ 10 invoices per page

// ── Types ──
interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';
  payment_method: string;
  created_at: string;
  paid_at: string | null;
  tenant_id: string;
}

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
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
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

// ── Static Demo Data ──
const DEMO_INVOICES: Invoice[] = [
  {
    id: 'inv_1',
    invoice_number: 'INV-2024-001',
    order_id: 'ORD-001',
    plan_id: 'monthly',
    plan_name: 'Monthly',
    amount: 9.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_2',
    invoice_number: 'INV-2024-002',
    order_id: 'ORD-002',
    plan_id: 'quarterly',
    plan_name: 'Quarterly',
    amount: 24.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_3',
    invoice_number: 'INV-2024-003',
    order_id: 'ORD-003',
    plan_id: 'annual',
    plan_name: 'Annual',
    amount: 89.99,
    currency: 'USD',
    status: 'PENDING',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: null,
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_4',
    invoice_number: 'INV-2024-004',
    order_id: 'ORD-004',
    plan_id: 'weekly',
    plan_name: 'Weekly',
    amount: 2.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_5',
    invoice_number: 'INV-2024-005',
    order_id: 'ORD-005',
    plan_id: 'monthly',
    plan_name: 'Monthly',
    amount: 9.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_6',
    invoice_number: 'INV-2024-006',
    order_id: 'ORD-006',
    plan_id: 'quarterly',
    plan_name: 'Quarterly',
    amount: 24.99,
    currency: 'USD',
    status: 'REFUNDED',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 119 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_7',
    invoice_number: 'INV-2024-007',
    order_id: 'ORD-007',
    plan_id: 'annual',
    plan_name: 'Annual',
    amount: 89.99,
    currency: 'USD',
    status: 'FAILED',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: null,
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_8',
    invoice_number: 'INV-2024-008',
    order_id: 'ORD-008',
    plan_id: 'weekly',
    plan_name: 'Weekly',
    amount: 2.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_9',
    invoice_number: 'INV-2024-009',
    order_id: 'ORD-009',
    plan_id: 'monthly',
    plan_name: 'Monthly',
    amount: 9.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_10',
    invoice_number: 'INV-2024-010',
    order_id: 'ORD-010',
    plan_id: 'quarterly',
    plan_name: 'Quarterly',
    amount: 24.99,
    currency: 'USD',
    status: 'PENDING',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: null,
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_11',
    invoice_number: 'INV-2024-011',
    order_id: 'ORD-011',
    plan_id: 'annual',
    plan_name: 'Annual',
    amount: 89.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 149 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
  {
    id: 'inv_12',
    invoice_number: 'INV-2024-012',
    order_id: 'ORD-012',
    plan_id: 'weekly',
    plan_name: 'Weekly',
    amount: 2.99,
    currency: 'USD',
    status: 'PAID',
    payment_method: 'EasyPaisa',
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    tenant_id: 'tenant_1',
  },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>(DEMO_INVOICES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  // ✅ Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // ── Theme listener ──
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

  // ── Pagination logic ──
  const totalPages = Math.ceil(invoices.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedInvoices = invoices.slice(startIndex, endIndex);

  // ── Reset page when invoices change ──
  useEffect(() => {
    setCurrentPage(1);
  }, [invoices.length]);

  // ── Refresh ──
  const refreshInvoices = () => {
    setLoading(true);
    setTimeout(() => {
      setInvoices(DEMO_INVOICES);
      setCurrentPage(1);
      setLoading(false);
    }, 500);
  };

  // ── Pagination handlers ──
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // ── Format date ──
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // ── Format price ──
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // ── Get status badge ──
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      'PAID': { label: 'Paid', color: '#16a34a', bg: isDark ? 'rgba(34,197,94,0.15)' : '#F0FFF4' },
      'PENDING': { label: 'Pending', color: '#d97706', bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB' },
      'FAILED': { label: 'Failed', color: '#dc2626', bg: isDark ? 'rgba(220,38,38,0.15)' : '#FEF2F2' },
      'REFUNDED': { label: 'Refunded', color: '#6b7280', bg: isDark ? 'rgba(107,114,128,0.15)' : '#F3F4F6' },
    };
    return statusMap[status] || statusMap['PENDING'];
  };

  // ── Get plan icon ──
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
          onClick={refreshInvoices}
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
                  const statusBadge = getStatusBadge(invoice.status);
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
                          {getPlanIcon(invoice.plan_id)}
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
                            {invoice.invoice_number}
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: colors.muted,
                              margin: 0,
                            }}
                          >
                            {invoice.plan_name} Plan ·{' '}
                            {formatDate(invoice.created_at)}
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
                          {formatPrice(invoice.amount, invoice.currency)}
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

              {/* ✅ Pagination Controls */}
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
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: `1.5px solid ${currentPage === 1 ? colors.border : colors.border}`,
                        background: currentPage === 1 ? colors.card2 : colors.card,
                        color: currentPage === 1 ? colors.subtle : colors.text,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        outline: 'none',
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {/* Page Numbers */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (currentPage <= 4) {
                          pageNum = i + 1;
                          if (i === 6) pageNum = totalPages;
                        } else if (currentPage >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = currentPage - 3 + i;
                        }
                        
                        const isActive = pageNum === currentPage;
                        const isEllipsis = i === 3 && totalPages > 7 && currentPage > 4 && currentPage < totalPages - 3;
                        
                        if (isEllipsis) {
                          return (
                            <span key={`ellipsis-${i}`} style={{
                              padding: '0 4px',
                              color: colors.subtle,
                              fontSize: 13,
                            }}>
                              …
                            </span>
                          );
                        }
                        
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
                              transition: 'all 0.2s ease',
                              outline: 'none',
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: `1.5px solid ${currentPage === totalPages ? colors.border : colors.border}`,
                        background: currentPage === totalPages ? colors.card2 : colors.card,
                        color: currentPage === totalPages ? colors.subtle : colors.text,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        outline: 'none',
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
            {/* Close */}
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
              {selectedInvoice.invoice_number}
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
                  {selectedInvoice.plan_name}
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
                  {formatPrice(selectedInvoice.amount, selectedInvoice.currency)}
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
                    color: getStatusBadge(selectedInvoice.status).color,
                    background: getStatusBadge(selectedInvoice.status).bg,
                    marginTop: 2,
                  }}
                >
                  {getStatusBadge(selectedInvoice.status).label}
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
                  {selectedInvoice.payment_method}
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
                  {formatDate(selectedInvoice.created_at)}
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
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: `1.5px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                <Download size={16} />
                Download PDF
              </button>
              <button                style={{
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
                  outline: 'none',
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