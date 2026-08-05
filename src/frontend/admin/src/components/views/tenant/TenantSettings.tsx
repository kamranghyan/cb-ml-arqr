'use client';

import { useState, useEffect } from 'react';
import {
  Building2, CreditCard, Shield, Store, Loader2, AlertCircle, QrCode,
} from 'lucide-react';
import { loadUser, type AuthUser } from '@/lib/cognito';
import { fetchMyTenant, planUsage, isAtPlanLimit, PLAN_LABELS, type ApiTenant } from '@/lib/auth-api';
import { fetchMyBranches, type Branch } from '@/lib/tenant-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

export default function TenantSettings() {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [tenant, setTenant]     = useState<ApiTenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    setUser(loadUser());
    Promise.all([fetchMyTenant(), fetchMyBranches()])
      .then(([t, b]) => { setTenant(t); setBranches(b); })
      .catch(e => setError(e?.message ?? 'Could not load your company'))
      .finally(() => setLoading(false));
  }, []);

  const atLimit = tenant ? isAtPlanLimit(tenant) : false;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Your company, your plan and your account.
        </p>
      </div>

      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <Card icon={<Building2 size={16} />} title="Company">
            <Field label="Name"    value={tenant?.companyName ?? '—'} />
            <Field label="Contact" value={tenant?.email ?? '—'} />
            <Field label="Status"
                   value={tenant?.isActive ? 'Active' : 'Suspended'}
                   color={tenant?.isActive ? C.green : C.red} />
            <p style={{ fontSize: 13, color: C.subtle, margin: '12px 0 0' }}>
              Company details are set by MenuLay. Contact support to change them.
            </p>
          </Card>

          <Card icon={<CreditCard size={16} />} title="Your plan">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.5, padding: '4px 10px', borderRadius: 6,
                background: `${C.red}15`, color: C.red,
              }}>{tenant?.planTier ?? '—'}</span>
              <span style={{ fontSize: 13, color: C.muted }}>
                {tenant ? planUsage(tenant) : ''}
              </span>
            </div>

            {tenant && tenant.maxRestaurants !== -1 && (
              <div style={{ height: 8, borderRadius: 4, background: C.bg, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  width: `${Math.min(100, Math.round((tenant.restaurantCount / tenant.maxRestaurants) * 100))}%`,
                  height: '100%',
                  background: atLimit ? C.red : C.green,
                }} />
              </div>
            )}

            {atLimit && (
              <div style={{
                padding: '9px 12px', borderRadius: 8, marginBottom: 10,
                background: '#FFF7E6', border: '1px solid #FFE0A3',
                color: '#891C1C', fontSize: 13,
              }}>
                You have used every restaurant on this plan. Contact MenuLay to
                upgrade and open another branch.
              </div>
            )}

            <p style={{ fontSize: 12, color: C.subtle, margin: '10px 0 6px', fontWeight: 700,
                        letterSpacing: 0.5, textTransform: 'uppercase' }}>
              What plans allow
            </p>
            {(Object.keys(PLAN_LABELS) as (keyof typeof PLAN_LABELS)[]).map(p => (
              <div key={p} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '7px 0', borderTop: `1px solid ${C.border}`,
                fontSize: 13,
                color: p === tenant?.planTier ? C.text : C.muted,
                fontWeight: p === tenant?.planTier ? 700 : 400,
              }}>
                <span style={{ textTransform: 'capitalize' }}>{p}</span>
                <span>{PLAN_LABELS[p].split('—')[1]?.trim() ?? ''}</span>
              </div>
            ))}
          </Card>

          <Card icon={<Store size={16} />} title="Your restaurants">
            {branches.length === 0 ? (
              <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>
                None yet — add one from the Restaurants page.
              </p>
            ) : branches.map(b => (
              <div key={b.restaurantId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 0', borderTop: `1px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: C.subtle }}>
                    {b.address?.city ?? '—'} · {b.currencyCode}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: b.isActive ? C.green : C.subtle,
                }}>
                  {b.isActive ? '● open' : '● closed'}
                </span>
              </div>
            ))}
          </Card>

          <Card icon={<Shield size={16} />} title="Your account">
            <Field label="Email" value={user?.email ?? '—'} />
            <Field label="Name"  value={user?.displayName || '—'} />
            <Field label="Role"  value="Company owner" />
            <p style={{ fontSize: 13, color: C.subtle, margin: '12px 0 0' }}>
              To change your password, sign out and use <strong>Forgot password</strong>
              {' '}on the sign-in screen.
            </p>
          </Card>

          <Card icon={<QrCode size={16} />} title="How your guests order">
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 10px' }}>
              Each table has its own QR code. A guest scans it, sees that
              restaurant&apos;s menu, and orders straight from their phone —
              no app to install.
            </p>
            <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>
              Print codes from a restaurant&apos;s <strong>QR Codes</strong> tab.
              Add or rename tables first, then generate.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

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

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? C.text }}>{value}</span>
    </div>
  );
}
