'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Loader2, RefreshCw, AlertCircle, Search, X } from 'lucide-react';
import ScopePicker, { EMPTY_SCOPE, type Scope } from '@/components/ScopePicker';
import {
  fetchOrdersForRestaurant, derivedStatus, money,
  STATUS_LABEL, STATUS_COLOR, orderTypeOf, destinationOf,
  ORDER_TYPE_LABEL, ORDER_TYPE_COLOR,
  type SupportOrder, type OrderStatus, type OrderType,
} from '@/lib/support-api';
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

// How far back to look. The orders API caps a query at 24 hours.
const RANGES = [
  { label: 'Last 4 hours', hours: 4 },
  { label: 'Last 12 hours', hours: 12 },
  { label: 'Last 24 hours', hours: 24 },
];

const FILTERS: (OrderStatus | 'all')[] =
  ['all', 'delivered', 'cancelled', 'ready', 'preparing', 'pending'];

// Truncate text function
const truncate = (text: string, maxLength: number = 30) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '…' : text;
};

export default function AdminHistory() {
  const [scope, setScope] = useState<Scope>(EMPTY_SCOPE);
  const [hours, setHours] = useState(24);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all');
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
    if (!scope.tenantId || !scope.restaurantId) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setOrders(await fetchOrdersForRestaurant(scope.tenantId, scope.restaurantId, hours));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load order history');
    } finally {
      setLoading(false);
    }
  }, [scope.tenantId, scope.restaurantId, hours]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = orders
    .filter(o => filter === 'all' || derivedStatus(o) === filter)
    .filter(o => typeFilter === 'all' || orderTypeOf(o) === typeFilter)
    .filter(o => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        o.orderId.toLowerCase().includes(q) ||
        (o.tableId ?? '').toLowerCase().includes(q) ||
        (o.deliveryAddress ?? '').toLowerCase().includes(q) ||
        (o.lineItems ?? []).some(li => li.name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''));

  const revenue = shown
    .filter(o => derivedStatus(o) !== 'cancelled')
    .reduce((s, o) => s + (o.totalAmountMinorUnits ?? 0), 0);

  // Clear all filters
  const clearFilters = () => {
    setFilter('all');
    setTypeFilter('all');
    setQuery('');
  };

  const hasActiveFilters = filter !== 'all' || typeFilter !== 'all' || query.trim() !== '';

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
              fontFamily: "'Poppins', sans-serif",
            }}>
              Order History
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Past orders for a branch — useful when a customer asks what happened.
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

      {/* ── Scope Picker ── */}
      <ScopePicker value={scope} onChange={setScope} />

      {/* ── Empty State (No Restaurant Selected) ── */}
      {!scope.restaurantId && (
        <Empty
          icon={<Receipt size={28} />}
          title="Pick a company and restaurant"
          text="Then you can look through its orders."
          colors={colors}
        />
      )}

      {scope.restaurantId && (
        <>
          {/* ── Filters Row ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 16,
          }}>
            {/* Time Range & Clear Filters */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
            }}>
              <select
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                style={{
                  padding: '7px 12px',
                  border: `1.5px solid ${colors.border}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  background: colors.card2,
                  color: colors.text,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  e.currentTarget.style.borderColor = BRAND;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                {RANGES.map(r => <option key={r.hours} value={r.hours}>{r.label}</option>)}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${colors.border}`,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: colors.card2,
                    color: colors.muted,
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
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>

            {/* Status Filters */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}>
              {FILTERS.map(f => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? BRAND : colors.border}`,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: active ? BRAND : colors.card2,
                      color: active ? '#fff' : colors.muted,
                      transition: 'all 0.2s ease',
                      fontFamily: "'Poppins', sans-serif",
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = colors.hoverBg;
                        e.currentTarget.style.color = colors.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = colors.card2;
                        e.currentTarget.style.color = colors.muted;
                      }
                    }}
                  >
                    {f === 'all' ? 'All' : STATUS_LABEL[f]}
                  </button>
                );
              })}
            </div>

            {/* Type Filters & Search */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
            }}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}>
                {(['all', 'dine_in', 'pickup', 'delivery'] as const).map(t => {
                  const active = typeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: `1.5px solid ${active ? colors.text : colors.border}`,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: active ? colors.text : colors.card2,
                        color: active
                          ? (isDark ? '#111111' : '#FFFFFF')
                          : colors.muted,
                        transition: 'all 0.2s ease',
                        fontFamily: "'Poppins', sans-serif",
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                        e.currentTarget.style.borderColor = colors.text;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = active
                          ? colors.text
                          : colors.border;
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = colors.hoverBg;
                          e.currentTarget.style.color = colors.text;
                          e.currentTarget.style.borderColor = colors.text;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = colors.card2;
                          e.currentTarget.style.color = colors.muted;
                          e.currentTarget.style.borderColor = colors.border;
                        }
                      }}
                    >
                      {t === 'all' ? 'Any type' : ORDER_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>

              <div style={{
                position: 'relative',
                flex: '1',
                minWidth: 180,
                maxWidth: '100%',
              }}>
                <Search size={14} color={colors.subtle} style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Order id, table or item…"
                  style={{
                    width: '100%',
                    padding: '8px 11px 8px 30px',
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: "'Poppins', sans-serif",
                    boxSizing: 'border-box',
                    background: colors.card2,
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                    e.currentTarget.style.borderColor = BRAND;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                />
              </div>
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
              <p style={{
                marginTop: 12,
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif"
              }}>
                Loading orders…
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
              {/* Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}>
                <Stat
                  label="Orders"
                  value={String(shown.length)}
                  colors={colors}
                />
                <Stat
                  label="Revenue"
                  value={money(revenue, scope.currency)}
                  accent={accents.green.text}
                  colors={colors}
                />
                <Stat
                  label="Cancelled"
                  value={String(shown.filter(o => derivedStatus(o) === 'cancelled').length)}
                  colors={colors}
                />
              </div>

              {/* ── Empty State ── */}
              {shown.length === 0 ? (
                <Empty
                  icon={<Receipt size={28} />}
                  title="Nothing here"
                  text={query || filter !== 'all' || typeFilter !== 'all'
                    ? 'No orders match those filters.'
                    : 'No orders in this window.'}
                  colors={colors}
                />
              ) : (
                /* ── Orders Table ── */
                <div style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: colors.card,
                }}>
                  <div style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: 780,
                    }}>
                      <thead style={{ background: colors.card2 }}>
                        <tr>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Poppins', sans-serif",
                          }}>Placed</th>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Poppins', sans-serif",
                          }}>Type</th>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Poppins', sans-serif",
                          }}>Going to</th>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Poppins', sans-serif",
                          }}>Items</th>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Poppins', sans-serif",
                          }}>Total</th>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Poppins', sans-serif",
                          }}>Rating</th>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Poppins', sans-serif",
                          }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map(o => {
                          const s = derivedStatus(o);
                          const count = (o.lineItems ?? []).reduce((n, li) => n + li.quantity, 0);
                          return (
                            <tr key={o.orderId} style={{
                              borderTop: `1px solid ${colors.border}`,
                            }}>
                              {/* ── Placed ── */}
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
                              </td>

                              {/* ── Type ── */}
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: isDark ? `${ORDER_TYPE_COLOR[orderTypeOf(o)]}15` : `${ORDER_TYPE_COLOR[orderTypeOf(o)]}10`,
                                  color: ORDER_TYPE_COLOR[orderTypeOf(o)],
                                  whiteSpace: 'nowrap',
                                  fontFamily: "'Poppins', sans-serif",
                                }}>
                                  {ORDER_TYPE_LABEL[orderTypeOf(o)]}
                                </span>
                              </td>

                              {/* ── Going to ── */}
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.muted,
                                whiteSpace: 'nowrap',
                                fontFamily: "'Poppins', sans-serif",
                                maxWidth: '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {truncate(destinationOf(o), 15)}
                              </td>

                              {/* ── Items ── */}
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.muted,
                                maxWidth: '180px',
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                <div style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {count} item{count === 1 ? '' : 's'}
                                  <span style={{
                                    color: colors.subtle,
                                    fontSize: 12,
                                    display: 'block',
                                    fontFamily: "'Poppins', sans-serif",
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}>
                                    {truncate((o.lineItems ?? []).slice(0, 2).map(li => li.name).join(', '), 25)}
                                    {(o.lineItems ?? []).length > 2 ? '…' : ''}
                                  </span>
                                </div>
                              </td>

                              {/* ── Total ── */}
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                fontWeight: 700,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                {money(o.totalAmountMinorUnits, scope.currency)}
                              </td>

                              {/* ── Rating ── */}
                              <td style={{
                                padding: '11px 12px',
                                textAlign: 'center',
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                {typeof o.rating === 'number' ? (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                    title={o.feedbackText || undefined}
                                  >
                                    <span style={{ color: '#FFB300', fontSize: 13 }}>★</span>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: colors.text,
                                      }}
                                    >
                                      {o.rating}/5
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: colors.subtle, fontSize: 12 }}>—</span>
                                )}
                              </td>

                              {/* ── Status ── */}
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: isDark ? `${STATUS_COLOR[s]}15` : `${STATUS_COLOR[s]}10`,
                                  color: STATUS_COLOR[s],
                                  whiteSpace: 'nowrap',
                                  fontFamily: "'Poppins', sans-serif",
                                }}>
                                  {STATUS_LABEL[s]}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
  colors,
}: {
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
      padding: '10px 18px',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.subtle,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'clamp(18px, 2.5vw, 20px)',
        fontWeight: 800,
        color: accent ?? colors.text,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {value}
      </div>
    </div>
  );
}

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
        fontFamily: "'Poppins', sans-serif",
      }}>
        {title}
      </p>
      <p style={{
        margin: '4px 0 0',
        fontSize: 13,
        color: colors.subtle,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {text}
      </p>
    </div>
  );
}