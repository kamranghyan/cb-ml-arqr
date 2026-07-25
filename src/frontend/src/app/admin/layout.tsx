'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, QrCode, ChefHat,
  BarChart2, Receipt, Users, Settings, LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { section: 'Main', items: [
    { href: '/admin/dashboard', label: 'Dashboard',       icon: LayoutDashboard },
    { href: '/admin/menu',      label: 'Menu Management', icon: BookOpen        },
    { href: '/admin/qr',        label: 'QR Codes',        icon: QrCode          },
    { href: '/admin/orders',    label: 'Kitchen Orders',  icon: ChefHat         },
  ]},
  { section: 'Reports', items: [
    { href: '/admin/dashboard', label: 'Analytics',      icon: BarChart2 },
    { href: '/admin/history',   label: 'Orders History', icon: Receipt   },
  ]},
  { section: 'Admin', items: [
    { href: '/admin/users',     label: 'User Management', icon: Users    },
    { href: '/admin/dashboard', label: 'Settings',        icon: Settings },
  ]},
];

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.push('/login/admin');
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const initials    = displayName.slice(0, 2).toUpperCase();
  const roleLabel   = user?.groups?.includes('menulay_admin')  ? 'Super Admin'             :
                      user?.groups?.includes('menulay_tenant') ? user.tenantName || 'Admin' :
                      'Admin';

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: C.bg, fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', background: C.white, borderRight: `1.5px solid ${C.border}`, boxShadow: '2px 0 8px rgba(137,28,28,0.04)' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: `1.5px solid ${C.border}` }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${C.dark}, #B22222)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
            🍽️
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: 'Georgia, serif', margin: 0, lineHeight: 1.2 }}>Menulay</p>
            <p style={{ fontSize: 9, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Admin Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(group => (
            <div key={group.section} style={{ marginBottom: 18 }}>
              <p style={{ padding: '3px 10px 6px', fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>
                {group.section}
              </p>
              {group.items.map(item => {
                const Icon   = item.icon;
                const active = pathname === item.href ||
                  (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link key={item.label} href={item.href}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, marginBottom: 2, textDecoration: 'none', transition: 'all 0.15s', fontSize: 13, fontWeight: active ? 700 : 500,
                      background: active ? '#FFF0EE' : 'transparent',
                      border:     `1.5px solid ${active ? '#FED0CC' : 'transparent'}`,
                      color:       active ? C.red : C.muted,
                    }}>
                    <Icon size={15} color={active ? C.red : C.subtle} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, flexShrink: 0 }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '10px 10px 16px', borderTop: `1.5px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: C.bg }}>
            {/* Avatar */}
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FFF3E0', border: `1.5px solid #FED7AA`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.dark, flexShrink: 0 }}>
              {initials}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
              <p style={{ fontSize: 10, color: C.subtle, margin: 0 }}>{roleLabel}</p>
            </div>
            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out"
              style={{ width: 28, height: 28, borderRadius: 8, background: 'none', border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s', opacity: loggingOut ? 0.4 : 1 }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = '#FFF0F0'; b.style.borderColor = '#FFD0D0'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'none'; b.style.borderColor = C.border; }}>
              <LogOut size={13} color={loggingOut ? C.subtle : C.muted} className={loggingOut ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.bg }}>
        {children}
      </main>
    </div>
  );
}