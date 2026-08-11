'use client';

/**
 * GuestTopBar
 * ===========
 * Shared top bar: logo + page name + bell dropdown + hamburger dropdown menu.
 * 
 * Clicking the bell icon opens a notification dropdown.
 * Clicking the hamburger icon opens a navigation dropdown.
 */

import { useState } from 'react';
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
  XCircle
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useCartStore } from '@/lib/store';
import { getGuestScope, withScope } from '@/lib/guest-scope';
import Image from 'next/image';

const BRAND = '#ff5723';

// Navigation tabs configuration
const NAV_TABS = [
  { key: 'home', label: 'Home', icon: Home, href: '/guest' },
  { key: 'menu', label: 'Menu', icon: BookOpen, href: '/guest/menu' },
  { key: 'favorites', label: 'Favorites', icon: Heart, href: '/guest/favorites' },
  { key: 'cart', label: 'Cart', icon: ShoppingCart, href: '/guest/cart' },
  { key: 'orders', label: 'Orders', icon: FileText, href: '/guest/tracking' },
  { key: 'profile', label: 'Profile', icon: User, href: '/guest/profile' },
];

// Static notification data
const NOTIFICATIONS = [
  {
    id: 1,
    title: 'Order #ORD-4521 Confirmed',
    message: 'Your order has been confirmed and is being prepared.',
    time: '2 min ago',
    type: 'success',
    read: false,
  },
  {
    id: 2,
    title: 'Special Offer: 20% Off',
    message: 'Use code SPECIAL20 on your next order over Rs. 500.',
    time: '15 min ago',
    type: 'promo',
    read: false,
  },
  {
    id: 3,
    title: 'Order #ORD-4520 Delivered',
    message: 'Your order has been delivered successfully. Enjoy your meal!',
    time: '1 hour ago',
    type: 'success',
    read: true,
  },
  {
    id: 4,
    title: 'New Item Added: Pasta',
    message: 'Try our new Italian Pasta with special sauce.',
    time: '2 hours ago',
    type: 'info',
    read: true,
  },
  {
    id: 5,
    title: 'Table Ready',
    message: 'Your table is ready for dining in. Please proceed to the host.',
    time: '3 hours ago',
    type: 'info',
    read: true,
  },
  {
    id: 6,
    title: 'Order #ORD-4519 Cancelled',
    message: 'Your order was cancelled due to unavailability of items.',
    time: '5 hours ago',
    type: 'error',
    read: true,
  },
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
  const pathname = usePathname();
  const router = useRouter();
  const scope = getGuestScope();
  const { itemCount } = useCartStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  
  const pageName = getPageName(pathname);
  const cartCount = itemCount();

  const bg = isDark ? '#1C1C1C' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0';
  const dropdownBg = isDark ? '#1C1C1C' : '#ffffff';
  const textColor = isDark ? '#F5F0E8' : '#000000';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : '#FFF5F0';
  const mutedColor = isDark ? '#9CA3AF' : '#6B6B6B';

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsBellOpen(false);
  };
  
  const toggleBell = () => {
    setIsBellOpen(!isBellOpen);
    setIsMenuOpen(false);
    // Mark all as read when opening
    if (!isBellOpen) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };
  
  const closeAll = () => {
    setIsMenuOpen(false);
    setIsBellOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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

  return (
    <>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: bg,
          borderBottom: `1px solid ${border}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo + Page Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/images/nav/logo.png" alt="Menulay Logo" width={107.5} height={35} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Bell Icon with Badge */}
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
            }}
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
                  border: `2px solid ${bg}`,
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Hamburger Menu Button */}
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
            }}
          >
            {isMenuOpen ? (
              <X size={28} color={BRAND} />
            ) : (
              <Image src="/images/nav/Menu.png" alt="Menu" width={28} height={28} />
            )}
          </button>
        </div>
      </div>

      {/* Bell Dropdown */}
      {isBellOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={closeAll}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 99,
            }}
          />
          
          {/* Dropdown */}
          <div
            style={{
              position: 'fixed',
              top: '72px',
              right: '50%',
              transform: 'translateX(50%)',
              width: '100%',
              maxWidth: 480,
              background: dropdownBg,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              zIndex: 100,
              borderTop: `2px solid ${BRAND}`,
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px 12px',
                borderBottom: `1px solid ${border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: textColor,
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
                  }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notification List */}
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Bell size={40} color={mutedColor} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 14, color: mutedColor, marginTop: 12 }}>
                  No notifications
                </p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '12px 20px',
                      background: !notif.read ? hoverBg : 'transparent',
                      borderBottom: `1px solid ${border}`,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => {
                      // Handle notification click - navigate or mark as read
                      setNotifications(prev => 
                        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
                      );
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: getNotificationBg(notif.type, isDark),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>
                    
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: notif.read ? 500 : 700,
                            color: textColor,
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: BRAND,
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: 13,
                          color: mutedColor,
                          margin: '4px 0 0',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                        }}
                      >
                        {notif.message}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 6,
                        }}
                      >
                        <Clock size={12} color={mutedColor} />
                        <span
                          style={{
                            fontSize: 11,
                            color: mutedColor,
                          }}
                        >
                          {notif.time}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Menu Dropdown */}
      {isMenuOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={closeAll}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 99,
            }}
          />
          
          {/* Dropdown */}
          <div
            style={{
              position: 'fixed',
              top: '72px',
              right: '50%',
              transform: 'translateX(50%)',
              width: '100%',
              maxWidth: 480,
              background: dropdownBg,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              padding: '12px 0',
              zIndex: 100,
              borderTop: `2px solid ${BRAND}`,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >

            {/* Navigation Items */}
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
                    background: active ? hoverBg : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = active ? hoverBg : 'transparent';
                  }}
                >
                  <Icon
                    size={20}
                    color={active ? BRAND : textColor}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      fontSize: 15,
                      fontWeight: active ? 700 : 500,
                      color: active ? BRAND : textColor,
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