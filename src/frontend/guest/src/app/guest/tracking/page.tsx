// app/guest/tracking/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, CheckCircle, ChefHat, Bell, Bike, Plus, Minus, ThumbsUp, Sparkles } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { getGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';
import { ApiMenuItem, fetchMenuItems, normaliseItem } from '@/lib/menu-api';
import Image from 'next/image';
import GuestTopBar from '@/components/guest/GuestTopBar';
import OrderFeedbackShareModal from '@/components/guest/OrderFeedbackShareModal';
import { connectWebSocket } from '@/lib/orders';

const BRAND = '#ff5723';

interface LineItem {
  name: string;
  itemId: string;
  quantity: number;
  unitPriceMinorUnits: number;
  totalPriceMinorUnits: number;
  imageUrl?: string;
  prepTime?: number;
  addOns?: Array<{
    addOnId: string;
    name: string;
    quantity: number;
    priceMinorUnits: number;
  }>;
  addOnsTotalMinorUnits?: number;
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
  { key: 'RECEIVED', label: 'Order Confirmed', icon: CheckCircle, desc: 'Payment successful' },
  { key: 'PREPARING', label: 'Preparing Your Order', icon: ChefHat, desc: 'Chef is cooking your order…' },
  { key: 'READY', label: 'Ready for Pickup', icon: Bell, desc: "You'll be notified" },
  { key: 'DELIVERED', label: 'Enjoy & Review', icon: Bike, desc: 'Rate your experience' },
];

const STATUS_RANK: Record<string, number> = {
  'RECEIVED': 0, 'PENDING': 0,
  'PREPARING': 1, 'IN_PROGRESS': 1, 'KITCHEN_ACCEPTED': 1,
  'READY': 2, 'READY_TO_SERVE': 2, 'FOOD_READY': 2,
  'DELIVERED': 3, 'COMPLETED': 3
};

function getStepIndex(status: string): number {
  const s = (status ?? '').toUpperCase();
  if (['RECEIVED', 'PENDING'].includes(s)) return 0;
  if (['PREPARING', 'IN_PROGRESS', 'KITCHEN_ACCEPTED'].includes(s)) return 1;
  if (['READY', 'READY_TO_SERVE', 'FOOD_READY'].includes(s)) return 2;
  if (['DELIVERED', 'COMPLETED'].includes(s)) return 3;
  return 0;
}

