'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Volume2, VolumeX, RefreshCw, Wifi, WifiOff, Radio, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { formatTimer, timerColorClass, timerBarColor, playNewOrderBeep } from '@/lib/utils';
import { patchOrderStatus, normaliseOrder, toKdsStatus, WS_URL, connectWebSocket, authHeaders } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';

type Filter = 'all' | 'new' | 'preparing' | 'ready' | 'delivered';
type WsState = 'connecting' | 'connected' | 'disconnected' | 'error';
type KdsOrderItemWithImage = KdsOrder['items'][number] & { imageUrl?: string };

const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing', preparing: 'ready', ready: 'delivered', delivered: null,
};
const STATUS_ORDER: Record<KdsStatus, number> = { new: 0, preparing: 1, ready: 2, delivered: 3 };
const STATUS_RANK: Record<string, number> = { new: 0, preparing: 1, ready: 2, delivered: 3 };
const STRIP_COLOR: Record<KdsStatus, string> = {
  new: '#ff5723', preparing: '#3b82f6', ready: '#22c55e', delivered: '#a855f7',
};
const BRAND = '#ff5723';
const POLL_INTERVAL = 15000;

export default function KitchenDisplayPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [audio, setAudio] = useState(true);
  const [clock, setClock] = useState('');
  const [pollPct, setPollPct] = useState(0);
  const [apiState, setApiState] = useState<'loading' | 'live' | 'error'>('loading');
  const [apiError, setApiError] = useState('');
  const [wsState, setWsState] = useState<WsState>('disconnected');
  const [wsLog, setWsLog] = useState<string[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pollStart = useRef(Date.now());
  const prevIds = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef(audio);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  async function handleLogout() { setLoggingOut(true); await logout(); router.push('/login/kds'); }

  useEffect(() => { const id = setInterval(() => { setOrders(prev => prev.map(o => o.status !== 'delivered' ? { ...o, elapsedSeconds: Math.min(o.elapsedSeconds + 1, o.maxSeconds + 300) } : o)); }, 1000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => { setPollPct(Math.min(100, ((Date.now() - pollStart.current) % POLL_INTERVAL) / POLL_INTERVAL * 100)); }, 200); return () => clearInterval(id); }, []);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'warning' | 'info' = 'info'
    ) => {
      toast.dismiss();

      const options = {
        position: 'top-right' as const,
        duration: 4000,
      };

      switch (type) {
        case 'success':
          toast.success(message, options);
          break;
        case 'error':
          toast.error(message, options);
          break;
        case 'warning':
          toast.warning(message, options);
          break;
        default:
          toast.info(message, options);
      }
    },
    []
  );
  const addWsLog = (msg: string) => { const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); setWsLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 9)]); };

  const connectWs = useCallback(async () => {
    // Already connected/connecting
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setWsState('connecting');
    addWsLog('Connecting to WebSocket…');

    try {
      const ws = await connectWebSocket();

      wsRef.current = ws;

      ws.onopen = () => {
        setWsState('connected');
        addWsLog('✓ Connected');

        // Stop REST fallback polling when WS is live
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }

        ws.send(
          JSON.stringify({
            action: 'subscribe',
            channel: 'orders',
          })
        );

        addWsLog('→ Subscribed to orders');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          addWsLog(`← ${JSON.stringify(msg).slice(0, 100)}`);

          // Support common broadcast envelopes
          const payload = msg.data ?? msg.order ?? msg.detail ?? msg;

          const orderId =
            payload.orderId ??
            payload.order_id ??
            msg.orderId ??
            msg.order_id;

          const status =
            payload.status ??
            payload.orderStatus ??
            msg.status ??
            msg.orderStatus;

          const flags =
            payload.flags ??
            msg.flags;

          if (!orderId) {
            addWsLog('← Ignored WS message: no orderId');
            return;
          }

          const displayId = `LM-${String(orderId)
            .slice(0, 6)
            .toUpperCase()}`;

          // ─────────────────────────────
          // NEW ORDER
          // ─────────────────────────────
          const isNewOrder =
            msg.type === 'ORDER_CREATED' ||
            msg.type === 'order.created' ||
            msg.event === 'ORDER_CREATED' ||
            msg.event === 'order.created' ||
            !!payload.lineItems ||
            !!payload.items;

          if (isNewOrder) {
            const newOrder = normaliseOrder(payload);

            setOrders(prev => {
              const alreadyExists = prev.some(
                o =>
                  (o as any)._apiId === String(orderId) ||
                  o.id === newOrder.id
              );

              if (alreadyExists) {
                return prev;
              }

              showToast(
                `🔔 New order #${newOrder.id} — Table ${newOrder.table}`,
                'success'
              );

              if (audioRef.current) {
                playNewOrderBeep();
              }

              return [newOrder, ...prev];
            });

            return;
          }

          // ─────────────────────────────
          // STATUS UPDATE
          // ─────────────────────────────
          if (status || flags) {
            const kdsStatus = toKdsStatus(
              status ?? '',
              flags
            );

            setOrders(prev =>
              prev.map(o =>
                (o as any)._apiId === String(orderId) ||
                  o.id === displayId
                  ? {
                    ...o,
                    status: kdsStatus,
                  }
                  : o
              )
            );

            showToast(
              `📡 WS: Order #${displayId} → ${kdsStatus.toUpperCase()}`,
              'info'
            );
          }

        } catch {
          addWsLog(
            `← (non-JSON) ${String(event.data).slice(0, 60)}`
          );
        }
      };

      ws.onerror = () => {
        setWsState('error');
        addWsLog('✗ WebSocket error');
      };

      ws.onclose = e => {
        setWsState('disconnected');

        addWsLog(
          `✗ Disconnected (code ${e.code})`
        );

        wsRef.current = null;

        // Start REST fallback
        startPolling();

        // Retry WS connection
        if (wsRetryRef.current) {
          clearTimeout(wsRetryRef.current);
        }

        wsRetryRef.current = setTimeout(() => {
          connectWs();
        }, 5000);
      };
    } catch (err: any) {
      setWsState('error');

      addWsLog(
        `✗ WebSocket connection failed: ${err?.message ?? 'Unknown error'
        }`
      );

      // If WS cannot connect, use REST fallback
      startPolling();

      if (wsRetryRef.current) {
        clearTimeout(wsRetryRef.current);
      }

      wsRetryRef.current = setTimeout(() => {
        connectWs();
      }, 5000);
    }
  }, []);
  const wsSend = (p: object) => { if (wsRef.current?.readyState === WebSocket.OPEN) { const m = JSON.stringify(p); wsRef.current.send(m); addWsLog(`→ ${m.slice(0, 80)}`); } };

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!silent) {
        setApiState('loading');
      }

      try {
        if (!user?.restaurantId) {
          setApiState('error');
          setApiError(
            'No restaurant assigned to this account'
          );
          return;
        }

        const res = await fetch('/api/orders', {
          cache: 'no-store',
          headers: await authHeaders(),
        });

        if (!res.ok) {
          throw new Error(`API ${res.status}`);
        }

        const data = await res.json();

        const fresh = data.orders ?? [];

        const freshIds = new Set<string>(
          fresh.map((o: any) => String(o.orderId))
        );

        // Detect new orders
        const newOnes = fresh.filter(
          (o: any) =>
            !prevIds.current.has(
              String(o.orderId)
            )
        );

        if (
          newOnes.length > 0 &&
          prevIds.current.size > 0
        ) {
          newOnes.forEach((o: any) => {
            showToast(
              `🔔 New order #${String(o.orderId)
                .slice(0, 6)
                .toUpperCase()} — Table ${o.tableNumber ??
                o.tableName ??
                o.tableId ??
                'N/A'
              }`,
              'success'
            );

            if (audioRef.current) {
              playNewOrderBeep();
            }
          });
        }

        prevIds.current = freshIds;

        setOrders(prev => {
          const previousMap = new Map(
            prev.map(o => [o.id, o])
          );

          return fresh.map((o: any) => {
            const kdsOrder = normaliseOrder(o);

            const existing =
              previousMap.get(kdsOrder.id);

            if (!existing) {
              return kdsOrder;
            }

            const existingRank =
              STATUS_RANK[existing.status] ?? 0;

            const freshRank =
              STATUS_RANK[kdsOrder.status] ?? 0;

            const status =
              existingRank > freshRank
                ? existing.status
                : kdsOrder.status;

            return {
              ...kdsOrder,
              status,

              // Keep local timer
              elapsedSeconds:
                existing.elapsedSeconds,

              // Keep local dish done state
              items: existing.items,
            };
          });
        });

        setApiState('live');
        setApiError('');
        pollStart.current = Date.now();
      } catch (err: any) {
        console.error(
          '❌ KDS API ERROR:',
          err
        );

        setApiError(
          err?.message ?? 'Failed to load orders'
        );

        setApiState('error');
      }
    },
    [user]
  );
  useEffect(() => {
    // Initial REST load
    loadOrders();

    // Try WebSocket
    connectWs();

    return () => {
      if (wsRetryRef.current) {
        clearTimeout(wsRetryRef.current);
        wsRetryRef.current = null;
      }

      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [loadOrders, connectWs]);
  const startPolling = useCallback(() => {
    // Don't create duplicate intervals
    if (pollRef.current) {
      return;
    }

    addWsLog(
      'REST fallback polling started'
    );

    // Immediately refresh once
    loadOrders(true);

    pollRef.current = setInterval(() => {
      // If WS became connected, stop polling
      if (
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }

        return;
      }

      loadOrders(true);
    }, POLL_INTERVAL);
  }, [loadOrders]);


  const advanceOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);

    if (!order) return;

    const next = STATUS_NEXT[order.status];

    if (!next) return;

    const previousStatus = order.status;

    setAdvancing(orderId);

    // Optimistic UI update
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
            ...o,
            status: next,
          }
          : o
      )
    );

    try {
      const apiId = (order as any)._apiId ?? orderId;

      await patchOrderStatus(apiId, next);

      wsSend({
        action: 'orderStatusUpdate',
        orderId: apiId,
        status: next,
      });

      showToast(
        `Order #${orderId} → ${next.toUpperCase()}`,
        'success'
      );
    } catch (err: any) {
      // Rollback UI
      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? {
              ...o,
              status: previousStatus,
            }
            : o
        )
      );

      showToast(
        err?.message
          ? `⚠ ${err.message}`
          : '⚠ Failed to update order status',
        'error'
      );
    } finally {
      setAdvancing(null);
    }
  };

  const toggleDish = (orderId: string, idx: number) => { setOrders(prev => prev.map(o => { if (o.id !== orderId) return o; const items = o.items.map((it, i) => i === idx ? { ...it, done: !it.done } : it); return { ...o, items }; })); };

  // ✅ Remove tableId filter from KDS - show ALL orders
  const filtered = orders.filter(o => {
    if (filter === 'all') return o.status !== 'delivered';
    if (filter === 'delivered') return o.status === 'delivered';
    return o.status === filter;
  }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.elapsedSeconds - a.elapsedSeconds);

  const counts = { pending: orders.filter(o => o.status === 'new').length, preparing: orders.filter(o => o.status === 'preparing').length, ready: orders.filter(o => o.status === 'ready').length };
  const [currentDate, setCurrentDate] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(
        [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map(x => String(x).padStart(2, '0'))
          .join(':')
      )
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', subtle: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F9FAFB', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', subtle: '#9CA3AF',
  };

  const TONE = {
    green: isDark ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' } : { bg: '#F0FFF4', border: '#BBF7D0', text: '#16a34a' },
    amber: isDark ? { bg: 'rgba(217,119,6,0.15)', border: 'rgba(217,119,6,0.35)', text: '#fbbf24' } : { bg: '#FFFBEB', border: '#FDE68A', text: '#d97706' },
    danger: isDark ? { bg: 'rgba(255,87,35,0.12)', border: 'rgba(255,87,35,0.3)', text: '#ff8a5c' } : { bg: '#FFF0F0', border: '#FFD0D0', text: BRAND },
    blue: isDark ? { bg: 'rgba(59,130,246,0.15)', border: 'rgba(96,165,250,0.3)', text: '#60a5fa' } : { bg: '#EFF6FF', border: '#BFDBFE', text: '#1d4ed8' },
    orange: isDark ? { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' } : { bg: '#FFF3E0', border: '#FED7AA', text: '#c2410c' },
    purple: isDark ? { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)', text: '#a78bfa' } : { bg: '#FAF5FF', border: '#DDD6FE', text: '#7c3aed' },
    gray: isDark ? { bg: D.card2, border: D.border, text: D.subtle } : { bg: '#F9FAFB', border: '#E5E7EB', text: '#9CA3AF' },
  };

  const BTN_CFG: Record<KdsStatus, { label: string; bg: string; color: string; border: string }[]> = {
    new: [{ label: '✓ Accept', bg: TONE.blue.bg, color: TONE.blue.text, border: TONE.blue.border }, { label: '🔥 Preparing', bg: TONE.orange.bg, color: TONE.orange.text, border: TONE.orange.border }],
    preparing: [{ label: '🔔 Mark Ready', bg: TONE.green.bg, color: TONE.green.text, border: TONE.green.border }],
    ready: [{ label: '✓ Delivered', bg: TONE.purple.bg, color: TONE.purple.text, border: TONE.purple.border }],
    delivered: [{ label: '✓ Completed', bg: TONE.gray.bg, color: TONE.gray.text, border: TONE.gray.border }],
  };

  const apiColor = apiState === 'live' ? TONE.green : apiState === 'error' ? TONE.danger : TONE.amber;
  const wsColor = wsState === 'connected' ? TONE.green : wsState === 'connecting' ? TONE.amber : TONE.danger;

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div style={{
      minHeight: '100dvh',
      background: D.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Poppins', sans-serif",
      transition: 'background 0.25s'
    }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: BRAND,
        boxShadow: '0 2px 12px rgba(255,87,35,0.25)',
        flexShrink: 0,
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexWrap: 'wrap',
        fontFamily: "'Poppins', sans-serif",
      }}>
        {/* Left - Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <img src='./Images/logo.png' alt="Menulay Logo" style={{ width: 120, height: 32, objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <p style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
              lineHeight: 1
            }}>KDS</p>
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}>Kitchen Display</p>
          </div>
        </div>

        {/* Center - Status Badges (Desktop) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: '0 1 auto',
          fontFamily: "'Poppins', sans-serif",
        }} className="desktop-status">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: apiColor.bg,
            border: `1px solid ${apiColor.border}`,
            borderRadius: 16,
            padding: '4px 10px'
          }}>
            {apiState === 'live' ? <Wifi size={12} color={apiColor.text} /> : apiState === 'error' ? <WifiOff size={12} color={apiColor.text} /> : <RefreshCw size={12} color={apiColor.text} className="animate-spin" />}
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: apiColor.text,
              textTransform: 'uppercase',
              fontFamily: "'Poppins', sans-serif",
            }}>{apiState === 'live' ? 'REST' : apiState === 'error' ? 'Error' : '…'}</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: wsColor.bg,
            border: `1px solid ${wsColor.border}`,
            borderRadius: 16,
            padding: '4px 10px'
          }}>
            <Radio size={12} color={wsColor.text} />
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: wsColor.text,
              textTransform: 'uppercase',
              fontFamily: "'Poppins', sans-serif",
            }}>WS {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '…' : 'Off'}</span>
            {wsState === 'connected' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />}
          </div>
        </div>

        {/* Right - Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Desktop Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Poppins', sans-serif" }} className="desktop-controls">
            {/* Counts */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[{ val: counts.pending, label: 'P' }, { val: counts.preparing, label: 'Pr' }, { val: counts.ready, label: 'R' }].map(s => (
                <div key={s.label} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.15)'
                }}>
                  <span style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'Poppins', sans-serif",
                    lineHeight: 1
                  }}>{s.val}</span>
                  <span style={{
                    fontSize: 7,
                    color: 'rgba(255,255,255,0.6)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{s.label}</span>
                </div>
              ))}
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />

            {/* Clock */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: 800,
                color: '#fff',
                margin: 0,
                lineHeight: 1
              }}>{clock || '00:00:00'}</p>
              <p style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.5)',
                margin: 0,
                fontFamily: "'Poppins', sans-serif",
              }}>{currentDate}</p>
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />

            {/* Audio Toggle */}
            <button
              onClick={() => setAudio(!audio)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1.5px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
            >
              {audio ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1.5px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                opacity: loggingOut ? 0.6 : 1,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                if (!loggingOut) {
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                if (!loggingOut) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loggingOut) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }
              }}
            >
              <LogOut size={16} /> {loggingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 8,
              border: '1.5px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            className="mobile-menu-btn"
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* ── Mobile Menu Dropdown ── */}
      {mobileMenuOpen && (
        <div style={{
          background: D.card,
          borderBottom: `1px solid ${D.border}`,
          padding: '16px 20px',
          display: 'none',
          flexDirection: 'column',
          gap: 12,
          position: 'sticky',
          top: 60,
          zIndex: 9,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          fontFamily: "'Poppins', sans-serif",
        }} className="mobile-dropdown">
          {/* Status Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: apiColor.bg,
              border: `1px solid ${apiColor.border}`,
              borderRadius: 16,
              padding: '4px 10px'
            }}>
              {apiState === 'live' ? <Wifi size={12} color={apiColor.text} /> : apiState === 'error' ? <WifiOff size={12} color={apiColor.text} /> : <RefreshCw size={12} color={apiColor.text} className="animate-spin" />}
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: apiColor.text,
                textTransform: 'uppercase',
                fontFamily: "'Poppins', sans-serif",
              }}>{apiState === 'live' ? 'REST' : apiState === 'error' ? 'Error' : '…'}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: wsColor.bg,
              border: `1px solid ${wsColor.border}`,
              borderRadius: 16,
              padding: '4px 10px'
            }}>
              <Radio size={12} color={wsColor.text} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: wsColor.text,
                textTransform: 'uppercase',
                fontFamily: "'Poppins', sans-serif",
              }}>WS {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '…' : 'Off'}</span>
              {wsState === 'connected' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />}
            </div>
          </div>

          {/* Compact counts for mobile */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ val: counts.pending, label: 'Pending' }, { val: counts.preparing, label: 'Preparing' }, { val: counts.ready, label: 'Ready' }].map(s => (
              <div key={s.label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${D.border}`,
                fontFamily: "'Poppins', sans-serif",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: D.text }}>{s.val}</span>
                <span style={{ fontSize: 10, color: D.muted }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Audio Toggle */}
            <button
              onClick={() => setAudio(!audio)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: `1.5px solid ${audio ? 'rgba(255,255,255,0.2)' : '#FFD0D0'}`,
                background: audio ? 'rgba(255,255,255,0.08)' : '#FFF0F0',
                color: audio ? D.text : BRAND,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {audio ? <Volume2 size={16} /> : <VolumeX size={16} />} {audio ? 'Sound On' : 'Sound Off'}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: `1.5px solid ${D.border}`,
                background: D.card2,
                color: D.text,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? 'Light' : 'Dark'}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1.5px solid #FFD0D0',
                background: '#FFF0F0',
                color: BRAND,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                opacity: loggingOut ? 0.6 : 1,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                if (!loggingOut) {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <LogOut size={16} /> {loggingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}

      {/* ── Poll bar ── */}
      <div style={{ height: 3, background: D.border, flexShrink: 0 }}>
        <div style={{ height: '100%', background: BRAND, transition: 'width 0.2s', width: `${pollPct}%` }} />
      </div>

      {/* ── API error ── */}
      {apiState === 'error' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: TONE.danger.bg,
          borderBottom: `1px solid ${TONE.danger.border}`,
          flexShrink: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <WifiOff size={14} color={TONE.danger.text} />
          <p style={{
            fontSize: 12,
            color: TONE.danger.text,
            flex: 1,
            margin: 0,
            fontFamily: "'Poppins', sans-serif",
          }}>{apiError}</p>
          <button
            onClick={() => loadOrders()}
            style={{
              padding: '4px 14px',
              borderRadius: 8,
              background: TONE.danger.bg,
              border: `1px solid ${TONE.danger.border}`,
              color: TONE.danger.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: D.card,
        borderBottom: `1.5px solid ${D.border}`,
        flexShrink: 0,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        fontFamily: "'Poppins', sans-serif",
      }}>
        {([{ key: 'all', label: 'All' }, { key: 'new', label: '🟠 New' }, { key: 'preparing', label: '🔵 Prep' }, { key: 'ready', label: '🟢 Ready' }] as const).map(f => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                border: `1.5px solid ${active ? BRAND : D.border}`,
                background: active ? TONE.danger.bg : D.card,
                color: active ? BRAND : D.muted,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontFamily: "'Poppins', sans-serif",
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = D.card;
                }
              }}
            >
              {f.label}
            </button>
          );
        })}
        <div style={{ width: 1, height: 16, background: D.border, margin: '0 4px', flexShrink: 0 }} />
        <button
          onClick={() => setFilter('delivered')}
          style={{
            padding: '4px 12px',
            borderRadius: 16,
            border: `1.5px solid ${filter === 'delivered' ? '#7c3aed' : D.border}`,
            background: filter === 'delivered' ? TONE.purple.bg : D.card,
            color: filter === 'delivered' ? TONE.purple.text : D.muted,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontFamily: "'Poppins', sans-serif",
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseEnter={(e) => {
            if (filter !== 'delivered') {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
            }
          }}
          onMouseLeave={(e) => {
            if (filter !== 'delivered') {
              e.currentTarget.style.background = D.card;
            }
          }}
        >
          ✓ Done
        </button>
      </div>

      {/* ── WS log ── */}
      {wsLog.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          background: TONE.green.bg,
          borderBottom: `1px solid ${TONE.green.border}`,
          flexShrink: 0,
          overflow: 'hidden',
          fontFamily: "'Poppins', sans-serif",
        }}>
          <Radio size={10} color={TONE.green.text} style={{ flexShrink: 0 }} />
          <p style={{
            fontSize: 9,
            color: TONE.green.text,
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            margin: 0
          }}>{wsLog[0]}</p>
          <span style={{ fontSize: 8, color: D.subtle, flexShrink: 0 }}>{wsLog.length}</span>
        </div>
      )}

      {/* ── Loading ── */}
      {apiState === 'loading' && orders.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '20px',
          fontFamily: "'Poppins', sans-serif",
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: `3px solid ${BRAND}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{
            fontSize: 14,
            color: D.muted,
            fontWeight: 600,
            fontFamily: "'Poppins', sans-serif",
          }}>Loading orders…</p>
        </div>
      )}


      {/* ── Grid ── */}
      {(apiState !== 'loading' || orders.length > 0) && (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          padding: '12px',
          alignContent: 'start',
          overflowY: 'auto',
        }}>
          {filtered.length === 0 && (
            <div style={{
              gridColumn: '1/-1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 16px',
              gap: 12,
              border: `2px dashed ${D.border}`,
              borderRadius: 20,
              background: D.card,
              fontFamily: "'Poppins', sans-serif",
            }}>
              <span style={{ fontSize: 32, opacity: 0.2 }}>✔️</span>
              <p style={{
                fontSize: 13,
                color: D.muted,
                fontWeight: 600,
                margin: 0,
                fontFamily: "'Poppins', sans-serif",
              }}>No orders in this category</p>
            </div>
          )}

          {filtered.map(order => {
            const pct = Math.min(100, (order.elapsedSeconds / order.maxSeconds) * 100);
            const isUrgent = pct >= 90;
            const isAdvancing = advancing === order.id;
            const allDone = order.items.every(i => i.done);
            return (
              <div key={order.id} style={{
                background: D.card,
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                border: `1.5px solid ${isUrgent ? TONE.danger.border : D.border}`,
                boxShadow: isUrgent ? '0 0 0 3px rgba(255,87,35,0.08),0 4px 16px rgba(255,87,35,0.08)' : (isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)'),
                transition: 'all 0.2s',
                overflow: 'hidden',
                minWidth: 0,
                fontFamily: "'Poppins', sans-serif",
              }}>
                <div style={{ height: 4, background: STRIP_COLOR[order.status] }} />
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '10px 14px 8px',
                  borderBottom: `1px solid ${D.border}`
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: 800,
                        color: D.text,
                        margin: 0
                      }}>#{order.id}</p>
                      {allDone && order.status !== 'delivered' && (
                        <span style={{
                          fontSize: 8,
                          background: TONE.green.bg,
                          border: `1px solid ${TONE.green.border}`,
                          color: TONE.green.text,
                          padding: '1px 6px',
                          borderRadius: 12,
                          fontWeight: 700,
                          fontFamily: "'Poppins', sans-serif",
                        }}>DONE</span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 10,
                      color: D.muted,
                      margin: '2px 0 0',
                      fontFamily: "'Poppins', sans-serif",
                    }}>🪑 Table {order.table} · {order.zone}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      fontFamily: 'monospace',
                      fontSize: 18,
                      fontWeight: 800,
                      margin: 0
                    }} className={timerColorClass(order.elapsedSeconds, order.maxSeconds)}>
                      {formatTimer(order.elapsedSeconds)}
                    </p>
                    <p style={{
                      fontSize: 9,
                      color: D.subtle,
                      margin: '1px 0 0',
                      fontFamily: "'Poppins', sans-serif",
                    }}>{order.placedAt}</p>
                  </div>
                </div>
                <div style={{ height: 3, background: D.border }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 4,
                    transition: 'width 1s',
                    width: `${pct}%`,
                    background: timerBarColor(order.elapsedSeconds, order.maxSeconds)
                  }} />
                </div>


                {/* ── Items with Add-ons ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', flex: 1 }}>
                  {order.items.map((dish, i) => {
                    const totalQty = dish.qty || 1;
                    const addons = (dish as KdsOrderItemWithImage & { addOns?: any[] }).addOns ?? [];
                    const hasAddons = addons.length > 0;

                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* ── Main Item Row ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Item Image */}
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: D.card2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {(dish as KdsOrderItemWithImage).imageUrl ? (
                              <Image
                                src={(dish as KdsOrderItemWithImage).imageUrl!}
                                alt={dish.name}
                                width={40}
                                height={40}
                                unoptimized
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: 20 }}>{dish.emoji || '🍽️'}</span>
                            )}
                          </div>

                          {/* ── Item Name & Quantity ── */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <p style={{
                                fontSize: 11,
                                fontWeight: 700,
                                margin: 0,
                                color: dish.done ? D.subtle : D.text,
                                textDecoration: dish.done ? 'line-through' : 'none',
                                fontFamily: "'Poppins', sans-serif",
                              }}>{dish.name}</p>

                              {/* ✅ Quantity Badge */}
                              {totalQty > 1 && (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  background: BRAND,
                                  color: '#fff',
                                  padding: '1px 8px',
                                  borderRadius: 12,
                                  fontFamily: "'Poppins', sans-serif",
                                  flexShrink: 0,
                                }}>
                                  ×{totalQty}
                                </span>
                              )}
                            </div>

                            {/* ✅ Add-ons Display (inline) */}
                            {hasAddons && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                                {addons.map((addon: any, idx: number) => {
                                  const addonQty = addon.qty || 1;
                                  return (
                                    <span key={idx} style={{
                                      fontSize: 8,
                                      color: D.muted,
                                      background: D.card2,
                                      padding: '1px 8px',
                                      borderRadius: 10,
                                      border: `1px solid ${D.border}`,
                                      fontFamily: "'Poppins', sans-serif",
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}>
                                      + {addon.name || addon}
                                      {addonQty > 1 && (
                                        <span style={{
                                          fontWeight: 700,
                                          color: BRAND,
                                          background: `${BRAND}15`,
                                          padding: '0 4px',
                                          borderRadius: 3,
                                          fontSize: 7,
                                        }}>
                                          ×{addonQty}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* ── Done Toggle ── */}
                          <button
                            onClick={() => toggleDish(order.id, i)}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 5,
                              border: `1.5px solid ${dish.done ? BRAND : D.border}`,
                              background: dish.done ? BRAND : D.card,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0,
                              transition: 'all 0.2s',
                              outline: 'none',
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            {dish.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                          </button>
                        </div>

                        {/* ✅ Add-ons with Quantity (Indented - Full Details) */}
                        {hasAddons && (
                          <div style={{
                            marginLeft: 50,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            paddingLeft: 4,
                            borderLeft: `2px solid ${D.border}`,
                          }}>
                            {addons.map((addon: any, idx: number) => {
                              const addonQty = addon.qty || 1;
                              return (
                                <div key={idx} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: D.card2,
                                  padding: '2px 8px 2px 6px',
                                  borderRadius: 10,
                                  border: `1px solid ${D.border}`,
                                  fontFamily: "'Poppins', sans-serif",
                                }}>
                                  <span style={{ fontSize: 8, color: D.subtle }}>+</span>
                                  <span style={{ fontSize: 9, fontWeight: 500, color: D.text }}>
                                    {addon.name || addon}
                                  </span>
                                  {addonQty > 1 && (
                                    <span style={{
                                      fontSize: 8,
                                      fontWeight: 700,
                                      color: BRAND,
                                      background: `${BRAND}15`,
                                      padding: '0 4px',
                                      borderRadius: 4,
                                    }}>
                                      ×{addonQty}
                                    </span>
                                  )}
                                  {addon.price && (
                                    <span style={{ fontSize: 8, color: D.subtle }}>
                                      Rs. {addon.price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {order.note && (
                  <div style={{
                    margin: '0 10px 6px',
                    padding: '6px 10px',
                    background: TONE.amber.bg,
                    border: `1px solid ${TONE.amber.border}`,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 4,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    <span style={{ color: TONE.amber.text, fontSize: 10, marginTop: 1 }}>⚠</span>
                    <p style={{
                      fontSize: 9,
                      color: TONE.amber.text,
                      lineHeight: 1.4,
                      margin: 0,
                      fontWeight: 600,
                      fontFamily: "'Poppins', sans-serif",
                    }}>{order.note}</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, padding: '8px 10px 10px', borderTop: `1px solid ${D.border}` }}>
                  {BTN_CFG[order.status].map((btn, i) => (
                    <button
                      key={btn.label}
                      onClick={() => i === 0 && advanceOrder(order.id)}
                      disabled={order.status === 'delivered' || isAdvancing}
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 8,
                        border: `1.5px solid ${btn.border}`,
                        background: btn.bg,
                        color: btn.color,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: order.status === 'delivered' ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        transition: 'all 0.2s',
                        opacity: (order.status === 'delivered' || isAdvancing) ? 0.5 : 1,
                        fontFamily: "'Poppins', sans-serif",
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        if (order.status !== 'delivered' && !isAdvancing) {
                          e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,87,35,0.15)'}`;
                        }
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {isAdvancing && i === 0 ?
                        <div style={{
                          width: 12,
                          height: 12,
                          border: `2px solid ${btn.color}`,
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} /> : btn.label
                      }
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        
        /* Desktop: Show all controls, hide mobile elements */
        @media (min-width: 768px) {
          .desktop-controls { display: flex !important; }
          .desktop-status { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
          .mobile-dropdown { display: none !important; }
        }
        
        /* Mobile: Hide desktop controls, show mobile elements */
        @media (max-width: 767px) {
          .desktop-controls { display: none !important; }
          .desktop-status { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .mobile-dropdown { display: flex !important; }
          
          header {
            padding: 8px 12px !important;
          }
          
          header > div:last-child {
            gap: 4px !important;
          }
        }
        
        /* Small mobile */
        @media (max-width: 480px) {
          header { padding: 6px 10px !important; gap: 6px !important; }
          header img { width: 80px !important; height: 24px !important; }
          .mobile-menu-btn { width: 32px !important; height: 32px !important; }
          .mobile-menu-btn svg { width: 16px !important; height: 16px !important; }
        }
      `}</style>
    </div>
  );
}