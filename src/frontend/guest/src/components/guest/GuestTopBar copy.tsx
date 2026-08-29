'use client';

/**
 * GuestTopBar
 * ===========
 * Shared guest top bar:
 * - MenuLay logo
 * - Notifications bell
 * - Hamburger navigation
 * - Initial notification history from API
 * - Realtime guest notifications through WebSocket
 * - Notification sound
 */

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Home,
  BookOpen,
  Heart,
  ShoppingCart,
  FileText,
  User,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Info,
} from 'lucide-react';
import Image from 'next/image';

import { useTheme } from '@/hooks/useTheme';
import { useCartStore } from '@/lib/store';
import { getGuestScope, withScope } from '@/lib/guest-scope';
import { connectWebSocket } from '@/lib/orders';

// ============================================================================
// TYPES
// ============================================================================

interface NotificationItem {
  id: string | number;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type?: 'info' | 'success' | 'alert' | 'promo' | 'error';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BRAND = '#ff5723';

const NAV_TABS = [
  {
    key: 'home',
    label: 'Home',
    icon: Home,
    href: '/guest',
  },
  {
    key: 'menu',
    label: 'Menu',
    icon: BookOpen,
    href: '/guest/menu',
  },
  {
    key: 'favorites',
    label: 'Favorites',
    icon: Heart,
    href: '/guest/favorites',
  },
  {
    key: 'cart',
    label: 'Cart',
    icon: ShoppingCart,
    href: '/guest/cart',
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: FileText,
    href: '/guest/tracking',
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: User,
    href: '/guest/profile',
  },
];

const ROUTE_NAMES: Record<string, string> = {
  '/guest': 'Home',
  '/guest/menu': 'Menu',
  '/guest/favorites': 'Favorites',
  '/guest/cart': 'Cart',
  '/guest/checkout': 'Checkout',
  '/guest/tracking': 'Orders',
  '/guest/profile': 'Profile',
  '/guest/ar': 'AR View',
};

// ============================================================================
// THEME
// ============================================================================

const getColors = (isDark: boolean) => ({
  bg: isDark ? '#1C1C1C' : '#FFFFFF',

  border: isDark
    ? 'rgba(255,255,255,0.08)'
    : '#F0E8E0',

  text: isDark
    ? '#F5F0E8'
    : '#000000',

  muted: isDark
    ? '#9CA3AF'
    : '#6B6B6B',

  subtle: isDark
    ? '#6B7280'
    : '#9CA3AF',

  hoverBg: isDark
    ? 'rgba(255,255,255,0.05)'
    : '#FFF5F0',

  brand: BRAND,

  brandBg: 'rgba(255,87,35,0.12)',

  focusRing: isDark
    ? 'rgba(255,87,35,0.2)'
    : 'rgba(255,87,35,0.15)',

  dropdownBg: isDark
    ? '#1C1C1C'
    : '#FFFFFF',

  dropdownBorder: isDark
    ? 'rgba(255,255,255,0.08)'
    : '#F0E8E0',

  overlay: isDark
    ? 'rgba(0,0,0,0.5)'
    : 'rgba(0,0,0,0.3)',
});

// ============================================================================
// PAGE NAME
// ============================================================================

const getPageName = (pathname: string): string => {
  if (ROUTE_NAMES[pathname]) {
    return ROUTE_NAMES[pathname];
  }

  for (const [route, name] of Object.entries(ROUTE_NAMES)) {
    if (
      pathname.startsWith(route) &&
      route !== '/guest'
    ) {
      return name;
    }
  }

  return 'MenuLay';
};

// ============================================================================
// NOTIFICATION ICON
// ============================================================================

const getNotificationIcon = (
  type: NotificationItem['type']
) => {
  switch (type) {
    case 'success':
      return (
        <CheckCircle
          size={18}
          color="#22c55e"
        />
      );

    case 'promo':
      return (
        <AlertCircle
          size={18}
          color="#ff5723"
        />
      );

    case 'error':
      return (
        <XCircle
          size={18}
          color="#ef4444"
        />
      );

    case 'alert':
      return (
        <AlertCircle
          size={18}
          color="#ef4444"
        />
      );

    default:
      return (
        <Info
          size={18}
          color="#3b82f6"
        />
      );
  }
};

// ============================================================================
// NOTIFICATION BACKGROUND
// ============================================================================

const getNotificationBg = (
  type: NotificationItem['type'],
  isDark: boolean
) => {
  const darkMap = {
    success: 'rgba(34,197,94,0.15)',
    promo: 'rgba(255,87,35,0.15)',
    error: 'rgba(239,68,68,0.15)',
    alert: 'rgba(239,68,68,0.15)',
    info: 'rgba(59,130,246,0.15)',
  };

  const lightMap = {
    success: '#f0fdf4',
    promo: '#fff5f0',
    error: '#fef2f2',
    alert: '#fef2f2',
    info: '#eff6ff',
  };

  const notificationType =
    type || 'info';

  return isDark
    ? darkMap[notificationType]
    : lightMap[notificationType];
};

// ============================================================================
// FORMAT TIME
// ============================================================================

const formatNotificationTime = (
  value?: string | number
): string => {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleTimeString(
    'en-US',
    {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }
  );
};

// ============================================================================
// DEFAULT NOTIFICATION TITLE
// ============================================================================

const getDefaultNotificationTitle = (
  eventType: string,
  status?: string
): string => {
  const combined =
    `${eventType} ${status ?? ''}`.toLowerCase();

  if (
    combined.includes('ready') ||
    combined.includes('food_ready')
  ) {
    return 'Order Ready';
  }

  if (
    combined.includes('preparing') ||
    combined.includes('accepted')
  ) {
    return 'Order Being Prepared';
  }

  if (
    combined.includes('delivered') ||
    combined.includes('completed')
  ) {
    return 'Order Delivered';
  }

  if (
    combined.includes('cancel')
  ) {
    return 'Order Cancelled';
  }

  return 'Order Update';
};

// ============================================================================
// DEFAULT NOTIFICATION MESSAGE
// ============================================================================

const getDefaultNotificationMessage = (
  eventType: string,
  status?: string
): string => {
  const combined =
    `${eventType} ${status ?? ''}`.toLowerCase();

  if (
    combined.includes('ready') ||
    combined.includes('food_ready')
  ) {
    return 'Your order is ready for pickup.';
  }

  if (
    combined.includes('preparing') ||
    combined.includes('accepted')
  ) {
    return 'The kitchen has started preparing your order.';
  }

  if (
    combined.includes('delivered') ||
    combined.includes('completed')
  ) {
    return 'Your order has been delivered.';
  }

  if (
    combined.includes('cancel')
  ) {
    return 'Your order has been cancelled.';
  }

  return 'There is an update to your order.';
};

// ============================================================================
// NORMALIZE NOTIFICATION TYPE
// ============================================================================

const normalizeNotificationType = (
  type: string
): NotificationItem['type'] => {
  const value =
    String(type).toLowerCase();

  if (
    value.includes('success') ||
    value.includes('ready') ||
    value.includes('completed') ||
    value.includes('delivered')
  ) {
    return 'success';
  }

  if (
    value.includes('error') ||
    value.includes('cancel')
  ) {
    return 'error';
  }

  if (
    value.includes('alert') ||
    value.includes('warning')
  ) {
    return 'alert';
  }

  if (
    value.includes('promo')
  ) {
    return 'promo';
  }

  return 'info';
};

// ============================================================================
// NORMALIZE WEBSOCKET NOTIFICATION
// ============================================================================

const normalizeWebSocketNotification = (
  rawPayload: any
): NotificationItem | null => {
  console.log(
    '[Guest Notifications] WebSocket payload:',
    rawPayload
  );

  if (!rawPayload) {
    return null;
  }

  const notification =
    rawPayload.notification ??
    rawPayload.data?.notification ??
    rawPayload.data ??
    rawPayload;

  const eventType = String(
    rawPayload.type ??
    rawPayload.eventType ??
    rawPayload.event ??
    notification.type ??
    ''
  ).toLowerCase();

  // ========================================================================
  // DETECT NOTIFICATION EVENT
  // ========================================================================

  const hasOrderInformation =
    Boolean(
      notification.orderId ||
      notification.status ||
      notification.orderStatus
    );

  const isNotificationEvent =
    eventType.includes('notification') ||
    eventType.includes('order') ||
    eventType.includes('ready') ||
    eventType.includes('preparing') ||
    eventType.includes('accepted') ||
    eventType.includes('delivered') ||
    eventType.includes('completed') ||
    eventType.includes('cancel') ||
    eventType === 'success' ||
    Boolean(
      notification.title &&
      notification.message
    ) ||
    hasOrderInformation;

  if (!isNotificationEvent) {
    console.log(
      '[Guest Notifications] Ignoring non-notification WS event:',
      eventType
    );

    return null;
  }

  // ========================================================================
  // EXTRACT FIELDS
  // ========================================================================

  const id =
    notification.id ??
    notification.notificationId ??
    notification.notificationID ??
    notification.orderId ??
    `${Date.now()}-${Math.random()}`;

  const title =
    notification.title ??
    notification.heading ??
    notification.subject ??
    getDefaultNotificationTitle(
      eventType,
      notification.status
    );

  const message =
    notification.message ??
    notification.body ??
    notification.text ??
    getDefaultNotificationMessage(
      eventType,
      notification.status
    );

  const type =
    normalizeNotificationType(
      notification.type ??
      notification.notificationType ??
      eventType
    );

  const time =
    notification.time ??
    notification.createdAt ??
    notification.timestamp ??
    notification.updatedAt;

  return {
    id,
    title,
    message,
    time: formatNotificationTime(time),
    read: false,
    type,
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GuestTopBar() {

  const { isDark } = useTheme();

  const colors =
    getColors(isDark);

  const pathname =
    usePathname();

  const router =
    useRouter();

  const scope =
    getGuestScope();

  const { itemCount } =
    useCartStore();

  // ========================================================================
  // STATE
  // ========================================================================

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [isBellOpen, setIsBellOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  // ========================================================================
  // DERIVED
  // ========================================================================

  const pageName =
    getPageName(pathname);

  const cartCount =
    itemCount();

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;

  // ========================================================================
  // NOTIFICATION SOUND
  // ========================================================================

  const playNotificationSound =
    useCallback(() => {

      try {

        const audio =
          new Audio(
            '/sounds/notification.mp3'
          );

        audio.volume = 0.7;

        audio.play()
          .then(() => {

            console.log(
              '[Guest Notifications] Notification sound played'
            );

          })
          .catch((error) => {

            console.warn(
              '[Guest Notifications] Notification sound blocked:',
              error
            );

          });

      } catch (error) {

        console.error(
          '[Guest Notifications] Failed to create notification sound:',
          error
        );

      }

    }, []);

  // ========================================================================
  // AUDIO UNLOCK
  // ========================================================================

  const unlockNotificationAudio =
    useCallback(() => {

      try {

        const audio =
          new Audio(
            '/sounds/notification.mp3'
          );

        audio.volume = 0;

        audio.play()
          .then(() => {

            audio.pause();
            audio.currentTime = 0;

            console.log(
              '[Guest Notifications] Audio unlocked'
            );

          })
          .catch(() => {
            // Browser still requires user interaction.
          });

      } catch (error) {

        console.warn(
          '[Guest Notifications] Audio unlock failed:',
          error
        );

      }

    }, []);

  // ========================================================================
  // AUDIO UNLOCK EFFECT
  // ========================================================================

  useEffect(() => {

    const unlock =
      () => {

        unlockNotificationAudio();

        window.removeEventListener(
          'click',
          unlock
        );

        window.removeEventListener(
          'touchstart',
          unlock
        );

        window.removeEventListener(
          'keydown',
          unlock
        );

      };

    window.addEventListener(
      'click',
      unlock
    );

    window.addEventListener(
      'touchstart',
      unlock
    );

    window.addEventListener(
      'keydown',
      unlock
    );

    return () => {

      window.removeEventListener(
        'click',
        unlock
      );

      window.removeEventListener(
        'touchstart',
        unlock
      );

      window.removeEventListener(
        'keydown',
        unlock
      );

    };

  }, [unlockNotificationAudio]);

  // ========================================================================
  // FETCH NOTIFICATION HISTORY
  // ========================================================================

  const fetchNotifications =
    useCallback(async () => {

      try {

        setLoading(true);

        console.log(
          '[Guest Notifications] Fetching notification history...'
        );

        const response =
          await fetch(
            '/api/guest/notifications',
            {
              method: 'GET',
              cache: 'no-store',
            }
          );

        if (!response.ok) {

          const text =
            await response
              .text()
              .catch(() => '');

          console.error(
            '[Guest Notifications] API error:',
            response.status,
            text
          );

          return;
        }

        const data =
          await response.json();

        console.log(
          '[Guest Notifications] API response:',
          data
        );

        const rawNotifications =
          Array.isArray(data)
            ? data
            : data.notifications ??
              data.items ??
              data.data ??
              [];

        if (!Array.isArray(rawNotifications)) {

          console.warn(
            '[Guest Notifications] Unexpected response format:',
            data
          );

          return;
        }

        const normalized =
          rawNotifications.map(
            (
              item: any,
              index: number
            ) => {

              const timestamp =
                item.time ??
                item.createdAt ??
                item.timestamp;

              return {
                id:
                  item.id ??
                  item.notificationId ??
                  item.orderId ??
                  `notification-${index}`,

                title:
                  item.title ??
                  item.heading ??
                  'Order Update',

                message:
                  item.message ??
                  item.body ??
                  item.text ??
                  '',

                time:
                  formatNotificationTime(
                    timestamp
                  ),

                read:
                  Boolean(
                    item.read ??
                    item.isRead ??
                    false
                  ),

                type:
                  normalizeNotificationType(
                    item.type ??
                    item.notificationType ??
                    'info'
                  ),
              };
            }
          );

        setNotifications(
          normalized
        );

      } catch (error) {

        console.error(
          '[Guest Notifications] Failed to fetch notifications:',
          error
        );

      } finally {

        setLoading(false);

      }

    }, []);

  // ========================================================================
  // WEBSOCKET SETUP
  // ========================================================================

  useEffect(() => {

    let mounted = true;

    let socket:
      WebSocket | null = null;

    const initialize =
      async () => {

        if (!mounted) {
          return;
        }

        try {

          // ---------------------------------------------------------------
          // 1. Load notification history
          // ---------------------------------------------------------------

          await fetchNotifications();

          if (!mounted) {
            return;
          }

          // ---------------------------------------------------------------
          // 2. Connect WebSocket
          // ---------------------------------------------------------------

          console.log(
            '[Guest Notifications] Connecting WebSocket...'
          );

          socket =
            connectWebSocket();

          console.log(
            '[Guest Notifications] WebSocket instance created'
          );

          // ---------------------------------------------------------------
          // OPEN
          // ---------------------------------------------------------------

          socket.addEventListener(
            'open',
            () => {

              console.log(
                '[Guest Notifications] WebSocket OPEN'
              );

            }
          );

          // ---------------------------------------------------------------
          // MESSAGE
          // ---------------------------------------------------------------

          socket.addEventListener(
            'message',
            (event) => {

              try {

                console.log(
                  '[Guest Notifications] RAW WS MESSAGE:',
                  event.data
                );

                let payload =
                  event.data;

                if (
                  typeof payload ===
                  'string'
                ) {

                  try {

                    payload =
                      JSON.parse(
                        payload
                      );

                  } catch {

                    console.warn(
                      '[Guest Notifications] WS message is not JSON:',
                      payload
                    );

                    return;
                  }
                }

                console.log(
                  '[Guest Notifications] PARSED WS PAYLOAD:',
                  payload
                );

                const newNotification =
                  normalizeWebSocketNotification(
                    payload
                  );

                if (!newNotification) {

                  console.log(
                    '[Guest Notifications] Message was not converted to notification'
                  );

                  return;
                }

                if (!mounted) {
                  return;
                }

                setNotifications(
                  (prev) => {

                    const alreadyExists =
                      prev.some(
                        (item) =>
                          String(
                            item.id
                          ) ===
                          String(
                            newNotification.id
                          )
                      );

                    if (
                      alreadyExists
                    ) {

                      console.log(
                        '[Guest Notifications] Duplicate ignored:',
                        newNotification.id
                      );

                      return prev;
                    }

                    console.log(
                      '[Guest Notifications] NEW notification:',
                      newNotification
                    );

                    // -----------------------------------------------------
                    // Play sound
                    // -----------------------------------------------------

                    playNotificationSound();

                    return [
                      newNotification,
                      ...prev,
                    ];

                  }
                );

              } catch (error) {

                console.error(
                  '[Guest Notifications] Failed to process WS message:',
                  error
                );

              }

            }
          );

          // ---------------------------------------------------------------
          // ERROR
          // ---------------------------------------------------------------

          socket.addEventListener(
            'error',
            (error) => {

              console.error(
                '[Guest Notifications] WebSocket ERROR:',
                error
              );

            }
          );

          // ---------------------------------------------------------------
          // CLOSE
          // ---------------------------------------------------------------

          socket.addEventListener(
            'close',
            (event) => {

              console.log(
                '[Guest Notifications] WebSocket CLOSED:',
                {
                  code:
                    event.code,

                  reason:
                    event.reason,

                  wasClean:
                    event.wasClean,
                }
              );

            }
          );

        } catch (error) {

          console.error(
            '[Guest Notifications] Initialization failed:',
            error
          );

        }

      };

    initialize();

    return () => {

      mounted = false;

      if (socket) {

        console.log(
          '[Guest Notifications] Closing WebSocket...'
        );

        socket.close();

      }

    };

  }, [
    fetchNotifications,
    playNotificationSound,
  ]);

  // ========================================================================
  // UI CONTROLS
  // ========================================================================

  const closeAll =
    () => {

      setIsMenuOpen(false);
      setIsBellOpen(false);

    };

  const toggleMenu =
    () => {

      setIsMenuOpen(
        (prev) => !prev
      );

      setIsBellOpen(false);

    };

  const toggleBell =
    () => {

      setIsBellOpen(
        (prev) => !prev
      );

      setIsMenuOpen(false);

    };

  // ========================================================================
  // MARK ALL READ
  // ========================================================================

  const markAllAsRead =
    async () => {

      try {

        if (
          unreadCount > 0
        ) {

          await fetch(
            '/api/guest/notifications/mark-read',
            {
              method: 'POST',
            }
          );

        }

      } catch (error) {

        console.error(
          '[Guest Notifications] Failed to mark notifications as read:',
          error
        );

      } finally {

        setNotifications(
          (prev) =>
            prev.map(
              (item) => ({
                ...item,
                read: true,
              })
            )
        );

      }

    };

  // ========================================================================
  // NAVIGATION
  // ========================================================================

  const handleLogoClick =
    () => {

      router.push(
        withScope(
          '/guest',
          scope
        )
      );

      closeAll();

    };

  const handleNavigation =
    (href: string) => {

      const finalHref =
        href === '/guest' ||
        href === '/guest/menu'
          ? withScope(
              href,
              scope
            )
          : href;

      router.push(
        finalHref
      );

      closeAll();

    };

  const isActive =
    (href: string) => {

      if (
        href === '/guest'
      ) {

        return (
          pathname ===
          '/guest'
        );

      }

      return pathname.startsWith(
        href
      );

    };

  // ========================================================================
  // FOCUS
  // ========================================================================

  const handleFocus =
    (
      e: React.FocusEvent<HTMLButtonElement>
    ) => {

      e.currentTarget.style.boxShadow =
        `0 0 0 3px ${colors.focusRing}`;

    };

  const handleBlur =
    (
      e: React.FocusEvent<HTMLButtonElement>
    ) => {

      e.currentTarget.style.boxShadow =
        'none';

    };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <>
      {/* ====================================================================
          TOP BAR
      ==================================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: colors.bg,
          borderBottom:
            `1px solid ${colors.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          fontFamily:
            "'Poppins', sans-serif",
        }}
      >

        {/* LOGO */}

        <button
          onClick={
            handleLogoClick
          }
          aria-label="Go to Home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            outline: 'none',
            borderRadius: 8,
            transition:
              'all 0.2s ease',
          }}
        >

          <Image
            src="/images/nav/logo.png"
            alt="MenuLay Logo"
            width={107.5}
            height={35}
          />

        </button>

        {/* ACTIONS */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >

          {/* ================================================================
              NOTIFICATION BELL
          ================================================================ */}

          <button
            aria-label={
              `Notifications${
                unreadCount > 0
                  ? `, ${unreadCount} unread`
                  : ''
              }`
            }
            onClick={
              toggleBell
            }
            style={{
              padding: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              outline: 'none',
              borderRadius: 8,
              transition:
                'all 0.2s ease',
            }}
            onFocus={
              handleFocus
            }
            onBlur={
              handleBlur
            }
          >

            <Image
              src="/images/nav/Bell.png"
              alt="Notifications"
              width={28}
              height={28}
            />

            {/* BADGE */}

            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  minWidth: 18,
                  height: 18,
                  padding: '0 4px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border:
                    `2px solid ${colors.bg}`,
                  fontFamily:
                    "'Poppins', sans-serif",
                }}
              >
                {unreadCount > 99
                  ? '99+'
                  : unreadCount}
              </span>
            )}

          </button>

          {/* ================================================================
              HAMBURGER
          ================================================================ */}

          <button
            aria-label="Menu"
            onClick={
              toggleMenu
            }
            style={{
              padding: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              borderRadius: 8,
              transition:
                'all 0.2s ease',
            }}
            onFocus={
              handleFocus
            }
            onBlur={
              handleBlur
            }
          >

            {isMenuOpen ? (
              <X
                size={28}
                color={BRAND}
              />
            ) : (
              <Image
                src="/images/nav/Menu.png"
                alt="Menu"
                width={28}
                height={28}
              />
            )}

          </button>

        </div>

      </div>

      {/* ====================================================================
          NOTIFICATION DROPDOWN
      ==================================================================== */}

      {isBellOpen && (
        <>

          {/* OVERLAY */}

          <div
            onClick={
              closeAll
            }
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                colors.overlay,
              zIndex: 99,
            }}
          />

          {/* DROPDOWN */}

          <div
            style={{
              position: 'fixed',
              top: '72px',
              right: '50%',
              transform:
                'translateX(50%)',
              width: '100%',
              maxWidth: 480,
              background:
                colors.dropdownBg,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              boxShadow:
                isDark
                  ? '0 8px 32px rgba(0,0,0,0.3)'
                  : '0 8px 32px rgba(0,0,0,0.15)',
              zIndex: 100,
              borderTop:
                `2px solid ${BRAND}`,
              maxHeight: '70vh',
              overflowY: 'auto',
              fontFamily:
                "'Poppins', sans-serif",
            }}
          >

            {/* HEADER */}

            <div
              style={{
                padding:
                  '16px 20px 12px',
                borderBottom:
                  `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
              }}
            >

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >

                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: colors.text,
                  }}
                >
                  Notifications
                </span>

                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      background:
                        BRAND,
                      padding:
                        '2px 7px',
                      borderRadius: 10,
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}

              </div>

              {notifications.length > 0 && (
                <button
                  onClick={
                    markAllAsRead
                  }
                  style={{
                    fontSize: 12,
                    color: BRAND,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily:
                      "'Poppins', sans-serif",
                    outline: 'none',
                    padding:
                      '4px 8px',
                    borderRadius: 6,
                  }}
                  onFocus={
                    handleFocus
                  }
                  onBlur={
                    handleBlur
                  }
                >
                  Mark all as read
                </button>
              )}

            </div>

            {/* LOADING */}

            {loading && (
              <div
                style={{
                  display: 'flex',
                  flexDirection:
                    'column',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  padding:
                    '40px 20px',
                  textAlign:
                    'center',
                }}
              >

                <Bell
                  size={36}
                  color={
                    colors.muted
                  }
                  style={{
                    opacity: 0.35,
                  }}
                />

                <p
                  style={{
                    fontSize: 14,
                    color:
                      colors.muted,
                    marginTop: 12,
                    marginBottom: 0,
                  }}
                >
                  Loading notifications...
                </p>

              </div>
            )}

            {/* EMPTY */}

            {!loading &&
              notifications.length === 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection:
                      'column',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    padding:
                      '40px 20px',
                    textAlign:
                      'center',
                  }}
                >

                  <Bell
                    size={40}
                    color={
                      colors.muted
                    }
                    style={{
                      opacity: 0.3,
                    }}
                  />

                  <p
                    style={{
                      fontSize: 14,
                      color:
                        colors.muted,
                      marginTop: 12,
                      marginBottom: 0,
                    }}
                  >
                    No notifications
                  </p>

                </div>
              )}

            {/* NOTIFICATION LIST */}

            {!loading &&
              notifications.length > 0 && (
                <div>

                  {notifications.map(
                    (item) => (
                      <div
                        key={
                          String(
                            item.id
                          )
                        }
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'flex-start',
                          gap: 12,
                          padding:
                            '14px 20px',
                          borderBottom:
                            `1px solid ${colors.border}`,
                          background:
                            !item.read
                              ? colors.hoverBg
                              : 'transparent',
                          transition:
                            'background 0.2s ease',
                        }}
                      >

                        {/* ICON */}

                        <div
                          style={{
                            width: 36,
                            height: 36,
                            minWidth: 36,
                            borderRadius: 10,
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            background:
                              getNotificationBg(
                                item.type,
                                isDark
                              ),
                          }}
                        >
                          {getNotificationIcon(
                            item.type
                          )}
                        </div>

                        {/* CONTENT */}

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >

                          <div
                            style={{
                              display:
                                'flex',
                              alignItems:
                                'flex-start',
                              justifyContent:
                                'space-between',
                              gap: 8,
                            }}
                          >

                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight:
                                  item.read
                                    ? 500
                                    : 700,
                                color:
                                  colors.text,
                              }}
                            >
                              {item.title}
                            </p>

                            {!item.read && (
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  minWidth: 7,
                                  borderRadius:
                                    '50%',
                                  background:
                                    BRAND,
                                  marginTop: 6,
                                }}
                              />
                            )}

                          </div>

                          <p
                            style={{
                              margin:
                                '4px 0 0',
                              fontSize: 12,
                              lineHeight:
                                1.5,
                              color:
                                colors.muted,
                            }}
                          >
                            {item.message}
                          </p>

                          <span
                            style={{
                              display:
                                'block',
                              marginTop: 5,
                              fontSize: 10,
                              color:
                                colors.subtle,
                            }}
                          >
                            {item.time}
                          </span>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

          </div>

        </>
      )}

      {/* ====================================================================
          NAVIGATION DROPDOWN
      ==================================================================== */}

      {isMenuOpen && (
        <>

          {/* OVERLAY */}

          <div
            onClick={
              closeAll
            }
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                colors.overlay,
              zIndex: 99,
            }}
          />

          {/* MENU */}

          <div
            style={{
              position: 'fixed',
              top: '72px',
              right: '50%',
              transform:
                'translateX(50%)',
              width: '100%',
              maxWidth: 480,
              background:
                colors.dropdownBg,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              boxShadow:
                isDark
                  ? '0 8px 32px rgba(0,0,0,0.3)'
                  : '0 8px 32px rgba(0,0,0,0.15)',
              padding:
                '12px 0',
              zIndex: 100,
              borderTop:
                `2px solid ${BRAND}`,
              maxHeight:
                '80vh',
              overflowY:
                'auto',
              fontFamily:
                "'Poppins', sans-serif",
            }}
          >

            {NAV_TABS.map(
              (tab) => {

                const active =
                  isActive(
                    tab.href
                  );

                const Icon =
                  tab.icon;

                const isCart =
                  tab.key ===
                  'cart';

                return (
                  <button
                    key={
                      tab.key
                    }
                    onClick={() =>
                      handleNavigation(
                        tab.href
                      )
                    }
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: 14,
                      padding:
                        '12px 20px',
                      width: '100%',
                      background:
                        active
                          ? colors.hoverBg
                          : 'transparent',
                      border:
                        'none',
                      cursor:
                        'pointer',
                      transition:
                        'all 0.15s ease',
                      position:
                        'relative',
                      outline:
                        'none',
                      fontFamily:
                        "'Poppins', sans-serif",
                    }}
                    onFocus={
                      handleFocus
                    }
                    onBlur={
                      handleBlur
                    }
                    onMouseEnter={(
                      e
                    ) => {

                      e.currentTarget.style.background =
                        colors.hoverBg;

                    }}
                    onMouseLeave={(
                      e
                    ) => {

                      e.currentTarget.style.background =
                        active
                          ? colors.hoverBg
                          : 'transparent';

                    }}
                  >

                    <Icon
                      size={20}
                      color={
                        active
                          ? BRAND
                          : colors.text
                      }
                      strokeWidth={
                        active
                          ? 2.5
                          : 2
                      }
                    />

                    <span
                      style={{
                        flex: 1,
                        textAlign:
                          'left',
                        fontSize: 15,
                        fontWeight:
                          active
                            ? 700
                            : 500,
                        color:
                          active
                            ? BRAND
                            : colors.text,
                        fontFamily:
                          "'Poppins', sans-serif",
                      }}
                    >
                      {tab.label}
                    </span>

                    {/* CART COUNT */}

                    {isCart &&
                      cartCount >
                        0 && (
                        <span
                          style={{
                            background:
                              BRAND,
                            color:
                              '#fff',
                            fontSize: 11,
                            fontWeight:
                              700,
                            padding:
                              '1px 10px',
                            borderRadius:
                              12,
                            minWidth:
                              20,
                            textAlign:
                              'center',
                            fontFamily:
                              "'Poppins', sans-serif",
                          }}
                        >
                          {cartCount}
                        </span>
                      )}

                    {/* ACTIVE INDICATOR */}

                    {active && (
                      <span
                        style={{
                          width: 4,
                          height: 24,
                          background:
                            BRAND,
                          borderRadius:
                            2,
                          position:
                            'absolute',
                          right: 0,
                        }}
                      />
                    )}

                  </button>
                );
              }
            )}

          </div>

        </>
      )}

    </>
  );
}