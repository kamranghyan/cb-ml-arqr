'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, CheckCircle, ChefHat, Bell, Bike, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface LineItem { name: string; itemId: string; quantity: number; unitPriceMinorUnits: number; totalPriceMinorUnits: number; }
interface ApiOrder { orderId: string; status: string; tableId?: string; lineItems: LineItem[]; placedAt?: string; totalAmountMinorUnits?: number; }

const STATUS_STEPS = [
  { key: 'RECEIVED',  label: 'Order Confirmed',      icon: CheckCircle, desc: '9:41 AM · Payment successful'   },
  { key: 'PREPARING', label: 'Preparing Your Order',  icon: ChefHat,     desc: 'Barista is brewing now…'        },
  { key: 'READY',     label: 'Ready for Pickup',      icon: Bell,        desc: "You'll be notified"              },
  { key: 'DELIVERED', label: 'Enjoy & Review',        icon: Bike,        desc: 'Rate your experience'            },
];
const STATUS_RANK: Record<string, number> = { 'RECEIVED':0,'PENDING':0,'PREPARING':1,'IN_PROGRESS':1,'KITCHEN_ACCEPTED':1,'READY':2,'READY_TO_SERVE':2,'FOOD_READY':2,'DELIVERED':3,'COMPLETED':3 };

