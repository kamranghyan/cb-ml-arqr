'use client';

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Shield, CreditCard, Server, Copy, Check,
} from 'lucide-react';
import { loadUser, type AuthUser } from '@/lib/cognito';
import { PLAN_LABELS, type PlanTier } from '@/lib/auth-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

// Plan limits are enforced in auth_svc; this mirrors them so an admin can see
// what each tier allows without reading the code.
const PLAN_LIMITS: Record<PlanTier, string> = {
  starter:      '1 restaurant',
  professional: 'up to 5 restaurants',
  enterprise:   'unlimited restaurants',
};

export default function SettingsPage() {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => { setUser(loadUser()); }, []);

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Your account and how the platform is configured.
        </p>
      </div>

      {/* ── Account ─────────────────────────────────────────────── */}
      <Card icon={<Shield size={16} />} title="Your account">
        <Field label="Email"    value={user?.email || '—'} />
        <Field label="Name"     value={user?.displayName || '—'} />
        <Field label="Role"     value="Platform administrator" />
        <p style={{ fontSize: 13, color: C.muted, margin: '14px 0 0' }}>
          A platform administrator is not tied to any company — that is what
          separates you from a company owner.
        </p>
        <p style={{ fontSize: 13, color: C.subtle, margin: '8px 0 0' }}>
          To change your password, sign out and use <strong>Forgot password</strong>
          {' '}on the sign-in screen.
        </p>
      </Card>

      {/* ── Plans ───────────────────────────────────────────────── */}
      <Card icon={<CreditCard size={16} />} title="Subscription plans">
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>
          What each tier allows. Change a company&apos;s plan from the{' '}
          <strong>Tenants</strong> page.
        </p>
        {(Object.keys(PLAN_LABELS) as PlanTier[]).map(p => (
          <div key={p} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderTop: `1px solid ${C.border}`,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 0.5, padding: '3px 9px', borderRadius: 6,
              background: `${C.red}15`, color: C.red,
            }}>{p}</span>
            <span style={{ fontSize: 13, color: C.muted }}>{PLAN_LIMITS[p]}</span>
          </div>
        ))}
      </Card>

      {/* ── Platform ────────────────────────────────────────────── */}
      <Card icon={<Server size={16} />} title="Platform">
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>
          Where this console is pointed. Handy when a customer reports an issue
          and you need to say which environment they are on.
        </p>
        <CopyField label="Region"    value="ap-south-1"
                   copied={copied} onCopy={copy} />
        <CopyField label="Auth API"  value={process.env.NEXT_PUBLIC_AUTH_API_BASE ?? '—'}
                   copied={copied} onCopy={copy} />
        <CopyField label="Menu API"  value={process.env.NEXT_PUBLIC_API_BASE ?? '—'}
                   copied={copied} onCopy={copy} />
        <CopyField label="Orders API" value={process.env.NEXT_PUBLIC_ORDERS_API_BASE ?? '—'}
                   copied={copied} onCopy={copy} />
        <CopyField label="Guest app" value={process.env.NEXT_PUBLIC_GUEST_APP_URL ?? '—'}
                   copied={copied} onCopy={copy} />
      </Card>

      {/* ── Roles ───────────────────────────────────────────────── */}
      <Card icon={<SettingsIcon size={16} />} title="Who can do what">
        <RoleRow role="Platform admin"
                 does="Creates companies, sets plans, suspends accounts, helps with support." />
        <RoleRow role="Company owner"
                 does="Adds their own restaurants, builds menus, prints QR codes, hires kitchen staff." />
        <RoleRow role="Kitchen staff"
                 does="Sees and updates orders for the one branch they belong to." />
        <RoleRow role="Guest"
                 does="Scans a table QR code, browses that branch's menu, orders and tracks it." />
      </Card>
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────

function Card({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 20, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: C.red }}>
        {icon}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</span>
    </div>
  );
}

function CopyField({ label, value, copied, onCopy }: {
  label: string; value: string;
  copied: string; onCopy: (l: string, v: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderTop: `1px solid ${C.border}`, gap: 12,
    }}>
      <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{
        fontSize: 12, color: C.text, fontFamily: 'monospace',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: 380, direction: 'rtl', textAlign: 'right',
      }}>{value}</span>
      <button onClick={() => onCopy(label, value)} style={{
        padding: 5, border: `1px solid ${C.border}`, borderRadius: 6,
        background: '#fff', cursor: 'pointer', display: 'inline-flex',
      }} title="Copy">
        {copied === label
          ? <Check size={13} color={C.green} />
          : <Copy size={13} color={C.subtle} />}
      </button>
    </div>
  );
}

function RoleRow({ role, does }: { role: string; does: string }) {
  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{role}</div>
      <div style={{ fontSize: 13, color: C.muted }}>{does}</div>
    </div>
  );
}
