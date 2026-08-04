'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ChefHat, Store, Receipt, BarChart2, Users, Settings,
  LogOut, Menu as MenuIcon, X, Building2,
} from 'lucide-react';
import { loadUser, clearTokens, type AuthUser } from '@/lib/cognito';
import { fetchMyTenant, planUsage, type ApiTenant } from '@/lib/auth-api';

const C = {
  red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1',
  white: '#fff', border: '#F0E8E0', text: '#1A1A1A',
  muted: '#687780', subtle: '#9CA3AF',
};

const NAV = [
  { href: '/tenant/dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/tenant/orders',      label: 'Kitchen Orders', icon: ChefHat         },
  { href: '/tenant/restaurants', label: 'Restaurants',    icon: Store           },
  { href: '/tenant/history',     label: 'Order History',  icon: Receipt         },
  { href: '/tenant/analytics',   label: 'Analytics',      icon: BarChart2       },
  { href: '/tenant/staff',       label: 'Staff',          icon: Users           },
  { href: '/tenant/settings',    label: 'Settings',       icon: Settings        },
];

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen]     = useState(false);
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<ApiTenant | null>(null);

  useEffect(() => {
    setUser(loadUser());
    fetchMyTenant().then(setTenant).catch(() => setTenant(null));
  }, []);

  function signOut() {
    clearTokens();
    document.cookie = 'menulay_token_console=; Max-Age=0; path=/';
    router.push('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: C.white, borderRight: `1px solid ${C.border}`,
        display: open ? 'flex' : 'none', flexDirection: 'column',
        position: 'fixed', inset: '0 auto 0 0', zIndex: 40,
      }} className="sidebar">
        <SidebarInner pathname={pathname} tenant={tenant} user={user} onSignOut={signOut} />
      </aside>

      <aside style={{
        width: 240, background: C.white, borderRight: `1px solid ${C.border}`,
        flexDirection: 'column', flexShrink: 0,
      }} className="sidebar-desktop">
        <SidebarInner pathname={pathname} tenant={tenant} user={user} onSignOut={signOut} />
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          height: 56, background: C.white, borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        }} className="mobile-header">
          <button onClick={() => setOpen(!open)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            {open ? <X size={20} /> : <MenuIcon size={20} />}
          </button>
          <span style={{ fontWeight: 800, color: C.text }}>
            {tenant?.companyName ?? 'MenuLay'}
          </span>
        </header>

        <main>{children}</main>
      </div>

      <style>{`
        .sidebar { display: none; }
        .sidebar-desktop { display: flex; }
        .mobile-header { display: none; }
        @media (max-width: 768px) {
          .sidebar-desktop { display: none; }
          .mobile-header { display: flex; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function SidebarInner({ pathname, tenant, user, onSignOut }: {
  pathname: string;
  tenant: ApiTenant | null;
  user: AuthUser | null;
  onSignOut: () => void;
}) {
  return (
    <>
      {/* Company */}
      <div style={{ padding: '20px 18px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Building2 size={18} color={C.red} />
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
            {tenant?.companyName ?? '…'}
          </span>
        </div>
        {tenant && (
          <div style={{ fontSize: 12, color: C.muted }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 0.5, padding: '2px 6px', borderRadius: 4,
              background: `${C.red}15`, color: C.red, marginRight: 6,
            }}>{tenant.planTier}</span>
            {planUsage(tenant)}
          </div>
        )}
        {tenant && !tenant.isActive && (
          <div style={{
            marginTop: 8, padding: '6px 8px', borderRadius: 6,
            background: '#FFF0F0', color: C.red, fontSize: 12, fontWeight: 600,
          }}>
            Account suspended — contact support.
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, marginBottom: 4,
              textDecoration: 'none', fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? C.red : C.muted,
              background: active ? `${C.red}0D` : 'transparent',
            }}>
              <Icon size={17} /> {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: 14, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          {user?.displayName || user?.email}
        </div>
        <div style={{ fontSize: 11, color: C.subtle, marginBottom: 8 }}>Owner</div>
        <button onClick={onSignOut} style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
          background: '#fff', cursor: 'pointer', fontSize: 13, color: C.text,
        }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </>
  );
}