function getStepIndex(status: string): number {
  const s = (status ?? '').toUpperCase();
  if (['RECEIVED','PENDING'].includes(s)) return 0;
  if (['PREPARING','IN_PROGRESS','KITCHEN_ACCEPTED'].includes(s)) return 1;
  if (['READY','READY_TO_SERVE','FOOD_READY'].includes(s)) return 2;
  if (['DELIVERED','COMPLETED'].includes(s)) return 3;
  return 0;
}
function formatTime(iso?: string) { if (!iso) return '—'; return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
function formatRs(minor?: number) { if (!minor) return 'Rs 0'; return 'Rs ' + (minor / 100).toLocaleString('en-PK'); }

const POLL_MS = 5000;

export default function TrackingPage() {
  const router     = useRouter();
  const { isDark } = useTheme();

  const [orders,       setOrders]       = useState<ApiOrder[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [lastSync,     setLastSync]     = useState('');
  const [sessionTid,   setSessionTid]   = useState('');
  const [sessionTable, setSessionTable] = useState('');
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState('');

  useEffect(() => {
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }
    setSessionTid(sessionStorage.getItem('lm_tid') ?? '');
    setSessionTable(sessionStorage.getItem('lm_table') ?? '');
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const all  = (data.orders ?? []).sort((a: ApiOrder, b: ApiOrder) =>
        new Date(b.placedAt ?? 0).getTime() - new Date(a.placedAt ?? 0).getTime()
      );
      setOrders(prev => {
        const prevMap = new Map(prev.map(o => [o.orderId, o]));
        return all.map((o: ApiOrder) => {
          const ex = prevMap.get(o.orderId);
          if (!ex) return o;
          const er = STATUS_RANK[(ex.status ?? '').toUpperCase()] ?? -1;
          const fr = STATUS_RANK[(o.status ?? '').toUpperCase()] ?? -1;
          const isFinal = ['TIMED_OUT','CANCELLED'].includes((o.status??'').toUpperCase());
          return { ...o, status: (!isFinal && er > fr) ? ex.status : o.status };
        });
      });
      setLastSync(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
      setError('');
    } catch (e: any) { setError(e?.message ?? 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(() => load(true), POLL_MS); return () => clearInterval(id); }, [load]);

  const myOrders = orders.filter(o => { const t = (o.tableId ?? '').toLowerCase(); return t === sessionTid.toLowerCase() || t.includes(sessionTable) || (sessionTable && t.endsWith(sessionTable.padStart(2,'0'))); });
  const displayOrders = myOrders.length > 0 ? myOrders : orders;
  const activeOrders  = displayOrders.filter(o => !['TIMED_OUT','CANCELLED'].includes((o.status ?? '').toUpperCase()));
  const latest        = (activeOrders.length > 0 ? activeOrders : displayOrders)[0];
  const currentStep   = latest ? getStepIndex(latest.status) : 0;
  const isCancelled   = ['TIMED_OUT','CANCELLED'].includes((latest?.status ?? '').toUpperCase());

  const cancelOrder = async () => {
    if (!latest) return;
    setCancelling(true); setCancelError('');
    try {
      const apiId = (latest as any)._apiId ?? latest.orderId;
      const res = await fetch(`/api/orders/${apiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId:     process.env.NEXT_PUBLIC_TENANT_ID_KDS,
          restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID_KDS,
          orderId:      apiId,
          cancelled:    true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `Error ${res.status}`);
      }
      setShowCancel(false);
      router.push('/guest');
    } catch (err: any) {
      setCancelError(err?.message ?? 'Failed to cancel order');
      setCancelling(false);
    }
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280',
  } : {
    bg: '#FFF8F1', card: '#FFFFFF', card2: '#F5F0EA', border: '#F0E8E0',
    text: '#1A1A1A', muted: '#687780', sub: '#9CA3AF',
  };

  // Progress bar %
  const progressPct = latest ? (currentStep / (STATUS_STEPS.length - 1)) * 100 : 0;

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Cancel modal overlay */}
      {showCancel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: D.card, borderRadius: '24px 24px 0 0', padding: '28px 24px 40px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: D.text, margin: '0 0 8px', textAlign: 'center' }}>Cancel Order?</h3>
            <p style={{ fontSize: 13, color: D.muted, margin: '0 0 24px', textAlign: 'center' }}>This action cannot be undone. Please contact staff if needed.</p>
            {cancelError && (
              <p style={{ fontSize: 12, color: '#E1251B', textAlign: 'center', margin: '0 0 12px' }}>{cancelError}</p>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setShowCancel(false); setCancelError(''); }}
                disabled={cancelling}
                style={{ flex: 1, height: 48, borderRadius: 24, background: D.card2, border: `1.5px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Keep Order
              </button>
              <button onClick={cancelOrder} disabled={cancelling}
                style={{ flex: 1, height: 48, borderRadius: 24, background: '#E1251B', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: cancelling ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: cancelling ? 0.7 : 1 }}>
                {cancelling
                  ? <><div style={{ width: 16, height: 16, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Cancelling…</>
                  : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '52px 20px 16px', background: D.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: D.card, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={18} color={D.text} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: D.text, margin: 0 }}>Order Tracking</h1>
            {latest && <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>Order #{latest.orderId.slice(0,8).toUpperCase()}</p>}
          </div>
          <button onClick={() => load()} style={{ width: 40, height: 40, borderRadius: 12, background: D.card, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={16} color={D.muted} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>

        {/* Loading */}
        {loading && orders.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
            <div style={{ width: 28, height: 28, border: '3px solid #E1251B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: D.muted, fontSize: 14 }}>Fetching your orders…</p>
          </div>
        )}

        {/* Empty */}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{ fontSize: 40, opacity: 0.2 }}>📋</span>
            <p style={{ color: D.muted, fontSize: 14, marginTop: 12 }}>No orders yet</p>
            <button onClick={() => router.push('/guest/menu')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 24, background: '#E1251B', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Browse Menu
            </button>
          </div>
        )}

        {latest && !loading && (
          <>
            {/* ── Hero status card ── */}
            <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 24, padding: '28px 20px', marginBottom: 16, textAlign: 'center' }}>
              {/* Icon */}
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: isCancelled ? '#FFF0F0' : 'linear-gradient(135deg,#FFF3E0,#FFF8F1)', border: `3px solid ${isCancelled ? '#FFD0D0' : '#FFC72C'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(255,199,44,0.2)' }}>
                {(() => { const Icon = STATUS_STEPS[currentStep]?.icon; return isCancelled ? '❌' : Icon ? <Icon size={36} color="#E1251B" /> : <span>🍽️</span>; })()}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: D.text, fontFamily: 'Georgia,serif', margin: '0 0 4px' }}>
                {isCancelled ? 'Order Cancelled' : STATUS_STEPS[currentStep]?.label ?? 'Processing…'}
              </h2>
              <p style={{ fontSize: 13, color: D.muted, margin: '0 0 20px' }}>
                {isCancelled ? 'Please contact staff' : `Ready in approx. ${8 - currentStep * 2} minutes`}
              </p>

              {/* Progress bar */}
              {!isCancelled && (
                <div style={{ height: 6, background: D.card2, borderRadius: 3, overflow: 'hidden', margin: '0 8px' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#891C1C,#E1251B)', borderRadius: 3, width: `${progressPct}%`, transition: 'width 1s ease' }} />
                </div>
              )}
            </div>

            {/* ── Status steps ── */}
            {!isCancelled && (
              <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 20, padding: '20px', marginBottom: 16 }}>
                {STATUS_STEPS.map((step, i) => {
                  const done    = i < currentStep;
                  const current = i === currentStep;
                  const Icon    = step.icon;
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: i < STATUS_STEPS.length - 1 ? 20 : 0, position: 'relative' }}>
                      {/* Connector line */}
                      {i < STATUS_STEPS.length - 1 && (
                        <div style={{ position: 'absolute', left: 19, top: 40, width: 2, height: 20, background: done ? '#E1251B' : D.border }} />
                      )}
                      {/* Icon circle */}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: `2px solid ${done || current ? '#E1251B' : D.border}`, background: done ? '#E1251B' : current ? '#FFF0EE' : D.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: current ? '0 0 16px rgba(225,37,27,0.3)' : 'none', transition: 'all 0.5s' }}>
                        {done ? <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>✓</span> : <Icon size={16} color={current ? '#E1251B' : D.sub} />}
                      </div>
                      <div style={{ flex: 1, paddingTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: done || current ? D.text : D.sub, margin: 0 }}>{step.label}</p>
                          {current && <span style={{ fontSize: 9, background: '#E1251B', color: '#fff', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>Live</span>}
                        </div>
                        <p style={{ fontSize: 12, color: D.muted, margin: '2px 0 0' }}>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Items ordered ── */}
            <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 20, padding: '16px 20px', marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: D.sub, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 12px' }}>Items Ordered</p>
              {(latest.lineItems ?? []).map((li, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < (latest.lineItems?.length ?? 0) - 1 ? `1px solid ${D.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: D.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🍽️</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: D.text, margin: 0 }}>{li.name}</p>
                      <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>× {li.quantity}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#E1251B' }}>{formatRs(li.totalPriceMinorUnits)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: `1.5px solid ${D.border}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: D.muted }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#891C1C', fontFamily: 'Georgia,serif' }}>{formatRs(latest.totalAmountMinorUnits)}</span>
              </div>
            </div>

            {/* Sync info */}
            {lastSync && <p style={{ textAlign: 'center', fontSize: 11, color: D.sub, marginBottom: 16 }}>Updated {lastSync} · Auto-refresh every 5s</p>}
          </>
        )}
      </div>

      {/* Cancel button */}
      {latest && !isCancelled && (
        <div style={{ padding: '14px 20px 32px', background: D.bg, borderTop: `1px solid ${D.border}` }}>
          <button onClick={() => setShowCancel(true)}
            style={{ width: '100%', height: 50, borderRadius: 25, background: D.card, border: `1.5px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Cancel Order
          </button>
        </div>
      )}

      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}