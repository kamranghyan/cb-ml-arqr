'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Store, ChefHat, TrendingUp, Receipt, Loader2, RefreshCw,
  AlertCircle, ChevronRight, Lock,
} from 'lucide-react';
import {
  fetchMyBranches, fetchOrders, revenueOf, byBranch, topItems, isLive,
  type Branch, type BranchOrder,
} from '@/lib/tenant-api';
import { fetchMyTenant, planUsage, isAtPlanLimit, type ApiTenant } from '@/lib/auth-api';
import { money } from '@/lib/support-api';
import { useTheme } from '@/hooks/useTheme';

// ── Color Schema (Matches Analytics page) ──────────────────────────────────
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

export default function TenantDashboard() {
  const { isDark } = useTheme();
  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, bs] = await Promise.all([
        fetchMyTenant().catch(() => null),
        fetchMyBranches(),
      ]);
      setTenant(t);
      setBranches(bs);
      // Today's trading across every branch.
      setOrders(await fetchOrders(bs, '', 24));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const live = orders.filter(isLive);
  const revenue = revenueOf(orders);
  const perBranch = byBranch(orders);
  const top = topItems(orders, 5);
  const currency = branches[0]?.currencyCode || 'PKR';
  const atLimit = tenant ? isAtPlanLimit(tenant) : false;

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
              {tenant?.companyName ?? 'Dashboard'}
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
            }}>
              The last 24 hours across all your restaurants.
            </p>
          </div>
          <button
            onClick={load}
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

      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: colors.muted,
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading dashboard…</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
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

      {/* Main Content */}
      {!loading && !error && (
        <>
          {/* Plan Limit Warning */}
          {atLimit && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              marginBottom: 16,
              background: isDark ? 'rgba(251,146,60,0.15)' : '#FFF7E6',
              border: `1px solid ${isDark ? 'rgba(251,146,60,0.3)' : '#FFE0A3'}`,
              color: isDark ? '#fb923c' : '#891C1C',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <Lock size={15} />
              <span>
                <strong>Plan full.</strong> {planUsage(tenant!)} used on the{' '}
                {tenant!.planTier} plan — upgrade to open another branch.
              </span>
            </div>
          )}

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}>
            <Stat
              icon={<ChefHat size={17} />}
              label="Live orders"
              value={String(live.length)}
              accent={live.length ? BRAND : undefined}
              colors={colors}
            />
            <Stat
              icon={<Receipt size={17} />}
              label="Orders (24h)"
              value={String(orders.length)}
              colors={colors}
            />
            <Stat
              icon={<TrendingUp size={17} />}
              label="Revenue (24h)"
              value={money(revenue, currency)}
              accent={colors.text}
              colors={colors}
            />
            <Stat
              icon={<Store size={17} />}
              label="Restaurants"
              value={tenant ? planUsage(tenant) : String(branches.length)}
              colors={colors}
            />
          </div>

          {/* Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {/* By Restaurant Card */}
            <Card title="By restaurant" href="/analytics" hrefLabel="See analytics" colors={colors}>
              {perBranch.length === 0 ? (
                <Muted text="No orders in the last 24 hours." colors={colors} />
              ) : (
                perBranch.map((b) => (
                  <div key={b.branchName} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderTop: `1px solid ${colors.border}`,
                    flexWrap: 'wrap',
                    gap: 4,
                  }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.text,
                    }}>
                      {b.branchName}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: colors.muted,
                    }}>
                      {b.orders} order{b.orders === 1 ? '' : 's'} · {money(b.revenue, currency)}
                    </span>
                  </div>
                ))
              )}
            </Card>

            {/* Top Items Card */}
            <Card title="Selling best" href="/analytics" hrefLabel="See analytics" colors={colors}>
              {top.length === 0 ? (
                <Muted text="Nothing sold yet today." colors={colors} />
              ) : (
                top.map((t) => {
                  const max = top[0].qty;
                  return (
                    <div key={t.name} style={{ marginBottom: 11 }}>
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
                          {t.name}
                        </span>
                        <span style={{
                          fontSize: 13,
                          color: colors.muted,
                        }}>
                          {t.qty}
                        </span>
                      </div>
                      <div style={{
                        height: 6,
                        borderRadius: 3,
                        background: colors.border,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${Math.round((t.qty / max) * 100)}%`,
                          height: '100%',
                          background: BRAND,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>

            {/* Restaurants Card */}
            <Card title="Your restaurants" href="/restaurants" hrefLabel="Manage" colors={colors}>
              {branches.length === 0 ? (
                <Muted text="Add your first restaurant to start taking orders." colors={colors} />
              ) : (
                branches.slice(0, 5).map((b) => (
                  <div key={b.restaurantId} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderTop: `1px solid ${colors.border}`,
                    flexWrap: 'wrap',
                    gap: 4,
                  }}>
                    <div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.text,
                      }}>
                        {b.name}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: colors.subtle,
                      }}>
                        {b.address?.city ?? '—'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: b.isActive ? '#4ade80' : colors.subtle,
                      whiteSpace: 'nowrap',
                    }}>
                      {b.isActive ? '● open' : '● closed'}
                    </span>
                  </div>
                ))
              )}
            </Card>
          </div>
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
        fontSize: 'clamp(18px, 2.5vw, 22px)',
        fontWeight: 800,
        color: accent ?? colors.text,
        lineHeight: 1.15,
      }}>
        {value}
      </div>
    </div>
  );
}

function Card({
  title,
  href,
  hrefLabel,
  children,
  colors,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
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
      <h2 style={{
        fontSize: 14,
        fontWeight: 800,
        color: colors.text,
        margin: '0 0 12px',
      }}>
        {title}
      </h2>
      {children}
      {href && (
        <Link
          href={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 12,
            fontSize: 13,
            fontWeight: 700,
            color: BRAND,
            textDecoration: 'none',
          }}
        >
          {hrefLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function Muted({ text, colors }: { text: string; colors: any }) {
  return (
    <p style={{
      fontSize: 13,
      color: colors.subtle,
      margin: 0,
      padding: '12px 0',
      textAlign: 'center',
    }}>
      {text}
    </p>
  );
}