'use client';

/**
 * GuestOrdersSocketProvider
 * ==========================
 * A single WebSocket connection for the guest's whole session — connected
 * once here (not per-page), so navigating between /guest/menu, /guest/cart,
 * /guest/tracking etc. never tears the socket down or misses an update.
 *
 * Reconnect strategy (event-driven, no polling/timers):
 *   1. If the socket closes/errors unexpectedly → retry with exponential
 *      backoff (1s, 2s, 4s, 8s, capped at 16s).
 *   2. If the tab comes back to the foreground (visibilitychange) and the
 *      socket isn't open → reconnect immediately. Mobile browsers routinely
 *      kill background sockets; this catches that the moment the guest
 *      looks at the screen again, rather than never.
 *   3. A lightweight "ping" every few minutes doubles as a keepalive AND
 *      refreshes the connection's TTL server-side (see ws_message handler).
 *
 * Any page can call useGuestOrdersSocket() to read the latest order-update
 * event, without needing to know a socket exists.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { connectWebSocket } from '@/lib/orders';

export interface GuestOrderUpdateEvent {
    orderId: string;
    status: string;
    message?: string;
    raw: any;
}

interface GuestOrdersSocketContextValue {
    connected: boolean;
    lastUpdate: GuestOrderUpdateEvent | null;
}

const GuestOrdersSocketContext =
    createContext<GuestOrdersSocketContextValue>({
        connected: false,
        lastUpdate: null,
    });

export function useGuestOrdersSocket() {
    return useContext(GuestOrdersSocketContext);
}

const MAX_BACKOFF_MS = 16000;
const PING_INTERVAL_MS = 3 * 60 * 1000; // keepalive + TTL refresh, not polling for data

const STATUS_LABELS: Record<string, string> = {
    RECEIVED: 'Order confirmed',
    PENDING: 'Order confirmed',
    PREPARING: 'Being prepared',
    IN_PROGRESS: 'Being prepared',
    KITCHEN_ACCEPTED: 'Being prepared',
    READY: 'Ready for pickup',
    READY_TO_SERVE: 'Ready for pickup',
    FOOD_READY: 'Ready for pickup',
    DELIVERED: 'Delivered',
    COMPLETED: 'Delivered',
    CANCELLED: 'Cancelled',
    TIMED_OUT: 'Cancelled',
};

export default function GuestOrdersSocketProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [connected, setConnected] = useState(false);
    const [lastUpdate, setLastUpdate] =
        useState<GuestOrderUpdateEvent | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backoffRef = useRef(1000);
    const mountedRef = useRef(true);

    const clearPingTimer = () => {
        if (pingTimerRef.current) {
            clearInterval(pingTimerRef.current);
            pingTimerRef.current = null;
        }
    };

    const clearReconnectTimer = () => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    };

    const scheduleReconnect = useCallback(() => {
        if (!mountedRef.current) return;
        clearReconnectTimer();

        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);

        reconnectTimerRef.current = setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            connect();
        }, delay);
    }, []);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;

        // Already connected/connecting — don't stack sockets.
        if (
            wsRef.current &&
            (wsRef.current.readyState === WebSocket.OPEN ||
                wsRef.current.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        const hasSession =
            typeof window !== 'undefined' &&
            sessionStorage.getItem('guestSessionId');

        if (!hasSession) {
            // No guest session yet (e.g. before scanning a QR code) — nothing
            // to connect to. The next page that establishes a session will
            // trigger a connect via the visibilitychange/mount effect.
            return;
        }

        let socket: WebSocket;
        try {
            socket = connectWebSocket();
        } catch (error) {
            console.error('[Guest WS] Failed to create socket:', error);
            scheduleReconnect();
            return;
        }

        wsRef.current = socket;

        socket.onopen = () => {
            console.log('[Guest WS] Connected');
            backoffRef.current = 1000; // reset backoff on a healthy connection
            if (mountedRef.current) setConnected(true);

            clearPingTimer();
            pingTimerRef.current = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ action: 'ping' }));
                }
            }, PING_INTERVAL_MS);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                const orderId = data?.orderId ?? data?.order?.orderId ?? data?.order?.id;
                const status = data?.status ?? data?.order?.status;

                if (!orderId || !status) return;

                const update: GuestOrderUpdateEvent = {
                    orderId,
                    status,
                    message: data?.message,
                    raw: data,
                };

                if (mountedRef.current) setLastUpdate(update);
            } catch (error) {
                console.error('[Guest WS] Failed to parse message:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('[Guest WS] Error:', error);
        };

        socket.onclose = (event) => {
            console.log('[Guest WS] Closed', { code: event.code, wasClean: event.wasClean });
            if (mountedRef.current) setConnected(false);
            clearPingTimer();
            wsRef.current = null;

            // Unexpected close → reconnect. A clean close during unmount is
            // guarded by mountedRef, so this only fires for real drops.
            if (mountedRef.current) {
                scheduleReconnect();
            }
        };
    }, [scheduleReconnect]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;

            const isOpen = wsRef.current?.readyState === WebSocket.OPEN;
            if (!isOpen) {
                console.log('[Guest WS] Tab foregrounded, socket not open — reconnecting');
                backoffRef.current = 1000;
                connect();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            mountedRef.current = false;
            document.removeEventListener('visibilitychange', handleVisibility);
            clearPingTimer();
            clearReconnectTimer();

            if (wsRef.current) {
                wsRef.current.onclose = null; // don't trigger reconnect logic on intentional teardown
                wsRef.current.close();
                wsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <GuestOrdersSocketContext.Provider value={{ connected, lastUpdate }}>
            {children}
        </GuestOrdersSocketContext.Provider>
    );
}