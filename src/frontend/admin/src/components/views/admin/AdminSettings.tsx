'use client';

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Shield, CreditCard, Server, Copy, Check,
} from 'lucide-react';
import { loadUser, type AuthUser } from '@/lib/cognito';
import { PLAN_LABELS, type PlanTier } from '@/lib/auth-api';
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
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

// Plan limits are enforced in auth_svc; this mirrors them so an admin can see
// what each tier allows without reading the code.
const PLAN_LIMITS: Record<PlanTier, string> = {
  starter: '1 restaurant',
  professional: 'up to 5 restaurants',
  enterprise: 'unlimited restaurants',
};

export default function AdminSettings() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [copied, setCopied] = useState('');
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
  }, []);

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  }

  return (
    <div style={{
      background: colors.bg,
      padding: '16px 20px 40px',
      // maxWidth: 900,
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
          color: colors.text,
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Settings
        </h1>
        <p style={{
          color: colors.muted,
          fontSize: 14,
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Your account and how the platform is configured.
        </p>
      </div>

      {/* ── Account Card ── */}
      <Card icon={<Shield size={16} color={BRAND} />} title="Your account" colors={colors}>
        <Field label="Email" value={user?.email || '—'} colors={colors} />
        <Field label="Name" value={user?.displayName || '—'} colors={colors} />
        <Field label="Role" value="Platform administrator" colors={colors} />
        <p style={{
          fontSize: 13,
          color: colors.muted,
          margin: '14px 0 0',
          fontFamily: "'Poppins', sans-serif",
        }}>
          A platform administrator is not tied to any company — that is what
          separates you from a company owner.
        </p>
        <p style={{
          fontSize: 13,
          color: colors.subtle,
          margin: '8px 0 0',
          fontFamily: "'Poppins', sans-serif",
        }}>
          To change your password, sign out and use{' '}
          <strong style={{ color: colors.text, fontFamily: "'Poppins', sans-serif" }}>
            Forgot password
          </strong>
          {' '}on the sign-in screen.
        </p>
      </Card>

      {/* ── Plans Card ── */}
      <Card icon={<CreditCard size={16} color={BRAND} />} title="Subscription plans" colors={colors}>
        <p style={{
          fontSize: 13,
          color: colors.muted,
          margin: '0 0 14px',
          fontFamily: "'Poppins', sans-serif",
        }}>
          What each tier allows. Change a company&apos;s plan from the{' '}
          <strong style={{ color: colors.text, fontFamily: "'Poppins', sans-serif" }}>
            Tenants
          </strong>{' '}
          page.
        </p>
        {(Object.keys(PLAN_LABELS) as PlanTier[]).map(p => (
          <div key={p} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderTop: `1px solid ${colors.border}`,
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              padding: '3px 10px',
              borderRadius: 6,
              background: colors.brandBg,
              color: BRAND,
              whiteSpace: 'nowrap',
              fontFamily: "'Poppins', sans-serif",
            }}>
              {p}
            </span>
            <span style={{
              fontSize: 13,
              color: colors.muted,
              fontFamily: "'Poppins', sans-serif",
            }}>
              {PLAN_LIMITS[p]}
            </span>
          </div>
        ))}
      </Card>

      {/* ── Platform Card ── */}
      <Card icon={<Server size={16} color={BRAND} />} title="Platform" colors={colors}>
        <p style={{
          fontSize: 13,
          color: colors.muted,
          margin: '0 0 14px',
          fontFamily: "'Poppins', sans-serif",
        }}>
          Where this console is pointed. Handy when a customer reports an issue
          and you need to say which environment they are on.
        </p>
        <CopyField
          label="Region"
          value="ap-south-1"
          copied={copied}
          onCopy={copy}
          colors={colors}
          accents={accents}
        />
        <CopyField
          label="Auth API"
          value={process.env.NEXT_PUBLIC_AUTH_API_BASE ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accents={accents}
        />
        <CopyField
          label="Menu API"
          value={process.env.NEXT_PUBLIC_API_BASE ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accents={accents}
        />
        <CopyField
          label="Orders API"
          value={process.env.NEXT_PUBLIC_ORDERS_API_BASE ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accents={accents}
        />
        <CopyField
          label="Guest app"
          value={process.env.NEXT_PUBLIC_GUEST_APP_URL ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accents={accents}
        />
      </Card>

      {/* ── Roles Card ── */}
      <Card icon={<SettingsIcon size={16} color={BRAND} />} title="Who can do what" colors={colors}>
        <RoleRow
          role="Platform admin"
          does="Creates companies, sets plans, suspends accounts, helps with support."
          colors={colors}
        />
        <RoleRow
          role="Company owner"
          does="Adds their own restaurants, builds menus, prints QR codes, hires kitchen staff."
          colors={colors}
        />
        <RoleRow
          role="Kitchen staff"
          does="Sees and updates orders for the one branch they belong to."
          colors={colors}
        />
        <RoleRow
          role="Guest"
          does="Scans a table QR code, browses that branch's menu, orders and tracks it."
          colors={colors}
        />
      </Card>
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
          color: colors.text,
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
  colors,
}: {
  label: string;
  value: string;
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
        color: colors.muted,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: colors.text,
        wordBreak: 'break-word',
        textAlign: 'right',
        fontFamily: "'Poppins', sans-serif",
      }}>
        {value}
      </span>
    </div>
  );
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
  colors,
  accents,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (l: string, v: string) => void;
  colors: ReturnType<typeof getColors>;
  accents: ReturnType<typeof getAccents>;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '9px 0',
      borderTop: `1px solid ${colors.border}`,
      gap: 8,
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 13,
        color: colors.muted,
        whiteSpace: 'nowrap',
        fontFamily: "'Poppins', sans-serif",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12,
        color: colors.text,
        fontFamily: 'monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        flex: 1,
        minWidth: 100,
        textAlign: 'right',
        direction: 'rtl',
      }}>
        {value}
      </span>
      <button
        onClick={() => onCopy(label, value)}
        style={{
          padding: 5,
          border: `1.5px solid ${colors.border}`,
          borderRadius: 8,
          background: colors.card2,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: 30,
          height: 30,
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        title="Copy"
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
          e.currentTarget.style.borderColor = BRAND;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = colors.border;
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colors.hoverBg;
          e.currentTarget.style.borderColor = BRAND;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = colors.card2;
          e.currentTarget.style.borderColor = colors.border;
        }}
      >
        {copied === label ? (
          <Check size={14} color={accents.green.text} />
        ) : (
          <Copy size={14} color={colors.subtle} />
        )}
      </button>
    </div>
  );
}

function RoleRow({
  role,
  does,
  colors,
}: {
  role: string;
  does: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div style={{
      padding: '10px 0',
      borderTop: `1px solid ${colors.border}`,
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: colors.text,
        marginBottom: 2,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {role}
      </div>
      <div style={{
        fontSize: 13,
        color: colors.muted,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {does}
      </div>
    </div>
  );
}