function formatRs(minor?: number) {
  if (!minor) return 'Rs 0';
  return 'Rs ' + (minor / 100).toLocaleString('en-PK');
}


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
  const [cancelReason, setCancelReason] = useState('');
  const [prepTime, setPrepTime] = useState('20-30 mins');

  // ✅ New states for order completion
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);

  const isMounted = useRef(true);
  const isFirstLoad = useRef(true);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load menu images only once
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



  // Session check only once
  useEffect(() => {
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) {
      window.location.href = '/guest';
      return;
    }
    setSessionTid(sessionStorage.getItem('lm_tid') ?? '');
    setSessionTable(sessionStorage.getItem('lm_table') ?? '');
    sessionStorage.getItem('guestSessionId')
    console.log(
      'guestSessionId:',
      sessionStorage.getItem('guestSessionId')
    );
  }, []);


  const [redirectParams, setRedirectParams] = useState({
    restaurantId: '',
    tableId: '',
  });

  const loadOrders = async () => {
    setLoading(true);
    isFirstLoad.current = false;

    try {
      const { restaurantId } = getGuestScope();
      const url = new URL('/api/orders', window.location.origin);
      url.searchParams.set('rid', restaurantId);
      console.log("📡 Fetching orders from:", url.toString());

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const all = (data.orders ?? []).sort((a: ApiOrder, b: ApiOrder) =>
        new Date(b.placedAt ?? 0).getTime() - new Date(a.placedAt ?? 0).getTime()
      );

      if (all.length > 0) {
        const latestOrder = all[0];
        if (latestOrder.prepTime) {
          setPrepTime(latestOrder.prepTime);
        } else if (latestOrder.estimatedTime) {
          setPrepTime(latestOrder.estimatedTime);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    return () => {
      isMounted.current = false;

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Guest Orders WebSocket
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;

    try {
      ws = connectWebSocket();
      if (!ws) {
        console.error('❌ [Guest WS] Failed to create websocket connection');
        return;
      }

      wsRef.current = ws;
      const socket = ws;

      socket.onopen = () => {
        console.log('🟢 [Guest WS] Connected successfully');
      };

      socket.onmessage = (event) => {
        console.log('📩 [Guest WS] Message received:', event.data);

        try {
          const data = JSON.parse(event.data);

          console.log('📦 [Guest WS] Parsed update:', data);

          /*
           * Expected examples:
           *
           * {
           *   orderId: "...",
           *   status: "PREPARING"
           * }
           *
           * OR
           *
           * {
           *   type: "ORDER_STATUS_UPDATED",
           *   orderId: "...",
           *   status: "READY"
           * }
           */

          const updatedOrderId =
            data?.orderId ??
            data?.order?.orderId ??
            data?.order?.id;

          const updatedStatus =
            data?.status ??
            data?.order?.status;

          if (!updatedOrderId || !updatedStatus) {
            console.log(
              'ℹ️ [Guest WS] Message does not contain order status update'
            );
            return;
          }

          setOrders((prevOrders) =>
            prevOrders.map((order) => {
              if (order.orderId !== updatedOrderId) {
                return order;
              }

              console.log(
                `🔄 [Guest WS] Order ${updatedOrderId} status: ${order.status} → ${updatedStatus}`
              );

              return {
                ...order,
                status: updatedStatus,
              };
            })
          );
        } catch (error) {
          console.error(
            '❌ [Guest WS] Failed to parse message:',
            error
          );
        }
      };

      socket.onerror = (error) => {
        console.error('❌ [Guest WS] Connection error:', error);
      };

      socket.onclose = (event) => {
        console.log(
          '🔴 [Guest WS] Disconnected',
          {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          }
        );
      };
    } catch (error) {
      console.error(
        '❌ [Guest WS] Failed to connect:',
        error
      );
    }

    return () => {
      if (ws) {
        console.log('🔌 [Guest WS] Closing connection');

        ws.close();
        ws = null;
      }

      wsRef.current = null;
    };
  }, []);

  const myOrders = orders.filter(o => {
    if (!o.tableId) return false;
    const orderTableId = o.tableId.toString().trim().toLowerCase();
    const normalizedSessionTid = sessionTid.trim().toLowerCase();
    const sessionTableNum = sessionTable.trim().toLowerCase();

    if (orderTableId === normalizedSessionTid) return true;
    if (sessionTableNum) {
      const sessionNumber = sessionTableNum.replace(/[^0-9]/g, '');
      if (sessionNumber) {
        if (orderTableId.includes(sessionNumber)) return true;
        if (orderTableId.endsWith(sessionNumber)) return true;
      }
    }
    const sessionNumberFromTid = normalizedSessionTid.replace(/[^0-9]/g, '');
    if (sessionNumberFromTid && orderTableId.includes(sessionNumberFromTid)) {
      return true;
    }
    return false;
  });

  const displayOrders = myOrders.length > 0 ? myOrders : orders;
  const activeOrders = displayOrders.filter(o => !['TIMED_OUT', 'CANCELLED'].includes((o.status ?? '').toUpperCase()));
  const latest = (activeOrders.length > 0 ? activeOrders : displayOrders)[0];

  const getItemImage = (itemId: string) => {
    const menuItem = menuItems.find(item => item.id === itemId);
    return (menuItem as any)?.imageUrl ?? '';
  };
  const currentStep = latest ? getStepIndex(latest.status) : 0;
  const isCancelled = ['TIMED_OUT', 'CANCELLED'].includes((latest?.status ?? '').toUpperCase());
  const isAtDeliveredStep = latest ? getStepIndex(latest.status) === 3 : false;
  const isOrderAlreadyCompleted = latest ? ['COMPLETED', 'DONE'].includes((latest.status ?? '').toUpperCase()) : false;

  const getRemainingTime = () => {
    if (isCancelled) return 'Please contact staff';
    if (!prepTime) return 'Ready in approx. 20-30 minutes';
    const match = prepTime.match(/(\d+)/);
    if (!match) return `Ready in approx. ${prepTime}`;
    const totalPrep = parseInt(match[1]);
    const remaining = Math.max(0, totalPrep - (currentStep * 5));
    return `Ready in approx. ${remaining}-${remaining + 5} minutes`;
  };
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [receivedOrderId, setReceivedOrderId] = useState<string>();

  const cancelOrder = async () => {
    if (!latest) return;

    const reason = cancelReason.trim();

    if (!reason) {
      setCancelError('Please enter a reason for cancelling your order.');
      return;
    }

    setCancelling(true);
    setCancelError('');

    try {
      const apiId = (latest as any)._apiId ?? latest.orderId;
      const { restaurantId: rid } = getGuestScope();
      const guestSessionId = sessionStorage.getItem('guestSessionId') ?? '';

      if (!guestSessionId) {
        throw new Error('Guest session not found. Please rescan the QR code.');
      }

      const res = await fetch(`/api/orders/${apiId}?rid=${rid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantId: getGuestScope().restaurantId,
          orderId: apiId,
          guestSessionId,
          cancelled: true,
          cancellationReason: reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `Error ${res.status}`);
      }

      toast.success('Order cancelled successfully');

      setShowCancel(false);
      setCancelReason('');
      setCancelError('');

      router.push('/guest');
    } catch (err: any) {
      const message = err?.message ?? 'Failed to cancel order';

      setCancelError(message);
      toast.error(message);
      setCancelling(false);
    }
  };

  const handleOrderReceived = () => {
    setShowCompleteOverlay(true);

    redirectTimerRef.current = setTimeout(() => {
      setShowCompleteOverlay(false);
      setIsOrderCompleted(true);

      const restaurantId = sessionStorage.getItem('lm_rid') || '';
      const tableId = sessionStorage.getItem('lm_tid') || '';

      setRedirectParams({
        restaurantId,
        tableId,
      });

      const completedOrderId = latest?.orderId ?? (latest as any)?._apiId ?? '';
      setReceivedOrderId(completedOrderId);
      setShowFeedbackModal(true);

      sessionStorage.removeItem('lm_rid');
      sessionStorage.removeItem('lm_tid');
      sessionStorage.removeItem('lm_table');
    }, 3000);
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280',
    btnBg: '#22c55e', btnText: '#ffffff', btnHover: '#16a34a',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', sub: '#9CA3AF',
    btnBg: '#22c55e', btnText: '#ffffff', btnHover: '#16a34a',
  };

  const progressPct = latest ? (currentStep / (STATUS_STEPS.length - 1)) * 100 : 0;

  const itemsTotal = latest?.lineItems?.reduce((sum, li) => sum + (li.unitPriceMinorUnits || 0) * li.quantity, 0) || 0;
  const addOnsGrandTotal = latest?.lineItems?.reduce((sum, li) => sum + (li.addOnsTotalMinorUnits || 0), 0) || 0;

  const getItemTotalWithAddOns = (lineItem: LineItem) => {
    const baseTotal = (lineItem.unitPriceMinorUnits || 0) * lineItem.quantity;
    const addOnsTotal = lineItem.addOns?.reduce((sum, a) => sum + (a.priceMinorUnits || 0) * (a.quantity || 1), 0) || 0;
    return baseTotal + addOnsTotal;
  };

  const getAddOnDisplay = (addon: any) => {
    const qty = addon.quantity || 1;
    if (qty > 1) {
      return `${addon.name} ×${qty}`;
    }
    return addon.name;
  };

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

      {/* ✅ Order Complete Overlay */}
      {showCompleteOverlay && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.5s ease'
        }}>
          <div style={{
            background: D.card,
            borderRadius: 32,
            padding: '40px 32px',
            maxWidth: 360,
            width: '90%',
            textAlign: 'center',
            animation: 'scaleIn 0.5s ease'
          }}>
            {/* Animated checkmark */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: BRAND,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              animation: 'bounceIn 0.6s ease'
            }}>
              <CheckCircle size={40} color={D.btnText} />
            </div>

            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: D.text,
              margin: '0 0 8px'
            }}>
              Order Complete! 🎉
            </h2>
            <p style={{
              fontSize: 14,
              color: D.muted,
              margin: '0 0 4px'
            }}>
              Thank you for dining with us!
            </p>
            <p style={{
              fontSize: 13,
              color: D.sub,
              margin: '0'
            }}>
              Redirecting to home...
            </p>

            {/* Progress dots */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              marginTop: 20
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: BRAND,
                animation: 'pulse 1s ease infinite'
              }} />
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: BRAND,
                animation: 'pulse 1s ease 0.3s infinite'
              }} />
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: BRAND,
                animation: 'pulse 1s ease 0.6s infinite'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
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
          }}>
            <h3 style={{
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
            }}>This action cannot be undone. Please contact staff if needed.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);

                if (cancelError) {
                  setCancelError('');
                }
              }}
              placeholder="Please tell us why you want to cancel your order..."
              disabled={cancelling}
              rows={4}
              maxLength={500}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                resize: 'none',
                borderRadius: 14,
                border: `1.5px solid ${D.border}`,
                background: D.card2,
                color: D.text,
                padding: '13px 14px',
                fontSize: 13,
                fontFamily: "'Poppins', sans-serif",
                outline: 'none',
                marginBottom: 6,
              }}
            />

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 16,
            }}>
              <span style={{
                fontSize: 10,
                color: D.sub,
              }}>
                {cancelReason.length}/500
              </span>
            </div>
            {cancelError && (
              <p style={{
                fontSize: 12,
                color: BRAND,
                textAlign: 'center',
                margin: '0 0 12px',
              }}>{cancelError}</p>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowCancel(false);
                  setCancelError('');
                  setCancelReason('');
                }}
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
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
              >
                Keep Order
              </button>
              <button
                onClick={cancelOrder}
                disabled={cancelling || !cancelReason.trim()}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 24,
                  background: BRAND,
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: cancelling || !cancelReason.trim()
                    ? 'not-allowed'
                    : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: cancelling || !cancelReason.trim() ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
              >
                {cancelling
                  ? (
                    <>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: '2.5px solid #fff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      Cancelling…
                    </>
                  )
                  : 'Submit Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
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
          >
            <ArrowLeft size={18} color={D.text} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: 18,
              fontWeight: 700,
              color: D.text,
              margin: 0
            }}>Order Tracking</h1>
            {latest && <p style={{
              fontSize: 11,
              color: D.muted,
              margin: 0,
            }}>Order #{latest.orderId.slice(0, 8).toUpperCase()}</p>}
          </div>
          <button
            onClick={() => loadOrders()}
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
          >
            <RefreshCw size={16} color={D.muted} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, marginBottom: "50px", overflowY: 'auto', padding: `0 20px ${latest && !isCancelled && !isAtDeliveredStep ? 180 : 100}px` }}>

        {/* Loading */}
        {loading && orders.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${BRAND}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: D.muted, fontSize: 14 }}>Fetching your orders…</p>
          </div>
        )}

        {/* Empty */}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{ fontSize: 40, opacity: 0.2 }}>📋</span>
            <p style={{ color: D.muted, fontSize: 14, marginTop: 12 }}>No orders yet</p>
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
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              Browse Menu
            </button>
          </div>
        )}

        {latest && !loading && (
          <>
            {/* Hero status card */}
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
                fontSize: 21,
                fontWeight: 700,
                color: D.text,
                margin: '0 0 4px'
              }}>
                {isCancelled ? 'Order Cancelled' : STATUS_STEPS[currentStep]?.label ?? 'Processing…'}
              </h2>
              <p style={{
                fontSize: 13,
                color: D.muted,
                margin: '0 0 20px',
              }}>
                {getRemainingTime()}
              </p>
              {!isCancelled && (
                <div style={{ height: 6, background: D.card2, borderRadius: 3, overflow: 'hidden', margin: '0 8px' }}>
                  <div style={{ height: '100%', background: BRAND, borderRadius: 3, width: `${progressPct}%`, transition: 'width 1s ease' }} />
                </div>
              )}
            </div>

            {/* Status steps */}
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
                          }}>Live</span>}
                        </div>
                        <p style={{
                          fontSize: 12,
                          color: D.muted,
                          margin: '2px 0 0',
                        }}>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Items ordered with Add-Ons */}
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
              }}>Items Ordered</p>

              {(latest.lineItems ?? []).map((li, i) => {
                const itemTotalWithAddOns = getItemTotalWithAddOns(li);
                const hasAddOns = (li.addOns || []).length > 0;

                return (
                  <div key={i} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 0',
                    borderBottom: i < (latest.lineItems?.length ?? 0) - 1 ? `1px solid ${D.border}` : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
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
                        }}>
                          {getItemImage(li.itemId) ? (
                            <Image
                              src={getItemImage(li.itemId)}
                              alt={li.name}
                              width={48}
                              height={48}
                              unoptimized
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : ('🍽️')}
                        </div>
                        <div>
                          <p style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: D.text,
                            margin: 0
                          }}>
                            {li.name}
                            {li.quantity > 1 && (
                              <span style={{
                                fontSize: 12,
                                color: D.muted,
                                marginLeft: 6,
                                fontWeight: 400,
                              }}>
                                × {li.quantity}
                              </span>
                            )}
                          </p>
                          {hasAddOns && (
                            <div style={{ marginTop: 2 }}>
                              {li.addOns?.map((addon, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: 11,
                                    color: D.muted,
                                    display: 'block',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  + {getAddOnDisplay(addon)}
                                  {addon.quantity > 1 && (
                                    <span style={{ fontSize: 10, color: D.sub, marginLeft: 4 }}>
                                      (×{addon.quantity})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: BRAND
                      }}>
                        {formatRs(itemTotalWithAddOns)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                paddingTop: 12,
                marginTop: 4,
                borderTop: `1.5px solid ${D.border}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: D.muted }}>Items Total</span>
                  <span style={{ fontSize: 13, color: D.muted }}>{formatRs(itemsTotal)}</span>
                </div>

                {addOnsGrandTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: D.muted }}>Add-ons Total</span>
                    <span style={{ fontSize: 13, color: D.muted }}>{formatRs(addOnsGrandTotal)}</span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  marginTop: 4,
                  borderTop: `1.5px solid ${D.border}`
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: D.text }}>Total</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: D.text }}>
                    {formatRs((itemsTotal || 0) + (addOnsGrandTotal || 0))}
                  </span>
                </div>
              </div>
            </div>

            {lastSync && (
              <p style={{
                textAlign: 'center',
                fontSize: 11,
                color: D.sub,
                marginBottom: 16,
              }}>
                Updated {lastSync} · Live updates enabled
              </p>
            )}
          </>
        )}
      </div>

      {/* ✅ "Received" button - Theme ke according color */}
      {latest && !isCancelled && isAtDeliveredStep && !isOrderCompleted && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          padding: '0 20px',
          boxSizing: 'border-box',
          zIndex: 99
        }}>
          <button
            onClick={handleOrderReceived}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 28,
              background: BRAND,
              border: 'none',
              color: D.btnText,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              // boxShadow: isDark ? `0 4px 16px rgba(34, 197, 94, 0.3)` : `0 4px 16px rgba(34, 197, 94, 0.4)`,
            }}
            onMouseEnter={(e) => {
              // e.currentTarget.style.background = D.btnHover;
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BRAND;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <ThumbsUp size={20} />
            I've Received My Order
          </button>
        </div>
      )}
      <OrderFeedbackShareModal
        open={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);

          router.push(
            `/guest?rid=${redirectParams.restaurantId}&tid=${redirectParams.tableId}`
          );
        }}
        orderId={receivedOrderId}
      />
      {/* Cancel button */}
      {latest && !isCancelled && !isAtDeliveredStep && (
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
              transition: 'all 0.2s ease',
              outline: 'none',
              marginBottom: "10px"
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}