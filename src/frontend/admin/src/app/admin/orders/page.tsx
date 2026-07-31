'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Wifi, WifiOff, ChevronRight, Clock, Users } from 'lucide-react';
import { fetchOrders, patchOrderStatus, normaliseOrder, toKdsStatus, WS_URL } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';

const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing', preparing: 'ready', ready: 'delivered', delivered: null,
};

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

const STATUS_CFG: Record<KdsStatus, { label: string; dot: string; bg: string; color: string; border: string }> = {
  new:       { label: 'New',       dot: '#f97316', bg: '#FFF3E0', color: '#c2410c', border: '#FED7AA' },
  preparing: { label: 'Preparing', dot: '#3b82f6', bg: '#EFF6FF', color: '#1d4ed8', border: '#BFDBFE' },
  ready:     { label: 'Ready',     dot: '#22c55e', bg: '#F0FFF4', color: '#16a34a', border: '#BBF7D0' },
  delivered: { label: 'Delivered', dot: '#a855f7', bg: '#FAF5FF', color: '#7c3aed', border: '#DDD6FE' },
};

const ACTION_CFG: Record<KdsStatus, { label: string; bg: string; color: string; border: string } | null> = {
  new:       { label: '✓ Accept & Prepare', bg: '#EFF6FF', color: '#1d4ed8', border: '#BFDBFE' },
  preparing: { label: '🔔 Mark Ready',      bg: '#F0FFF4', color: '#16a34a', border: '#BBF7D0' },
  ready:     { label: '✓ Mark Delivered',   bg: '#FAF5FF', color: '#7c3aed', border: '#DDD6FE' },
  delivered: null,
};

const STAT_COLORS: Record<KdsStatus, string> = {
  new: '#f97316', preparing: '#3b82f6', ready: '#22c55e', delivered: '#a855f7',
};

