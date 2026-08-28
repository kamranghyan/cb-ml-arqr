'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Volume2,
  VolumeX,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import {
  formatTimer,
  timerColorClass,
  timerBarColor,
  playNewOrderBeep,
} from '@/lib/utils';
import {
  patchOrderStatus,
  normaliseOrder,
  WS_URL,
  connectWebSocket,
  authHeaders,
} from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';

type Filter = 'all' | 'new' | 'preparing' | 'ready' | 'delivered';

type WsState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

type KdsOrderItemWithImage = KdsOrder['items'][number] & {
  imageUrl?: string;
  addOns?: Array<{
    name?: string;
    qty?: number;
    price?: number;
  } | string>;
};

const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
};

const STATUS_ORDER: Record<KdsStatus, number> = {
  new: 0,
  preparing: 1,
  ready: 2,
  delivered: 3,
};

const STATUS_RANK: Record<string, number> = {
  new: 0,
  preparing: 1,
  ready: 2,
  delivered: 3,
};

const STRIP_COLOR: Record<KdsStatus, string> = {
  new: '#ff5723',
  preparing: '#3b82f6',
  ready: '#22c55e',
  delivered: '#a855f7',
};

const BRAND = '#ff5723';

export default function KitchenDisplayPage() {
  const router = useRouter();

  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();

  const [loggingOut, setLoggingOut] = useState(false);
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [audio, setAudio] = useState(true);
  const [clock, setClock] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  const [apiState, setApiState] = useState<
    'loading' | 'live' | 'error'
  >('loading');

  const [apiError, setApiError] = useState('');

  const [wsState, setWsState] =
    useState<WsState>('disconnected');

  const [wsLog, setWsLog] = useState<string[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /*
   * Keeps track of order IDs already known to the client.
   * Used only for detecting genuinely new orders.
   */
  const prevIds = useRef<Set<string>>(new Set());

  /*
   * Current WebSocket instance.
   */
  const wsRef = useRef<WebSocket | null>(null);

  /*
   * Reconnect timeout.
   */
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /*
   * Prevent reconnect after component unmount.
   */
  const mountedRef = useRef(true);

  /*
   * Prevent stale socket events from affecting the current socket.
   */
  const wsGenerationRef = useRef(0);

  /*
   * Audio ref prevents stale closure inside async functions.
   */
  const audioRef = useRef(audio);

  /*
   * Prevent concurrent order loads.
   */
  const loadingOrdersRef = useRef(false);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  /*
   * Component lifecycle.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
   * Logout.
   */
  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
      router.push('/login/kds');
    } catch (error) {
      console.error('[KDS] Logout failed:', error);

      toast.error('Failed to sign out. Please try again.', {
        position: 'top-right',
        duration: 4000,
      });

      setLoggingOut(false);
    }
  }

  /*
   * Clock.
   */
  useEffect(() => {
    const tick = () => {
      const now = new Date();

      setClock(
        [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map((value) => String(value).padStart(2, '0'))
          .join(':')
      );

      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };

    tick();

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, []);

  /*
   * Local KDS timer.
   *
   * Important:
   * This only increments the existing local timer.
   * REST/WS refreshes preserve this value.
   */
  useEffect(() => {
    const id = setInterval(() => {
      setOrders((prev) =>
        prev.map((order) =>
          order.status !== 'delivered'
            ? {
                ...order,
                elapsedSeconds: Math.min(
                  order.elapsedSeconds + 1,
                  order.maxSeconds + 300
                ),
              }
            : order
        )
      );
    }, 1000);

    return () => clearInterval(id);
  }, []);

  /*
   * WebSocket log.
   */
  const addWsLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setWsLog((prev) => [
      `[${time}] ${msg}`,
      ...prev.slice(0, 9),
    ]);
  }, []);

  /*
   * Clear any scheduled WebSocket reconnect.
   */
  const clearWsRetry = useCallback(() => {
    if (wsRetryRef.current) {
      clearTimeout(wsRetryRef.current);
      wsRetryRef.current = null;
    }
  }, []);

  /*
   * Schedule WebSocket reconnect.
   */
  const scheduleWsReconnect = useCallback(
    (connectFn: () => void) => {
      if (!mountedRef.current) return;

      clearWsRetry();

      wsRetryRef.current = setTimeout(() => {
        wsRetryRef.current = null;

        if (mountedRef.current) {
          connectFn();
        }
      }, 5000);
    },
    [clearWsRetry]
  );

  /*
   * Load orders.
   *
   * This is the single source of truth for REST/WS order refreshes.
   *
   * IMPORTANT:
   * - server status cannot move an order backwards
   * - local elapsed timer is preserved
   * - local dish done state is preserved
   */
  const loadOrders = useCallback(
    async (silent = false) => {
      if (loadingOrdersRef.current) {
        return;
      }

      loadingOrdersRef.current = true;

      if (!silent && mountedRef.current) {
        setApiState('loading');
      }

      try {
        if (!user?.restaurantId) {
          if (mountedRef.current) {
            setApiState('error');
            setApiError(
              'No restaurant assigned to this account'
            );
          }

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

        const fresh = Array.isArray(data.orders)
          ? data.orders
          : [];

        /*
         * Detect genuinely new orders.
         */
        const freshIds = new Set<string>(
          fresh.map((order: any) =>
            String(order.orderId)
          )
        );

        const newOnes = fresh.filter(
          (order: any) =>
            !prevIds.current.has(
              String(order.orderId)
            )
        );

        /*
         * Do not play notifications on the very first load.
         */
        if (
          newOnes.length > 0 &&
          prevIds.current.size > 0
        ) {
          newOnes.forEach((order: any) => {
            const shortId = String(
              order.orderId
            )
              .slice(0, 6)
              .toUpperCase();

            const table =
              order.tableNumber ??
              order.tableName ??
              order.tableId ??
              'N/A';

            toast.success(
              `🔔 New order #${shortId} — Table ${table}`,
              {
                position: 'top-right',
                duration: 4000,
              }
            );

            if (audioRef.current) {
              playNewOrderBeep();
            }
          });
        }

        prevIds.current = freshIds;

        /*
         * Merge server data with local KDS state.
         */
        setOrders((previousOrders) => {
          const previousMap = new Map(
            previousOrders.map((order) => [
              order.id,
              order,
            ])
          );

          return fresh.map((rawOrder: any) => {
            const kdsOrder = normaliseOrder(rawOrder);

            const existing = previousMap.get(
              kdsOrder.id
            );

            /*
             * New order.
             */
            if (!existing) {
              return kdsOrder;
            }

            /*
             * Never move status backwards locally.
             *
             * Example:
             * local = ready
             * server = preparing
             *
             * Keep ready.
             */
            const existingRank =
              STATUS_RANK[existing.status] ?? 0;

            const freshRank =
              STATUS_RANK[kdsOrder.status] ?? 0;

            const status =
              existingRank > freshRank
                ? existing.status
                : kdsOrder.status;

            /*
             * Preserve local item completion state.
             *
             * Server refreshes should not uncheck dishes
             * that the kitchen already marked done.
             */
            const mergedItems =
              existing.items.length ===
              kdsOrder.items.length
                ? kdsOrder.items.map(
                    (freshItem, index) => ({
                      ...freshItem,
                      done:
                        existing.items[index]?.done ??
                        freshItem.done ??
                        false,
                    })
                  )
                : existing.items;

            return {
              ...kdsOrder,

              status,

              /*
               * Preserve local timer.
               */
              elapsedSeconds:
                existing.elapsedSeconds,

              /*
               * Preserve local done state.
               */
              items: mergedItems,
            };
          });
        });

        if (mountedRef.current) {
          setApiState('live');
          setApiError('');
        }
      } catch (error: any) {
        console.error(
          '❌ KDS API ERROR:',
          error
        );

        if (mountedRef.current) {
          setApiError(
            error?.message ??
              'Failed to load orders'
          );

          setApiState('error');
        }
      } finally {
        loadingOrdersRef.current = false;
      }
    },
    [user]
  );

  /*
   * WebSocket connection.
   *
   * WS does NOT directly replace orders anymore.
   * Instead it triggers loadOrders(true), so the same merge
   * logic preserves timer/done/status.
   */
  const connectWs = useCallback(async () => {
    if (!mountedRef.current) return;

    /*
     * Don't create another connection while one is active.
     */
    if (
      wsRef.current?.readyState ===
        WebSocket.OPEN ||
      wsRef.current?.readyState ===
        WebSocket.CONNECTING
    ) {
      return;
    }

    clearWsRetry();

    const generation =
      ++wsGenerationRef.current;

    setWsState('connecting');
    addWsLog('Connecting to WebSocket…');

    try {
      const ws = await connectWebSocket();

      /*
       * Component may have unmounted while awaiting connection.
       */
      if (
        !mountedRef.current ||
        generation !== wsGenerationRef.current
      ) {
        ws.close();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (
          !mountedRef.current ||
          generation !== wsGenerationRef.current
        ) {
          return;
        }

        setWsState('connected');
        addWsLog('✓ Connected');

        try {
          ws.send(
            JSON.stringify({
              action: 'subscribe',
              channel: 'orders',
            })
          );

          addWsLog(
            '→ Subscribed to orders'
          );
        } catch (error) {
          console.error(
            '[KDS WS] Subscribe failed:',
            error
          );
        }
      };

      ws.onerror = () => {
        if (
          !mountedRef.current ||
          generation !== wsGenerationRef.current
        ) {
          return;
        }

        setWsState('error');
        addWsLog('✗ WebSocket error');
      };

      ws.onclose = (event) => {
        if (
          !mountedRef.current ||
          generation !== wsGenerationRef.current
        ) {
          return;
        }

        setWsState('disconnected');

        addWsLog(
          `✗ Disconnected (code ${event.code})`
        );

        wsRef.current = null;

        scheduleWsReconnect(connectWs);
      };

      ws.onmessage = (event) => {
        if (
          !mountedRef.current ||
          generation !== wsGenerationRef.current
        ) {
          return;
        }

        try {
          const message = JSON.parse(
            event.data
          );

          console.log(
            '[KDS WS] Message:',
            message
          );

          const messageType =
            String(message?.type ?? '')
              .toUpperCase();

          /*
           * Any order create/update event causes
           * a silent REST refresh.
           *
           * We deliberately don't use:
           *
           * fetchOrders().then(setOrders)
           *
           * because that bypasses our local-state merge.
           */
          if (
            messageType ===
              'ORDER_CREATED' ||
            messageType ===
              'ORDER_UPDATED' ||
            messageType ===
              'ORDER_CREATED_EVENT' ||
            messageType ===
              'ORDER_UPDATED_EVENT'
          ) {
            void loadOrders(true);
          }
        } catch (error) {
          console.error(
            '[KDS WS] Invalid message:',
            error
          );
        }
      };
    } catch (error: any) {
      if (
        !mountedRef.current ||
        generation !== wsGenerationRef.current
      ) {
        return;
      }

      setWsState('error');

      addWsLog(
        `✗ WebSocket connection failed: ${
          error?.message ??
          'Unknown error'
        }`
      );

      wsRef.current = null;

      scheduleWsReconnect(connectWs);
    }
  }, [
    addWsLog,
    clearWsRetry,
    loadOrders,
    scheduleWsReconnect,
  ]);

  /*
   * Send message over current WebSocket.
   */
  const wsSend = useCallback(
    (payload: object) => {
      const ws = wsRef.current;

      if (
        ws?.readyState !==
        WebSocket.OPEN
      ) {
        return false;
      }

      try {
        const message =
          JSON.stringify(payload);

        ws.send(message);

        addWsLog(
          `→ ${message.slice(0, 80)}`
        );

        return true;
      } catch (error) {
        console.error(
          '[KDS WS] Send failed:',
          error
        );

        return false;
      }
    },
    [addWsLog]
  );

  /*
   * Initial REST + WebSocket.
   */
  useEffect(() => {
    if (!user?.restaurantId) {
      return;
    }

    void loadOrders();
    void connectWs();

    return () => {
      clearWsRetry();

      /*
       * Invalidate all handlers belonging to the
       * old socket.
       */
      wsGenerationRef.current += 1;

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore close errors.
        }

        wsRef.current = null;
      }

      setWsState('disconnected');
    };
  }, [
    user?.restaurantId,
    loadOrders,
    connectWs,
    clearWsRetry,
  ]);

  /*
   * Advance order status.
   */
  const advanceOrder = useCallback(
    async (orderId: string) => {
      const order = orders.find(
        (item) => item.id === orderId
      );

      if (!order) {
        return;
      }

      const next =
        STATUS_NEXT[order.status];

      if (!next) {
        return;
      }

      const previousStatus =
        order.status;

      setAdvancing(orderId);

      /*
       * Optimistic update.
       */
      setOrders((previous) =>
        previous.map((item) =>
          item.id === orderId
            ? {
                ...item,
                status: next,
              }
            : item
        )
      );

      try {
        const apiId =
          (order as any)._apiId ??
          orderId;

        await patchOrderStatus(
          apiId,
          next
        );

        /*
         * Notify WebSocket backend if connected.
         */
        wsSend({
          action:
            'orderStatusUpdate',
          orderId: apiId,
          status: next,
        });

        toast.success(
          `Order #${orderId} → ${next.toUpperCase()}`,
          {
            position: 'top-right',
            duration: 4000,
          }
        );
      } catch (error: any) {
        /*
         * Rollback optimistic update.
         */
        setOrders((previous) =>
          previous.map((item) =>
            item.id === orderId
              ? {
                  ...item,
                  status:
                    previousStatus,
                }
              : item
          )
        );

        console.error(
          '[KDS] Status update failed:',
          error
        );

        toast.error(
          error?.message ??
            'Failed to update order status',
          {
            position: 'top-right',
            duration: 4000,
          }
        );
      } finally {
        setAdvancing(null);
      }
    },
    [orders, wsSend]
  );

  /*
   * Toggle individual dish completion.
   *
   * This is intentionally local because the KDS item-level
   * completion state is not being persisted by patchOrderStatus.
   */
  const toggleDish = useCallback(
    (orderId: string, index: number) => {
      setOrders((previous) =>
        previous.map((order) => {
          if (order.id !== orderId) {
            return order;
          }

          const items = order.items.map(
            (item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    done: !item.done,
                  }
                : item
          );

          return {
            ...order,
            items,
          };
        })
      );
    },
    []
  );

  /*
   * Filtering.
   */
  const filtered = orders
    .filter((order) => {
      if (filter === 'all') {
        return order.status !== 'delivered';
      }

      if (filter === 'delivered') {
        return order.status === 'delivered';
      }

      return order.status === filter;
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] -
          STATUS_ORDER[b.status] ||
        b.elapsedSeconds -
          a.elapsedSeconds
    );

  /*
   * Header counts.
   */
  const counts = {
    pending: orders.filter(
      (order) => order.status === 'new'
    ).length,

    preparing: orders.filter(
      (order) =>
        order.status === 'preparing'
    ).length,

    ready: orders.filter(
      (order) => order.status === 'ready'
    ).length,
  };

  /*
   * Theme tokens.
   */
  const D = isDark
    ? {
        bg: '#111111',
        card: '#1C1C1C',
        card2: '#242424',
        border:
          'rgba(255,255,255,0.08)',
        text: '#F5F0E8',
        muted: '#9CA3AF',
        subtle: '#6B7280',
      }
    : {
        bg: '#FFFFFF',
        card: '#FFFFFF',
        card2: '#F9FAFB',
        border: '#F0EBE6',
        text: '#000000',
        muted: '#6B6B6B',
        subtle: '#9CA3AF',
      };

  const TONE = {
    green: isDark
      ? {
          bg: 'rgba(34,197,94,0.12)',
          border:
            'rgba(34,197,94,0.3)',
          text: '#4ade80',
        }
      : {
          bg: '#F0FFF4',
          border: '#BBF7D0',
          text: '#16a34a',
        },

    amber: isDark
      ? {
          bg: 'rgba(217,119,6,0.15)',
          border:
            'rgba(217,119,6,0.35)',
          text: '#fbbf24',
        }
      : {
          bg: '#FFFBEB',
          border: '#FDE68A',
          text: '#d97706',
        },

    danger: isDark
      ? {
          bg: 'rgba(255,87,35,0.12)',
          border:
            'rgba(255,87,35,0.3)',
          text: '#ff8a5c',
        }
      : {
          bg: '#FFF0F0',
          border: '#FFD0D0',
          text: BRAND,
        },

    blue: isDark
      ? {
          bg: 'rgba(59,130,246,0.15)',
          border:
            'rgba(96,165,250,0.3)',
          text: '#60a5fa',
        }
      : {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          text: '#1d4ed8',
        },

    orange: isDark
      ? {
          bg: 'rgba(251,146,60,0.15)',
          border:
            'rgba(251,146,60,0.3)',
          text: '#fb923c',
        }
      : {
          bg: '#FFF3E0',
          border: '#FED7AA',
          text: '#c2410c',
        },

    purple: isDark
      ? {
          bg: 'rgba(167,139,250,0.15)',
          border:
            'rgba(167,139,250,0.3)',
          text: '#a78bfa',
        }
      : {
          bg: '#FAF5FF',
          border: '#DDD6FE',
          text: '#7c3aed',
        },

    gray: isDark
      ? {
          bg: D.card2,
          border: D.border,
          text: D.subtle,
        }
      : {
          bg: '#F9FAFB',
          border: '#E5E7EB',
          text: '#9CA3AF',
        },
  };

  const BTN_CFG: Record<
    KdsStatus,
    {
      label: string;
      bg: string;
      color: string;
      border: string;
    }[]
  > = {
    new: [
      {
        label: '✓ Accept',
        bg: TONE.blue.bg,
        color: TONE.blue.text,
        border: TONE.blue.border,
      },
    ],

    preparing: [
      {
        label: '🔔 Mark Ready',
        bg: TONE.green.bg,
        color: TONE.green.text,
        border: TONE.green.border,
      },
    ],

    ready: [
      {
        label: '✓ Delivered',
        bg: TONE.purple.bg,
        color: TONE.purple.text,
        border: TONE.purple.border,
      },
    ],

    delivered: [
      {
        label: '✓ Completed',
        bg: TONE.gray.bg,
        color: TONE.gray.text,
        border: TONE.gray.border,
      },
    ],
  };

  const apiColor =
    apiState === 'live'
      ? TONE.green
      : apiState === 'error'
      ? TONE.danger
      : TONE.amber;

  const wsColor =
    wsState === 'connected'
      ? TONE.green
      : wsState === 'connecting'
      ? TONE.amber
      : TONE.danger;

  const toggleMobileMenu = () =>
    setMobileMenuOpen(
      (previous) => !previous
    );

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: D.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily:
          "'Poppins', sans-serif",
        transition:
          'background 0.25s',
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          padding: '10px 20px',
          background: BRAND,
          boxShadow:
            '0 2px 12px rgba(255,87,35,0.25)',
          flexShrink: 0,
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexWrap: 'wrap',
          fontFamily:
            "'Poppins', sans-serif",
        }}
      >
        {/* Left - Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <img
            src="/Images/logo.png"
            alt="Menulay Logo"
            style={{
              width: 120,
              height: 32,
              objectFit: 'contain',
            }}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <p
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                fontFamily:
                  "'Poppins', sans-serif",
                lineHeight: 1,
              }}
            >
              KDS
            </p>

            <p
              style={{
                color:
                  'rgba(255,255,255,0.7)',
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform:
                  'uppercase',
                margin: 0,
                fontFamily:
                  "'Poppins', sans-serif",
              }}
            >
              Kitchen Display
            </p>
          </div>
        </div>

        {/* Center - Status Badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '0 1 auto',
            fontFamily:
              "'Poppins', sans-serif",
          }}
          className="desktop-status"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: apiColor.bg,
              border: `1px solid ${apiColor.border}`,
              borderRadius: 16,
              padding: '4px 10px',
            }}
          >
            {apiState === 'live' ? (
              <Wifi
                size={12}
                color={apiColor.text}
              />
            ) : apiState ===
              'error' ? (
              <WifiOff
                size={12}
                color={apiColor.text}
              />
            ) : (
              <RefreshCw
                size={12}
                color={apiColor.text}
                className="animate-spin"
              />
            )}

            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: apiColor.text,
                textTransform:
                  'uppercase',
                fontFamily:
                  "'Poppins', sans-serif",
              }}
            >
              {apiState === 'live'
                ? 'REST'
                : apiState === 'error'
                ? 'Error'
                : '…'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: wsColor.bg,
              border: `1px solid ${wsColor.border}`,
              borderRadius: 16,
              padding: '4px 10px',
            }}
          >
            <Radio
              size={12}
              color={wsColor.text}
            />

            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: wsColor.text,
                textTransform:
                  'uppercase',
                fontFamily:
                  "'Poppins', sans-serif",
              }}
            >
              WS{' '}
              {wsState ===
              'connected'
                ? 'Live'
                : wsState ===
                  'connecting'
                ? '…'
                : 'Off'}
            </span>

            {wsState ===
              'connected' && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius:
                    '50%',
                  background:
                    '#22c55e',
                  display:
                    'inline-block',
                }}
              />
            )}
          </div>
        </div>

        {/* Right - Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Desktop Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily:
                "'Poppins', sans-serif",
            }}
            className="desktop-controls"
          >
            {/* Counts */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems:
                  'center',
              }}
            >
              {[
                {
                  val: counts.pending,
                  label: 'P',
                },
                {
                  val: counts.preparing,
                  label: 'Pr',
                },
                {
                  val: counts.ready,
                  label: 'R',
                },
              ].map((status) => (
                <div
                  key={
                    status.label
                  }
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    alignItems:
                      'center',
                    padding:
                      '2px 8px',
                    borderRadius: 8,
                    background:
                      'rgba(255,255,255,0.12)',
                    border:
                      '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily:
                        "'Poppins', sans-serif",
                      lineHeight: 1,
                    }}
                  >
                    {status.val}
                  </span>

                  <span
                    style={{
                      fontSize: 7,
                      color:
                        'rgba(255,255,255,0.6)',
                      fontWeight: 700,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        0.5,
                      fontFamily:
                        "'Poppins', sans-serif",
                    }}
                  >
                    {status.label}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                width: 1,
                height: 24,
                background:
                  'rgba(255,255,255,0.2)',
              }}
            />

            {/* Clock */}
            <div
              style={{
                textAlign: 'center',
                display: 'flex',
                flexDirection:
                  'column',
                alignItems:
                  'center',
              }}
            >
              <p
                style={{
                  fontFamily:
                    'monospace',
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#fff',
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                {clock ||
                  '00:00:00'}
              </p>

              <p
                style={{
                  fontSize: 10,
                  color:
                    'rgba(255,255,255,0.5)',
                  margin: 0,
                  fontFamily:
                    "'Poppins', sans-serif",
                }}
              >
                {currentDate}
              </p>
            </div>

            <div
              style={{
                width: 1,
                height: 24,
                background:
                  'rgba(255,255,255,0.2)',
              }}
            />

            {/* Audio */}
            <button
              onClick={() =>
                setAudio(
                  (previous) =>
                    !previous
                )
              }
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 4,
                padding:
                  '6px 10px',
                borderRadius: 8,
                border:
                  '1.5px solid rgba(255,255,255,0.2)',
                background:
                  'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily:
                  "'Poppins', sans-serif",
                transition:
                  'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(event) => {
                event.currentTarget.style.boxShadow =
                  '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(event) => {
                event.currentTarget.style.boxShadow =
                  'none';
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background =
                  'rgba(255,255,255,0.18)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background =
                  'rgba(255,255,255,0.08)';
              }}
            >
              {audio ? (
                <Volume2 size={16} />
              ) : (
                <VolumeX size={16} />
              )}
            </button>

            {/* Theme */}
            <button
              onClick={toggle}
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 4,
                padding:
                  '6px 10px',
                borderRadius: 8,
                border:
                  '1.5px solid rgba(255,255,255,0.2)',
                background:
                  'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily:
                  "'Poppins', sans-serif",
                transition:
                  'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(event) => {
                event.currentTarget.style.boxShadow =
                  '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(event) => {
                event.currentTarget.style.boxShadow =
                  'none';
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background =
                  'rgba(255,255,255,0.18)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background =
                  'rgba(255,255,255,0.08)';
              }}
            >
              {isDark ? (
                <Sun size={16} />
              ) : (
                <Moon size={16} />
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 4,
                padding:
                  '6px 12px',
                borderRadius: 8,
                border:
                  '1.5px solid rgba(255,255,255,0.2)',
                background:
                  'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily:
                  "'Poppins', sans-serif",
                opacity:
                  loggingOut
                    ? 0.6
                    : 1,
                transition:
                  'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(event) => {
                if (!loggingOut) {
                  event.currentTarget.style.boxShadow =
                    '0 0 0 3px rgba(255,255,255,0.3)';
                }
              }}
              onBlur={(event) => {
                event.currentTarget.style.boxShadow =
                  'none';
              }}
              onMouseEnter={(event) => {
                if (!loggingOut) {
                  event.currentTarget.style.background =
                    'rgba(255,255,255,0.18)';
                }
              }}
              onMouseLeave={(event) => {
                if (!loggingOut) {
                  event.currentTarget.style.background =
                    'rgba(255,255,255,0.08)';
                }
              }}
            >
              <LogOut size={16} />

              {loggingOut
                ? 'Signing out…'
                : 'Sign Out'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            style={{
              display: 'none',
              alignItems:
                'center',
              justifyContent:
                'center',
              width: 38,
              height: 38,
              borderRadius: 8,
              border:
                '1.5px solid rgba(255,255,255,0.2)',
              background:
                'rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
              transition:
                'all 0.2s ease',
              outline: 'none',
            }}
            className="mobile-menu-btn"
            onFocus={(event) => {
              event.currentTarget.style.boxShadow =
                '0 0 0 3px rgba(255,255,255,0.3)';
            }}
            onBlur={(event) => {
              event.currentTarget.style.boxShadow =
                'none';
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background =
                'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background =
                'rgba(255,255,255,0.1)';
            }}
          >
            {mobileMenuOpen ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile Menu ── */}
      {mobileMenuOpen && (
        <div
          style={{
            background: D.card,
            borderBottom: `1px solid ${D.border}`,
            padding: '16px 20px',
            display: 'none',
            flexDirection:
              'column',
            gap: 12,
            position: 'sticky',
            top: 60,
            zIndex: 9,
            boxShadow:
              '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily:
              "'Poppins', sans-serif",
          }}
          className="mobile-dropdown"
        >
          {/* Status */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
                background:
                  apiColor.bg,
                border: `1px solid ${apiColor.border}`,
                borderRadius: 16,
                padding:
                  '4px 10px',
              }}
            >
              {apiState ===
              'live' ? (
                <Wifi
                  size={12}
                  color={
                    apiColor.text
                  }
                />
              ) : apiState ===
                'error' ? (
                <WifiOff
                  size={12}
                  color={
                    apiColor.text
                  }
                />
              ) : (
                <RefreshCw
                  size={12}
                  color={
                    apiColor.text
                  }
                  className="animate-spin"
                />
              )}

              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color:
                    apiColor.text,
                  textTransform:
                    'uppercase',
                }}
              >
                {apiState ===
                'live'
                  ? 'REST'
                  : apiState ===
                    'error'
                  ? 'Error'
                  : '…'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
                background:
                  wsColor.bg,
                border: `1px solid ${wsColor.border}`,
                borderRadius: 16,
                padding:
                  '4px 10px',
              }}
            >
              <Radio
                size={12}
                color={
                  wsColor.text
                }
              />

              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color:
                    wsColor.text,
                  textTransform:
                    'uppercase',
                }}
              >
                WS{' '}
                {wsState ===
                'connected'
                  ? 'Live'
                  : wsState ===
                    'connecting'
                  ? '…'
                  : 'Off'}
              </span>

              {wsState ===
                'connected' && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius:
                      '50%',
                    background:
                      '#22c55e',
                    display:
                      'inline-block',
                  }}
                />
              )}
            </div>
          </div>

          {/* Counts */}
          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            {[
              {
                val: counts.pending,
                label: 'Pending',
              },
              {
                val: counts.preparing,
                label: 'Preparing',
              },
              {
                val: counts.ready,
                label: 'Ready',
              },
            ].map((status) => (
              <div
                key={
                  status.label
                }
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: 4,
                  padding:
                    '4px 10px',
                  borderRadius: 8,
                  background:
                    'rgba(255,255,255,0.05)',
                  border: `1px solid ${D.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: D.text,
                  }}
                >
                  {status.val}
                </span>

                <span
                  style={{
                    fontSize: 10,
                    color: D.muted,
                  }}
                >
                  {status.label}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {/* Audio */}
            <button
              onClick={() =>
                setAudio(
                  (previous) =>
                    !previous
                )
              }
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
                padding:
                  '8px 14px',
                borderRadius: 8,
                border: `1.5px solid ${
                  audio
                    ? 'rgba(255,255,255,0.2)'
                    : '#FFD0D0'
                }`,
                background: audio
                  ? 'rgba(255,255,255,0.08)'
                  : '#FFF0F0',
                color: audio
                  ? D.text
                  : BRAND,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily:
                  "'Poppins', sans-serif",
              }}
            >
              {audio ? (
                <Volume2 size={16} />
              ) : (
                <VolumeX size={16} />
              )}

              {audio
                ? 'Sound On'
                : 'Sound Off'}
            </button>

            {/* Theme */}
            <button
              onClick={toggle}
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
                padding:
                  '8px 14px',
                borderRadius: 8,
                border: `1.5px solid ${D.border}`,
                background:
                  D.card2,
                color: D.text,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily:
                  "'Poppins', sans-serif",
              }}
            >
              {isDark ? (
                <Sun size={16} />
              ) : (
                <Moon size={16} />
              )}

              {isDark
                ? 'Light'
                : 'Dark'}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
                padding:
                  '8px 14px',
                borderRadius: 8,
                border:
                  '1.5px solid #FFD0D0',
                background:
                  '#FFF0F0',
                color: BRAND,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily:
                  "'Poppins', sans-serif",
                opacity:
                  loggingOut
                    ? 0.6
                    : 1,
              }}
            >
              <LogOut size={16} />

              {loggingOut
                ? 'Signing out…'
                : 'Sign Out'}
            </button>
          </div>
        </div>
      )}

      {/* ── API Error ── */}
      {apiState ===
        'error' && (
        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            gap: 12,
            padding:
              '10px 16px',
            background:
              TONE.danger.bg,
            borderBottom: `1px solid ${TONE.danger.border}`,
            flexShrink: 0,
          }}
        >
          <WifiOff
            size={14}
            color={
              TONE.danger.text
            }
          />

          <p
            style={{
              fontSize: 12,
              color:
                TONE.danger.text,
              flex: 1,
              margin: 0,
            }}
          >
            {apiError}
          </p>

          <button
            onClick={() =>
              loadOrders()
            }
            style={{
              padding:
                '4px 14px',
              borderRadius: 8,
              background:
                TONE.danger.bg,
              border: `1px solid ${TONE.danger.border}`,
              color:
                TONE.danger.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems:
            'center',
          gap: 6,
          padding:
            '8px 12px',
          background: D.card,
          borderBottom: `1.5px solid ${D.border}`,
          flexShrink: 0,
          overflowX: 'auto',
          flexWrap: 'nowrap',
          fontFamily:
            "'Poppins', sans-serif",
        }}
      >
        {(
          [
            {
              key: 'all',
              label: 'All',
            },
            {
              key: 'new',
              label: '🟠 New',
            },
            {
              key: 'preparing',
              label: '🔵 Prep',
            },
            {
              key: 'ready',
              label: '🟢 Ready',
            },
          ] as const
        ).map((item) => {
          const active =
            filter === item.key;

          return (
            <button
              key={item.key}
              onClick={() =>
                setFilter(
                  item.key
                )
              }
              style={{
                padding:
                  '4px 12px',
                borderRadius: 16,
                border: `1.5px solid ${
                  active
                    ? BRAND
                    : D.border
                }`,
                background: active
                  ? TONE.danger.bg
                  : D.card,
                color: active
                  ? BRAND
                  : D.muted,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace:
                  'nowrap',
                flexShrink: 0,
                fontFamily:
                  "'Poppins', sans-serif",
              }}
            >
              {item.label}
            </button>
          );
        })}

        <div
          style={{
            width: 1,
            height: 16,
            background:
              D.border,
            margin: '0 4px',
            flexShrink: 0,
          }}
        />

        <button
          onClick={() =>
            setFilter(
              'delivered'
            )
          }
          style={{
            padding:
              '4px 12px',
            borderRadius: 16,
            border: `1.5px solid ${
              filter ===
              'delivered'
                ? '#7c3aed'
                : D.border
            }`,
            background:
              filter ===
              'delivered'
                ? TONE.purple.bg
                : D.card,
            color:
              filter ===
              'delivered'
                ? TONE.purple.text
                : D.muted,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace:
              'nowrap',
            flexShrink: 0,
            fontFamily:
              "'Poppins', sans-serif",
          }}
        >
          ✓ Done
        </button>
      </div>

      {/* ── WS Log ── */}
      {wsLog.length >
        0 && (
        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            gap: 8,
            padding:
              '4px 12px',
            background:
              TONE.green.bg,
            borderBottom: `1px solid ${TONE.green.border}`,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <Radio
            size={10}
            color={
              TONE.green.text
            }
          />

          <p
            style={{
              fontSize: 9,
              color:
                TONE.green.text,
              fontFamily:
                'monospace',
              overflow:
                'hidden',
              textOverflow:
                'ellipsis',
              whiteSpace:
                'nowrap',
              flex: 1,
              margin: 0,
            }}
          >
            {wsLog[0]}
          </p>

          <span
            style={{
              fontSize: 8,
              color: D.subtle,
            }}
          >
            {wsLog.length}
          </span>
        </div>
      )}

      {/* ── Loading ── */}
      {apiState ===
        'loading' &&
        orders.length ===
          0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection:
                'column',
              alignItems:
                'center',
              justifyContent:
                'center',
              gap: 16,
              padding:
                '20px',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: `3px solid ${BRAND}`,
                borderTopColor:
                  'transparent',
                borderRadius:
                  '50%',
                animation:
                  'spin 0.8s linear infinite',
              }}
            />

            <p
              style={{
                fontSize: 14,
                color: D.muted,
                fontWeight: 600,
              }}
            >
              Loading orders…
            </p>
          </div>
        )}

      {/* ── Grid ── */}
      {(apiState !==
        'loading' ||
        orders.length >
          0) && (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
            padding:
              '12px',
            alignContent:
              'start',
            overflowY:
              'auto',
          }}
        >
          {filtered.length ===
            0 && (
            <div
              style={{
                gridColumn:
                  '1/-1',
                display: 'flex',
                flexDirection:
                  'column',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                padding:
                  '40px 16px',
                gap: 12,
                border: `2px dashed ${D.border}`,
                borderRadius: 20,
                background:
                  D.card,
              }}
            >
              <span
                style={{
                  fontSize: 32,
                  opacity: 0.2,
                }}
              >
                ✔️
              </span>

              <p
                style={{
                  fontSize: 13,
                  color: D.muted,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                No orders in
                this category
              </p>
            </div>
          )}

          {filtered.map(
            (order) => {
              const pct = Math.min(
                100,
                (order.elapsedSeconds /
                  order.maxSeconds) *
                  100
              );

              const isUrgent =
                pct >= 90;

              const isAdvancing =
                advancing ===
                order.id;

              const allDone =
                order.items.length >
                  0 &&
                order.items.every(
                  (item) =>
                    item.done
                );

              return (
                <div
                  key={order.id}
                  style={{
                    background:
                      D.card,
                    borderRadius:
                      16,
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    border: `1.5px solid ${
                      isUrgent
                        ? TONE.danger
                            .border
                        : D.border
                    }`,
                    boxShadow:
                      isUrgent
                        ? '0 0 0 3px rgba(255,87,35,0.08),0 4px 16px rgba(255,87,35,0.08)'
                        : isDark
                        ? 'none'
                        : '0 2px 12px rgba(0,0,0,0.06)',
                    transition:
                      'all 0.2s',
                    overflow:
                      'hidden',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      height: 4,
                      background:
                        STRIP_COLOR[
                          order.status
                        ],
                    }}
                  />

                  {/* Order Header */}
                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'flex-start',
                      justifyContent:
                        'space-between',
                      padding:
                        '10px 14px 8px',
                      borderBottom: `1px solid ${D.border}`,
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: 6,
                          flexWrap:
                            'wrap',
                        }}
                      >
                        <p
                          style={{
                            fontFamily:
                              'monospace',
                            fontSize: 12,
                            fontWeight: 800,
                            color:
                              D.text,
                            margin: 0,
                          }}
                        >
                          #
                          {
                            order.id
                          }
                        </p>

                        {allDone &&
                          order.status !==
                            'delivered' && (
                            <span
                              style={{
                                fontSize: 8,
                                background:
                                  TONE
                                    .green
                                    .bg,
                                border: `1px solid ${TONE.green.border}`,
                                color:
                                  TONE
                                    .green
                                    .text,
                                padding:
                                  '1px 6px',
                                borderRadius:
                                  12,
                                fontWeight: 700,
                              }}
                            >
                              DONE
                            </span>
                          )}
                      </div>

                      <p
                        style={{
                          fontSize: 10,
                          color:
                            D.muted,
                          margin:
                            '2px 0 0',
                        }}
                      >
                        🪑 Table{' '}
                        {
                          order.table
                        }{' '}
                        ·{' '}
                        {
                          order.zone
                        }
                      </p>
                    </div>

                    <div
                      style={{
                        textAlign:
                          'right',
                        flexShrink: 0,
                      }}
                    >
                      <p
                        style={{
                          fontFamily:
                            'monospace',
                          fontSize: 18,
                          fontWeight: 800,
                          margin: 0,
                        }}
                        className={timerColorClass(
                          order.elapsedSeconds,
                          order.maxSeconds
                        )}
                      >
                        {formatTimer(
                          order.elapsedSeconds
                        )}
                      </p>

                      <p
                        style={{
                          fontSize: 9,
                          color:
                            D.subtle,
                          margin:
                            '1px 0 0',
                        }}
                      >
                        {
                          order.placedAt
                        }
                      </p>
                    </div>
                  </div>

                  {/* Timer Bar */}
                  <div
                    style={{
                      height: 3,
                      background:
                        D.border,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius:
                          4,
                        transition:
                          'width 1s',
                        width: `${pct}%`,
                        background:
                          timerBarColor(
                            order.elapsedSeconds,
                            order.maxSeconds
                          ),
                      }}
                    />
                  </div>

                  {/* Items */}
                  <div
                    style={{
                      display:
                        'flex',
                      flexDirection:
                        'column',
                      gap: 6,
                      padding:
                        '10px 14px',
                      flex: 1,
                    }}
                  >
                    {order.items.map(
                      (dish, index) => {
                        const item =
                          dish as KdsOrderItemWithImage;

                        const totalQty =
                          dish.qty ||
                          1;

                        const addons =
                          item.addOns ??
                          [];

                        const hasAddons =
                          addons.length >
                          0;

                        return (
                          <div
                            key={
                              index
                            }
                            style={{
                              display:
                                'flex',
                              flexDirection:
                                'column',
                              gap: 4,
                            }}
                          >
                            {/* Main Item */}
                            <div
                              style={{
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                gap: 10,
                              }}
                            >
                              {/* Image */}
                              <div
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 8,
                                  overflow:
                                    'hidden',
                                  flexShrink: 0,
                                  background:
                                    D.card2,
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'center',
                                }}
                              >
                                {item.imageUrl ? (
                                  <Image
                                    src={
                                      item.imageUrl
                                    }
                                    alt={
                                      dish.name
                                    }
                                    width={
                                      40
                                    }
                                    height={
                                      40
                                    }
                                    unoptimized
                                    style={{
                                      width:
                                        '100%',
                                      height:
                                        '100%',
                                      objectFit:
                                        'cover',
                                    }}
                                  />
                                ) : (
                                  <span
                                    style={{
                                      fontSize:
                                        20,
                                    }}
                                  >
                                    {dish.emoji ||
                                      '🍽️'}
                                  </span>
                                )}
                              </div>

                              {/* Name */}
                              <div
                                style={{
                                  flex: 1,
                                  minWidth:
                                    0,
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      'flex',
                                    alignItems:
                                      'center',
                                    gap: 6,
                                    flexWrap:
                                      'wrap',
                                  }}
                                >
                                  <p
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      margin: 0,
                                      color:
                                        dish.done
                                          ? D.subtle
                                          : D.text,
                                      textDecoration:
                                        dish.done
                                          ? 'line-through'
                                          : 'none',
                                    }}
                                  >
                                    {
                                      dish.name
                                    }
                                  </p>

                                  {totalQty >
                                    1 && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        background:
                                          BRAND,
                                        color:
                                          '#fff',
                                        padding:
                                          '1px 8px',
                                        borderRadius:
                                          12,
                                      }}
                                    >
                                      ×
                                      {
                                        totalQty
                                      }
                                    </span>
                                  )}
                                </div>

                                {/* Inline Addons */}
                                {hasAddons && (
                                  <div
                                    style={{
                                      display:
                                        'flex',
                                      flexWrap:
                                        'wrap',
                                      gap: 3,
                                      marginTop:
                                        2,
                                    }}
                                  >
                                    {addons.map(
                                      (
                                        addon,
                                        addonIndex
                                      ) => {
                                        const addonObject =
                                          typeof addon ===
                                          'string'
                                            ? {
                                                name: addon,
                                              }
                                            : addon;

                                        const addonQty =
                                          typeof addon ===
                                          'string'
                                            ? 1
                                            : addon.qty ||
                                              1;

                                        return (
                                          <span
                                            key={
                                              addonIndex
                                            }
                                            style={{
                                              fontSize: 8,
                                              color:
                                                D.muted,
                                              background:
                                                D.card2,
                                              padding:
                                                '1px 8px',
                                              borderRadius:
                                                10,
                                              border: `1px solid ${D.border}`,
                                              display:
                                                'inline-flex',
                                              alignItems:
                                                'center',
                                              gap: 2,
                                            }}
                                          >
                                            +
                                            {
                                              addonObject.name
                                            }

                                            {addonQty >
                                              1 && (
                                              <span
                                                style={{
                                                  fontWeight: 700,
                                                  color:
                                                    BRAND,
                                                  background:
                                                    `${BRAND}15`,
                                                  padding:
                                                    '0 4px',
                                                  borderRadius:
                                                    3,
                                                  fontSize: 7,
                                                }}
                                              >
                                                ×
                                                {
                                                  addonQty
                                                }
                                              </span>
                                            )}
                                          </span>
                                        );
                                      }
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Done Toggle */}
                              <button
                                onClick={() =>
                                  toggleDish(
                                    order.id,
                                    index
                                  )
                                }
                                aria-label={
                                  dish.done
                                    ? `Mark ${dish.name} as not done`
                                    : `Mark ${dish.name} as done`
                                }
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius:
                                    5,
                                  border: `1.5px solid ${
                                    dish.done
                                      ? BRAND
                                      : D.border
                                  }`,
                                  background:
                                    dish.done
                                      ? BRAND
                                      : D.card,
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'center',
                                  cursor:
                                    'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                {dish.done && (
                                  <span
                                    style={{
                                      color:
                                        '#fff',
                                      fontSize:
                                        10,
                                      fontWeight:
                                        800,
                                    }}
                                  >
                                    ✓
                                  </span>
                                )}
                              </button>
                            </div>

                            {/* Detailed Addons */}
                            {hasAddons && (
                              <div
                                style={{
                                  marginLeft:
                                    50,
                                  display:
                                    'flex',
                                  flexWrap:
                                    'wrap',
                                  gap: 4,
                                  paddingLeft:
                                    4,
                                  borderLeft: `2px solid ${D.border}`,
                                }}
                              >
                                {addons.map(
                                  (
                                    addon,
                                    addonIndex
                                  ) => {
                                    const addonObject: {
                                      name?: string;
                                      qty?: number;
                                      price?: number;
                                    } =
                                      typeof addon ===
                                      'string'
                                        ? {
                                            name: addon,
                                          }
                                        : addon;

                                    const addonQty =
                                      addonObject.qty ||
                                      1;

                                    return (
                                      <div
                                        key={
                                          addonIndex
                                        }
                                        style={{
                                          display:
                                            'flex',
                                          alignItems:
                                            'center',
                                          gap: 4,
                                          background:
                                            D.card2,
                                          padding:
                                            '2px 8px 2px 6px',
                                          borderRadius:
                                            10,
                                          border: `1px solid ${D.border}`,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize:
                                              8,
                                            color:
                                              D.subtle,
                                          }}
                                        >
                                          +
                                        </span>

                                        <span
                                          style={{
                                            fontSize:
                                              9,
                                            fontWeight:
                                              500,
                                            color:
                                              D.text,
                                          }}
                                        >
                                          {
                                            addonObject.name
                                          }
                                        </span>

                                        {addonQty >
                                          1 && (
                                          <span
                                            style={{
                                              fontSize:
                                                8,
                                              fontWeight:
                                                700,
                                              color:
                                                BRAND,
                                              background:
                                                `${BRAND}15`,
                                              padding:
                                                '0 4px',
                                              borderRadius:
                                                4,
                                            }}
                                          >
                                            ×
                                            {
                                              addonQty
                                            }
                                          </span>
                                        )}

                                        {typeof addonObject.price ===
                                          'number' && (
                                          <span
                                            style={{
                                              fontSize:
                                                8,
                                              color:
                                                D.subtle,
                                            }}
                                          >
                                            Rs.{' '}
                                            {addonObject.price.toFixed(
                                              2
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* Note */}
                  {order.note && (
                    <div
                      style={{
                        margin:
                          '0 10px 6px',
                        padding:
                          '6px 10px',
                        background:
                          TONE.amber.bg,
                        border: `1px solid ${TONE.amber.border}`,
                        borderRadius: 10,
                        display:
                          'flex',
                        alignItems:
                          'flex-start',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          color:
                            TONE.amber
                              .text,
                          fontSize: 10,
                        }}
                      >
                        ⚠
                      </span>

                      <p
                        style={{
                          fontSize: 9,
                          color:
                            TONE.amber
                              .text,
                          lineHeight: 1.4,
                          margin: 0,
                          fontWeight: 600,
                        }}
                      >
                        {
                          order.note
                        }
                      </p>
                    </div>
                  )}

                  {/* Action */}
                  <div
                    style={{
                      display:
                        'flex',
                      gap: 6,
                      padding:
                        '8px 10px 10px',
                      borderTop: `1px solid ${D.border}`,
                    }}
                  >
                    {BTN_CFG[
                      order.status
                    ].map(
                      (
                        buttonConfig,
                        buttonIndex
                      ) => (
                        <button
                          key={
                            buttonConfig.label
                          }
                          onClick={() =>
                            buttonIndex ===
                              0 &&
                            advanceOrder(
                              order.id
                            )
                          }
                          disabled={
                            order.status ===
                              'delivered' ||
                            isAdvancing
                          }
                          style={{
                            flex: 1,
                            height: 32,
                            borderRadius: 8,
                            border: `1.5px solid ${buttonConfig.border}`,
                            background:
                              buttonConfig.bg,
                            color:
                              buttonConfig.color,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor:
                              order.status ===
                              'delivered'
                                ? 'default'
                                : 'pointer',
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            gap: 4,
                            transition:
                              'all 0.2s',
                            opacity:
                              order.status ===
                                'delivered' ||
                              isAdvancing
                                ? 0.5
                                : 1,
                            fontFamily:
                              "'Poppins', sans-serif",
                            outline:
                              'none',
                          }}
                        >
                          {isAdvancing &&
                          buttonIndex ===
                            0 ? (
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                border: `2px solid ${buttonConfig.color}`,
                                borderTopColor:
                                  'transparent',
                                borderRadius:
                                  '50%',
                                animation:
                                  'spin 0.8s linear infinite',
                              }}
                            />
                          ) : (
                            buttonConfig.label
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      <style>{`
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Desktop */
        @media (min-width: 768px) {
          .desktop-controls {
            display: flex !important;
          }

          .desktop-status {
            display: flex !important;
          }

          .mobile-menu-btn {
            display: none !important;
          }

          .mobile-dropdown {
            display: none !important;
          }
        }

        /* Mobile */
        @media (max-width: 767px) {
          .desktop-controls {
            display: none !important;
          }

          .desktop-status {
            display: none !important;
          }

          .mobile-menu-btn {
            display: flex !important;
          }

          .mobile-dropdown {
            display: flex !important;
          }

          header {
            padding: 8px 12px !important;
          }

          header > div:last-child {
            gap: 4px !important;
          }
        }

        /* Small mobile */
        @media (max-width: 480px) {
          header {
            padding: 6px 10px !important;
            gap: 6px !important;
          }

          header img {
            width: 80px !important;
            height: 24px !important;
          }

          .mobile-menu-btn {
            width: 32px !important;
            height: 32px !important;
          }

          .mobile-menu-btn svg {
            width: 16px !important;
            height: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}