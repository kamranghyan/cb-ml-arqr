'use client';

/**
 * GuestTopBar
 * ===========
 * Shared top bar: logo + page name + bell dropdown + hamburger dropdown menu.
 * 
 * Clicking the bell icon opens a notification dropdown.
 * Clicking the hamburger icon opens a navigation dropdown.
 */

import { useState, useEffect } from 'react';
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
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  XCircle,
  Info
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useCartStore } from '@/lib/store';
import { getGuestScope, withScope } from '@/lib/guest-scope';
import Image from 'next/image';


interface NotificationItem {
  id: string | number;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type?: 'info' | 'success' | 'alert';
}


const BRAND = '#ff5723';

// ── Theme Colors ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#1C1C1C' : '#FFFFFF',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#FFF5F0',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  dropdownBg: isDark ? '#1C1C1C' : '#FFFFFF',
  dropdownBorder: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  overlay: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
});

// Navigation tabs configuration
const NAV_TABS = [
  { key: 'home', label: 'Home', icon: Home, href: '/guest' },
  { key: 'menu', label: 'Menu', icon: BookOpen, href: '/guest/menu' },
  { key: 'favorites', label: 'Favorites', icon: Heart, href: '/guest/favorites' },
  { key: 'cart', label: 'Cart', icon: ShoppingCart, href: '/guest/cart' },
  { key: 'orders', label: 'Orders', icon: FileText, href: '/guest/tracking' },
  { key: 'profile', label: 'Profile', icon: User, href: '/guest/profile' },
];



// Get notification icon based on type
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle size={18} color="#22c55e" />;
    case 'promo':
      return <AlertCircle size={18} color="#ff5723" />;
    case 'error':
      return <XCircle size={18} color="#ef4444" />;
    default:
      return <Package size={18} color="#3b82f6" />;
  }
};

// Get notification background color based on type
const getNotificationBg = (type: string, isDark: boolean) => {
  if (isDark) {
    switch (type) {
      case 'success': return 'rgba(34,197,94,0.15)';
      case 'promo': return 'rgba(255,87,35,0.15)';
      case 'error': return 'rgba(239,68,68,0.15)';
      default: return 'rgba(59,130,246,0.15)';
    }
  }
  switch (type) {
    case 'success': return '#f0fdf4';
    case 'promo': return '#fff5f0';
    case 'error': return '#fef2f2';
    default: return '#eff6ff';
  }
};

// Get page name from pathname
const getPageName = (pathname: string): string => {
  const routes: Record<string, string> = {
    '/guest': 'Home',
    '/guest/menu': 'Menu',
    '/guest/favorites': 'Favorites',
    '/guest/cart': 'Cart',
    '/guest/checkout': 'Checkout',
    '/guest/tracking': 'Orders',
    '/guest/profile': 'Profile',
    '/guest/ar': 'AR View',
  };

  if (routes[pathname]) return routes[pathname];
  for (const [route, name] of Object.entries(routes)) {
    if (pathname.startsWith(route) && route !== '/guest') {
      return name;
    }
  }
  return 'MenuLay';
};

