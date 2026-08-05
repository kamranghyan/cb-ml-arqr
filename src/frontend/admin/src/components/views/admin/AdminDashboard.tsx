'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2, Store, TrendingUp, Loader2, AlertCircle,
  RefreshCw, ChevronRight, Pause,
} from 'lucide-react';
import { fetchTenants, type ApiTenant, type PlanTier } from '@/lib/auth-api';

const C = {
  red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1',
  white: '#fff', border: '#F0E8E0', text: '#1A1A1A',
  muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

const PLAN_ORDER: PlanTier[] = ['starter', 'professional', 'enterprise'];

export default function AdminDashboard() {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setTenants(await fetchTenants()); }
    catch (e: any) { setError(e?.message ?? 'Could not load platform data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active      = tenants.filter(t => t.isActive);
  const suspended   = tenants.filter(t => !t.isActive);
  const restaurants = tenants.reduce((s, t) => s + (t.restaurantCount ?? 0), 0);

  const byPlan = PLAN_ORDER.map(p => ({
    plan:  p,
    count: tenants.filter(t => t.planTier === p).length,
  }));

  // Tenants sitting on their plan ceiling — natural upgrade conversations.
  const atLimit = tenants.filter(
    t => t.maxRestaurants !== -1 && t.restaurantCount >= t.maxRestaurants
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
            Platform Overview
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            Customer companies on MenuLay and how much of their plan they use.
          </p>
        </div>
        <button onClick={load} style={ghost}><RefreshCw size={14} /> Refresh</button>
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
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: 14, marginBottom: 22,
          }}>
            <Stat icon={<Building2 size={18} />}  label="Tenants"     value={tenants.length} />
            <Stat icon={<TrendingUp size={18} />} label="Active"      value={active.length} accent={C.green} />
            <Stat icon={<Pause size={18} />}      label="Suspended"   value={suspended.length}
                  accent={suspended.length ? C.red : undefined} />
            <Stat icon={<Store size={18} />}      label="Restaurants" value={restaurants} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>

            <Card title="Subscription mix">
              {tenants.length === 0 ? (
                <Empty text="No tenants yet." />
              ) : byPlan.map(({ plan, count }) => {
                const pct = tenants.length ? Math.round((count / tenants.length) * 100) : 0;
                return (
                  <div key={plan} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>
                        {plan}
                      </span>
                      <span style={{ fontSize: 13, color: C.muted }}>{count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: C.red }} />
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card title="At plan limit">
              {atLimit.length === 0 ? (
                <Empty text="No tenant has hit its ceiling." />
              ) : (
                <>
                  <p style={{ fontSize: 13, color: C.muted, margin: '0 0 10px' }}>
                    These companies cannot add restaurants until they upgrade.
                  </p>
                  {atLimit.map(t => (
                    <div key={t.tenantId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderTop: `1px solid ${C.border}`,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t.companyName}</span>
                      <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>
                        {t.restaurantCount}/{t.maxRestaurants} · {t.planTier}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </Card>

            <Card title="Newest tenants">
              {tenants.length === 0 ? (
                <Empty text="Create your first tenant to get started." />
              ) : (
                [...tenants]
                  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
                  .slice(0, 5)
                  .map(t => (
                    <div key={t.tenantId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderTop: `1px solid ${C.border}`,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                          {t.companyName}
                        </div>
                        <div style={{ fontSize: 12, color: C.subtle }}>{t.email}</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: t.isActive ? C.green : C.red, whiteSpace: 'nowrap',
                      }}>
                        {t.isActive ? '● active' : '● suspended'}
                      </span>
                    </div>
                  ))
              )}
              <Link href="/tenants" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12,
                fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'none',
              }}>
                Manage tenants <ChevronRight size={14} />
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number; accent?: string;
}) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: accent ?? C.muted, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ?? C.text, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 18,
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: '0 0 14px' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>{text}</p>;
}

const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
