'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChefHat,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
} from 'lucide-react';
import BranchPicker from '@/components/BranchPicker';
import {
  fetchMyBranches,
  fetchOrders,
  connectTenantWebSocket,
  parseTenantOrderEvent,
  isLive,
  derivedStatus,
  type Branch,
  type BranchOrder,
} from '@/lib/tenant-api'
import {
  money,
  timeAgo,
  STATUS_LABEL,
  STATUS_COLOR,
} from '@/lib/support-api';
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
  brandBg: 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark
    ? 'rgba(255,87,35,0.2)'
    : 'rgba(255,87,35,0.15)',
});

// ── Accent colors based on theme ──
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
    bg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
    border: isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0',
    text: isDark ? '#ff8a5c' : BRAND,
  },
});



// ── Calculate Items Total (without add-ons) ──
const getItemsTotal = (order: BranchOrder): number => {
  return (order.lineItems || []).reduce((sum, li) => {
    return sum + (li.unitPriceMinorUnits || 0) * li.quantity;
  }, 0);
};

// ── Calculate Add-Ons Total ──
const getAddOnsTotal = (order: BranchOrder): number => {
  return (order.lineItems || []).reduce((sum, li) => {
    const addOns = (
      li as typeof li & {
        addOns?: Array<{
          priceMinorUnits?: number;
          quantity?: number;
        }>;
      }
    ).addOns;

    const addOnsTotal = (addOns || []).reduce((s, a) => {
      return s + (a.priceMinorUnits || 0) * (a.quantity || 1);
    }, 0);

    return sum + addOnsTotal;
  }, 0);
};

// ── Calculate Grand Total ──
const getGrandTotal = (order: BranchOrder): number => {
  return getItemsTotal(order) + getAddOnsTotal(order);
};