export default function GuestTopBar() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const pathname = usePathname();
  const router = useRouter();
  const scope = getGuestScope();
  const { itemCount } = useCartStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pageName = getPageName(pathname);
  const cartCount = itemCount();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsBellOpen(false);
  };

  const toggleBell = () => {
    setIsBellOpen(!isBellOpen);
    setIsMenuOpen(false);
    if (!isBellOpen) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const closeAll = () => {
    setIsMenuOpen(false);
    setIsBellOpen(false);
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Apni actual API endpoint yahan replace karein
        const response = await fetch('/api/guest/notifications');
        const data = await response.json();

        if (response.ok) {
          setNotifications(data.notifications || data);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const handleToggleBell = async () => {
    const nextState = !isBellOpen;
    setIsBellOpen(nextState);

    // Jab dropdown open ho aur unread items hon
    if (nextState && unreadCount > 0) {
      try {
        // Backend ko read status update bhejna
        await fetch('/api/guest/notifications/mark-read', {
          method: 'POST',
        });

        // UI state update
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, read: true }))
        );
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
      }
    }
  };
  const handleNavigation = (href: string) => {
    const finalHref = (href === '/guest' || href === '/guest/menu')
      ? withScope(href, scope)
      : href;
    router.push(finalHref);
    closeAll();
  };

  const isActive = (href: string) => {
    if (href === '/guest') return pathname === '/guest';
    return pathname.startsWith(href);
  };

  // ── Focus/Blur handlers ──
  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
  };

  const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = colors.hoverBg;
  };

  const handleButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
  };




  return (
    <>
      {/* ── Top Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: colors.bg,
          borderBottom: `1px solid ${colors.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/images/nav/logo.png" alt="Menulay Logo" width={107.5} height={35} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* ── Bell Icon ── */}
          <button
            aria-label="Notifications"
            onClick={toggleBell}
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
              transition: 'all 0.2s ease',
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
          >
            <Image src="/images/nav/Bell.png" alt="Notifications" width={28} height={28} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${colors.bg}`,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* ── Hamburger Menu ── */}
          <button
            aria-label="Menu"
            onClick={toggleMenu}
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
              transition: 'all 0.2s ease',
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
          >
            {isMenuOpen ? (
              <X size={28} color={BRAND} />
            ) : (
              <Image src="/images/nav/Menu.png" alt="Menu" width={28} height={28} />
            )}
          </button>
        </div>
      </div>

      {/* ── Bell Dropdown ── */}
      {isBellOpen && (
        <>
          <div
            onClick={closeAll}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: colors.overlay,
              zIndex: 99,
            }}
          />

          <div
            style={{
              position: 'fixed',
              top: '72px',
              right: '50%',
              transform: 'translateX(50%)',
              width: '100%',
              maxWidth: 480,
              background: colors.dropdownBg,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.15)',
              zIndex: 100,
              borderTop: `2px solid ${BRAND}`,
              maxHeight: '70vh',
              overflowY: 'auto',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px 12px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: colors.text,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Notifications
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={() => {
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  }}
                  style={{
                    fontSize: 12,
                    color: BRAND,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: "'Poppins', sans-serif",
                    outline: 'none',
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notification List */}
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Bell size={40} color={colors.muted} style={{ opacity: 0.3 }} />
                <p style={{
                  fontSize: 14,
                  color: colors.muted,
                  marginTop: 12,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  No notifications
                </p>
              </div>
            ) : (
              <div className="relative flex items-center justify-between bg-white px-4 py-3 shadow-sm">
                <h1 className="text-lg font-bold">Dashboard</h1>

                {/* Bell Icon Trigger */}
                <div className="relative">
                  <button
                    onClick={handleToggleBell}
                    className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
                  >
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Box */}
                  {isBellOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-100 bg-white shadow-lg z-50">
                      <div className="flex items-center justify-between border-b px-4 py-2 font-semibold text-gray-700">
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-xs text-blue-600">{unreadCount} new</span>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto">
                        {loading ? (
                          <p className="p-4 text-center text-sm text-gray-400">Loading...</p>
                        ) : notifications.length === 0 ? (
                          <p className="p-4 text-center text-sm text-gray-400">No notifications</p>
                        ) : (
                          notifications.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-start gap-3 border-b p-3 text-sm transition-colors hover:bg-gray-50 ${!item.read ? 'bg-blue-50/50' : ''
                                }`}
                            >
                              <div className="mt-0.5">
                                {item.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                {item.type === 'alert' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                {(!item.type || item.type === 'info') && <Info className="h-4 w-4 text-blue-500" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-800">{item.title}</p>
                                <p className="text-xs text-gray-500">{item.message}</p>
                                <span className="mt-1 block text-[10px] text-gray-400">{item.time}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Menu Dropdown ── */}
      {isMenuOpen && (
        <>
          <div
            onClick={closeAll}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: colors.overlay,
              zIndex: 99,
            }}
          />

          <div
            style={{
              position: 'fixed',
              top: '72px',
              right: '50%',
              transform: 'translateX(50%)',
              width: '100%',
              maxWidth: 480,
              background: colors.dropdownBg,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.15)',
              padding: '12px 0',
              zIndex: 100,
              borderTop: `2px solid ${BRAND}`,
              maxHeight: '80vh',
              overflowY: 'auto',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {NAV_TABS.map((tab) => {
              const active = isActive(tab.href);
              const Icon = tab.icon;
              const isCart = tab.key === 'cart';

              return (
                <button
                  key={tab.key}
                  onClick={() => handleNavigation(tab.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 20px',
                    width: '100%',
                    background: active ? colors.hoverBg : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    outline: 'none',
                    fontFamily: "'Poppins', sans-serif",
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = active ? colors.hoverBg : 'transparent';
                  }}
                >
                  <Icon
                    size={20}
                    color={active ? BRAND : colors.text}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      fontSize: 15,
                      fontWeight: active ? 700 : 500,
                      color: active ? BRAND : colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {tab.label}
                  </span>
                  {isCart && cartCount > 0 && (
                    <span
                      style={{
                        background: BRAND,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '1px 10px',
                        borderRadius: 12,
                        minWidth: 20,
                        textAlign: 'center',
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {cartCount}
                    </span>
                  )}
                  {active && (
                    <span
                      style={{
                        width: 4,
                        height: 24,
                        background: BRAND,
                        borderRadius: 2,
                        position: 'absolute',
                        right: 0,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}