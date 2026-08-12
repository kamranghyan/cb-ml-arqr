'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Loader2, RefreshCw, AlertCircle, Search, X } from 'lucide-react';
import BranchPicker from '@/components/BranchPicker';
import {
  fetchMyBranches, fetchOrders, revenueOf, derivedStatus,
  type Branch, type BranchOrder,
} from '@/lib/tenant-api';
import {
  money, STATUS_LABEL, STATUS_COLOR, orderTypeOf, destinationOf,
  ORDER_TYPE_LABEL, ORDER_TYPE_COLOR,
  type OrderStatus, type OrderType,
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

const RANGES = [
  { label: 'Last 4 hours', hours: 4 },
  { label: 'Last 12 hours', hours: 12 },
  { label: 'Last 24 hours', hours: 24 },
];

const FILTERS: (OrderStatus | 'all')[] =
  ['all', 'delivered', 'cancelled', 'ready', 'preparing', 'pending'];

export default function TenantHistory() {
  const { isDark } = useTheme();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [hours, setHours] = useState(24);
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [loadingB, setLoadB] = useState(true);
  const [loadingO, setLoadO] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all');

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

  useEffect(() => {
    fetchMyBranches()
      .then(setBranches)
      .catch(e => setError(e?.message ?? 'Could not load your restaurants'))
      .finally(() => setLoadB(false));
  }, []);

  const load = useCallback(async () => {
    if (branches.length === 0) return;
    setLoadO(true);
    setError('');
    try {
      setOrders(await fetchOrders(branches, branchId, hours));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load order history');
    } finally {
      setLoadO(false);
    }
  }, [branches, branchId, hours]);

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
        o.branchName.toLowerCase().includes(q) ||
        (o.lineItems ?? []).some(li => li.name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''));

  const currency = branches[0]?.currencyCode || 'PKR';
  const showBranch = branchId === '' && branches.length > 1;

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
              Order History
            </h1>
            <p style={{
              color: colors.muted,
              fontSize: 13,
              margin: 0,
            }}>
              Everything your restaurants have served recently.
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
            <RefreshCw size={14} className={loadingO ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <BranchPicker branches={branches} value={branchId}
        onChange={setBranchId} loading={loadingB} />

      {!loadingB && branches.length > 0 && (
        <>
          {/* Filters Row */}
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
                  padding: '7px 10px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  background: colors.card2,
                  color: colors.text,
                  cursor: 'pointer',
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
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: `1px solid ${colors.border}`,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: colors.card2,
                    color: colors.muted,
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
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1px solid ${filter === f ? BRAND : colors.border}`,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: filter === f ? BRAND : colors.card2,
                    color: filter === f ? '#fff' : colors.muted,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {f === 'all' ? 'All' : STATUS_LABEL[f]}
                </button>
              ))}
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
                {(['all', 'dine_in', 'pickup', 'delivery'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: `1px solid ${typeFilter === t ? colors.text : colors.border}`,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: typeFilter === t ? colors.text : colors.card2,
                      color: typeFilter === t ? '#fff' : colors.muted,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {t === 'all' ? 'Any type' : ORDER_TYPE_LABEL[t]}
                  </button>
                ))}
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
                  placeholder="Search orders, items, tables..."
                  style={{
                    width: '100%',
                    padding: '8px 11px 8px 30px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    boxSizing: 'border-box',
                    background: colors.card2,
                    color: colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Loading State */}
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
              <p style={{ marginTop: 12, fontSize: 14 }}>Loading orders…</p>
            </div>
          )}

          {/* Error State */}
          {!loadingO && error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '40px 20px',
              color: BRAND,
            }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Content */}
          {!loadingO && !error && (
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
                  value={money(revenueOf(shown), currency)}
                  accent={colors.text}
                  colors={colors}
                />
                <Stat
                  label="Cancelled"
                  value={String(shown.filter(o => derivedStatus(o) === 'cancelled').length)}
                  colors={colors}
                />
              </div>

              {/* Empty State */}
              {shown.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  color: colors.subtle,
                }}>
                  <Receipt size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <p style={{ margin: 0, fontWeight: 600, color: colors.muted }}>
                    Nothing here
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtle }}>
                    {query || filter !== 'all' || typeFilter !== 'all'
                      ? 'No orders match those filters.'
                      : 'No orders in this time window.'}
                  </p>
                </div>
              ) : (
                // Orders Table
                <div style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: colors.card,
                }}>
                  {/* Table wrapper with horizontal scroll for mobile */}
                  <div style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: 700, // Ensures table doesn't get too cramped
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
                          }}>Placed</th>
                          {showBranch && <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                          }}>Restaurant</th>}
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
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
                          }}>Total</th>
                          <th style={{
                            padding: '10px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: colors.subtle,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                          }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map(o => {
                          const s = derivedStatus(o);
                          const n = (o.lineItems ?? []).reduce((x, li) => x + li.quantity, 0);
                          return (
                            <tr key={o.orderId} style={{
                              borderTop: `1px solid ${colors.border}`,
                            }}>
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                              }}>
                                {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
                              </td>
                              {showBranch && (
                                <td style={{
                                  padding: '11px 12px',
                                  fontSize: 14,
                                  color: colors.muted,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {o.branchName}
                                </td>
                              )}
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                              }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: `${ORDER_TYPE_COLOR[orderTypeOf(o)]}15`,
                                  color: ORDER_TYPE_COLOR[orderTypeOf(o)],
                                  whiteSpace: 'nowrap',
                                }}>
                                  {ORDER_TYPE_LABEL[orderTypeOf(o)]}
                                </span>
                              </td>
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.muted,
                                whiteSpace: 'nowrap',
                              }}>
                                {destinationOf(o)}
                              </td>
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.muted,
                                maxWidth: 200,
                              }}>
                                <div style={{ whiteSpace: 'normal' }}>
                                  {n} item{n === 1 ? '' : 's'}
                                  <span style={{
                                    color: colors.subtle,
                                    fontSize: 12,
                                    display: 'block',
                                  }}>
                                    {(o.lineItems ?? []).slice(0, 2).map(li => li.name).join(', ')}
                                    {(o.lineItems ?? []).length > 2 ? '…' : ''}
                                  </span>
                                </div>
                              </td>
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                fontWeight: 700,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                              }}>
                                {money(o.totalAmountMinorUnits, o.currency)}
                              </td>
                              <td style={{
                                padding: '11px 12px',
                                fontSize: 14,
                                color: colors.text,
                                whiteSpace: 'nowrap',
                              }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: `${STATUS_COLOR[s]}15`,
                                  color: STATUS_COLOR[s],
                                  whiteSpace: 'nowrap',
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
        fontSize: 'clamp(18px, 2.5vw, 20px)',
        fontWeight: 800,
        color: accent ?? colors.text,
      }}>
        {value}
      </div>
    </div>
  );
}