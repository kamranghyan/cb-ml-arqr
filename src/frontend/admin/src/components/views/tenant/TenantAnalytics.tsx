'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Loader2, RefreshCw, AlertCircle, TrendingUp, Receipt, Clock,
} from 'lucide-react';
import BranchPicker from '@/components/BranchPicker';
import {
  fetchMyBranches, fetchOrders, revenueOf, byBranch, topItems,
  ordersByHour, derivedStatus, byOrderType, type Branch, type BranchOrder,
} from '@/lib/tenant-api';
import { money, ORDER_TYPE_LABEL, ORDER_TYPE_COLOR } from '@/lib/support-api';
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

export default function TenantAnalytics() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [loadingB, setLoadB] = useState(true);
  const [loadingO, setLoadO] = useState(false);
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

  useEffect(() => {
    fetchMyBranches()
      .then(setBranches)
      .catch(e => setError(e?.message ?? 'Could not load your restaurants'))
      .finally(() => setLoadB(false));
  }, []);

  const load = useCallback(async () => {
    if (branches.length === 0) return;
    setLoadO(true); setError('');
    try { setOrders(await fetchOrders(branches, branchId, 24)); }
    catch (e: any) { setError(e?.message ?? 'Could not load analytics'); }
    finally { setLoadO(false); }
  }, [branches, branchId]);

  useEffect(() => { load(); }, [load]);

  const completed = orders.filter(o => derivedStatus(o) !== 'cancelled');
  const revenue = revenueOf(orders);
  const avg = completed.length ? Math.round(revenue / completed.length) : 0;
  const currency = branches[0]?.currencyCode || 'PKR';
  const perBranch = byBranch(orders);
  const items = topItems(orders, 8);
  const hourly = ordersByHour(orders);
  const types = byOrderType(orders);
  const peakCount = Math.max(...hourly.map(h => h.count), 0);

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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
      }}>
        <div>
          <h1 style={{
            fontSize: 'clamp(20px, 3vw, 26px)',
            fontWeight: 800,
            color: colors.text,
            margin: '0 0 2px',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Analytics
          </h1>
          <p style={{
            color: colors.muted,
            fontSize: 13,
            margin: 0,
            fontFamily: "'Poppins', sans-serif",
          }}>
            The last 24 hours — what sold, when, and where.
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
          <RefreshCw size={14} style={loadingO ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
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
          {/* ── Loading State ── */}
          {loadingO && (
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
                Loading analytics…
              </p>
            </div>
          )}

          {/* ── Error State ── */}
          {!loadingO && error && (
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
          {!loadingO && !error && (
            <>
              {/* Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}>
                <Stat 
                  icon={<Receipt size={17} />} 
                  label="Orders" 
                  value={String(completed.length)} 
                  colors={colors} 
                />
                <Stat 
                  icon={<TrendingUp size={17} />} 
                  label="Revenue" 
                  value={money(revenue, currency)} 
                  accent={accents.green.text} 
                  colors={colors} 
                />
                <Stat 
                  icon={<BarChart2 size={17} />} 
                  label="Avg order" 
                  value={money(avg, currency)} 
                  colors={colors} 
                />
                <Stat 
                  icon={<Clock size={17} />} 
                  label="Cancelled" 
                  value={String(orders.length - completed.length)} 
                  colors={colors} 
                />
              </div>

              {/* ── Charts Grid ── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 16,
              }}>
                {/* By Restaurant Card */}
                {branchId === '' && branches.length > 1 && (
                  <Card title="How each restaurant did" colors={colors}>
                    {perBranch.length === 0 ? (
                      <Muted text="No orders yet today." colors={colors} />
                    ) : (
                      perBranch.map(b => {
                        const max = perBranch[0].orders;
                        return (
                          <div key={b.branchName} style={{ marginBottom: 12 }}>
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
                                {b.branchName}
                              </span>
                              <span style={{
                                fontSize: 12,
                                color: colors.muted,
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                {b.orders} · {money(b.revenue, currency)}
                              </span>
                            </div>
                            <Bar 
                              pct={max ? Math.round((b.orders / max) * 100) : 0} 
                              colors={colors} 
                            />
                          </div>
                        );
                      })
                    )}
                  </Card>
                )}

                {/* Order Types Card */}
                <Card title="Dine in, pickup or delivery" colors={colors}>
                  {types.length === 0 ? (
                    <Muted text="No orders yet today." colors={colors} />
                  ) : (
                    types.map(t => {
                      const share = orders.length
                        ? Math.round((t.orders / orders.length) * 100) : 0;
                      return (
                        <div key={t.type} style={{ marginBottom: 12 }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 4,
                            alignItems: 'center',
                          }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: isDark ? `${ORDER_TYPE_COLOR[t.type]}15` : `${ORDER_TYPE_COLOR[t.type]}10`,
                              color: ORDER_TYPE_COLOR[t.type],
                              fontFamily: "'Poppins', sans-serif",
                            }}>
                              {ORDER_TYPE_LABEL[t.type]}
                            </span>
                            <span style={{
                              fontSize: 12,
                              color: colors.muted,
                              fontFamily: "'Poppins', sans-serif",
                            }}>
                              {t.orders} · {money(t.revenue, currency)} · {share}%
                            </span>
                          </div>
                          <Bar pct={share} colors={colors} />
                        </div>
                      );
                    })
                  )}
                </Card>

                {/* Top Items Card */}
                <Card title="Selling best" colors={colors}>
                  {items.length === 0 ? (
                    <Muted text="Nothing sold yet today." colors={colors} />
                  ) : (
                    items.map(t => {
                      const max = items[0].qty;
                      return (
                        <div key={t.name} style={{ marginBottom: 10 }}>
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
                          <Bar 
                            pct={Math.round((t.qty / max) * 100)} 
                            colors={colors} 
                          />
                        </div>
                      );
                    })
                  )}
                </Card>

                {/* Hourly Orders Card */}
                <Card title="When you are busy" colors={colors}>
                  {peakCount === 0 ? (
                    <Muted text="No orders to chart yet." colors={colors} />
                  ) : (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 2,
                        height: '120px',
                        marginBottom: 6,
                      }}>
                        {hourly.map(h => (
                          <div key={h.hour} 
                            title={`${h.hour}:00 — ${h.count} orders`}
                            style={{
                              flex: 1,
                              height: `${peakCount ? (h.count / peakCount) * 100 : 0}%`,
                              minHeight: h.count ? 3 : 1,
                              background: h.count ? BRAND : colors.border,
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 0.3s ease',
                            }} 
                          />
                        ))}
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        color: colors.subtle,
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        <span>00:00</span>
                        <span>12:00</span>
                        <span>23:00</span>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            </>
          )}
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
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: colors.muted,
        marginBottom: 4,
      }}>
        {icon}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'clamp(18px, 2.5vw, 22px)',
        fontWeight: 800,
        color: accent || colors.text,
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
      borderRadius: 12,
      padding: 16,
    }}>
      <h3 style={{
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: colors.muted,
        margin: '0 0 12px 0',
        fontFamily: "'Poppins', sans-serif",
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bar({
  pct,
  colors,
}: {
  pct: number;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div style={{
      width: '100%',
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      background: colors.border,
    }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`,
        height: '100%',
        borderRadius: 3,
        background: BRAND,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

function Muted({
  text,
  colors,
}: {
  text: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <p style={{
      fontSize: 13,
      color: colors.muted,
      margin: 0,
      padding: '24px 0',
      textAlign: 'center',
      fontFamily: "'Poppins', sans-serif",
    }}>
      {text}
    </p>
  );
}