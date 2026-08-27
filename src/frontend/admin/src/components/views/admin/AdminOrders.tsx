'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChefHat, Loader2, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import ScopePicker, { EMPTY_SCOPE, type Scope } from '@/components/ScopePicker';
import {
  fetchOrdersForRestaurant,
  derivedStatus,
  isLive,
  money,
  timeAgo,
  STATUS_LABEL,
  STATUS_COLOR,
  type SupportOrder,
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
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
});

// ── Accent colors ──
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

const REFRESH_MS = 15000;

/* ============================================================
   TOTAL HELPERS
   ============================================================ */

// Items total WITHOUT add-ons
const getItemsTotal = (order: SupportOrder): number => {
  return (order.lineItems ?? []).reduce((sum, li) => {
    return sum + (li.unitPriceMinorUnits || 0) * li.quantity;
  }, 0);
};

// Add-ons total
const getAddOnsTotal = (order: SupportOrder): number => {
  return (order.lineItems ?? []).reduce((sum, li) => {
    const addOns = (
      li as typeof li & {
        addOns?: Array<{
          priceMinorUnits?: number;
          quantity?: number;
        }>;
      }
    ).addOns;

    const addOnsTotal = (addOns ?? []).reduce((addOnSum, addon) => {
      return (
        addOnSum +
        (addon.priceMinorUnits || 0) * (addon.quantity || 1)
      );
    }, 0);

    return sum + addOnsTotal;
  }, 0);
};

// Grand total = Items + Add-ons
const getGrandTotal = (order: SupportOrder): number => {
  return getItemsTotal(order) + getAddOnsTotal(order);
};

/* ============================================================
   ADMIN ORDERS
   ============================================================ */

export default function AdminOrders() {
  const [scope, setScope] = useState<Scope>(EMPTY_SCOPE);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const [isDark, setIsDark] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const load = useCallback(
    async (quiet = false) => {
      if (!scope.tenantId || !scope.restaurantId) {
        setOrders([]);
        return;
      }

      if (!quiet) setLoading(true);

      setError('');

      try {
        const list = await fetchOrdersForRestaurant(
          scope.tenantId,
          scope.restaurantId,
          4
        );

        setOrders(list);
        setLastAt(new Date());
      } catch (e: any) {
        setError(e?.message ?? 'Could not load orders');
      } finally {
        setLoading(false);
      }
    },
    [scope.tenantId, scope.restaurantId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Auto refresh
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);

    if (scope.restaurantId) {
      timer.current = setInterval(() => load(true), REFRESH_MS);
    }

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [scope.restaurantId, load]);

  const live = orders.filter(isLive);

  const byStatus = (s: string) =>
    live.filter((o) => derivedStatus(o) === s);

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
              What a branch is cooking right now. Read-only — the kitchen
              screen is where orders actually move.
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
                cursor: 'pointer',
                color: colors.text,
                whiteSpace: 'nowrap',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  `0 0 0 3px ${colors.focusRing}`;
                e.currentTarget.style.borderColor = BRAND;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = colors.border;
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.hoverBg;
                e.currentTarget.style.borderColor = BRAND;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.card2;
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <RefreshCw
                size={14}
                style={
                  loading
                    ? { animation: 'spin 1s linear infinite' }
                    : {}
                }
              />

              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Scope Picker ── */}
      <ScopePicker value={scope} onChange={setScope} />

      {/* ── Empty State ── */}
      {!scope.restaurantId && (
        <Empty
          icon={<ChefHat size={28} />}
          title="Pick a company and restaurant"
          text="Then you will see that branch's live orders."
          colors={colors}
        />
      )}

      {/* ── Loading ── */}
      {scope.restaurantId && loading && (
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
            style={{ animation: 'spin 1s linear infinite' }}
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

      {/* ── Error ── */}
      {scope.restaurantId && !loading && error && (
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

          <span style={{ fontFamily: "'Poppins', sans-serif" }}>
            {error}
          </span>
        </div>
      )}

      {/* ── Content ── */}
      {scope.restaurantId && !loading && !error && (
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
              value={byStatus('pending').length}
              colors={colors}
            />

            <Stat
              label="Preparing"
              value={byStatus('preparing').length}
              accent={BRAND}
              colors={colors}
            />

            <Stat
              label="Ready"
              value={byStatus('ready').length}
              accent={accents.green.text}
              colors={colors}
            />
          </div>

          {/* Orders */}
          {live.length === 0 ? (
            <Empty
              icon={<ChefHat size={28} />}
              title="Nothing cooking"
              text="No live orders at this branch in the last 4 hours."
              colors={colors}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 14,
              }}
            >
              {live
                .sort((a, b) =>
                  (b.placedAt ?? '').localeCompare(
                    a.placedAt ?? ''
                  )
                )
                .map((o) => (
                  <OrderCard
                    key={o.orderId}
                    order={o}
                    currency={scope.currency}
                    colors={colors}
                    isDark={isDark}
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   ORDER CARD
   ============================================================ */

function OrderCard({
  order,
  currency,
  colors,
  isDark,
}: {
  order: SupportOrder;
  currency: string;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
}) {
  const status = derivedStatus(order);
  const statusColor = STATUS_COLOR[status] || '#9CA3AF';

  // ── Totals ──
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
      {/* ── Header ── */}
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
            Table {order.tableId || '—'}
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
              {timeAgo(order.placedAt ?? order.createdAt)}
            </span>
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

      {/* ── Items ── */}
      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          paddingTop: 10,
          flex: 1,
        }}
      >
        {(order.lineItems ?? []).map((li, i) => {
          const addOns = (
            li as typeof li & {
              addOns?: Array<{
                addOnId?: string;
                name?: string;
                quantity?: number;
                priceMinorUnits?: number;
              }>;
            }
          ).addOns ?? [];

          return (
            <div
              key={i}
              style={{
                marginBottom: 8,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {/* Main item */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    color: colors.text,
                    wordBreak: 'break-word',
                  }}
                >
                  <strong style={{ color: BRAND }}>
                    {li.quantity}×
                  </strong>{' '}
                  {li.name}
                </span>

                <span
                  style={{
                    color: colors.muted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {money(
                    li.unitPriceMinorUnits * li.quantity,
                    currency
                  )}
                </span>
              </div>

              {/* Add-ons under item */}
              {addOns.length > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    marginLeft: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {addOns.map((addon, addonIndex) => (
                    <div
                      key={addon.addOnId ?? addonIndex}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 11,
                        color: BRAND,
                      }}
                    >
                      <span>
                        + {addon.quantity ?? 1}×{' '}
                        {addon.name ?? 'Add-on'}
                      </span>

                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          color: colors.muted,
                        }}
                      >
                        {money(
                          (addon.priceMinorUnits ?? 0) *
                            (addon.quantity ?? 1),
                          currency
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ======================================================
          SAME TOTAL BREAKDOWN AS TENANT ORDERS
          ====================================================== */}

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
            {money(itemsTotal, currency)}
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
            {money(addOnsTotal, currency)}
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
            {money(grandTotal, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   STAT
   ============================================================ */

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

/* ============================================================
   EMPTY
   ============================================================ */

function Empty({
  icon,
  title,
  text,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
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
      <div
        style={{
          opacity: 0.4,
          marginBottom: 8,
        }}
      >
        {icon}
      </div>

      <p
        style={{
          margin: 0,
          fontWeight: 600,
          color: colors.muted,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {title}
      </p>

      <p
        style={{
          margin: '4px 0 0',
          fontSize: 13,
          color: colors.subtle,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {text}
      </p>
    </div>
  );
}