export default function AdminOrdersPage() {
  const [orders,    setOrders]    = useState<(KdsOrder & { _apiId: string })[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filter,    setFilter]    = useState<'all' | KdsStatus>('all');
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [wsState,   setWsState]   = useState<'connecting'|'connected'|'disconnected'>('disconnected');
  const wsRef      = useRef<WebSocket | null>(null);
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try { const data = await fetchOrders(); setOrders(data); }
    catch (e: any) { setError(e?.message ?? 'Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(() => load(true), 15000); return () => clearInterval(id); }, [load]);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsState('connecting');
    const ws = new WebSocket(WS_URL); wsRef.current = ws;
    ws.onopen = () => { setWsState('connected'); ws.send(JSON.stringify({ action: 'subscribe', channel: 'orders' })); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data); const orderId = msg.orderId ?? msg.order_id;
        if (orderId && msg.flags) { const kdsStatus = toKdsStatus('', msg.flags); setOrders(prev => prev.map(o => (o as any)._apiId === orderId ? { ...o, status: kdsStatus } : o)); }
        else if (msg.lineItems) { setOrders(prev => [normaliseOrder(msg) as any, ...prev]); }
      } catch {}
    };
    ws.onerror = () => setWsState('disconnected');
    ws.onclose = () => { setWsState('disconnected'); wsRetryRef.current = setTimeout(connectWs, 5000); };
  }, []);

  useEffect(() => { connectWs(); return () => { wsRetryRef.current && clearTimeout(wsRetryRef.current); wsRef.current?.close(); }; }, [connectWs]);

  const advance = async (order: KdsOrder & { _apiId: string }) => {
    const next = STATUS_NEXT[order.status]; if (!next) return;
    setAdvancing(order.id); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
    try { await patchOrderStatus(order._apiId, next); }
    catch { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o)); }
    finally { setAdvancing(null); }
  };

  const displayed = orders.filter(o => filter === 'all' ? o.status !== 'delivered' : o.status === filter);
  const counts = { new: orders.filter(o => o.status === 'new').length, preparing: orders.filter(o => o.status === 'preparing').length, ready: orders.filter(o => o.status === 'ready').length, delivered: orders.filter(o => o.status === 'delivered').length };

  const wsColor = wsState === 'connected' ? { bg: '#F0FFF4', border: '#BBF7D0', color: '#16a34a' }
                : wsState === 'connecting' ? { bg: '#FFFBEB', border: '#FDE68A', color: '#d97706' }
                :                            { bg: '#FFF0F0', border: '#FFD0D0', color: C.red };

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: C.white, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>Kitchen Orders</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Live orders · {orders.length} total</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* WS status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: wsColor.bg, border: `1px solid ${wsColor.border}` }}>
            {wsState === 'connected' ? <Wifi size={11} color={wsColor.color} /> : <WifiOff size={11} color={wsColor.color} />}
            <span style={{ fontSize: 11, fontWeight: 700, color: wsColor.color, letterSpacing: 1, textTransform: 'uppercase' }}>
              WS {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '…' : 'Off'}
            </span>
            {wsState === 'connected' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />}
          </div>
          <button onClick={() => load()} title="Refresh"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} color={C.dark} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {(['new','preparing','ready','delivered'] as KdsStatus[]).map(s => {
            const cfg = STATUS_CFG[s];
            return (
              <div key={s} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                  <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{cfg.label}</p>
                </div>
                <p style={{ fontSize: 28, fontWeight: 800, color: STAT_COLORS[s], fontFamily: 'Georgia, serif', margin: 0, lineHeight: 1 }}>{counts[s]}</p>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 4, width: 'fit-content' }}>
          {[
            { key: 'all',       label: 'Active Orders' },
            { key: 'new',       label: '🟠 New'        },
            { key: 'preparing', label: '🔵 Preparing'  },
            { key: 'ready',     label: '🟢 Ready'      },
            { key: 'delivered', label: '✓ Delivered'   },
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
            <button onClick={() => load()} style={{ padding: '6px 14px', borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && orders.length === 0 && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0E8E0', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 10, width: '33%', background: '#F0E8E0', borderRadius: 6 }} />
                  <div style={{ height: 8, width: '50%', background: '#F0E8E0', borderRadius: 6 }} />
                </div>
                <div style={{ height: 32, width: 110, background: '#F0E8E0', borderRadius: 10 }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && displayed.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, border: `2px dashed ${C.border}`, borderRadius: 20, background: C.white }}>
            <span style={{ fontSize: 36, opacity: 0.2 }}>✓</span>
            <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>No orders in this category</p>
          </div>
        )}

        {/* Orders table */}
        {displayed.length > 0 && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(137,28,28,0.05)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 70px 1fr 100px 120px 150px', gap: 12, padding: '10px 20px', borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
              {['Order ID', 'Table', 'Items', 'Total', 'Status', 'Action'].map(h => (
                <p key={h} style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>

            {/* Rows */}
            {displayed.map(order => {
              const cfg    = STATUS_CFG[order.status];
              const action = ACTION_CFG[order.status];
              const total  = (order as any)._raw?.totalAmountMinorUnits;
              return (
                <div key={order.id}
                  style={{ display: 'grid', gridTemplateColumns: '90px 70px 1fr 100px 120px 150px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.bg}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

                  <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: C.red, margin: 0 }}>{order.id}</p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Users size={11} color={C.subtle} />
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{order.table}</span>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: C.text, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(' · ')}
                    </p>
                    <p style={{ fontSize: 10, color: C.subtle, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={9} /> {order.placedAt}
                    </p>
                  </div>

                  <p style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: 'Georgia, serif', margin: 0 }}>
                    {total ? `Rs ${(total / 100).toFixed(0)}` : '—'}
                  </p>

                  {/* Status chip */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  </span>

                  {/* Action button */}
                  {action ? (
                    <button onClick={() => advance(order)} disabled={advancing === order.id}
                      style={{ height: 32, padding: '0 12px', borderRadius: 10, background: action.bg, border: `1.5px solid ${action.border}`, color: action.color, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', opacity: advancing === order.id ? 0.5 : 1, transition: 'all 0.2s' }}>
                      {advancing === order.id
                        ? <div style={{ width: 12, height: 12, border: `2px solid ${action.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        : <>{action.label} <ChevronRight size={11} /></>}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: C.subtle }}>—</span>
                  )}
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: `1.5px solid ${C.border}`, background: C.bg }}>
              <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>Showing {displayed.length} of {orders.length} orders</p>
              <p style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'monospace', margin: 0 }}>Live · AWS API Gateway</p>
            </div>
          </div>
        )}
      </div>

      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}