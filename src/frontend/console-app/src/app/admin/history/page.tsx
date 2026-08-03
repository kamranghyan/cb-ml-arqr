'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Loader2, RefreshCw, AlertCircle, Search } from 'lucide-react';
import ScopePicker, { EMPTY_SCOPE, type Scope } from '@/components/ScopePicker';
import {
  fetchOrdersForRestaurant, derivedStatus, money,
  STATUS_LABEL, STATUS_COLOR, type SupportOrder, type OrderStatus,
} from '@/lib/support-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

// How far back to look. The orders API caps a query at 24 hours.
const RANGES = [
  { label: 'Last 4 hours',  hours: 4  },
  { label: 'Last 12 hours', hours: 12 },
  { label: 'Last 24 hours', hours: 24 },
];

const FILTERS: (OrderStatus | 'all')[] =
  ['all', 'delivered', 'cancelled', 'ready', 'preparing', 'pending'];

export default function OrderHistoryPage() {
  const [scope, setScope]     = useState<Scope>(EMPTY_SCOPE);
  const [hours, setHours]     = useState(24);
  const [orders, setOrders]   = useState<SupportOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState<OrderStatus | 'all'>('all');
  const [query, setQuery]     = useState('');

  const load = useCallback(async () => {
    if (!scope.tenantId || !scope.restaurantId) { setOrders([]); return; }
    setLoading(true); setError('');
    try {
      setOrders(await fetchOrdersForRestaurant(scope.tenantId, scope.restaurantId, hours));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load order history');
    } finally {
      setLoading(false);
    }
  }, [scope.tenantId, scope.restaurantId, hours]);

  useEffect(() => { load(); }, [load]);

  const shown = orders
    .filter(o => filter === 'all' || derivedStatus(o) === filter)
    .filter(o => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        o.orderId.toLowerCase().includes(q) ||
        (o.tableId ?? '').toLowerCase().includes(q) ||
        (o.lineItems ?? []).some(li => li.name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''));

  const revenue = shown
    .filter(o => derivedStatus(o) !== 'cancelled')
    .reduce((s, o) => s + (o.totalAmountMinorUnits ?? 0), 0);

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
            Order History
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            Past orders for a branch — useful when a customer asks what happened.
          </p>
        </div>
        <button onClick={load} style={ghost}><RefreshCw size={14} /> Refresh</button>
      </div>

      <ScopePicker value={scope} onChange={setScope} />

      {!scope.restaurantId && (
        <Empty icon={<Receipt size={28} />} title="Pick a company and restaurant"
               text="Then you can look through its orders." />
      )}

      {scope.restaurantId && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <select value={hours} onChange={e => setHours(Number(e.target.value))} style={select}>
              {RANGES.map(r => <option key={r.hours} value={r.hours}>{r.label}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  ...chip,
                  background: filter === f ? C.red : '#fff',
                  color:      filter === f ? '#fff' : C.muted,
                  borderColor: filter === f ? C.red : C.border,
                }}>
                  {f === 'all' ? 'All' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={14} color={C.subtle}
                      style={{ position: 'absolute', left: 10, top: 9 }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                     placeholder="Order id, table or item…"
                     style={{ ...input, paddingLeft: 30, width: 240 }} />
            </div>
          </div>

          {loading && (
            <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
              <AlertCircle size={20} /> {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <Stat label="Orders"  value={String(shown.length)} />
                <Stat label="Revenue" value={money(revenue, scope.currency)} accent={C.green} />
                <Stat label="Cancelled"
                      value={String(shown.filter(o => derivedStatus(o) === 'cancelled').length)} />
              </div>

              {shown.length === 0 ? (
                <Empty icon={<Receipt size={28} />} title="Nothing here"
                       text={query || filter !== 'all'
                         ? 'No orders match those filters.'
                         : 'No orders in this window.'} />
              ) : (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: C.bg }}>
                      <tr>
                        <th style={th}>Placed</th><th style={th}>Table</th>
                        <th style={th}>Items</th><th style={th}>Total</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map(o => {
                        const s = derivedStatus(o);
                        const count = (o.lineItems ?? []).reduce((n, li) => n + li.quantity, 0);
                        return (
                          <tr key={o.orderId} style={{ borderTop: `1px solid ${C.border}` }}>
                            <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                              {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
                            </td>
                            <td style={cell}>{o.tableId || '—'}</td>
                            <td style={{ ...cell, color: C.muted }}>
                              {count} item{count === 1 ? '' : 's'}
                              <span style={{ color: C.subtle, fontSize: 12 }}>
                                {' · '}
                                {(o.lineItems ?? []).slice(0, 2).map(li => li.name).join(', ')}
                                {(o.lineItems ?? []).length > 2 ? '…' : ''}
                              </span>
                            </td>
                            <td style={{ ...cell, fontWeight: 700 }}>
                              {money(o.totalAmountMinorUnits, scope.currency)}
                            </td>
                            <td style={cell}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: 0.5, padding: '3px 8px', borderRadius: 6,
                                background: `${STATUS_COLOR[s]}15`, color: STATUS_COLOR[s],
                              }}>{STATUS_LABEL[s]}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 18px', minWidth: 120 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: C.subtle }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? C.text }}>{value}</div>
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: C.subtle }}>
      <div style={{ opacity: 0.4, marginBottom: 8 }}>{icon}</div>
      <p style={{ margin: 0, fontWeight: 600, color: C.muted }}>{title}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>{text}</p>
    </div>
  );
}

const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
const chip: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const select: React.CSSProperties = {
  padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 13, background: '#fff', color: C.text, cursor: 'pointer',
};
const input: React.CSSProperties = {
  padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 13, boxSizing: 'border-box', background: '#fff',
};
const cell: React.CSSProperties = { padding: '11px 12px', fontSize: 14, color: C.text };
const th: React.CSSProperties = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
  textTransform: 'uppercase', color: C.subtle, textAlign: 'left',
};
