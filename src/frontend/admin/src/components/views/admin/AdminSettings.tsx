'use client';

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Shield, CreditCard, Server, Copy, Check,
} from 'lucide-react';
import { loadUser, type AuthUser } from '@/lib/cognito';
import { PLAN_LABELS, type PlanTier } from '@/lib/auth-api';
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

// Plan limits are enforced in auth_svc; this mirrors them so an admin can see
// what each tier allows without reading the code.
const PLAN_LIMITS: Record<PlanTier, string> = {
  starter: '1 restaurant',
  professional: 'up to 5 restaurants',
  enterprise: 'unlimited restaurants',
};

export default function AdminSettings() {
  const { isDark } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [copied, setCopied] = useState('');

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
          Your account and how the platform is configured.
        </p>
      </div>

      {/* ── Account ─────────────────────────────────────────────── */}
      <Card icon={<Shield size={16} />} title="Your account" colors={colors}>
        <Field label="Email" value={user?.email || '—'} colors={colors} />
        <Field label="Name" value={user?.displayName || '—'} colors={colors} />
        <Field label="Role" value="Platform administrator" colors={colors} />
        <p style={{
          fontSize: 13,
          color: colors.muted,
          margin: '14px 0 0',
        }}>
          A platform administrator is not tied to any company — that is what
          separates you from a company owner.
        </p>
        <p style={{
          fontSize: 13,
          color: colors.subtle,
          margin: '8px 0 0',
        }}>
          To change your password, sign out and use <strong style={{ color: colors.text }}>Forgot password</strong>
          {' '}on the sign-in screen.
        </p>
      </Card>

      {/* ── Plans ───────────────────────────────────────────────── */}
      <Card icon={<CreditCard size={16} />} title="Subscription plans" colors={colors}>
        <p style={{
          fontSize: 13,
          color: colors.muted,
          margin: '0 0 14px',
        }}>
          What each tier allows. Change a company&apos;s plan from the{' '}
          <strong style={{ color: colors.text }}>Tenants</strong> page.
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
              padding: '3px 9px',
              borderRadius: 6,
              background: `${BRAND}15`,
              color: BRAND,
              whiteSpace: 'nowrap',
            }}>
              {p}
            </span>
            <span style={{
              fontSize: 13,
              color: colors.muted,
            }}>
              {PLAN_LIMITS[p]}
            </span>
          </div>
        ))}
      </Card>

      {/* ── Platform ────────────────────────────────────────────── */}
      <Card icon={<Server size={16} />} title="Platform" colors={colors}>
        <p style={{
          fontSize: 13,
          color: colors.muted,
          margin: '0 0 14px',
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
          accent={accent}
        />
        <CopyField
          label="Auth API"
          value={process.env.NEXT_PUBLIC_AUTH_API_BASE ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accent={accent}
        />
        <CopyField
          label="Menu API"
          value={process.env.NEXT_PUBLIC_API_BASE ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accent={accent}
        />
        <CopyField
          label="Orders API"
          value={process.env.NEXT_PUBLIC_ORDERS_API_BASE ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accent={accent}
        />
        <CopyField
          label="Guest app"
          value={process.env.NEXT_PUBLIC_GUEST_APP_URL ?? '—'}
          copied={copied}
          onCopy={copy}
          colors={colors}
          accent={accent}
        />
      </Card>

      {/* ── Roles ───────────────────────────────────────────────── */}
      <Card icon={<SettingsIcon size={16} />} title="Who can do what" colors={colors}>
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
  colors,
}: {
  label: string;
  value: string;
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
        color: colors.text,
        wordBreak: 'break-word',
        textAlign: 'right',
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
  accent,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (l: string, v: string) => void;
  colors: any;
  accent: any;
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
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          background: colors.card2,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: 28,
          height: 28,
          transition: 'all 0.2s ease',
        }}
        title="Copy"
      >
        {copied === label ? (
          <Check size={13} color={accent.green.text} />
        ) : (
          <Copy size={13} color={colors.subtle} />
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
  colors: any;
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
      }}>
        {role}
      </div>
      <div style={{
        fontSize: 13,
        color: colors.muted,
      }}>
        {does}
      </div>
    </div>
  );
}