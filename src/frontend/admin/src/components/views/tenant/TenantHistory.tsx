'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, Loader2, RefreshCw, AlertCircle, Search, X, Printer } from 'lucide-react';
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
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printingAll, setPrintingAll] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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

// Get branch name safely - check all possible ID fields
const getBranchName = (id: string) => {
  if (!id || !branches || branches.length === 0) return '';
  
  // Try to find the branch by checking all possible ID fields
  const branch = branches.find(b => {
    const branchObj = b as any;
    return branchObj._id === id || 
           branchObj.id === id || 
           branchObj.branchId === id ||
           branchObj.branch_id === id ||
           branchObj.restaurantId === id ||
           branchObj.companyId === id;
  });
  
  return branch?.name || '';
};

  // Print single order function
  const handlePrintOrder = (order: BranchOrder) => {
    setPrintingOrderId(order.orderId);
    setTimeout(() => {
      const status = derivedStatus(order);
      const printWindow = window.open('', '_blank', 'width=700,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Order #${order.orderId.slice(0, 8).toUpperCase()}</title>
              <style>
                body { font-family: 'DM Sans', sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                h1 { font-family: Georgia, serif; font-size: 24px; margin-bottom: 4px; color: #1A1A1A; }
                .order-id { color: #6B7280; font-size: 14px; margin-bottom: 20px; }
                .divider { border-top: 2px solid #E5E7EB; margin: 16px 0; }
                .row { display: flex; justify-content: space-between; padding: 6px 0; }
                .label { color: #6B7280; font-weight: 600; }
                .total { font-size: 18px; font-weight: 800; margin-top: 12px; }
                .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; }
                .items { margin: 12px 0; }
                .item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #F3F4F6; }
                .header { text-align: center; margin-bottom: 20px; }
                .header h1 { margin: 0; }
                .header p { margin: 4px 0 0; color: #6B7280; font-size: 13px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Order Receipt</h1>
                <p>#${order.orderId.toUpperCase()}</p>
              </div>
              
              <div class="divider"></div>
              
              <div class="row"><span class="label">Table</span><span>${order.tableId || '—'}</span></div>
              <div class="row"><span class="label">Type</span><span>${ORDER_TYPE_LABEL[orderTypeOf(order)]}</span></div>
              <div class="row"><span class="label">Destination</span><span>${destinationOf(order)}</span></div>
              <div class="row"><span class="label">Branch</span><span>${order.branchName || '—'}</span></div>
              <div class="row"><span class="label">Placed</span><span>${order.placedAt ? new Date(order.placedAt).toLocaleString() : '—'}</span></div>
              
              <div class="divider"></div>
              
              <div class="items">
                <div style="font-weight:700;margin-bottom:8px;">Items</div>
                ${(order.lineItems ?? []).map(li => `
                  <div class="item">
                    <span>${li.quantity}× ${li.name}</span>
                    <span>${money(li.totalPriceMinorUnits, order.currency)}</span>
                  </div>
                `).join('')}
              </div>
              
              <div class="divider"></div>
              
              <div class="total">
                <div class="row"><span>Total</span><span>${money(order.totalAmountMinorUnits, order.currency)}</span></div>
              </div>
              
              <div class="divider"></div>
              
              <div style="text-align:center;">
                <span class="status" style="background:${STATUS_COLOR[status]}15;color:${STATUS_COLOR[status]};padding:4px 12px;border-radius:4px;font-weight:600;font-size:12px;">
                  ${STATUS_LABEL[status]}
                </span>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
      setPrintingOrderId(null);
    }, 300);
  };

  // Print all orders function
  const handlePrintAll = () => {
    if (shown.length === 0) return;
    setPrintingAll(true);
    setTimeout(() => {
      const printWindow = window.open('', '_blank', 'width=1100,height=800');
      if (printWindow) {
        const branchName = getBranchName(branchId);
        const filterLabel = filter !== 'all' ? ` · Status: ${STATUS_LABEL[filter]}` : '';
        const branchText = branchName ? ` · Branch: ${branchName}` : '';
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Order History Report</title>
              <style>
                body { font-family: 'DM Sans', sans-serif; padding: 30px; max-width: 1200px; margin: 0 auto; }
                h1 { font-family: Georgia, serif; font-size: 24px; margin-bottom: 4px; color: #1A1A1A; }
                .subtitle { color: #6B7280; font-size: 13px; margin-bottom: 20px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E5E7EB; padding-bottom: 16px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                th { padding: 10px 12px; text-align: left; font-weight: 700; color: #1A1A1A; border-bottom: 2px solid #E5E7EB; background: #F9FAFB; }
                td { padding: 10px 12px; border-bottom: 1px solid #E5E7EB; }
                tr:nth-child(even) { background: #FAFAFA; }
                .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }
                .total-row { border-top: 2px solid #E5E7EB; background: #F9FAFB; font-weight: 700; }
                .footer { margin-top: 20px; text-align: center; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 16px; }
              </style>
            </head>
            <body>
              <div class="header">
                <div>
                  <h1>Order History Report</h1>
                  <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
                  <p style="font-size:12px;color:#6B7280;margin:2px 0 0;">
                    ${RANGES.find(r => r.hours === hours)?.label || 'Custom'}
                    ${branchText}
                    ${filterLabel}
                  </p>
                </div>
                <div style="text-align:right;">
                  <p style="font-size:16px;font-weight:700;margin:0;">Total Orders: ${shown.length}</p>
                  <p style="font-size:16px;font-weight:700;margin:4px 0 0;">Revenue: ${money(revenueOf(shown), currency)}</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Placed</th>
                    ${showBranch ? '<th>Branch</th>' : ''}
                    <th>Type</th>
                    <th>Destination</th>
                    <th>Items</th>
                    <th style="text-align:right;">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${shown.map(o => {
                    const s = derivedStatus(o);
                    const n = (o.lineItems ?? []).reduce((x, li) => x + li.quantity, 0);
                    return `
                      <tr>
                        <td style="font-family:monospace;font-size:12px;">#${o.orderId.slice(0, 8).toUpperCase()}</td>
                        <td>${o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}</td>
                        ${showBranch ? `<td>${o.branchName || '—'}</td>` : ''}
                        <td><span style="padding:2px 8px;border-radius:4px;font-weight:600;font-size:11px;background:${ORDER_TYPE_COLOR[orderTypeOf(o)]}15;color:${ORDER_TYPE_COLOR[orderTypeOf(o)]};">${ORDER_TYPE_LABEL[orderTypeOf(o)]}</span></td>
                        <td>${destinationOf(o)}</td>
                        <td>${n} item${n === 1 ? '' : 's'}</td>
                        <td style="text-align:right;font-weight:600;">${money(o.totalAmountMinorUnits, o.currency)}</td>
                        <td><span class="status-badge" style="background:${STATUS_COLOR[s]}15;color:${STATUS_COLOR[s]};">${STATUS_LABEL[s]}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
                <tfoot>
                  <tr class="total-row">
                    <td colspan="${showBranch ? 5 : 4}">Total Orders: ${shown.length}</td>
                    <td style="text-align:right;">${money(revenueOf(shown), currency)}</td>
                    <td colspan="2"></td>
                  </tr>
                </tfoot>
              </table>
              <div class="footer">© ${new Date().getFullYear()} Menulay — Order History Report</div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
      setPrintingAll(false);
    }, 300);
  };

  return (
    <div style={{
      background: colors.bg,
      padding: '16px 20px 40px',
      maxWidth: 1150,
      margin: '0 auto',
      minHeight: '100vh',
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .print-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
          color: ${colors.muted};
        }
        .print-btn:hover {
          background: ${colors.card2};
          color: ${BRAND};
        }
        .print-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {/* Main Content */}
      <div style={{
        background: colors.bg,
        padding: '16px 20px 40px',
        maxWidth: 1150,
        margin: '0 auto',
        minHeight: '100vh',
      }}>
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
            alignItems: 'center',
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              <button
                onClick={handlePrintAll}
                disabled={shown.length === 0 || printingAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  border: `1.5px solid ${shown.length === 0 ? colors.border : BRAND}`,
                  borderRadius: 8,
                  background: shown.length === 0 ? colors.card2 : BRAND,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: shown.length === 0 ? 'not-allowed' : 'pointer',
                  color: shown.length === 0 ? colors.subtle : '#fff',
                  whiteSpace: 'nowrap',
                  opacity: shown.length === 0 ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (shown.length > 0) {
                    e.currentTarget.style.background = '#e04a1a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (shown.length > 0) {
                    e.currentTarget.style.background = BRAND;
                  }
                }}
              >
                {printingAll ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                <span>{printingAll ? 'Printing…' : 'Print All'}</span>
              </button>
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
                        minWidth: 700,
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
                            <th style={{
                              padding: '10px 12px',
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: 1,
                              textTransform: 'uppercase',
                              color: colors.subtle,
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                            }}>Print</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map(o => {
                            const s = derivedStatus(o);
                            const n = (o.lineItems ?? []).reduce((x, li) => x + li.quantity, 0);
                            const isPrinting = printingOrderId === o.orderId;
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
                                <td style={{
                                  padding: '11px 12px',
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                }}>
                                  <button
                                    onClick={() => handlePrintOrder(o)}
                                    disabled={isPrinting}
                                    className="print-btn"
                                    title="Print this order"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: isPrinting ? 'not-allowed' : 'pointer',
                                      padding: '6px 10px',
                                      borderRadius: 6,
                                      transition: 'all 0.2s',
                                      color: isPrinting ? colors.subtle : colors.muted,
                                      opacity: isPrinting ? 0.5 : 1,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isPrinting) {
                                        e.currentTarget.style.background = colors.card2;
                                        e.currentTarget.style.color = BRAND;
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isPrinting) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = colors.muted;
                                      }
                                    }}
                                  >
                                    {isPrinting ? (
                                      <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                      <Printer size={16} />
                                    )}
                                  </button>
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