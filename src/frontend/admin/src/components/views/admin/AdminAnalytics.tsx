'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Loader2, RefreshCw, AlertCircle, Building2, Store,
  TrendingUp, Pause,
} from 'lucide-react';
import { fetchTenants, planUsage, type ApiTenant, type PlanTier } from '@/lib/auth-api';
import ScopePicker, { EMPTY_SCOPE, type Scope } from '@/components/ScopePicker';
import {
  fetchOrdersForRestaurant, derivedStatus, money, type SupportOrder,
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

const PLANS: PlanTier[] = ['starter', 'professional', 'enterprise'];

export default function AdminAnalytics() {
  const { isDark } = useTheme();
  // ── Platform-wide (no scope needed) ────────────────────────────────
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loadingT, setLoadT] = useState(true);
  const [errorT, setErrorT] = useState('');

  // ── One branch (needs a scope) ─────────────────────────────────────
  const [scope, setScope] = useState<Scope>(EMPTY_SCOPE);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [loadingO, setLoadO] = useState(false);

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

  const loadTenants = useCallback(async () => {
    setLoadT(true);
    setErrorT('');
    try {
      setTenants(await fetchTenants());
    } catch (e: any) {
      setErrorT(e?.message ?? 'Could not load platform data');
    } finally {
      setLoadT(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (!scope.tenantId || !scope.restaurantId) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    setLoadO(true);
    fetchOrdersForRestaurant(scope.tenantId, scope.restaurantId, 24)
      .then(o => {
        if (!cancelled) setOrders(o);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoadO(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope.tenantId, scope.restaurantId]);

  const active = tenants.filter(t => t.isActive);
  const restaurants = tenants.reduce((s, t) => s + (t.restaurantCount ?? 0), 0);
  const atLimit = tenants.filter(
    t => t.maxRestaurants !== -1 && t.restaurantCount >= t.maxRestaurants
  );

  const completed = orders.filter(o => derivedStatus(o) !== 'cancelled');
  const revenue = completed.reduce((s, o) => s + (o.totalAmountMinorUnits ?? 0), 0);
  const avgOrder = completed.length ? Math.round(revenue / completed.length) : 0;

  // Most-ordered items in the last 24h at the picked branch.
  const itemCounts = new Map<string, number>();
  completed.forEach(o => (o.lineItems ?? []).forEach(li => {
    itemCounts.set(li.name, (itemCounts.get(li.name) ?? 0) + li.quantity);
  }));
  const topItems = Array.from(itemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
        marginBottom: 20,
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
              Analytics
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
            }}>
              How the platform is doing, and how any one branch is trading.
            </p>
          </div>
          <button
            onClick={loadTenants}
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
            <RefreshCw size={14} className={loadingT ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Platform ─────────────────────────────────────────────── */}
      <h2 style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.subtle,
        margin: '0 0 12px',
      }}>
        Platform
      </h2>

      {loadingT && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          color: colors.muted,
        }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading platform data…</p>
        </div>
      )}

      {!loadingT && errorT && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '30px 20px',
          color: accent.danger.text,
        }}>
          <AlertCircle size={18} />
          <span>{errorT}</span>
        </div>
      )}

      {!loadingT && !errorT && (
        <>
          {/* Platform Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 14,
            marginBottom: 18,
          }}>
            <Stat
              icon={<Building2 size={17} />}
              label="Companies"
              value={String(tenants.length)}
              colors={colors}
            />
            <Stat
              icon={<TrendingUp size={17} />}
              label="Active"
              value={String(active.length)}
              accent={accent.green.text}
              colors={colors}
            />
            <Stat
              icon={<Pause size={17} />}
              label="Suspended"
              value={String(tenants.length - active.length)}
              accent={tenants.length - active.length ? accent.danger.text : undefined}
              colors={colors}
            />
            <Stat
              icon={<Store size={17} />}
              label="Restaurants"
              value={String(restaurants)}
              colors={colors}
            />
          </div>

          {/* Platform Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 28,
          }}>
            <Card title="Plan mix" colors={colors}>
              {tenants.length === 0 ? (
                <Muted text="No companies yet." colors={colors} />
              ) : (
                PLANS.map(p => {
                  const n = tenants.filter(t => t.planTier === p).length;
                  const pct = tenants.length ? Math.round((n / tenants.length) * 100) : 0;
                  return (
                    <div key={p} style={{ marginBottom: 12 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          color: colors.text,
                        }}>
                          {p}
                        </span>
                        <span style={{
                          fontSize: 13,
                          color: colors.muted,
                        }}>
                          {n} · {pct}%
                        </span>
                      </div>
                      <Bar pct={pct} colors={colors} />
                    </div>
                  );
                })
              )}
            </Card>

            <Card title="Ready to upgrade" colors={colors}>
              {atLimit.length === 0 ? (
                <Muted text="No company has filled its plan." colors={colors} />
              ) : (
                atLimit.map(t => (
                  <Row
                    key={t.tenantId}
                    left={t.companyName}
                    right={`${t.restaurantCount}/${t.maxRestaurants} · ${t.planTier}`}
                    rightColor={accent.danger.text}
                    colors={colors}
                  />
                ))
              )}
            </Card>

            <Card title="Biggest customers" colors={colors}>
              {tenants.length === 0 ? (
                <Muted text="No companies yet." colors={colors} />
              ) : (
                [...tenants]
                  .sort((a, b) => (b.restaurantCount ?? 0) - (a.restaurantCount ?? 0))
                  .slice(0, 5)
                  .map(t => (
                    <Row
                      key={t.tenantId}
                      left={t.companyName}
                      right={planUsage(t)}
                      colors={colors}
                    />
                  ))
              )}
            </Card>
          </div>
        </>
      )}

      {/* ── One branch ───────────────────────────────────────────── */}
      <h2 style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.subtle,
        margin: '0 0 12px',
      }}>
        A single branch — last 24 hours
      </h2>

      <ScopePicker
        value={scope}
        onChange={setScope}
        storageKey="console_analytics_scope"
      />

      {!scope.restaurantId && (
        <Muted text="Pick a company and restaurant above to see its trading figures." colors={colors} />
      )}

      {scope.restaurantId && loadingO && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          color: colors.muted,
        }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading orders…</p>
        </div>
      )}

      {scope.restaurantId && !loadingO && (
        <>
          {/* Branch Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 14,
            marginBottom: 18,
          }}>
            <Stat
              icon={<BarChart2 size={17} />}
              label="Orders"
              value={String(completed.length)}
              colors={colors}
            />
            <Stat
              icon={<TrendingUp size={17} />}
              label="Revenue"
              value={money(revenue, scope.currency)}
              accent={accent.green.text}
              colors={colors}
            />
            <Stat
              icon={<BarChart2 size={17} />}
              label="Avg order"
              value={money(avgOrder, scope.currency)}
              colors={colors}
            />
            <Stat
              icon={<Pause size={17} />}
              label="Cancelled"
              value={String(orders.length - completed.length)}
              colors={colors}
            />
          </div>

          {/* Top Items Card */}
          <Card title="Most ordered" colors={colors}>
            {topItems.length === 0 ? (
              <Muted text="No orders in the last 24 hours." colors={colors} />
            ) : (
              topItems.map(([name, qty]) => {
                const max = topItems[0][1];
                return (
                  <div key={name} style={{ marginBottom: 12 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.text,
                      }}>
                        {name}
                      </span>
                      <span style={{
                        fontSize: 13,
                        color: colors.muted,
                      }}>
                        {qty}
                      </span>
                    </div>
                    <Bar pct={Math.round((qty / max) * 100)} colors={colors} />
                  </div>
                );
              })
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
  accent,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  colors: any;
}) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: '15px 17px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        color: accent ?? colors.muted,
        marginBottom: 6,
      }}>
        {icon}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'clamp(20px, 2.5vw, 24px)',
        fontWeight: 800,
        color: accent ?? colors.text,
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: 18,
    }}>
      <h3 style={{
        fontSize: 14,
        fontWeight: 800,
        color: colors.text,
        margin: '0 0 14px',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bar({ pct, colors }: { pct: number; colors: any }) {
  return (
    <div style={{
      height: 6,
      borderRadius: 3,
      background: colors.border,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`,
        height: '100%',
        background: BRAND,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

function Row({
  left,
  right,
  rightColor,
  colors,
}: {
  left: string;
  right: string;
  rightColor?: string;
  colors: any;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderTop: `1px solid ${colors.border}`,
      gap: 8,
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: colors.text,
      }}>
        {left}
      </span>
      <span style={{
        fontSize: 12,
        color: rightColor ?? colors.muted,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}>
        {right}
      </span>
    </div>
  );
}

function Muted({ text, colors }: { text: string; colors: any }) {
  return (
    <p style={{
      fontSize: 13,
      color: colors.subtle,
      margin: '0 0 14px',
    }}>
      {text}
    </p>
  );
}