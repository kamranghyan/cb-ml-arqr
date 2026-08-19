'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, CheckCircle, ChefHat, Bell, Bike } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';
import { ApiMenuItem, fetchMenuItems, normaliseItem } from '@/lib/menu-api';
import Image from 'next/image';
import GuestTopBar from '@/components/guest/GuestTopBar';

const BRAND = '#ff5723';

interface LineItem {
  name: string;
  itemId: string;
  quantity: number;
  unitPriceMinorUnits: number;
  totalPriceMinorUnits: number;
  imageUrl?: string;
  prepTime?: number;
}
interface ApiOrder { 
  orderId: string; 
  status: string; 
  tableId?: string; 
  lineItems: LineItem[]; 
  placedAt?: string; 
  totalAmountMinorUnits?: number;
  prepTime?: string;
  estimatedTime?: string;
  orderType?: string; 
}

const STATUS_STEPS = [
  { key: 'RECEIVED', label: 'Order Confirmed', icon: CheckCircle, desc: '9:41 AM · Payment successful' },
  { key: 'PREPARING', label: 'Preparing Your Order', icon: ChefHat, desc: 'Barista is brewing now…' },
  { key: 'READY', label: 'Ready for Pickup', icon: Bell, desc: "You'll be notified" },
  { key: 'DELIVERED', label: 'Enjoy & Review', icon: Bike, desc: 'Rate your experience' },
];
const STATUS_RANK: Record<string, number> = { 'RECEIVED': 0, 'PENDING': 0, 'PREPARING': 1, 'IN_PROGRESS': 1, 'KITCHEN_ACCEPTED': 1, 'READY': 2, 'READY_TO_SERVE': 2, 'FOOD_READY': 2, 'DELIVERED': 3, 'COMPLETED': 3 };

