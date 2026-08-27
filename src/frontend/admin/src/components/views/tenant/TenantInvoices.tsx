'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  Eye,
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

const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B7280',
});

const getAccents = (isDark: boolean) => ({
  green: {
    bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
    border: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
    text: isDark ? '#4ade80' : '#16a34a',
  },
  orange: {
    bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
    border: isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A',
    text: isDark ? '#fb923c' : '#d97706',
  },
  danger: {
    bg: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
    border: isDark ? 'rgba(220,38,38,0.3)' : '#FECACA',
    text: isDark ? '#f87171' : '#dc2626',
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

export default function TenantInvoices() {
  const router = useRouter();
  const { role, loading: authLoading } = useCurrentUser();

  const [invoices, setInvoices] = useState<InvoiceWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(false);

  const [selectedInvoice, setSelectedInvoice] =
    useState<InvoiceWithId | null>(null);

  const [showDetail, setShowDetail] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  /*
   * IMPORTANT:
   * This ref prevents the initial invoice API from being called
   * more than once during the lifetime of this component.
   *
   * This is especially useful when React StrictMode causes
   * effects to execute twice in development.
   */
  const initialLoadDoneRef = useRef(false);

  /*
   * Prevents two invoice requests from running simultaneously.
   */
  const invoiceRequestRunningRef = useRef(false);

  // ─────────────────────────────────────────────
  // Theme
  // ─────────────────────────────────────────────

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(getTheme() === 'dark');
    };

    updateTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'admin_theme') {
        updateTheme();
      }
    };

    const handleThemeChange = () => {
      updateTheme();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('themeChange', handleThemeChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeChange);
    };
  }, []);

  const colors = getColors(isDark);
  const accents = getAccents(isDark);

  // ─────────────────────────────────────────────
  // Tenant Role Check
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && role !== 'tenant') {
      router.replace('/dashboard');
    }
  }, [role, authLoading, router]);

  // ─────────────────────────────────────────────
  // Load Invoices
  // ─────────────────────────────────────────────

  const loadInvoices = useCallback(
    async (force = false) => {
      /*
       * Normal initial load:
       * Once loaded, NEVER call again automatically.
       */
      if (!force && initialLoadDoneRef.current) {
        return;
      }

      /*
       * Prevent duplicate requests if another request
       * is already in progress.
       */
      if (invoiceRequestRunningRef.current) {
        return;
      }

      invoiceRequestRunningRef.current = true;

      setLoading(true);
      setError('');

      try {
        const tenantData = await fetchMyTenant();

        if (!tenantData?.tenantId) {
          throw new Error(
            'Could not load tenant information'
          );
        }

        const data = await fetchInvoices(
          tenantData.tenantId
        );

        const mappedInvoices: InvoiceWithId[] = (
          data || []
        ).map((inv: any, index: number) => {
          const invoiceId =
            inv.invoiceId ||
            inv.id ||
            `invoice-${index}`;

          const orderId =
            inv.orderId ||
            inv.order_id ||
            '';

          const createdAt =
            inv.createdAt ||
            inv.created_at ||
            '';

          return {
            ...inv,

            id: invoiceId,

            invoiceId,

            invoice_number:
              inv.invoiceNumber ||
              inv.invoice_number ||
              inv.invoiceId ||
              invoiceId,

            order_id: orderId,
            orderId,

            plan_id:
              inv.planId ||
              inv.plan_id ||
              'monthly',

            plan_name:
              inv.planName ||
              inv.plan_name ||
              '',

            amount: String(
              inv.amount ?? '0'
            ),

            currency:
              inv.currency ||
              'USD',

            status:
              inv.status ||
              'PENDING',

            payment_method:
              inv.paymentMethod ||
              inv.payment_method ||
              '—',

            created_at: createdAt,
            createdAt,

            paid_at:
              inv.paidAt ||
              inv.paid_at ||
              null,

            tenant_id:
              inv.tenantId ||
              inv.tenant_id ||
              tenantData.tenantId,

            downloadUrl:
              inv.downloadUrl ||
              '',

            s3Key:
              inv.s3Key ||
              '',
          };
        });

        setInvoices(mappedInvoices);
        setCurrentPage(1);

        /*
         * Mark initial loading as completed.
         *
         * This stays true even when React re-renders.
         */
        initialLoadDoneRef.current = true;
      } catch (err: any) {
        console.error(
          'Error loading tenant invoices:',
          err
        );

        setError(
          err?.message ||
            'Failed to load invoices'
        );
      } finally {
        invoiceRequestRunningRef.current = false;
        setLoading(false);
      }
    },
    []
  );

  // ─────────────────────────────────────────────
  // Initial Invoice Load — ONLY ONCE
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (role !== 'tenant') {
      return;
    }

    /*
     * StrictMode / re-render protection.
     */
    if (initialLoadDoneRef.current) {
      return;
    }

    if (invoiceRequestRunningRef.current) {
      return;
    }

    loadInvoices(false);
  }, [role, loadInvoices]);

  // ─────────────────────────────────────────────
  // Pagination
  // ─────────────────────────────────────────────

  const totalPages = Math.max(
    1,
    Math.ceil(
      invoices.length / PAGE_SIZE
    )
  );

  const startIndex =
    (currentPage - 1) * PAGE_SIZE;

  const endIndex =
    startIndex + PAGE_SIZE;

  const paginatedInvoices =
    invoices.slice(
      startIndex,
      endIndex
    );

  const goToPage = (page: number) => {
    if (
      page < 1 ||
      page > totalPages
    ) {
      return;
    }

    setCurrentPage(page);
  };

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  const formatDate = (
    dateStr: string | null | undefined
  ) => {
    if (!dateStr) {
      return '—';
    }

    const date = new Date(dateStr);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );
  };

  const formatPrice = (
    price: number,
    currency: string
  ) => {
    try {
      return new Intl.NumberFormat(
        'en-US',
        {
          style: 'currency',
          currency:
            currency || 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      ).format(price);
    } catch {
      return `$${price.toFixed(2)}`;
    }
  };

  const getStatusBadge = (
    status?: string
  ) => {
    const normalized =
      String(
        // status || 'PENDING'
      ).toUpperCase();

    const statusMap: Record<
      string,
      {
        label: string;
        color: string;
        bg: string;
      }
    > = {
      PAID: {
        label: 'Paid',
        color:
          accents.green.text,
        bg:
          accents.green.bg,
      },

      // PENDING: {
      //   label: 'Pending',
      //   color:
      //     accents.orange.text,
      //   bg:
      //     accents.orange.bg,
      // },

      FAILED: {
        label: 'Failed',
        color:
          accents.danger.text,
        bg:
          accents.danger.bg,
      },

      REFUNDED: {
        label: 'Refunded',
        color: colors.muted,
        bg: isDark
          ? 'rgba(107,114,128,0.15)'
          : '#F3F4F6',
      },
    };

    return (
      statusMap[normalized] || ""
      // statusMap.PENDING
    );
  };

  const getPlanIcon = (
    planId?: string
  ) => {
    switch (
      String(
        planId || ''
      ).toLowerCase()
    ) {
      case 'weekly':
        return <Clock size={16} />;

      case 'monthly':
        return <Calendar size={16} />;

      case 'quarterly':
        return <Zap size={16} />;

      case 'semi_annual':
      case 'semi-annual':
        return <Star size={16} />;

      case 'annual':
      case 'yearly':
        return <Crown size={16} />;

      default:
        return <CreditCard size={16} />;
    }
  };

  // ─────────────────────────────────────────────
  // Download
  // ─────────────────────────────────────────────

  const handleDownload = async (
    invoice: InvoiceWithId
  ) => {
    if (downloading) {
      return;
    }

    setDownloading(true);
    setError('');

    try {
      if (invoice.downloadUrl) {
        window.open(
          invoice.downloadUrl,
          '_blank',
          'noopener,noreferrer'
        );
      } else {
        await downloadInvoice(
          invoice.id
        );
      }
    } catch (err: any) {
      console.error(
        'Invoice download failed:',
        err
      );

      setError(
        err?.message ||
          'Failed to download invoice'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleViewReceipt = async (
    invoice: InvoiceWithId
  ) => {
    setError('');

    if (invoice.downloadUrl) {
      window.open(
        invoice.downloadUrl,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    await handleDownload(invoice);
  };

  // ─────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.bg,
        }}
      >
        <Loader2
          size={28}
          color={BRAND}
          style={{
            animation:
              'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  if (role !== 'tenant') {
    return null;
  }

  // ─────────────────────────────────────────────
  // Page
  // ─────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        padding:
          '20px 24px 40px',
        maxWidth: 1100,
        margin: '0 auto',
        fontFamily:
          "'Poppins', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .invoice-fade-in {
          animation: fadeIn 0.3s ease-out;
        }

        .invoice-row:hover {
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .invoice-row {
            padding: 14px !important;
          }

          .invoice-right {
            width: 100%;
            justify-content: space-between !important;
          }

          .invoice-amount {
            margin-left: 54px;
          }

          .invoice-detail-grid {
            grid-template-columns: 1fr !important;
          }

          .invoice-actions {
            flex-direction: column !important;
          }
        }
      `}</style>

      {/* Header */}

      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems:
            'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize:
                'clamp(20px, 2.5vw, 26px)',
              fontWeight: 800,
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <FileText
              size={24}
              color={BRAND}
            />

            Invoices
          </h1>

          <p
            style={{
              margin:
                '4px 0 0',
              fontSize: 13,
              color: colors.muted,
            }}
          >
            View all your payment
            invoices and receipts
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            loadInvoices(true)
          }
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding:
              '8px 16px',
            border:
              `1.5px solid ${colors.border}`,
            borderRadius: 10,
            background:
              colors.card2,
            color: colors.text,
            fontWeight: 600,
            fontSize: 13,
            cursor: loading
              ? 'not-allowed'
              : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw
            size={14}
            style={
              loading
                ? {
                    animation:
                      'spin 1s linear infinite',
                  }
                : undefined
            }
          />

          Refresh
        </button>
      </div>

      {/* Loading */}

      {loading && (
        <div
          style={{
            minHeight: 260,
            display: 'flex',
            flexDirection:
              'column',
            alignItems: 'center',
            justifyContent:
              'center',
            color: colors.muted,
          }}
        >
          <Loader2
            size={24}
            style={{
              animation:
                'spin 1s linear infinite',
            }}
          />

          <p
            style={{
              margin:
                '12px 0 0',
              fontSize: 14,
            }}
          >
            Loading invoices…
          </p>
        </div>
      )}

      {/* Error */}

      {!loading && error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'center',
            gap: 8,
            padding:
              '14px 18px',
            marginBottom: 16,
            background:
              accents.danger.bg,
            border:
              `1px solid ${accents.danger.border}`,
            borderRadius: 12,
            color:
              accents.danger.text,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          <AlertCircle size={18} />

          <span>{error}</span>
        </div>
      )}

      {/* Content */}

      {!loading && !error && (
        <>
          {/* Stats */}

          {invoices.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {/* Total */}

              <div
                style={{
                  background:
                    colors.card,
                  border:
                    `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding:
                    '14px 16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color:
                      colors.subtle,
                    textTransform:
                      'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Total
                </p>

                <p
                  style={{
                    margin:
                      '2px 0 0',
                    fontSize: 20,
                    fontWeight: 700,
                    color:
                      colors.text,
                  }}
                >
                  {invoices.length}
                </p>
              </div>

              {/* Paid */}

              <div
                style={{
                  background:
                    colors.card,
                  border:
                    `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding:
                    '14px 16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color:
                      colors.subtle,
                    textTransform:
                      'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Paid
                </p>

                <p
                  style={{
                    margin:
                      '2px 0 0',
                    fontSize: 20,
                    fontWeight: 700,
                    color:
                      accents.green.text,
                  }}
                >
                  {
                    invoices.filter(
                      (invoice) =>
                        String(
                          invoice.status
                        ).toUpperCase() ===
                        'PAID'
                    ).length
                  }
                </p>
              </div>

              {/* Pending */}

              <div
                style={{
                  background:
                    colors.card,
                  border:
                    `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding:
                    '14px 16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color:
                      colors.subtle,
                    textTransform:
                      'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Pending
                </p>

                <p
                  style={{
                    margin:
                      '2px 0 0',
                    fontSize: 20,
                    fontWeight: 700,
                    color:
                      accents.orange.text,
                  }}
                >
                  {
                    invoices.filter(
                      (invoice) =>
                        String(
                          invoice.status
                        ).toUpperCase() ===
                        'PENDING'
                    ).length
                  }
                </p>
              </div>
            </div>
          )}

          {/* Empty */}

          {invoices.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection:
                  'column',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                textAlign:
                  'center',
                minHeight: 300,
                color:
                  colors.muted,
              }}
            >
              <FileText
                size={48}
                style={{
                  opacity: 0.2,
                }}
              />

              <p
                style={{
                  margin:
                    '12px 0 0',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                No invoices found
              </p>

              <p
                style={{
                  margin:
                    '4px 0 0',
                  fontSize: 13,
                  color:
                    colors.subtle,
                }}
              >
                Your invoices will
                appear here after
                your first payment
              </p>
            </div>
          ) : (
            <>
              {/* Invoice List */}

              <div
                style={{
                  display: 'flex',
                  flexDirection:
                    'column',
                  gap: 10,
                }}
              >
                {paginatedInvoices.map(
                  (invoice) => {
                    const statusBadge =
                      getStatusBadge(
                        // invoice.status
                      );

                    return (
                      <div
                        key={
                          invoice.id
                        }
                        className="invoice-row invoice-fade-in"
                        style={{
                          background:
                            colors.card,
                          border:
                            `1px solid ${colors.border}`,
                          borderRadius: 12,
                          padding:
                            '16px 20px',
                          display: 'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'space-between',
                          flexWrap:
                            'wrap',
                          gap: 12,
                          cursor:
                            'pointer',
                          transition:
                            'all 0.2s ease',
                        }}
                        onMouseEnter={(
                          event
                        ) => {
                          event.currentTarget.style.borderColor =
                            BRAND;

                          event.currentTarget.style.boxShadow =
                            isDark
                              ? '0 4px 16px rgba(0,0,0,0.3)'
                              : '0 4px 16px rgba(0,0,0,0.06)';
                        }}
                        onMouseLeave={(
                          event
                        ) => {
                          event.currentTarget.style.borderColor =
                            colors.border;

                          event.currentTarget.style.boxShadow =
                            'none';
                        }}
                        onClick={() => {
                          setSelectedInvoice(
                            invoice
                          );

                          setShowDetail(
                            true
                          );
                        }}
                      >
                        {/* Left */}

                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap: 14,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              flexShrink: 0,
                              borderRadius:
                                '50%',
                              background:
                                `${BRAND}15`,
                              display:
                                'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              color:
                                BRAND,
                            }}
                          >
                            {getPlanIcon(
                              invoice.planId
                            )}
                          </div>

                          <div
                            style={{
                              minWidth: 0,
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontSize: 15,
                                fontWeight: 700,
                                color:
                                  colors.text,
                                overflow:
                                  'hidden',
                                textOverflow:
                                  'ellipsis',
                                whiteSpace:
                                  'nowrap',
                              }}
                            >
                              {
                                invoice.invoice_number
                              }
                            </p>

                            <p
                              style={{
                                margin:
                                  '2px 0 0',
                                fontSize: 12,
                                color:
                                  colors.muted,
                              }}
                            >
                              {
                                invoice.plan_name
                              }

                              {' · '}

                              {formatDate(
                                invoice.createdAt
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right */}

                        <div
                          className="invoice-right"
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'flex-end',
                            gap: 14,
                          }}
                        >
                          <span
                            className="invoice-amount"
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color:
                                colors.text,
                            }}
                          >
                            {formatPrice(
                              Number(
                                invoice.amount ||
                                  0
                              ),
                              invoice.currency ||
                                'USD'
                            )}
                          </span>

                          <span
                            style={{
                              padding:
                                '3px 11px',
                              borderRadius:
                                20,
                              fontSize: 11,
                              fontWeight: 700,
                              color:
                                statusBadge.color,
                              background:
                                statusBadge.bg,
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {
                              statusBadge.label
                            }
                          </span>

                          <ChevronRight
                            size={18}
                            color={
                              colors.muted
                            }
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Pagination */}

              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'space-between',
                    gap: 10,
                    flexWrap:
                      'wrap',
                    paddingTop: 16,
                    marginTop: 16,
                    borderTop:
                      `1px solid ${colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color:
                        colors.subtle,
                    }}
                  >
                    Showing{' '}
                    {startIndex + 1}
                    {' – '}
                    {Math.min(
                      endIndex,
                      invoices.length
                    )}
                    {' of '}
                    {
                      invoices.length
                    }{' '}
                    invoices
                  </div>

                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        goToPage(
                          currentPage -
                            1
                        )
                      }
                      disabled={
                        currentPage ===
                        1
                      }
                      style={{
                        width: 36,
                        height: 36,
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        borderRadius:
                          8,
                        border:
                          `1.5px solid ${colors.border}`,
                        background:
                          colors.card,
                        color:
                          colors.text,
                        cursor:
                          currentPage ===
                          1
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          currentPage ===
                          1
                            ? 0.5
                            : 1,
                      }}
                    >
                      <ChevronLeft
                        size={18}
                      />
                    </button>

                    {Array.from(
                      {
                        length:
                          Math.min(
                            totalPages,
                            5
                          ),
                      },
                      (_, index) => {
                        let pageNumber: number;

                        if (
                          totalPages <=
                          5
                        ) {
                          pageNumber =
                            index + 1;
                        } else if (
                          currentPage <=
                          3
                        ) {
                          pageNumber =
                            index + 1;
                        } else if (
                          currentPage >=
                          totalPages - 2
                        ) {
                          pageNumber =
                            totalPages -
                            4 +
                            index;
                        } else {
                          pageNumber =
                            currentPage -
                            2 +
                            index;
                        }

                        const active =
                          pageNumber ===
                          currentPage;

                        return (
                          <button
                            type="button"
                            key={
                              pageNumber
                            }
                            onClick={() =>
                              goToPage(
                                pageNumber
                              )
                            }
                            style={{
                              minWidth: 36,
                              height: 36,
                              padding:
                                '0 8px',
                              borderRadius:
                                8,
                              border:
                                `1.5px solid ${
                                  active
                                    ? BRAND
                                    : colors.border
                                }`,
                              background:
                                active
                                  ? BRAND
                                  : colors.card,
                              color:
                                active
                                  ? '#fff'
                                  : colors.text,
                              fontWeight:
                                active
                                  ? 700
                                  : 500,
                              fontSize: 13,
                              cursor:
                                'pointer',
                            }}
                          >
                            {
                              pageNumber
                            }
                          </button>
                        );
                      }
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        goToPage(
                          currentPage +
                            1
                        )
                      }
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      style={{
                        width: 36,
                        height: 36,
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        borderRadius:
                          8,
                        border:
                          `1.5px solid ${colors.border}`,
                        background:
                          colors.card,
                        color:
                          colors.text,
                        cursor:
                          currentPage ===
                          totalPages
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          currentPage ===
                          totalPages
                            ? 0.5
                            : 1,
                      }}
                    >
                      <ChevronRight
                        size={18}
                      />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Invoice Detail Modal */}

      {showDetail &&
        selectedInvoice && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              padding: 20,
              background:
                'rgba(0,0,0,0.6)',
              backdropFilter:
                'blur(4px)',
            }}
            onClick={() =>
              setShowDetail(false)
            }
          >
            <div
              style={{
                position:
                  'relative',
                width: '100%',
                maxWidth: 500,
                maxHeight:
                  '90vh',
                overflowY:
                  'auto',
                padding: 28,
                background:
                  colors.card,
                borderRadius: 16,
                boxSizing:
                  'border-box',
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* Close */}

              <button
                type="button"
                onClick={() =>
                  setShowDetail(
                    false
                  )
                }
                aria-label="Close"
                style={{
                  position:
                    'absolute',
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  border: 'none',
                  borderRadius:
                    8,
                  background:
                    colors.card2,
                  color:
                    colors.muted,
                  cursor:
                    'pointer',
                  fontSize: 18,
                }}
              >
                ×
              </button>

              {/* Header */}

              <div
                style={{
                  paddingRight: 36,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 19,
                    fontWeight: 700,
                    color:
                      colors.text,
                  }}
                >
                  Invoice Details
                </h2>

                <p
                  style={{
                    margin:
                      '4px 0 20px',
                    fontSize: 13,
                    color:
                      colors.muted,
                  }}
                >
                  {
                    selectedInvoice.invoice_number
                  }
                </p>
              </div>

              {/* Details */}

              <div
                className="invoice-detail-grid"
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: 16,
                  marginBottom:
                    20,
                }}
              >
                {/* Plan */}

                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color:
                        colors.subtle,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        0.5,
                    }}
                  >
                    Plan
                  </p>

                  <p
                    style={{
                      margin:
                        '3px 0 0',
                      fontSize: 14,
                      fontWeight: 600,
                      color:
                        colors.text,
                    }}
                  >
                    {
                      selectedInvoice.plan_name
                    }
                  </p>
                </div>

                {/* Amount */}

                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color:
                        colors.subtle,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        0.5,
                    }}
                  >
                    Amount
                  </p>

                  <p
                    style={{
                      margin:
                        '3px 0 0',
                      fontSize: 14,
                      fontWeight: 700,
                      color:
                        colors.text,
                    }}
                  >
                    {formatPrice(
                      Number(
                        selectedInvoice.amount ||
                          0
                      ),
                      selectedInvoice.currency ||
                        'USD'
                    )}
                  </p>
                </div>

                {/* Status */}

                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color:
                        colors.subtle,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        0.5,
                    }}
                  >
                    Status
                  </p>

                  {(() => {
                    const badge =
                      getStatusBadge(
                        // selectedInvoice.status
                      );

                    return (
                      <span
                        style={{
                          display:
                            'inline-block',
                          marginTop: 4,
                          padding:
                            '3px 11px',
                          borderRadius:
                            20,
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            badge.color,
                          background:
                            badge.bg,
                        }}
                      >
                        {
                          badge.label
                        }
                      </span>
                    );
                  })()}
                </div>

                {/* Payment Method */}

                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color:
                        colors.subtle,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        0.5,
                    }}
                  >
                    Payment Method
                  </p>

                  <p
                    style={{
                      margin:
                        '3px 0 0',
                      fontSize: 14,
                      fontWeight: 600,
                      color:
                        colors.text,
                    }}
                  >
                    {
                      selectedInvoice.payment_method
                    }
                  </p>
                </div>

                {/* Created */}

                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color:
                        colors.subtle,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        0.5,
                    }}
                  >
                    Created
                  </p>

                  <p
                    style={{
                      margin:
                        '3px 0 0',
                      fontSize: 13,
                      color:
                        colors.text,
                    }}
                  >
                    {formatDate(
                      selectedInvoice.createdAt
                    )}
                  </p>
                </div>

                {/* Paid */}

                {selectedInvoice.paid_at && (
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        color:
                          colors.subtle,
                        textTransform:
                          'uppercase',
                        letterSpacing:
                          0.5,
                      }}
                    >
                      Paid On
                    </p>

                    <p
                      style={{
                        margin:
                          '3px 0 0',
                        fontSize: 13,
                        color:
                          colors.text,
                      }}
                    >
                      {formatDate(
                        selectedInvoice.paid_at
                      )}
                    </p>
                  </div>
                )}

                {/* Order ID */}

                {selectedInvoice.order_id && (
                  <div
                    style={{
                      gridColumn:
                        '1 / -1',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        color:
                          colors.subtle,
                        textTransform:
                          'uppercase',
                        letterSpacing:
                          0.5,
                      }}
                    >
                      Order ID
                    </p>

                    <p
                      style={{
                        margin:
                          '3px 0 0',
                        fontSize: 13,
                        color:
                          colors.text,
                        wordBreak:
                          'break-all',
                      }}
                    >
                      {
                        selectedInvoice.order_id
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}

              <div
                className="invoice-actions"
                style={{
                  display: 'flex',
                  gap: 10,
                  paddingTop: 16,
                  borderTop:
                    `1px solid ${colors.border}`,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      selectedInvoice
                    )
                  }
                  disabled={
                    downloading
                  }
                  style={{
                    flex: 1,
                    minHeight: 42,
                    padding:
                      '10px 14px',
                    borderRadius:
                      10,
                    border:
                      `1.5px solid ${colors.border}`,
                    background:
                      colors.card,
                    color:
                      colors.text,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor:
                      downloading
                        ? 'not-allowed'
                        : 'pointer',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    gap: 8,
                    opacity:
                      downloading
                        ? 0.6
                        : 1,
                  }}
                >
                  {downloading ? (
                    <Loader2
                      size={16}
                      style={{
                        animation:
                          'spin 1s linear infinite',
                      }}
                    />
                  ) : (
                    <Download
                      size={16}
                    />
                  )}

                  Download PDF
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleViewReceipt(
                      selectedInvoice
                    )
                  }
                  disabled={
                    downloading
                  }
                  style={{
                    flex: 1,
                    minHeight: 42,
                    padding:
                      '10px 14px',
                    borderRadius:
                      10,
                    border: 'none',
                    background:
                      BRAND,
                    color:
                      '#FFFFFF',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor:
                      downloading
                        ? 'not-allowed'
                        : 'pointer',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    gap: 8,
                    opacity:
                      downloading
                        ? 0.6
                        : 1,
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