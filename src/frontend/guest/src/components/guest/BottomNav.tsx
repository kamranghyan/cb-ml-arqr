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

const NAV_BG      = '#ff5723';
const ACTIVE      = '#ffffff';
const INACTIVE    = '#331107';

interface NavTab {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  matchPrefix: string | string[]; // pathname prefix(es) that count as "active" for this tab
}

export default function BottomNav() {
  const pathname = usePathname();
  const scope    = getGuestScope();
  const { itemCount } = useCartStore();
  const cartCount = itemCount();

  // Home/Menu keep rid/tid on the link (same as before extraction) so a
  // refresh on those pages doesn't lose QR scope. Cart/Orders rely on
  // sessionStorage, matching how those pages already behaved.
  const tabs: NavTab[] = [
    { key: 'home',      label: 'Home',      icon: Home,         href: withScope('/guest', scope),      matchPrefix: '/guest' },
    { key: 'menu',      label: 'Menu',      icon: BookOpen,     href: withScope('/guest/menu', scope),  matchPrefix: '/guest/menu' },
    { key: 'favorites', label: 'Favorites', icon: Heart,        href: '/guest/favorites',                matchPrefix: '/guest/favorites' },
    // Checkout is a continuation of the cart flow (and the order-success
    // screen shows Cart as active in the Figma), so it counts as "Cart" too.
    { key: 'cart',      label: 'Cart',      icon: ShoppingCart, href: '/guest/cart',                     matchPrefix: ['/guest/cart', '/guest/checkout'] },
    { key: 'orders',    label: 'Orders',    icon: FileText,     href: '/guest/tracking',                 matchPrefix: '/guest/tracking' },
    { key: 'profile',   label: 'Profile',   icon: User,         href: '/guest/profile',                  matchPrefix: '/guest/profile' },
  ];

  const isActive = (tab: NavTab) => {
    if (tab.key === 'home') return pathname === '/guest';
    const prefixes = Array.isArray(tab.matchPrefix) ? tab.matchPrefix : [tab.matchPrefix];
    return prefixes.some(p => pathname.startsWith(p));
  };

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: NAV_BG,
        padding: '10px 0 24px', display: 'flex', justifyContent: 'space-around',
        zIndex: 100,
      }}
    >
      {tabs.map(tab => {
        const active = isActive(tab);
        const Icon   = tab.icon;
        const color  = active ? ACTIVE : INACTIVE;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              textDecoration: 'none', color, position: 'relative', minWidth: 44,
            }}
          >
            <Icon size={22} color={color} strokeWidth={active ? 2.25 : 2} />
            {tab.key === 'cart' && cartCount > 0 && (
              <span
                style={{
                  position: 'absolute', top: -4, right: 6, minWidth: 15, height: 15,
                  borderRadius: '50%', background: ACTIVE, color: NAV_BG,
                  fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: '0 3px', lineHeight: 1,
                }}
              >
                {cartCount}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}