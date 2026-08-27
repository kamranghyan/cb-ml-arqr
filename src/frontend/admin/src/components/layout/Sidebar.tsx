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
import { getTheme } from '@/lib/theme';

const BRAND = '#ff5723';

// ── Colors matching checkout page ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#ffffff',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
  text: isDark ? '#F5F0E8' : '#111827',
  muted: isDark ? '#9CA3AF' : '#6B7280',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.15)' : '#FFF0F0',
  activeBg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
  dangerBg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
});

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role } = useCurrentUser();
  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [isDark, setIsDark] = useState(false);

  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };

    updateTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);

    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  useEffect(() => {
    if (role !== 'tenant') return;
    fetchMyTenant().then(setTenant).catch(() => setTenant(null));
  }, [role]);

  const sections = visibleNav(user?.permissions ?? [], role).map(
    ({ section, items }) => ({
      section,
      items:
        role === 'tenant'
          ? items
          : items.filter(
            (item) =>
              item.href !== '/invoices' &&
              item.href !== '/dashboard/invoices'
          ),
    })
  ).filter(({ items }) => items.length > 0);
  const colors = getColors(isDark);

  function signOut() {
    clearTokens();
    clearAuthCookie();
    router.push('/login');
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: colors.bg,
      borderRight: `1px solid ${colors.border}`,
      width: 240,
      flexShrink: 0,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* Who and where */}
      <div style={{
        padding: '18px 18px 16px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
          {role === 'admin' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={17} color={BRAND} />
              <span style={{
                fontSize: 15,
                fontWeight: 700,
                color: colors.text,
                fontFamily: "'Poppins', sans-serif"
              }}>
                MenuLay
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={17} color={BRAND} />
              <span style={{
                fontSize: 15,
                fontWeight: 700,
                color: colors.text,
                fontFamily: "'Poppins', sans-serif"
              }}>
                {tenant?.companyName ?? '…'}
              </span>
            </div>
          )}
        </div>

        {role === 'admin' ? (
          <div style={{
            fontSize: 12,
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif"
          }}>
            Platform console
          </div>
        ) : (
          <>
            {tenant && (
              <div style={{
                fontSize: 12,
                color: colors.muted,
                fontFamily: "'Poppins', sans-serif"
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: colors.brandBg,
                  color: BRAND,
                  marginRight: 6,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {tenant.planTier}
                </span>
                {planUsage(tenant)}
              </div>
            )}
            {tenant && !tenant.isActive && (
              <div style={{
                marginTop: 8,
                padding: '6px 10px',
                borderRadius: 6,
                background: colors.dangerBg,
                color: BRAND,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
              }}>
                Account suspended — contact support.
              </div>
            )}
          </>
        )}
      </div>

      {/* Menu — built from what this person may reach */}
      <nav style={{
        flex: 1,
        padding: '12px 10px',
        overflowY: 'auto',
        background: colors.bg,
      }}>
        {sections.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 14 }}>
            <p style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: colors.subtle,
              margin: '0 0 6px 12px',
              fontFamily: "'Poppins', sans-serif",
            }}>
              {section}
            </p>

            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    marginBottom: 3,
                    textDecoration: 'none',
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 500,
                    // 🔥 SELECTED: BRAND bg with white text (both themes)
                    color: active ? '#FFFFFF' : colors.muted,
                    background: active ? BRAND : 'transparent',
                    transition: 'all 0.2s ease',
                    fontFamily: "'Poppins', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = colors.hoverBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <Icon
                    size={16}
                    // 🔥 Selected icon: white, else muted
                    color={active ? '#FFFFFF' : colors.muted}
                  />
                  <span style={{
                    // 🔥 Selected text: white, else muted
                    color: active ? '#FFFFFF' : colors.muted,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Account */}
      <div style={{
        padding: 14,
        borderTop: `1px solid ${colors.border}`,
        background: colors.bg,
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.text,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {user?.displayName || user?.email}
        </div>
        <div style={{
          fontSize: 11,
          color: colors.subtle,
          marginBottom: 8,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {role ? ROLE_LABEL[role] : ''}
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            marginBottom: '70px',
            padding: '8px 12px',
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            background: colors.card2,
            cursor: 'pointer',
            fontSize: 13,
            color: colors.text,
            fontFamily: "'Poppins', sans-serif",
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.hoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.card2;
          }}
        >
          <LogOut size={14} color={colors.muted} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}