export default function TenantOrders() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [loadingB, setLoadB] = useState(true);
  const [loadingO, setLoadO] = useState(false);
  const [error, setError] = useState('');
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Prevent duplicate API requests when one request is already running.
  const requestInProgress = useRef(false);
  const refreshQueued = useRef(false);

  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };

    updateTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') {
        updateTheme();
      }
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

  // ── Load branches only once ──
  useEffect(() => {
    let cancelled = false;

    fetchMyBranches()
      .then((data) => {
        if (!cancelled) {
          setBranches(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e?.message ?? 'Could not load your restaurants'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadB(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Single orders loader ──
  const load = useCallback(
    async (quiet = false) => {
      if (branches.length === 0) return;

      // If a request is already running, remember that
      // another refresh is needed after it finishes.
      if (requestInProgress.current) {
        refreshQueued.current = true;
        return;
      }

      requestInProgress.current = true;

      if (!quiet) {
        setLoadO(true);
      }

      setError('');

      try {
        const data = await fetchOrders(
          branches,
          branchId,
          4
        );

        setOrders(data);
        setLastAt(new Date());
      } catch (e: any) {
        setError(
          e?.message ?? 'Could not load orders'
        );
      } finally {
        requestInProgress.current = false;

        if (!quiet) {
          setLoadO(false);
        }

        // If a WebSocket event arrived while the request
        // was running, immediately fetch again.
        if (refreshQueued.current) {
          refreshQueued.current = false;

          // Do not show the full loading state for a WS refresh.
          void load(true);
        }
      }
    },
    [branches, branchId]
  );

  // ── Real-time order updates ────────────────────────────────────────
  useEffect(() => {
    if (branches.length === 0) return;

    let cancelled = false;
    let socket: WebSocket | null = null;

    const connect = async () => {
      try {
        socket = await connectTenantWebSocket();

        if (cancelled) {
          socket.close();
          return;
        }

        wsRef.current = socket;

        socket.onopen = () => {
          console.log('[Tenant WS] Connected');
          setWsConnected(true);
        };

        socket.onmessage = async (event) => {
          console.log('[Tenant WS] RAW MESSAGE:', event.data);

          const data = parseTenantOrderEvent(event.data);

          console.log('[Tenant WS] PARSED EVENT:', data);

          if (!data) {
            console.warn('[Tenant WS] Could not parse event');
            return;
          }

          console.log('[Tenant WS] Refreshing orders...');

          await load(true);
        };

        socket.onerror = (error) => {
          console.error('[Tenant WS] Error:', error);
          setWsConnected(false);
        };

        socket.onclose = () => {
          console.log('[Tenant WS] Closed');
          setWsConnected(false);
          wsRef.current = null;
        };
      } catch (error) {
        console.error('[Tenant WS] Connection failed:', error);
        setWsConnected(false);
      }
    };

    connect();

    return () => {
      cancelled = true;

      if (socket) {
        socket.close();
      }

      wsRef.current = null;
      setWsConnected(false);
    };
  }, [branches, load]);

  // ── Initial load / branch change ──
  useEffect(() => {
    if (branches.length > 0) {
      load();
    }
  }, [branches, branchId, load]);


  const live = orders.filter(isLive);

  const showBranch =
    branchId === '' && branches.length > 1;

  const count = (status: string) =>
    live.filter(
      (order) => derivedStatus(order) === status
    ).length;

  return (
    <div
      style={{
        background: colors.bg,
        padding: '16px 20px 40px',
        maxWidth: 1150,
        margin: '0 auto',
        minHeight: '100vh',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 'clamp(20px, 3vw, 26px)',
                fontWeight: 800,
                color: colors.text,
                margin: '0 0 2px',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Kitchen Orders
            </h1>

            <p
              style={{
                color: colors.muted,
                fontSize: 13,
                margin: 0,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              What your kitchens are cooking right now.
              Your staff move orders along from the kitchen
              screen.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {lastAt && (
              <span
                style={{
                  fontSize: 12,
                  color: colors.subtle,
                  whiteSpace: 'nowrap',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                updated {lastAt.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={() => load()}
              disabled={loadingO}
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
                cursor: loadingO ? 'not-allowed' : 'pointer',
                color: colors.text,
                whiteSpace: 'nowrap',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
                opacity: loadingO ? 0.7 : 1,
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  `0 0 0 3px ${colors.focusRing}`;
                e.currentTarget.style.borderColor = BRAND;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor =
                  colors.border;
              }}
              onMouseEnter={(e) => {
                if (!loadingO) {
                  e.currentTarget.style.background =
                    colors.hoverBg;
                  e.currentTarget.style.borderColor = BRAND;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  colors.card2;
                e.currentTarget.style.borderColor =
                  colors.border;
              }}
            >
              <RefreshCw
                size={14}
                style={
                  loadingO
                    ? {
                      animation:
                        'spin 1s linear infinite',
                    }
                    : {}
                }
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Branch Picker ── */}
      <BranchPicker
        branches={branches}
        value={branchId}
        onChange={setBranchId}
        loading={loadingB}
      />

      {!loadingB && branches.length > 0 && (
        <>
          {/* Loading State */}
          {loadingO && (
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
              <Loader2
                size={22}
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              />

              <p
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Loading orders…
              </p>
            </div>
          )}

          {/* Error State */}
          {!loadingO && error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '40px 20px',
                color: accents.danger.text,
              }}
            >
              <AlertCircle size={20} />

              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {error}
              </span>
            </div>
          )}

          {/* Content */}
          {!loadingO && !error && (
            <>
              {/* Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(100px, 1fr))',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <Stat
                  label="Live"
                  value={live.length}
                  colors={colors}
                />

                <Stat
                  label="Waiting"
                  value={count('pending')}
                  colors={colors}
                />

                <Stat
                  label="Preparing"
                  value={count('preparing')}
                  accent={BRAND}
                  colors={colors}
                />

                <Stat
                  label="Ready"
                  value={count('ready')}
                  accent={accents.green.text}
                  colors={colors}
                />
              </div>

              {/* Empty State */}
              {live.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    color: colors.subtle,
                  }}
                >
                  <ChefHat
                    size={28}
                    style={{
                      opacity: 0.4,
                      marginBottom: 8,
                    }}
                  />

                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: colors.muted,
                      fontFamily:
                        "'Poppins', sans-serif",
                    }}
                  >
                    Nothing cooking
                  </p>

                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 13,
                      color: colors.subtle,
                      fontFamily:
                        "'Poppins', sans-serif",
                    }}
                  >
                    No live orders in the last 4 hours.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 14,
                  }}
                >
                  {live
                    .sort((a, b) =>
                      (b.placedAt ?? '').localeCompare(
                        a.placedAt ?? ''
                      )
                    )
                    .map((order) => (
                      <OrderCard
                        key={order.orderId}
                        order={order}
                        showBranch={showBranch}
                        colors={colors}
                        accents={accents}
                        isDark={isDark}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────

function OrderCard({
  order,
  showBranch,
  colors,
  accents,
  isDark,
}: {
  order: BranchOrder;
  showBranch: boolean;
  colors: ReturnType<typeof getColors>;
  accents: ReturnType<typeof getAccents>;
  isDark: boolean;
}) {
  const status = derivedStatus(order);
  const statusColor =
    STATUS_COLOR[status] || '#9CA3AF';

  const itemsTotal = getItemsTotal(order);
  const addOnsTotal = getAddOnsTotal(order);
  const grandTotal = getGrandTotal(order);

  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 10,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: colors.text,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {order.tableNumber ? `Table ${order.tableNumber}` : (order.tableId ? `Table ${order.tableId}` : '—')}
          </div>

          <div
            style={{
              fontSize: 12,
              color: colors.subtle,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <Clock size={11} />

            <span>
              {timeAgo(
                order.placedAt ?? order.createdAt
              )}
            </span>

            {showBranch && (
              <>
                <span
                  style={{
                    color: colors.border,
                  }}
                >
                  ·
                </span>

                <span>{order.branchName}</span>
              </>
            )}
          </div>
        </div>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            padding: '4px 9px',
            borderRadius: 6,
            background: isDark
              ? `${statusColor}15`
              : `${statusColor}10`,
            color: statusColor,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Grand Total Breakdown */}
      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          marginTop: 8,
          paddingTop: 10,
        }}
      >
        {/* Items Total */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif",
            paddingBottom: 4,
          }}
        >
          <span>Items Total</span>

          <span>
            {money(itemsTotal, order.currency)}
          </span>
        </div>

        {/* Add-Ons Total */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            color: BRAND,
            fontWeight: 600,
            fontFamily: "'Poppins', sans-serif",
            paddingBottom: 4,
          }}
        >
          <span>Add-Ons Total</span>

          <span>
            {money(addOnsTotal, order.currency)}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1.5,
            background: colors.border,
            margin: '6px 0',
          }}
        />

        {/* Grand Total */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 16,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <span>Grand Total</span>

          <span
            style={{
              color: BRAND,
              fontSize: 17,
            }}
          >
            {money(grandTotal, order.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Stat Component ─────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
  colors,
}: {
  label: string;
  value: number;
  accent?: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '10px 18px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: colors.subtle,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 'clamp(18px, 2.5vw, 22px)',
          fontWeight: 800,
          color: accent ?? colors.text,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {value}
      </div>
    </div>
  );
}