function getStepIndex(status: string): number {
  const s = (status ?? '').toUpperCase();
  if (['RECEIVED', 'PENDING'].includes(s)) return 0;
  if (['PREPARING', 'IN_PROGRESS', 'KITCHEN_ACCEPTED'].includes(s)) return 1;
  if (['READY', 'READY_TO_SERVE', 'FOOD_READY'].includes(s)) return 2;
  if (['DELIVERED', 'COMPLETED'].includes(s)) return 3;
  return 0;
}
function formatTime(iso?: string) { if (!iso) return '—'; return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
function formatRs(minor?: number) { if (!minor) return 'Rs 0'; return 'Rs ' + (minor / 100).toLocaleString('en-PK'); }

const POLL_MS = 5000;

export default function TrackingPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [menuItems, setMenuItems] = useState<ApiMenuItem[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState('');
  const [sessionTid, setSessionTid] = useState('');
  const [sessionTable, setSessionTable] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [prepTime, setPrepTime] = useState('20-30 mins');

  useEffect(() => {
    const loadMenuImages = async () => {
      try {
        const { restaurantId } = getGuestScope();
        const rawItems = await fetchMenuItems(restaurantId);
        const normalisedItems = rawItems.map(normaliseItem);
        setMenuItems(normalisedItems);
      } catch (error) {
        console.error('Failed to load menu images:', error);
      }
    };
    loadMenuImages();
  }, []);

  useEffect(() => {
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }
    setSessionTid(sessionStorage.getItem('lm_tid') ?? '');
    setSessionTable(sessionStorage.getItem('lm_table') ?? '');
    
    console.log('📌 SESSION DATA:', {
      sessionTid: sessionStorage.getItem('lm_tid'),
      sessionTable: sessionStorage.getItem('lm_table')
    });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { restaurantId } = getGuestScope();
      console.log('🔍 Fetching orders for restaurant:', restaurantId);
      
      // ✅ FIX: Use URL object to prevent duplicate query parameters
      const url = new URL('/api/orders', window.location.origin);
      url.searchParams.set('rid', restaurantId);
      
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      
      const data = await res.json();
      console.log('✅ API RAW RESPONSE:', data);
      
      const all = (data.orders ?? []).sort((a: ApiOrder, b: ApiOrder) =>
        new Date(b.placedAt ?? 0).getTime() - new Date(a.placedAt ?? 0).getTime()
      );
      
      console.log('📦 Total Orders in API:', all.length);
      
      if (all.length > 0) {
        const latestOrder = all[0];
        if (latestOrder.prepTime) {
          setPrepTime(latestOrder.prepTime);
        } else if (latestOrder.estimatedTime) {
          setPrepTime(latestOrder.estimatedTime);
        } else if (latestOrder.lineItems && latestOrder.lineItems.length > 0) {
          const prepTimes = latestOrder.lineItems
            .map((item: LineItem) => item.prepTime || 0)
            .filter((t: number) => t > 0);
          if (prepTimes.length > 0) {
            const maxPrep = Math.max(...prepTimes);
            setPrepTime(`${maxPrep}-${maxPrep + 5} mins`);
          }
        }
      }
      
      setOrders(prev => {
        const prevMap = new Map(prev.map(o => [o.orderId, o]));
        return all.map((o: ApiOrder) => {
          const ex = prevMap.get(o.orderId);
          if (!ex) return o;
          const er = STATUS_RANK[(ex.status ?? '').toUpperCase()] ?? -1;
          const fr = STATUS_RANK[(o.status ?? '').toUpperCase()] ?? -1;
          const isFinal = ['TIMED_OUT', 'CANCELLED'].includes((o.status ?? '').toUpperCase());
          return { ...o, status: (!isFinal && er > fr) ? ex.status : o.status };
        });
      });
      setLastSync(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
      setError('');
    } catch (e: any) { 
      console.error('❌ API ERROR:', e);
      setError(e?.message ?? 'Failed'); 
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(() => load(true), POLL_MS); return () => clearInterval(id); }, [load]);

  // ✅ FIX: MATCH UUID TABLE ID WITH SESSION SHORT ID
  const myOrders = orders.filter(o => {
    if (!o.tableId) return false;
    
    const orderTable = o.tableId.toString().trim().toLowerCase();
    const sessionT = sessionTid.trim().toLowerCase();
    const sessionTableRaw = sessionTable.trim().toLowerCase();

    console.log(`🔎 Comparing: OrderTable="${orderTable}" | SessionTid="${sessionT}" | SessionTable="${sessionTableRaw}"`);

    // 1. Direct match
    if (orderTable === sessionT) return true;

    // 2. If sessionT contains "table-01" and orderTable is UUID, we cannot match directly
    // We need to match based on sessionTableRaw
    if (sessionTableRaw) {
      // Check if orderTable ends with the sessionTable number
      const sessionNumber = sessionTableRaw.replace(/[^0-9]/g, '');
      if (sessionNumber && orderTable.endsWith(sessionNumber)) {
        return true;
      }
    }

    // 3. Fallback: Extract number from sessionT and check if orderTable ends with it
    const sessionNumberFromTid = sessionT.replace(/[^0-9]/g, '');
    if (sessionNumberFromTid && orderTable.endsWith(sessionNumberFromTid)) {
      return true;
    }

    return false;
  });

  console.log('🟢 myOrders count:', myOrders.length);
  console.log('🟡 All Orders count:', orders.length);

  // ✅ FALLBACK: Agar myOrders empty hai toh saare orders show karo (Debugging ke liye)
  const displayOrders = myOrders.length > 0 ? myOrders : orders;
  
  const activeOrders = displayOrders.filter(o => !['TIMED_OUT', 'CANCELLED'].includes((o.status ?? '').toUpperCase()));
  const latest = (activeOrders.length > 0 ? activeOrders : displayOrders)[0];
  
  const getItemImage = (itemId: string) => {
    const menuItem = menuItems.find(item => item.id === itemId);
    return (menuItem as any)?.imageUrl ?? '';
  };
  const currentStep = latest ? getStepIndex(latest.status) : 0;
  const isCancelled = ['TIMED_OUT', 'CANCELLED'].includes((latest?.status ?? '').toUpperCase());

  const getRemainingTime = () => {
    if (isCancelled) return 'Please contact staff';
    if (!prepTime) return 'Ready in approx. 20-30 minutes';
    const match = prepTime.match(/(\d+)/);
    if (!match) return `Ready in approx. ${prepTime}`;
    const totalPrep = parseInt(match[1]);
    const remaining = Math.max(0, totalPrep - (currentStep * 5));
    const range = `${remaining}-${remaining + 5}`;
    return `Ready in approx. ${range} minutes`;
  };

  const cancelOrder = async () => {
    if (!latest) return;
    setCancelling(true); setCancelError('');
    try {
      const apiId = (latest as any)._apiId ?? latest.orderId;
      const { restaurantId: rid } = getGuestScope();
      const res = await fetch(`/api/orders/${apiId}?rid=${rid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: getGuestScope().restaurantId,
          orderId: apiId,
          cancelled: true,
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
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', sub: '#9CA3AF',
  };

  const progressPct = latest ? (currentStep / (STATUS_STEPS.length - 1)) * 100 : 0;

  return (
    <div style={{
      minHeight: '100dvh',
      background: D.bg,
      fontFamily: "'Poppins', sans-serif",
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background 0.25s',
    }}>
      <GuestTopBar />

      {/* ── Cancel Modal ── */}
      {showCancel && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'flex-end',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            margin: '0 auto',
            background: D.card,
            borderRadius: '24px 24px 0 0',
            padding: '28px 24px 40px',
            fontFamily: "'Poppins', sans-serif",
          }}>
            <h3 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 19,
              fontWeight: 700,
              color: D.text,
              margin: '0 0 8px',
              textAlign: 'center'
            }}>Cancel Order?</h3>
            <p style={{
              fontSize: 13,
              color: D.muted,
              margin: '0 0 24px',
              textAlign: 'center',
              fontFamily: "'Poppins', sans-serif",
            }}>This action cannot be undone. Please contact staff if needed.</p>
            {cancelError && (
              <p style={{
                fontSize: 12,
                color: BRAND,
                textAlign: 'center',
                margin: '0 0 12px',
                fontFamily: "'Poppins', sans-serif",
              }}>{cancelError}</p>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setShowCancel(false); setCancelError(''); }}
                disabled={cancelling}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 24,
                  background: D.card2,
                  border: `1.5px solid ${D.border}`,
                  color: D.muted,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                  e.currentTarget.style.borderColor = BRAND;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = D.border;
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = D.card2;
                }}
              >
                Keep Order
              </button>
              <button
                onClick={cancelOrder}
                disabled={cancelling}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 24,
                  background: BRAND,
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: "'Poppins', sans-serif",
                  opacity: cancelling ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  if (!cancelling) {
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,87,35,0.3)';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  if (!cancelling) {
                    e.currentTarget.style.background = '#e64a1a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!cancelling) {
                    e.currentTarget.style.background = BRAND;
                  }
                }}
              >
                {cancelling
                  ? <><div style={{ width: 16, height: 16, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Cancelling…</>
                  : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding: '35px 20px 16px', background: D.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: D.card,
              border: `1.5px solid ${D.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = D.card;
            }}
          >
            <ArrowLeft size={18} color={D.text} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: D.text,
              margin: 0
            }}>Order Tracking</h1>
            {latest && <p style={{
              fontSize: 11,
              color: D.muted,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}>Order #{latest.orderId.slice(0, 8).toUpperCase()}</p>}
          </div>
          <button
            onClick={() => load()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: D.card,
              border: `1.5px solid ${D.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = D.card;
            }}
          >
            <RefreshCw size={16} color={D.muted} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `0 20px ${latest && !isCancelled ? 180 : 100}px` }}>

        {/* ── Loading ── */}
        {loading && orders.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${BRAND}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{
              color: D.muted,
              fontSize: 14,
              fontFamily: "'Poppins', sans-serif",
            }}>Fetching your orders…</p>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{ fontSize: 40, opacity: 0.2 }}>📋</span>
            <p style={{
              color: D.muted,
              fontSize: 14,
              marginTop: 12,
              fontFamily: "'Poppins', sans-serif",
            }}>No orders yet</p>
            <button
              onClick={() => router.push('/guest/menu')}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                borderRadius: 24,
                background: BRAND,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,87,35,0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e64a1a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = BRAND;
              }}
            >
              Browse Menu
            </button>
          </div>
        )}

        {latest && !loading && (
          <>
            {/* ── Hero status card ── */}
            <div style={{
              background: D.card,
              border: `1.5px solid ${D.border}`,
              borderRadius: 24,
              padding: '28px 20px',
              marginBottom: 16,
              textAlign: 'center'
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: isCancelled ? '#FFF0F0' : isDark ? 'rgba(255,87,35,0.12)' : '#ffbca7',
                border: `3px solid ${isCancelled ? '#FFD0D0' : BRAND}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                margin: '0 auto 16px'
              }}>
                {(() => { const Icon = STATUS_STEPS[currentStep]?.icon; return isCancelled ? '❌' : Icon ? <Icon size={36} color={BRAND} /> : <span>🍽️</span>; })()}
              </div>
              <h2 style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 21,
                fontWeight: 700,
                color: D.text,
                margin: '0 0 4px'
              }}>
                {isCancelled ? 'Order Cancelled' : STATUS_STEPS[currentStep]?.label ?? 'Processing…'}
              </h2>
              
              {/* ✅ Dynamic prep time display */}
              <p style={{
                fontSize: 13,
                color: D.muted,
                margin: '0 0 20px',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {getRemainingTime()}
              </p>

              {/* Progress bar */}
              {!isCancelled && (
                <div style={{ height: 6, background: D.card2, borderRadius: 3, overflow: 'hidden', margin: '0 8px' }}>
                  <div style={{ height: '100%', background: BRAND, borderRadius: 3, width: `${progressPct}%`, transition: 'width 1s ease' }} />
                </div>
              )}
            </div>

            {/* ── Status steps ── */}
            {!isCancelled && (
              <div style={{
                background: D.card,
                border: `1.5px solid ${D.border}`,
                borderRadius: 20,
                padding: '20px',
                marginBottom: 16
              }}>
                {STATUS_STEPS.map((step, i) => {
                  const done = i < currentStep;
                  const current = i === currentStep;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      marginBottom: i < STATUS_STEPS.length - 1 ? 20 : 0,
                      position: 'relative'
                    }}>
                      {i < STATUS_STEPS.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: 19,
                          top: 40,
                          width: 2,
                          height: 20,
                          background: done ? BRAND : D.border
                        }} />
                      )}
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        flexShrink: 0,
                        border: `2px solid ${done || current ? BRAND : D.border}`,
                        background: done ? BRAND : current ? isDark ? 'rgba(255,87,35,0.12)' : '#ffe4d8' : D.card2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.5s'
                      }}>
                        {done ? <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>✓</span> : <Icon size={16} color={current ? BRAND : D.sub} />}
                      </div>
                      <div style={{ flex: 1, paddingTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            color: done || current ? D.text : D.sub,
                            margin: 0
                          }}>{step.label}</p>
                          {current && <span style={{
                            fontSize: 9,
                            background: BRAND,
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: 20,
                            fontWeight: 700,
                            fontFamily: "'Poppins', sans-serif",
                          }}>Live</span>}
                        </div>
                        <p style={{
                          fontSize: 12,
                          color: D.muted,
                          margin: '2px 0 0',
                          fontFamily: "'Poppins', sans-serif",
                        }}>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Items ordered ── */}
            <div style={{
              background: D.card,
              border: `1.5px solid ${D.border}`,
              borderRadius: 20,
              padding: '16px 20px',
              marginBottom: 16
            }}>
              <p style={{
                fontSize: 12,
                fontWeight: 700,
                color: D.sub,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                margin: '0 0 12px',
                fontFamily: "'Poppins', sans-serif",
              }}>Items Ordered</p>
              {(latest.lineItems ?? []).map((li, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: i < (latest.lineItems?.length ?? 0) - 1 ? `1px solid ${D.border}` : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        background: D.card2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {getItemImage(li.itemId) ? (
                        <Image
                          src={getItemImage(li.itemId)}
                          alt={li.name}
                          width={48}
                          height={48}
                          unoptimized
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        '🍽️'
                      )}
                    </div>
                    <div>
                      <p style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 14,
                        fontWeight: 600,
                        color: D.text,
                        margin: 0
                      }}>{li.name}</p>
                      <p style={{
                        fontSize: 11,
                        color: D.muted,
                        margin: 0,
                        fontFamily: "'Poppins', sans-serif",
                      }}>× {li.quantity}</p>
                    </div>
                  </div>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: BRAND
                  }}>{formatRs(li.totalPriceMinorUnits)}</span>
                </div>
              ))}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 12,
                marginTop: 4,
                borderTop: `1.5px solid ${D.border}`
              }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: D.text
                }}>Total</span>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: D.text
                }}>{formatRs(latest.totalAmountMinorUnits)}</span>
              </div>
            </div>

            {/* Sync info */}
            {lastSync && (
              <p style={{
                textAlign: 'center',
                fontSize: 11,
                color: D.sub,
                marginBottom: 16,
                fontFamily: "'Poppins', sans-serif",
              }}>Updated {lastSync} · Auto-refresh every 5s</p>
            )}
          </>
        )}
      </div>

      {/* ── Cancel button ── */}
      {latest && !isCancelled && (
        <div style={{
          position: 'fixed',
          bottom: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          padding: '0 20px',
          boxSizing: 'border-box',
          zIndex: 99
        }}>
          <button
            onClick={() => setShowCancel(true)}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 25,
              background: D.card,
              border: `1.5px solid ${D.border}`,
              color: D.muted,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
              marginBottom: "10px"

            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = D.border;
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
              e.currentTarget.style.borderColor = BRAND;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = D.card;
              e.currentTarget.style.borderColor = D.border;
            }}
          >
            Cancel Order
          </button>
        </div>
      )}

      <BottomNav />
      <style>{`
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}