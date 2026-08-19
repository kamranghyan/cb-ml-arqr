'use client';

/**
 * BottomNav
 * =========
 * Shared 6-tab bottom navigation for the guest app: Home, Menu, Favorites,
 * Cart, Orders, Profile.
 *
 * Extracted from the guest landing page on 2024 Figma pass — every guest
 * screen was re-declaring the same nav array, icon map, and active-state
 * logic. This is now the single source of truth.
 *
 * NOTE: "Profile" doesn't have a page yet — wired to /guest/profile so the
 * component stays complete, but tapping it 404s until that section is
 * built. ("Favorites" used to be in the same boat; it now has a real page.)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Heart, ShoppingCart, FileText, User, type LucideIcon } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { getGuestScope, withScope } from '@/lib/guest-scope';

const NAV_BG = '#ff5723';
const ACTIVE = '#ffffff';
const INACTIVE = '#331107';

interface NavTab {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  matchPrefix: string | string[]; // pathname prefix(es) that count as "active" for this tab
}

export default function BottomNav() {
  const pathname = usePathname();
  const scope = getGuestScope();
  const { itemCount } = useCartStore();
  const cartCount = itemCount();

  // Home/Menu keep rid/tid on the link (same as before extraction) so a
  // refresh on those pages doesn't lose QR scope. Cart/Orders rely on
  // sessionStorage, matching how those pages already behaved.
  const tabs: NavTab[] = [
    { key: 'home', label: 'Home', icon: Home, href: withScope('/guest', scope), matchPrefix: '/guest' },
    { key: 'menu', label: 'Menu', icon: BookOpen, href: withScope('/guest/menu', scope), matchPrefix: '/guest/menu' },
    { key: 'favorites', label: 'Favorites', icon: Heart, href: '/guest/favorites', matchPrefix: '/guest/favorites' },
    // Checkout is a continuation of the cart flow (and the order-success
    // screen shows Cart as active in the Figma), so it counts as "Cart" too.
    { key: 'cart', label: 'Cart', icon: ShoppingCart, href: '/guest/cart', matchPrefix: ['/guest/cart', '/guest/checkout'] },
    { key: 'orders', label: 'Orders', icon: FileText, href: '/guest/tracking', matchPrefix: '/guest/tracking' },
    { key: 'profile', label: 'Profile', icon: User, href: '/guest/profile', matchPrefix: '/guest/profile' },
  ];

  const isActive = (tab: NavTab) => {
    if (tab.key === 'home') return pathname === '/guest';
    const prefixes = Array.isArray(tab.matchPrefix) ? tab.matchPrefix : [tab.matchPrefix];
    return prefixes.some(p => pathname.startsWith(p));
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: NAV_BG,
        padding: '10px 0 20px',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 100,
        fontFamily: "'Poppins', sans-serif",
        // boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      }}
    >
      {tabs.map(tab => {
        const active = isActive(tab);
        const Icon = tab.icon;
        const color = active ? ACTIVE : INACTIVE;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              textDecoration: 'none',
              color,
              position: 'relative',
              minWidth: 44,
              padding: '4px 8px',
              borderRadius: 8,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              // e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
            }}
            onBlur={(e) => {
              // e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              // e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              if (!active) {
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = active ? ACTIVE : INACTIVE;
            }}
          >
            <Icon
              size={22}
              color={color}
              strokeWidth={active ? 2.25 : 2}
              style={{
                transition: 'all 0.2s ease',
                transform: active ? 'scale(1.05)' : 'scale(1)',
              }}
            />
            {tab.key === 'cart' && cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: ACTIVE,
                  color: NAV_BG,
                  fontSize: 9,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                  fontFamily: "'Poppins', sans-serif",
                  // boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                }}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color,
                transition: 'all 0.2s ease',
                fontFamily: "'Poppins', sans-serif",
                letterSpacing: active ? 0.3 : 0,
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}