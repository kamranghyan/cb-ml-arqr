/**
 * navigation/nav-config.ts
 * ========================
 * One menu for the whole console. Each item declares what it needs, and the
 * sidebar filters by the signed-in person's permissions.
 *
 * Both roles share the first section: the routes are the same, but each sees
 * its own scope inside them — an admin picks a company, an owner sees theirs.
 * The role-specific sections below only appear for whoever holds the
 * permission.
 */

import {
  LayoutDashboard, BarChart2, ChefHat, Receipt, Settings,
  Building2, Users, Store, UserCog,
  CreditCard,
  FileText,
} from 'lucide-react'

import type { NavSection } from '@/types/auth'

export const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
      { href: '/analytics', label: 'Analytics', icon: BarChart2, permission: 'analytics:read' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/orders', label: 'Kitchen Orders', icon: ChefHat, permission: 'orders:read' },
      { href: '/history', label: 'Order History', icon: Receipt, permission: 'orders:read' },
    ],
  },
  {
    // Platform admins only.
    section: 'Customers',
    items: [
      { href: '/tenants', label: 'Tenants', icon: Building2, permission: 'tenants:read' },
      { href: '/users', label: 'Users', icon: Users, permission: 'users:read' },
    ],
  },
  {
    // Company owners only.
    section: 'My Company',
    items: [
      { href: '/restaurants', label: 'Restaurants', icon: Store, permission: 'restaurants:read' },
      { href: '/staff', label: 'Staff', icon: UserCog, permission: 'staff:read' },
      { href: '/subscription', label: 'Subscription', icon: CreditCard, permission: 'settings:read' },
      { href: '/invoices', label: 'Invoices', icon: FileText, permission: 'settings:read' },
    ],
  },
  // {
  //   section: 'Subscription',
  //   items: [
  //     { href: '/Plans', label: 'My Plans', icon: Settings, permission: 'settings:read' },
  //     { href: '/Invoices', label: 'Invoices', icon: Settings, permission: 'settings:read' },
  //   ],
  // },
  {
    section: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings:read' },
    ],
  },

]

/**
 * Drop what this person cannot reach, then drop any section left empty —
 * an "Customers" heading with nothing under it is just noise.
 */
export function visibleNav(
  permissions: string[],
  role: string | null,
): NavSection[] {
  return NAV
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.permission && !permissions.includes(item.permission)) return false
        if (item.roles && (!role || !item.roles.includes(role as never))) return false
        return true
      }),
    }))
    .filter(section => section.items.length > 0)
}
