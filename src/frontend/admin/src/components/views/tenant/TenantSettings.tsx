'use client';

import { useState, useEffect } from 'react';
import {
  Building2, CreditCard, Shield, Store, Loader2, AlertCircle, QrCode,
} from 'lucide-react';
import { loadUser, type AuthUser } from '@/lib/cognito';
import { fetchMyTenant, planUsage, isAtPlanLimit, PLAN_LABELS, type ApiTenant } from '@/lib/auth-api';
import { fetchMyBranches, type Branch } from '@/lib/tenant-api';
import { useTheme } from '@/hooks/useTheme';

// ── Color Schema (Matches other pages) ──────────────────────────────────
const BRAND = '#ff5723';
const D = {
  bg: '#111111',
  card: '#1C1C1C',
  card2: '#242424',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F0E8',
  muted: '#9CA3AF',
  subtle: '#6B7280',
};
const TONE = {
  green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' },
  orange: { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' },
  danger: { bg: 'rgba(255,87,35,0.12)', border: 'rgba(255,87,35,0.3)', text: '#ff8a5c' },
};

export default function TenantSettings() {
  const { isDark } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Theme-aware colors
  const colors = isDark ? D : {
    bg: '#FFFFFF',
    card: '#ffffff',
    card2: '#F9FAFB',
    border: '#F0EBE6',
    text: '#000000',
    muted: '#6B6B6B',
    subtle: '#9CA3AF',
  };
  const accent = isDark ? TONE : {
    green: { bg: '#F0FFF4', border: '#BBF7D0', text: '#16a34a' },
    orange: { bg: '#FFFBEB', border: '#FDE68A', text: '#d97706' },
    danger: { bg: '#FFF0F0', border: '#FFD0D0', text: BRAND },
  };

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
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 22,
      }}>
        <h1 style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 800,
          color: colors.text,
          margin: 0,
        }}>
          Settings
        </h1>
        <p style={{
          color: colors.muted,
          fontSize: 14,
          margin: 0,
        }}>
          Your company, your plan and your account.
        </p>
      </div>

      {/* Loading State */}
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
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading settings…</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '40px 20px',
          color: accent.danger.text,
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Company Card */}
          <Card icon={<Building2 size={16} />} title="Company" colors={colors}>
            <Field label="Name" value={tenant?.companyName ?? '—'} colors={colors} />
            <Field label="Contact" value={tenant?.email ?? '—'} colors={colors} />
            <Field
              label="Status"
              value={tenant?.isActive ? 'Active' : 'Suspended'}
              color={tenant?.isActive ? accent.green.text : accent.danger.text}
              colors={colors}
            />
            <p style={{
              fontSize: 13,
              color: colors.subtle,
              margin: '12px 0 0',
            }}>
              Company details are set by MenuLay. Contact support to change them.
            </p>
          </Card>

          {/* Plan Card */}
          <Card icon={<CreditCard size={16} />} title="Your plan" colors={colors}>
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
                padding: '4px 10px',
                borderRadius: 6,
                background: `${BRAND}15`,
                color: BRAND,
              }}>
                {tenant?.planTier ?? '—'}
              </span>
              <span style={{
                fontSize: 13,
                color: colors.muted,
              }}>
                {tenant ? planUsage(tenant) : ''}
              </span>
            </div>

            {tenant && tenant.maxRestaurants !== -1 && (
              <div style={{
                height: 8,
                borderRadius: 4,
                background: colors.border,
                overflow: 'hidden',
                marginBottom: 10,
              }}>
                <div style={{
                  width: `${Math.min(100, Math.round((tenant.restaurantCount / tenant.maxRestaurants) * 100))}%`,
                  height: '100%',
                  background: atLimit ? BRAND : accent.green.text,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}

            {atLimit && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 10,
                background: isDark ? 'rgba(251,146,60,0.15)' : '#FFF7E6',
                border: `1px solid ${isDark ? 'rgba(251,146,60,0.3)' : '#FFE0A3'}`,
                color: isDark ? '#fb923c' : '#891C1C',
                fontSize: 13,
              }}>
                You have used every restaurant on this plan. Contact MenuLay to
                upgrade and open another branch.
              </div>
            )}

            <p style={{
              fontSize: 12,
              color: colors.subtle,
              margin: '10px 0 6px',
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
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
                color: p === tenant?.planTier ? colors.text : colors.muted,
                fontWeight: p === tenant?.planTier ? 700 : 400,
                gap: 8,
                flexWrap: 'wrap',
              }}>
                <span style={{ textTransform: 'capitalize' }}>{p}</span>
                <span>{PLAN_LABELS[p].split('—')[1]?.trim() ?? ''}</span>
              </div>
            ))}
          </Card>

          {/* Restaurants Card */}
          <Card icon={<Store size={16} />} title="Your restaurants" colors={colors}>
            {branches.length === 0 ? (
              <p style={{
                fontSize: 13,
                color: colors.subtle,
                margin: 0,
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
                      color: colors.text,
                    }}>
                      {b.name}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: colors.subtle,
                    }}>
                      {b.address?.city ?? '—'} · {b.currencyCode}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: b.isActive ? accent.green.text : colors.subtle,
                    whiteSpace: 'nowrap',
                  }}>
                    {b.isActive ? '● open' : '● closed'}
                  </span>
                </div>
              ))
            )}
          </Card>

          {/* Account Card */}
          <Card icon={<Shield size={16} />} title="Your account" colors={colors}>
            <Field label="Email" value={user?.email ?? '—'} colors={colors} />
            <Field label="Name" value={user?.displayName || '—'} colors={colors} />
            <Field label="Role" value="Company owner" colors={colors} />
            <p style={{
              fontSize: 13,
              color: colors.subtle,
              margin: '12px 0 0',
            }}>
              To change your password, sign out and use <strong style={{ color: colors.text }}>Forgot password</strong>
              {' '}on the sign-in screen.
            </p>
          </Card>

          {/* QR Code Card */}
          <Card icon={<QrCode size={16} />} title="How your guests order" colors={colors}>
            <p style={{
              fontSize: 13,
              color: colors.muted,
              margin: '0 0 10px',
            }}>
              Each table has its own QR code. A guest scans it, sees that
              restaurant&apos;s menu, and orders straight from their phone —
              no app to install.
            </p>
            <p style={{
              fontSize: 13,
              color: colors.subtle,
              margin: 0,
            }}>
              Print codes from a restaurant&apos;s <strong style={{ color: colors.text }}>QR Codes</strong> tab.
              Add or rename tables first, then generate.
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
  colors: any;
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
        color: BRAND,
        flexWrap: 'wrap',
      }}>
        {icon}
        <h2 style={{
          fontSize: 15,
          fontWeight: 800,
          color: colors.text,
          margin: 0,
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
  colors: any;
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
        color: colors.muted,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: color ?? colors.text,
        wordBreak: 'break-word',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}