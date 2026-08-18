'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2, Store, TrendingUp, Loader2, AlertCircle,
  RefreshCw, ChevronRight, Pause,
} from 'lucide-react';
import { fetchTenants, type ApiTenant, type PlanTier } from '@/lib/auth-api';
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

const PLAN_ORDER: PlanTier[] = ['starter', 'professional', 'enterprise'];

export default function AdminDashboard() {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
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
              fontFamily: "'Poppins', sans-serif",
            }}>
              Platform Overview
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
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
            Loading platform data…
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

      {/* ── Content ── */}
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
              accent={accents.green.text}
              colors={colors}
            />
            <Stat
              icon={<Pause size={18} />}
              label="Suspended"
              value={suspended.length}
              accent={suspended.length ? accents.danger.text : undefined}
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
                          fontFamily: "'Poppins', sans-serif",
                        }}>
                          {plan}
                        </span>
                        <span style={{
                          fontSize: 13,
                          color: colors.muted,
                          fontFamily: "'Poppins', sans-serif",
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
                    fontFamily: "'Poppins', sans-serif",
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
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        {t.companyName}
                      </span>
                      <span style={{
                        fontSize: 12,
                        color: accents.danger.text,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        fontFamily: "'Poppins', sans-serif",
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
                          fontFamily: "'Poppins', sans-serif",
                        }}>
                          {t.companyName}
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: colors.subtle,
                          fontFamily: "'Poppins', sans-serif",
                        }}>
                          {t.email}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: t.isActive ? accents.green.text : accents.danger.text,
                        whiteSpace: 'nowrap',
                        fontFamily: "'Poppins', sans-serif",
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
  colors: ReturnType<typeof getColors>;
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
          fontFamily: "'Poppins', sans-serif",
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'clamp(24px, 3vw, 28px)',
        fontWeight: 800,
        color: accent ?? colors.text,
        lineHeight: 1,
        fontFamily: "'Poppins', sans-serif",
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
  colors: ReturnType<typeof getColors>;
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
        fontFamily: "'Poppins', sans-serif",
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Bar({ pct, colors }: { pct: number; colors: ReturnType<typeof getColors> }) {
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

function Empty({ text, colors }: { text: string; colors: ReturnType<typeof getColors> }) {
  return (
    <p style={{
      fontSize: 13,
      color: colors.subtle,
      margin: 0,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {text}
    </p>
  );
}