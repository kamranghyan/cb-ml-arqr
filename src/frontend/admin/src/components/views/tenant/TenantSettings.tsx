'use client';

import { useState, useEffect } from 'react';
import {
  Building2, CreditCard, Shield, Store, Loader2, AlertCircle, QrCode,
} from 'lucide-react';
import { loadUser, type AuthUser } from '@/lib/cognito';
import { fetchMyTenant, planUsage, isAtPlanLimit, PLAN_LABELS, type ApiTenant } from '@/lib/auth-api';
import { fetchMyBranches, type Branch } from '@/lib/tenant-api';
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000', // ✅ Light: Black
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B', // ✅ Light: Darker gray
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
});

// ── Accent colors based on theme ──
const getAccents = (isDark: boolean) => ({
  green: { 
    bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4', 
    border: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0', 
    text: isDark ? '#4ade80' : '#16a34a' 
  },
  orange: { 
    bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB', 
    border: isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A', 
    text: isDark ? '#fb923c' : '#d97706' 
  },
  danger: { 
    bg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0', 
    border: isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0', 
    text: isDark ? '#ff8a5c' : BRAND 
  },
});

export default function TenantSettings() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const colors = getColors(isDark);
  const accents = getAccents(isDark);

  useEffect(() => {
    setUser(loadUser());
    Promise.all([fetchMyTenant(), fetchMyBranches()])
      .then(([t, b]) => { setTenant(t); setBranches(b); })
      .catch(e => setError(e?.message ?? 'Could not load your company'))
      .finally(() => setLoading(false));
  }, []);

  const atLimit = tenant ? isAtPlanLimit(tenant) : false;

  return (
    <div style={{
      background: colors.bg,
      padding: '16px 20px 40px',
      maxWidth: 900,
      margin: '0 auto',
      minHeight: '100vh',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 22,
      }}>
        <h1 style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 800,
          color: colors.text, // ✅ Light: Black
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Settings
        </h1>
        <p style={{
          color: colors.muted, // ✅ Light: #6B6B6B
          fontSize: 14,
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Your company, your plan and your account.
        </p>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: colors.muted,
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
            Loading settings…
          </p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '40px 20px',
          color: accents.danger.text,
        }}>
          <AlertCircle size={20} />
          <span style={{ fontFamily: "'Poppins', sans-serif" }}>{error}</span>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && !error && (
        <>
          {/* Company Card */}
          <Card icon={<Building2 size={16} color={BRAND} />} title="Company" colors={colors}>
            <Field label="Name" value={tenant?.companyName ?? '—'} colors={colors} />
            <Field label="Contact" value={tenant?.email ?? '—'} colors={colors} />
            <Field
              label="Status"
              value={tenant?.isActive ? 'Active' : 'Suspended'}
              color={tenant?.isActive ? accents.green.text : accents.danger.text}
              colors={colors}
            />
            <p style={{
              fontSize: 13,
              color: colors.subtle, // ✅ Light: #6B6B6B
              margin: '12px 0 0',
              fontFamily: "'Poppins', sans-serif",
            }}>
              Company details are set by MenuLay. Contact support to change them.
            </p>
          </Card>

          {/* Plan Card */}
          <Card icon={<CreditCard size={16} color={BRAND} />} title="Your plan" colors={colors}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '4px 12px',
                borderRadius: 6,
                background: colors.brandBg,
                color: BRAND,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {tenant?.planTier ?? '—'}
              </span>
              <span style={{
                fontSize: 13,
                color: colors.muted, // ✅ Light: #6B6B6B
                fontFamily: "'Poppins', sans-serif",
              }}>
                {tenant ? planUsage(tenant) : ''}
              </span>
            </div>

            {tenant && tenant.maxRestaurants !== -1 && (
              <div style={{
                height: 6,
                borderRadius: 4,
                background: colors.border,
                overflow: 'hidden',
                marginBottom: 10,
              }}>
                <div style={{
                  width: `${Math.min(100, Math.round((tenant.restaurantCount / tenant.maxRestaurants) * 100))}%`,
                  height: '100%',
                  background: atLimit ? BRAND : accents.green.text,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}

            {atLimit && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 10,
                background: accents.orange.bg,
                border: `1px solid ${accents.orange.border}`,
                color: accents.orange.text,
                fontSize: 13,
                fontFamily: "'Poppins', sans-serif",
              }}>
                You have used every restaurant on this plan. Contact MenuLay to
                upgrade and open another branch.
              </div>
            )}

            <p style={{
              fontSize: 12,
              color: colors.subtle, // ✅ Light: #6B6B6B
              margin: '10px 0 6px',
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              fontFamily: "'Poppins', sans-serif",
            }}>
              What plans allow
            </p>
            {(Object.keys(PLAN_LABELS) as (keyof typeof PLAN_LABELS)[]).map(p => (
              <div key={p} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 0',
                borderTop: `1px solid ${colors.border}`,
                fontSize: 13,
                color: p === tenant?.planTier ? colors.text : colors.muted, // ✅ Light: Black or #6B6B6B
                fontWeight: p === tenant?.planTier ? 700 : 400,
                gap: 8,
                flexWrap: 'wrap',
                fontFamily: "'Poppins', sans-serif",
              }}>
                <span style={{ textTransform: 'capitalize' }}>{p}</span>
                <span>{PLAN_LABELS[p].split('—')[1]?.trim() ?? ''}</span>
              </div>
            ))}
          </Card>

          {/* Restaurants Card */}
          <Card icon={<Store size={16} color={BRAND} />} title="Your restaurants" colors={colors}>
            {branches.length === 0 ? (
              <p style={{
                fontSize: 13,
                color: colors.subtle, // ✅ Light: #6B6B6B
                margin: 0,
                fontFamily: "'Poppins', sans-serif",
              }}>
                None yet — add one from the Restaurants page.
              </p>
            ) : (
              branches.map(b => (
                <div key={b.restaurantId} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 0',
                  borderTop: `1px solid ${colors.border}`,
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.text, // ✅ Light: Black
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {b.name}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: colors.subtle, // ✅ Light: #6B6B6B
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {b.address?.city ?? '—'} · {b.currencyCode}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: b.isActive ? accents.green.text : colors.subtle, // ✅ Light: #6B6B6B
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    {b.isActive ? '● open' : '● closed'}
                  </span>
                </div>
              ))
            )}
          </Card>

          {/* Account Card */}
          <Card icon={<Shield size={16} color={BRAND} />} title="Your account" colors={colors}>
            <Field label="Email" value={user?.email ?? '—'} colors={colors} />
            <Field label="Name" value={user?.displayName || '—'} colors={colors} />
            <Field label="Role" value="Company owner" colors={colors} />
            <p style={{
              fontSize: 13,
              color: colors.subtle, // ✅ Light: #6B6B6B
              margin: '12px 0 0',
              fontFamily: "'Poppins', sans-serif",
            }}>
              To change your password, sign out and use{' '}
              <strong style={{ color: colors.text, fontFamily: "'Poppins', sans-serif" }}>
                Forgot password
              </strong>
              {' '}on the sign-in screen.
            </p>
          </Card>

          {/* QR Code Card */}
          <Card icon={<QrCode size={16} color={BRAND} />} title="How your guests order" colors={colors}>
            <p style={{
              fontSize: 13,
              color: colors.muted, // ✅ Light: #6B6B6B
              margin: '0 0 10px',
              fontFamily: "'Poppins', sans-serif",
            }}>
              Each table has its own QR code. A guest scans it, sees that
              restaurant&apos;s menu, and orders straight from their phone —
              no app to install.
            </p>
            <p style={{
              fontSize: 13,
              color: colors.subtle, // ✅ Light: #6B6B6B
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Print codes from a restaurant&apos;s{' '}
              <strong style={{ color: colors.text, fontFamily: "'Poppins', sans-serif" }}>
                QR Codes
              </strong>
              {' '}tab. Add or rename tables first, then generate.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Card({
  icon,
  title,
  children,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: 'clamp(16px, 2vw, 20px)',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}>
        {icon}
        <h2 style={{
          fontSize: 15,
          fontWeight: 800,
          color: colors.text, // ✅ Light: Black
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color?: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      gap: 8,
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 13,
        color: colors.muted, // ✅ Light: #6B6B6B
        fontFamily: "'Poppins', sans-serif",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: color ?? colors.text, // ✅ Light: Black
        wordBreak: 'break-word',
        textAlign: 'right',
        fontFamily: "'Poppins', sans-serif",
      }}>
        {value}
      </span>
    </div>
  );
}