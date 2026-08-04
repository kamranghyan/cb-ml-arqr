'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Loader2, RefreshCw, AlertCircle, Building2, Store,
  TrendingUp, Pause,
} from 'lucide-react';
import { fetchTenants, planUsage, type ApiTenant, type PlanTier } from '@/lib/auth-api';
import ScopePicker, { EMPTY_SCOPE, type Scope } from '@/components/ScopePicker';
import {
  fetchOrdersForRestaurant, derivedStatus, money, type SupportOrder,
} from '@/lib/support-api';

const C = {
  red: '#E1251B', dark: '#891C1C', bg: '#FFF8F1', white: '#fff',
  border: '#F0E8E0', text: '#1A1A1A', muted: '#687780',
  subtle: '#9CA3AF', green: '#0F9D58',
};

const PLANS: PlanTier[] = ['starter', 'professional', 'enterprise'];

export default function AnalyticsPage() {
  // ── Platform-wide (no scope needed) ────────────────────────────────
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loadingT, setLoadT]  = useState(true);
  const [errorT, setErrorT]   = useState('');

  // ── One branch (needs a scope) ─────────────────────────────────────
  const [scope, setScope]   = useState<Scope>(EMPTY_SCOPE);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [loadingO, setLoadO] = useState(false);

  const loadTenants = useCallback(async () => {
    setLoadT(true); setErrorT('');
    try { setTenants(await fetchTenants()); }
    catch (e: any) { setErrorT(e?.message ?? 'Could not load platform data'); }
    finally { setLoadT(false); }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  useEffect(() => {
    if (!scope.tenantId || !scope.restaurantId) { setOrders([]); return; }
    let cancelled = false;
    setLoadO(true);
    fetchOrdersForRestaurant(scope.tenantId, scope.restaurantId, 24)
      .then(o => { if (!cancelled) setOrders(o); })
      .catch(() => { if (!cancelled) setOrders([]); })
      .finally(() => { if (!cancelled) setLoadO(false); });
    return () => { cancelled = true; };
  }, [scope.tenantId, scope.restaurantId]);

  const active      = tenants.filter(t => t.isActive);
  const restaurants = tenants.reduce((s, t) => s + (t.restaurantCount ?? 0), 0);
  const atLimit     = tenants.filter(
    t => t.maxRestaurants !== -1 && t.restaurantCount >= t.maxRestaurants);

  const completed = orders.filter(o => derivedStatus(o) !== 'cancelled');
  const revenue   = completed.reduce((s, o) => s + (o.totalAmountMinorUnits ?? 0), 0);
  const avgOrder  = completed.length ? Math.round(revenue / completed.length) : 0;

  // Most-ordered items in the last 24h at the picked branch.
  const itemCounts = new Map<string, number>();
  completed.forEach(o => (o.lineItems ?? []).forEach(li => {
    itemCounts.set(li.name, (itemCounts.get(li.name) ?? 0) + li.quantity);
  }));
  const topItems = Array.from(itemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
            Analytics
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            How the platform is doing, and how any one branch is trading.
          </p>
        </div>
        <button onClick={loadTenants} style={ghost}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* ── Platform ─────────────────────────────────────────────── */}
      <h2 style={sectionTitle}>Platform</h2>

      {loadingT && (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      )}

      {!loadingT && errorT && (
        <div style={{ padding: 30, textAlign: 'center', color: C.red }}>
          <AlertCircle size={18} /> {errorT}
        </div>
      )}

      {!loadingT && !errorT && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 14, marginBottom: 18,
          }}>
            <Stat icon={<Building2 size={17} />}  label="Companies"   value={String(tenants.length)} />
            <Stat icon={<TrendingUp size={17} />} label="Active"      value={String(active.length)} accent={C.green} />
            <Stat icon={<Pause size={17} />}      label="Suspended"   value={String(tenants.length - active.length)}
                  accent={tenants.length - active.length ? C.red : undefined} />
            <Stat icon={<Store size={17} />}      label="Restaurants" value={String(restaurants)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginBottom: 28 }}>
            <Card title="Plan mix">
              {tenants.length === 0 ? <Muted text="No companies yet." /> : PLANS.map(p => {
                const n = tenants.filter(t => t.planTier === p).length;
                const pct = tenants.length ? Math.round((n / tenants.length) * 100) : 0;
                return (
                  <div key={p} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{p}</span>
                      <span style={{ fontSize: 13, color: C.muted }}>{n} · {pct}%</span>
                    </div>
                    <Bar pct={pct} />
                  </div>
                );
              })}
            </Card>

            <Card title="Ready to upgrade">
              {atLimit.length === 0 ? (
                <Muted text="No company has filled its plan." />
              ) : atLimit.map(t => (
                <Row key={t.tenantId} left={t.companyName}
                     right={`${t.restaurantCount}/${t.maxRestaurants} · ${t.planTier}`}
                     rightColor={C.red} />
              ))}
            </Card>

            <Card title="Biggest customers">
              {tenants.length === 0 ? <Muted text="No companies yet." /> :
                [...tenants]
                  .sort((a, b) => (b.restaurantCount ?? 0) - (a.restaurantCount ?? 0))
                  .slice(0, 5)
                  .map(t => (
                    <Row key={t.tenantId} left={t.companyName} right={planUsage(t)} />
                  ))}
            </Card>
          </div>
        </>
      )}

      {/* ── One branch ───────────────────────────────────────────── */}
      <h2 style={sectionTitle}>A single branch — last 24 hours</h2>
      <ScopePicker value={scope} onChange={setScope} storageKey="console_analytics_scope" />

      {!scope.restaurantId && (
        <Muted text="Pick a company and restaurant above to see its trading figures." />
      )}

      {scope.restaurantId && loadingO && (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading orders…
        </div>
      )}

      {scope.restaurantId && !loadingO && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 14, marginBottom: 18,
          }}>
            <Stat icon={<BarChart2 size={17} />} label="Orders"    value={String(completed.length)} />
            <Stat icon={<TrendingUp size={17} />} label="Revenue"  value={money(revenue, scope.currency)} accent={C.green} />
            <Stat icon={<BarChart2 size={17} />} label="Avg order" value={money(avgOrder, scope.currency)} />
            <Stat icon={<Pause size={17} />}     label="Cancelled"
                  value={String(orders.length - completed.length)} />
          </div>

          <Card title="Most ordered">
            {topItems.length === 0 ? (
              <Muted text="No orders in the last 24 hours." />
            ) : topItems.map(([name, qty]) => {
              const max = topItems[0][1];
              return (
                <div key={name} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>{qty}</span>
                  </div>
                  <Bar pct={Math.round((qty / max) * 100)} />
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────

function Stat({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: string;
}) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '15px 17px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: accent ?? C.muted, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? C.text, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: '0 0 14px' }}>{title}</h3>
      {children}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: C.red }} />
    </div>
  );
}

function Row({ left, right, rightColor }: { left: string; right: string; rightColor?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderTop: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{left}</span>
      <span style={{ fontSize: 12, color: rightColor ?? C.muted, fontWeight: 700 }}>{right}</span>
    </div>
  );
}

function Muted({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: C.subtle, margin: '0 0 14px' }}>{text}</p>;
}

const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
  color: C.subtle, margin: '0 0 12px',
};
const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
