'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChefHat, Loader2, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import ScopePicker, { EMPTY_SCOPE, type Scope } from '@/components/ScopePicker';
import {
  fetchOrdersForRestaurant, derivedStatus, isLive, money, timeAgo,
  STATUS_LABEL, STATUS_COLOR, type SupportOrder,
} from '@/lib/support-api';
import { useTheme } from '@/hooks/useTheme';

// ── Color Schema (Matches other pages) ──────────────────────────────────
const BRAND = '#ff5723';
const D = {
  bg: '#111111',
  card: '#1C1C1C',
  card2: '#242424',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F0E8',
  muted: '#9CA3AF',
  subtle: '#6B7280',
};
const TONE = {
  green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' },
  orange: { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' },
  danger: { bg: 'rgba(255,87,35,0.12)', border: 'rgba(255,87,35,0.3)', text: '#ff8a5c' },
};

const REFRESH_MS = 15000;

export default function AdminOrders() {
  const { isDark } = useTheme();
  const [scope, setScope] = useState<Scope>(EMPTY_SCOPE);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Theme-aware colors
  const colors = isDark ? D : {
    bg: '#FFFFFF',
    card: '#ffffff',
    card2: '#F9FAFB',
    border: '#F0EBE6',
    text: '#000000',
    muted: '#6B6B6B',
    subtle: '#9CA3AF',
  };
  const accent = isDark ? TONE : {
    green: { bg: '#F0FFF4', border: '#BBF7D0', text: '#16a34a' },
    orange: { bg: '#FFFBEB', border: '#FDE68A', text: '#d97706' },
    danger: { bg: '#FFF0F0', border: '#FFD0D0', text: BRAND },
  };

  const load = useCallback(async (quiet = false) => {
    if (!scope.tenantId || !scope.restaurantId) {
      setOrders([]);
      return;
    }
    if (!quiet) setLoading(true);
    setError('');
    try {
      const list = await fetchOrdersForRestaurant(scope.tenantId, scope.restaurantId, 4);
      setOrders(list);
      setLastAt(new Date());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [scope.tenantId, scope.restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  // A kitchen board is only useful if it keeps itself current.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (scope.restaurantId) timer.current = setInterval(() => load(true), REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [scope.restaurantId, load]);

  const live = orders.filter(isLive);
  const byStatus = (s: string) => live.filter(o => derivedStatus(o) === s);

  return (
    <div style={{
      background: colors.bg,
      padding: '16px 20px 40px',
      maxWidth: 1150,
      margin: '0 auto',
      minHeight: '100vh',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 18,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            <h1 style={{
              fontSize: 'clamp(20px, 3vw, 26px)',
              fontWeight: 800,
              color: colors.text,
              margin: '0 0 2px',
            }}>
              Kitchen Orders
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
            }}>
              What a branch is cooking right now. Read-only — the kitchen screen
              is where orders actually move.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            {lastAt && (
              <span style={{
                fontSize: 12,
                color: colors.subtle,
                whiteSpace: 'nowrap',
              }}>
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
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                background: colors.card2,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: colors.text,
                whiteSpace: 'nowrap',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <ScopePicker value={scope} onChange={setScope} />

      {!scope.restaurantId && (
        <Empty
          icon={<ChefHat size={28} />}
          title="Pick a company and restaurant"
          text="Then you will see that branch's live orders."
          colors={colors}
        />
      )}

      {scope.restaurantId && loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: colors.muted,
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading orders…</p>
        </div>
      )}

      {scope.restaurantId && !loading && error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '40px 20px',
          color: accent.danger.text,
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {scope.restaurantId && !loading && !error && (
        <>
          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}>
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
              accent={accent.green.text}
              colors={colors}
            />
          </div>

          {/* Orders Grid */}
          {live.length === 0 ? (
            <Empty
              icon={<ChefHat size={28} />}
              title="Nothing cooking"
              text="No live orders at this branch in the last 4 hours."
              colors={colors}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}>
              {live
                .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''))
                .map(o => (
                  <OrderCard
                    key={o.orderId}
                    order={o}
                    currency={scope.currency}
                    colors={colors}
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Order Card Component ──────────────────────────────────────────────────

function OrderCard({
  order,
  currency,
  colors,
}: {
  order: SupportOrder;
  currency: string;
  colors: any;
}) {
  const status = derivedStatus(order);
  const statusColor = STATUS_COLOR[status] || '#9CA3AF';

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 800,
            color: colors.text,
          }}>
            Table {order.tableId || '—'}
          </div>
          <div style={{
            fontSize: 12,
            color: colors.subtle,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}>
            <Clock size={11} />
            <span>{timeAgo(order.placedAt ?? order.createdAt)}</span>
          </div>
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          padding: '4px 9px',
          borderRadius: 6,
          background: `${statusColor}15`,
          color: statusColor,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Items */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        paddingTop: 10,
        flex: 1,
      }}>
        {(order.lineItems ?? []).map((li, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            marginBottom: 5,
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{
              color: colors.text,
              wordBreak: 'break-word',
            }}>
              <strong style={{ color: BRAND }}>{li.quantity}×</strong> {li.name}
            </span>
            <span style={{
              color: colors.muted,
              whiteSpace: 'nowrap',
            }}>
              {money(li.totalPriceMinorUnits, currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        marginTop: 8,
        paddingTop: 8,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 14,
        fontWeight: 800,
        color: colors.text,
      }}>
        <span>Total</span>
        <span>{money(order.totalAmountMinorUnits, currency)}</span>
      </div>
    </div>
  );
}

// ── Stat Component ──────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
  colors,
}: {
  label: string;
  value: number;
  accent?: string;
  colors: any;
}) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '10px 18px',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.subtle,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'clamp(18px, 2.5vw, 22px)',
        fontWeight: 800,
        color: accent ?? colors.text,
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Empty Component ──────────────────────────────────────────────────

function Empty({
  icon,
  title,
  text,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  colors: any;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: colors.subtle,
    }}>
      <div style={{ opacity: 0.4, marginBottom: 8 }}>{icon}</div>
      <p style={{
        margin: 0,
        fontWeight: 600,
        color: colors.muted,
      }}>
        {title}
      </p>
      <p style={{
        margin: '4px 0 0',
        fontSize: 13,
        color: colors.subtle,
      }}>
        {text}
      </p>
    </div>
  );
}