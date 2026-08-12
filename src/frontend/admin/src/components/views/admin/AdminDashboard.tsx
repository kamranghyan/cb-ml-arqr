'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2, Store, TrendingUp, Loader2, AlertCircle,
  RefreshCw, ChevronRight, Pause,
} from 'lucide-react';
import { fetchTenants, type ApiTenant, type PlanTier } from '@/lib/auth-api';
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

const PLAN_ORDER: PlanTier[] = ['starter', 'professional', 'enterprise'];

export default function AdminDashboard() {
  const { isDark } = useTheme();
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
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
      setTenants(await fetchTenants());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load platform data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = tenants.filter(t => t.isActive);
  const suspended = tenants.filter(t => !t.isActive);
  const restaurants = tenants.reduce((s, t) => s + (t.restaurantCount ?? 0), 0);

  const byPlan = PLAN_ORDER.map(p => ({
    plan: p,
    count: tenants.filter(t => t.planTier === p).length,
  }));

  // Tenants sitting on their plan ceiling — natural upgrade conversations.
  const atLimit = tenants.filter(
    t => t.maxRestaurants !== -1 && t.restaurantCount >= t.maxRestaurants
  );

  return (
    <div style={{
      background: colors.bg,
      padding: '16px 20px 40px',
      maxWidth: 1100,
      margin: '0 auto',
      minHeight: '100vh',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 22,
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
              Platform Overview
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
            }}>
              Customer companies on MenuLay and how much of their plan they use.
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
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading platform data…</p>
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

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 14,
            marginBottom: 22,
          }}>
            <Stat
              icon={<Building2 size={18} />}
              label="Tenants"
              value={tenants.length}
              colors={colors}
            />
            <Stat
              icon={<TrendingUp size={18} />}
              label="Active"
              value={active.length}
              accent={accent.green.text}
              colors={colors}
            />
            <Stat
              icon={<Pause size={18} />}
              label="Suspended"
              value={suspended.length}
              accent={suspended.length ? accent.danger.text : undefined}
              colors={colors}
            />
            <Stat
              icon={<Store size={18} />}
              label="Restaurants"
              value={restaurants}
              colors={colors}
            />
          </div>

          {/* Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {/* Subscription Mix Card */}
            <Card title="Subscription mix" colors={colors}>
              {tenants.length === 0 ? (
                <Empty text="No tenants yet." colors={colors} />
              ) : (
                byPlan.map(({ plan, count }) => {
                  const pct = tenants.length ? Math.round((count / tenants.length) * 100) : 0;
                  return (
                    <div key={plan} style={{ marginBottom: 12 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.text,
                          textTransform: 'capitalize',
                        }}>
                          {plan}
                        </span>
                        <span style={{
                          fontSize: 13,
                          color: colors.muted,
                        }}>
                          {count}
                        </span>
                      </div>
                      <Bar pct={pct} colors={colors} />
                    </div>
                  );
                })
              )}
            </Card>

            {/* At Plan Limit Card */}
            <Card title="At plan limit" colors={colors}>
              {atLimit.length === 0 ? (
                <Empty text="No tenant has hit its ceiling." colors={colors} />
              ) : (
                <>
                  <p style={{
                    fontSize: 13,
                    color: colors.muted,
                    margin: '0 0 10px',
                  }}>
                    These companies cannot add restaurants until they upgrade.
                  </p>
                  {atLimit.map(t => (
                    <div key={t.tenantId} style={{
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
                        {t.companyName}
                      </span>
                      <span style={{
                        fontSize: 12,
                        color: accent.danger.text,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        {t.restaurantCount}/{t.maxRestaurants} · {t.planTier}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </Card>

            {/* Newest Tenants Card */}
            <Card title="Newest tenants" colors={colors}>
              {tenants.length === 0 ? (
                <Empty text="Create your first tenant to get started." colors={colors} />
              ) : (
                [...tenants]
                  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
                  .slice(0, 5)
                  .map(t => (
                    <div key={t.tenantId} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderTop: `1px solid ${colors.border}`,
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.text,
                        }}>
                          {t.companyName}
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: colors.subtle,
                        }}>
                          {t.email}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: t.isActive ? accent.green.text : accent.danger.text,
                        whiteSpace: 'nowrap',
                      }}>
                        {t.isActive ? '● active' : '● suspended'}
                      </span>
                    </div>
                  ))
              )}
              <Link
                href="/tenants"
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
                Manage tenants <ChevronRight size={14} />
              </Link>
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
  value: number;
  accent?: string;
  colors: any;
}) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: '16px 18px',
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
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'clamp(24px, 3vw, 28px)',
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
      <h2 style={{
        fontSize: 15,
        fontWeight: 800,
        color: colors.text,
        margin: '0 0 14px',
      }}>
        {title}
      </h2>
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

function Empty({ text, colors }: { text: string; colors: any }) {
  return (
    <p style={{
      fontSize: 13,
      color: colors.subtle,
      margin: 0,
    }}>
      {text}
    </p>
  );
}