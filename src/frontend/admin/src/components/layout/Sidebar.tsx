'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Building2, LogOut, Shield } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { visibleNav } from '@/components/navigation/nav-config';
import { ROLE_LABEL } from '@/lib/roles';
import { clearAuthCookie } from '@/lib/auth';
import { clearTokens } from '@/lib/cognito';
import { fetchMyTenant, planUsage, type ApiTenant } from '@/lib/auth-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF',
};

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, role } = useCurrentUser();
  const [tenant, setTenant] = useState<ApiTenant | null>(null);

  // An owner's sidebar carries their company and plan; an admin belongs to
  // no company, so there is nothing to fetch.
  useEffect(() => {
    if (role !== 'tenant') return;
    fetchMyTenant().then(setTenant).catch(() => setTenant(null));
  }, [role]);

  const sections = visibleNav(user?.permissions ?? [], role);

  function signOut() {
    clearTokens();
    clearAuthCookie();
    router.push('/login');
  }

  return (
    <>
      {/* Who and where */}
      <div style={{ padding: '18px 18px 16px', borderBottom: `1px solid ${C.border}` }}>
        {role === 'admin' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <Shield size={17} color={C.red} />
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>MenuLay</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>Platform console</div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <Building2 size={17} color={C.red} />
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
          </>
        )}
      </div>

      {/* Menu — built from what this person may reach */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {sections.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 14 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              textTransform: 'uppercase', color: C.subtle,
              margin: '0 0 6px 12px',
            }}>{section}</p>

            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10, marginBottom: 3,
                  textDecoration: 'none', fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? C.red : C.muted,
                  background: active ? `${C.red}0D` : 'transparent',
                }}>
                  <Icon size={16} /> {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Account */}
      <div style={{ padding: 14, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          {user?.displayName || user?.email}
        </div>
        <div style={{ fontSize: 11, color: C.subtle, marginBottom: 8 }}>
          {role ? ROLE_LABEL[role] : ''}
        </div>
        <button onClick={signOut} style={{
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
