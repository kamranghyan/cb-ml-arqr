'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, QrCode, Users, RefreshCw, AlertCircle, TrendingUp, ShoppingBag, Table2, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface LineItem { name: string; itemId: string; quantity: number; unitPriceMinorUnits: number; totalPriceMinorUnits: number; }
interface ApiOrder { orderId: string; status: string; tableId?: string; lineItems: LineItem[]; placedAt?: string; updatedAt?: string; totalAmountMinorUnits?: number; currencyCode?: string; tenantId?: string; restaurantId?: string; }

function toKds(status: string): 'new' | 'preparing' | 'ready' | 'delivered' {
  const s = status.toUpperCase();
  if (s === 'RECEIVED' || s === 'PENDING')      return 'new';
  if (s === 'PREPARING' || s === 'IN_PROGRESS') return 'preparing';
  if (s === 'READY')                            return 'ready';
  return 'delivered';
}
function formatRs(minor: number)    { return 'Rs ' + (minor / 100).toLocaleString('en-PK'); }
function formatTime(iso?: string)   { if (!iso) return '—'; return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
function shortId(id: string)        { return `LM-${id.slice(0, 6).toUpperCase()}`; }
function tableNum(t?: string)       { if (!t) return '??'; const n = t.replace(/[^0-9]/g, ''); return n ? n.padStart(2, '0') : t; }

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

const STATUS_CHIP: Record<string, { bg: string; color: string; dot: string; border: string }> = {
  new:       { bg: '#FFF3E0', color: '#c2410c', dot: '#f97316', border: '#FED7AA' },
  preparing: { bg: '#EFF6FF', color: '#1d4ed8', dot: '#3b82f6', border: '#BFDBFE' },
  ready:     { bg: '#F0FFF4', color: '#16a34a', dot: '#22c55e', border: '#BBF7D0' },
  delivered: { bg: '#FAF5FF', color: '#7c3aed', dot: '#a855f7', border: '#DDD6FE' },
};

const QUICK_LINKS = [
  { href: '/admin/menu',  label: 'Menu Management', icon: BookOpen, desc: 'Edit items, categories & pricing'  },
  { href: '/admin/qr',    label: 'QR Codes',         icon: QrCode,  desc: 'Generate & manage table QR codes' },
  { href: '/admin/users', label: 'User Management',  icon: Users,   desc: 'Team members & access roles'      },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [orders,   setOrders]   = useState<ApiOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [lastSync, setLastSync] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setLastSync(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    } catch (err: any) { setError(err?.message ?? 'Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const totalRevenue  = orders.reduce((s, o) => s + (o.totalAmountMinorUnits ?? 0), 0);
  const activeOrders  = orders.filter(o => toKds(o.status) !== 'delivered');
  const delivering    = orders.filter(o => toKds(o.status) === 'delivered').length;
  const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const activeTables  = new Set(activeOrders.map(o => o.tableId).filter(Boolean)).size;
  const recentOrders  = [...orders].sort((a, b) => new Date(b.placedAt ?? 0).getTime() - new Date(a.placedAt ?? 0).getTime()).slice(0, 10);

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';
  const firstName = user?.displayName?.split(' ')[0] ?? 'Admin';

  const stats = [
    { label: 'Total Revenue',   val: loading ? null : formatRs(totalRevenue),      delta: `${orders.length} orders`,      icon: DollarSign,  accent: C.red     },
    { label: 'Active Orders',   val: loading ? null : String(activeOrders.length), delta: `${delivering} delivered`,      icon: ShoppingBag, accent: '#1d4ed8'  },
    { label: 'Active Tables',   val: loading ? null : String(activeTables),        delta: 'Tables with open orders',      icon: Table2,      accent: '#16a34a'  },
    { label: 'Avg Order Value', val: loading ? null : formatRs(avgOrderValue),     delta: `From ${orders.length} orders`, icon: TrendingUp,  accent: '#d97706'  },
  ];

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', background: C.white, borderBottom: `1.5px solid ${C.border}`, boxShadow: '0 1px 4px rgba(137,28,28,0.04)', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>
            Good {greeting},{' '}
            <span style={{ color: C.red }}>{firstName}</span>
          </h1>
          <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastSync && (
            <span style={{ fontSize: 11, color: C.subtle, background: '#FFF3E0', border: '1px solid #FED7AA', borderRadius: 20, padding: '4px 12px' }}>
              Synced {lastSync}
            </span>
          )}
          <button onClick={loadOrders} title="Refresh"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
            <RefreshCw size={14} color={C.dark} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#FFF0F0', border: '1.5px solid #FFD0D0', borderRadius: 14 }}>
            <AlertCircle size={16} color={C.red} style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: C.red, flex: 1, margin: 0 }}>{error}</p>
            <button onClick={loadOrders} style={{ fontSize: 12, color: C.red, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
          </div>
        )}

        {/* ── Stats grid ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '20px', boxShadow: '0 2px 8px rgba(137,28,28,0.05)', position: 'relative', overflow: 'hidden' }}>
                {/* Subtle warm glow */}
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${s.accent}15`, pointerEvents: 'none' }} />
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.accent}15`, border: `1.5px solid ${s.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon size={16} color={s.accent} />
                </div>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 26, width: 100, background: '#F0E8E0', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ height: 10, width: 70, background: '#F0E8E0', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 4px' }}>{s.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'Georgia, serif', margin: '0 0 4px', lineHeight: 1.2 }}>{s.val}</p>
                    <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>{s.delta}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Quick links ─────────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 12px' }}>Quick Access</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {QUICK_LINKS.map(ql => {
              const Icon = ql.icon;
              return (
                <Link key={ql.href} href={ql.href} style={{ textDecoration: 'none' }}>
                  <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '20px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                    onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = '#FED0CC'; d.style.boxShadow = '0 4px 20px rgba(225,37,27,0.1)'; d.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = C.border; d.style.boxShadow = 'none'; d.style.transform = 'none'; }}>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(225,37,27,0.05)', pointerEvents: 'none' }} />
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FFF0EE', border: '1.5px solid #FED0CC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <Icon size={20} color={C.red} />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{ql.label}</p>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{ql.desc}</p>
                    <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 18, color: '#FED0CC' }}>→</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Recent orders ───────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Recent Orders</p>
            <Link href="/kds" style={{ fontSize: 12, color: C.red, fontWeight: 700, textDecoration: 'none' }}>View KDS →</Link>
          </div>

          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(137,28,28,0.05)' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 80px 60px 120px 110px 80px', gap: 12, padding: '10px 20px', borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
              {['Order ID', 'Table', 'Items', 'Total', 'Status', 'Time'].map(h => (
                <p key={h} style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>

            {/* Loading skeletons */}
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 80px 60px 120px 110px 80px', gap: 12, padding: '14px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center' }}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} style={{ height: 10, background: '#F0E8E0', borderRadius: 6 }} />
                ))}
              </div>
            ))}

            {/* Empty */}
            {!loading && recentOrders.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
                <span style={{ fontSize: 32, opacity: 0.2 }}>📋</span>
                <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>No orders yet</p>
              </div>
            )}

            {/* Rows */}
            {!loading && recentOrders.map(order => {
              const kds  = toKds(order.status);
              const chip = STATUS_CHIP[kds];
              const cnt  = order.lineItems?.length ?? 0;
              return (
                <div key={order.orderId}
                  style={{ display: 'grid', gridTemplateColumns: '130px 80px 60px 120px 110px 80px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', transition: 'background 0.15s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.bg}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: C.red }}>{shortId(order.orderId)}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>Table {tableNum(order.tableId)}</span>
                  <span style={{ fontSize: 13, color: C.subtle }}>{cnt} item{cnt !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: 'Georgia, serif' }}>{formatRs(order.totalAmountMinorUnits ?? 0)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: chip.dot, display: 'inline-block' }} />
                    {kds}
                  </span>
                  <span style={{ fontSize: 12, color: C.subtle }}>{formatTime(order.placedAt)}</span>
                </div>
              );
            })}

            {/* Footer */}
            {!loading && orders.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: `1.5px solid ${C.border}`, background: C.bg }}>
                <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>Showing {recentOrders.length} of {orders.length} orders</p>
                <p style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'monospace', margin: 0 }}>Source: AWS API Gateway</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} } .animate-spin{animation:spin 0.8s linear infinite} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}