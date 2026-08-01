'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, WifiOff, Clock, Users, TrendingUp, ShoppingBag, DollarSign, CheckCircle } from 'lucide-react';
import { fetchOrders } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

const STATUS_CFG: Record<KdsStatus, { label: string; dot: string; bg: string; color: string; border: string }> = {
  new:       { label: 'New',       dot: '#f97316', bg: '#FFF3E0', color: '#c2410c', border: '#FED7AA' },
  preparing: { label: 'Preparing', dot: '#3b82f6', bg: '#EFF6FF', color: '#1d4ed8', border: '#BFDBFE' },
  ready:     { label: 'Ready',     dot: '#22c55e', bg: '#F0FFF4', color: '#16a34a', border: '#BBF7D0' },
  delivered: { label: 'Delivered', dot: '#a855f7', bg: '#FAF5FF', color: '#7c3aed', border: '#DDD6FE' },
};

export default function OrdersHistoryPage() {
  const [orders,  setOrders]  = useState<(KdsOrder & { _apiId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all' | KdsStatus>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await fetchOrders(); setOrders(data); }
    catch (e: any) { setError(e?.message ?? 'Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch = search === '' || o.id.toLowerCase().includes(search.toLowerCase()) || o.table.includes(search) || o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const totalRevenue = orders.reduce((sum, o) => sum + ((o as any)._raw?.totalAmountMinorUnits ?? 0), 0) / 100;
  const delivered    = orders.filter(o => o.status === 'delivered').length;
  const avgItems     = orders.length ? (orders.reduce((s, o) => s + o.items.length, 0) / orders.length).toFixed(1) : '0';

  const stats = [
    { label: 'Total Orders',    value: orders.length,                   icon: ShoppingBag, color: C.text    },
    { label: 'Delivered',       value: delivered,                       icon: CheckCircle, color: '#16a34a' },
    { label: 'Revenue',         value: `Rs ${totalRevenue.toFixed(0)}`, icon: DollarSign,  color: C.red     },
    { label: 'Avg Items/Order', value: avgItems,                        icon: TrendingUp,  color: '#d97706' },
  ];

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: C.white, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>Orders History</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>All orders · {orders.length} total</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.subtle, pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders…"
              style={{ height: 36, paddingLeft: 36, paddingRight: 14, borderRadius: 10, width: 200, fontSize: 13, background: C.bg, border: `1.5px solid ${C.border}`, color: C.text, outline: 'none' }}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
              onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
            />
          </div>
          <button onClick={load} title="Refresh"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} color={C.dark} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Icon size={13} color={C.subtle} />
                  <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
                </div>
                <p style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'Georgia, serif', margin: 0, lineHeight: 1 }}>{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 4, width: 'fit-content' }}>
          {[
            { key: 'all',       label: 'All Orders'  },
            { key: 'new',       label: '🟠 New'       },
            { key: 'preparing', label: '🔵 Preparing' },
            { key: 'ready',     label: '🟢 Ready'     },
            { key: 'delivered', label: '✓ Delivered'  },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              style={{ padding: '6px 16px', height: 34, borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: filter === f.key ? C.red : 'transparent',
                color:      filter === f.key ? '#fff' : C.muted,
                boxShadow:  filter === f.key ? '0 4px 12px rgba(225,37,27,0.25)' : 'none',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#FFF0F0', border: '1.5px solid #FFD0D0', borderRadius: 14 }}>
            <WifiOff size={16} color={C.red} style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: C.red, flex: 1, margin: 0 }}>{error}</p>
            <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ width: 64, height: 14, background: '#F0E8E0', borderRadius: 6 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 10, width: '50%', background: '#F0E8E0', borderRadius: 6 }} />
                  <div style={{ height: 8, width: '30%', background: '#F0E8E0', borderRadius: 6 }} />
                </div>
                <div style={{ width: 80, height: 24, background: '#F0E8E0', borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, border: `2px dashed ${C.border}`, borderRadius: 20, background: C.white }}>
            <span style={{ fontSize: 36, opacity: 0.2 }}>📋</span>
            <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>{search ? 'No orders match your search' : 'No orders yet'}</p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(137,28,28,0.05)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 70px 1fr 110px 110px 120px', gap: 12, padding: '10px 20px', borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
              {['Order ID', 'Table', 'Items', 'Placed At', 'Total', 'Status'].map(h => (
                <p key={h} style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>

            {/* Rows */}
            {filtered.map(order => {
              const cfg   = STATUS_CFG[order.status];
              const total = (order as any)._raw?.totalAmountMinorUnits;
              const qty   = order.items.reduce((s, i) => s + i.qty, 0);
              return (
                <div key={order.id}
                  style={{ display: 'grid', gridTemplateColumns: '100px 70px 1fr 110px 110px 120px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.bg}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

                  <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: C.red, margin: 0 }}>{order.id}</p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Users size={11} color={C.subtle} />
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{order.table}</span>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(' · ')}
                    </p>
                    <p style={{ fontSize: 10, color: C.subtle, margin: '2px 0 0' }}>
                      {qty} item{qty !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>
                    <Clock size={11} color={C.subtle} />
                    {order.placedAt}
                  </div>

                  <p style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: 'Georgia, serif', margin: 0 }}>
                    {total ? `Rs ${(total / 100).toFixed(0)}` : '—'}
                  </p>

                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  </span>
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: `1.5px solid ${C.border}`, background: C.bg }}>
              <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>
                Showing {filtered.length} of {orders.length} orders{search && ` · filtered by "${search}"`}
              </p>
              <p style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'monospace', margin: 0 }}>Source: AWS API Gateway</p>
            </div>
          </div>
        )}
      </div>

      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}