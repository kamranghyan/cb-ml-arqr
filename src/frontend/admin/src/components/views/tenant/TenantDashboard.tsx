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
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
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

// ── Accent colors based on theme ──
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
    bg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0', 
    border: isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0', 
    text: isDark ? '#ff8a5c' : BRAND 
  },
});

export default function TenantDashboard() {
  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(false);

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
      fontFamily: "'Poppins', sans-serif",
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Header ── */}
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
              fontFamily: "'Poppins', sans-serif",
            }}>
              {tenant?.companyName ?? 'Dashboard'}
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
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
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
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
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
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
          <p style={{ marginTop: 12, fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
            Loading dashboard…
          </p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '40px 20px',
          color: accents.danger.text,
        }}>
          <AlertCircle size={20} />
          <span style={{ fontFamily: "'Poppins', sans-serif" }}>{error}</span>
        </div>
      )}

      {/* ── Main Content ── */}
      {!loading && !error && (
        <>
          {/* Plan Limit Warning */}
          {atLimit && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              marginBottom: 16,
              background: accents.orange.bg,
              border: `1px solid ${accents.orange.border}`,
              color: accents.orange.text,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              fontFamily: "'Poppins', sans-serif",
            }}>
              <Lock size={15} />
              <span>
                <strong>Plan full.</strong> {planUsage(tenant!)} used on the{' '}
                {tenant!.planTier} plan — upgrade to open another branch.
              </span>
            </div>
          )}

          {/* ── Stats Grid ── */}
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
              isDark={isDark}
            />
            <Stat
              icon={<Receipt size={17} />}
              label="Orders (24h)"
              value={String(orders.length)}
              colors={colors}
              isDark={isDark}
            />
            <Stat
              icon={<TrendingUp size={17} />}
              label="Revenue (24h)"
              value={money(revenue, currency)}
              accent={colors.text}
              colors={colors}
              isDark={isDark}
            />
            <Stat
              icon={<Store size={17} />}
              label="Restaurants"
              value={tenant ? planUsage(tenant) : String(branches.length)}
              colors={colors}
              isDark={isDark}
            />
          </div>

          {/* ── Cards Grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {/* By Restaurant Card */}
            <Card title="By restaurant" href="/analytics" hrefLabel="See analytics" colors={colors} isDark={isDark}>
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
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {b.branchName}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: colors.muted,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {b.orders} order{b.orders === 1 ? '' : 's'} · {money(b.revenue, currency)}
                    </span>
                  </div>
                ))
              )}
            </Card>

            {/* Top Items Card */}
            <Card title="Selling best" href="/analytics" hrefLabel="See analytics" colors={colors} isDark={isDark}>
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
                          fontFamily: "'Poppins', sans-serif",
                        }}>
                          {t.name}
                        </span>
                        <span style={{
                          fontSize: 13,
                          color: colors.muted,
                          fontFamily: "'Poppins', sans-serif",
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
            <Card title="Your restaurants" href="/restaurants" hrefLabel="Manage" colors={colors} isDark={isDark}>
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
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        {b.name}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: colors.subtle,
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        {b.address?.city ?? '—'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: b.isActive ? accents.green.text : colors.subtle,
                      whiteSpace: 'nowrap',
                      fontFamily: "'Poppins', sans-serif",
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
  isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
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
          fontFamily: "'Poppins', sans-serif",
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'clamp(18px, 2.5vw, 22px)',
        fontWeight: 800,
        color: accent ?? colors.text,
        lineHeight: 1.15,
        fontFamily: "'Poppins', sans-serif",
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
  isDark,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
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
        fontFamily: "'Poppins', sans-serif",
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
            fontFamily: "'Poppins', sans-serif",
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {hrefLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function Muted({ text, colors }: { text: string; colors: ReturnType<typeof getColors> }) {
  return (
    <p style={{
      fontSize: 13,
      color: colors.subtle,
      margin: 0,
      padding: '12px 0',
      textAlign: 'center',
      fontFamily: "'Poppins', sans-serif",
    }}>
      {text}
    </p>
  );
}