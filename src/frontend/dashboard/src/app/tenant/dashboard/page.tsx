'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Store, ChefHat, TrendingUp, Receipt, Loader2, RefreshCw,
  AlertCircle, ChevronRight, Lock,
} from 'lucide-react';
import {
  fetchMyBranches, fetchOrders, revenueOf, byBranch, topItems, isLive,
  type Branch, type BranchOrder,
} from '@/lib/tenant-api';
import { fetchMyTenant, planUsage, isAtPlanLimit, type ApiTenant } from '@/lib/auth-api';
import { money } from '@/lib/support-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

export default function TenantDashboard() {
  const [tenant, setTenant]     = useState<ApiTenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders]     = useState<BranchOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [t, bs] = await Promise.all([
        fetchMyTenant().catch(() => null),
        fetchMyBranches(),
      ]);
      setTenant(t);
      setBranches(bs);
      // Today's trading across every branch.
      setOrders(await fetchOrders(bs, '', 24));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const live     = orders.filter(isLive);
  const revenue  = revenueOf(orders);
  const perBranch = byBranch(orders);
  const top      = topItems(orders, 5);
  const currency = branches[0]?.currencyCode || 'PKR';
  const atLimit  = tenant ? isAtPlanLimit(tenant) : false;

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
            {tenant?.companyName ?? 'Dashboard'}
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            The last 24 hours across all your restaurants.
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
          {atLimit && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              background: '#FFF7E6', border: '1px solid #FFE0A3',
              color: '#891C1C', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Lock size={15} />
              <span>
                <strong>Plan full.</strong> {planUsage(tenant!)} used on the{' '}
                {tenant!.planTier} plan — upgrade to open another branch.
              </span>
            </div>
          )}

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 14, marginBottom: 20,
          }}>
            <Stat icon={<ChefHat size={17} />}    label="Live orders" value={String(live.length)}
                  accent={live.length ? C.red : undefined} />
            <Stat icon={<Receipt size={17} />}    label="Orders (24h)" value={String(orders.length)} />
            <Stat icon={<TrendingUp size={17} />} label="Revenue (24h)"
                  value={money(revenue, currency)} accent={C.green} />
            <Stat icon={<Store size={17} />}      label="Restaurants"
                  value={tenant ? planUsage(tenant) : String(branches.length)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>

            <Card title="By restaurant" href="/tenant/analytics" hrefLabel="See analytics">
              {perBranch.length === 0 ? (
                <Muted text="No orders in the last 24 hours." />
              ) : perBranch.map(b => (
                <div key={b.branchName} style={row}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{b.branchName}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {b.orders} order{b.orders === 1 ? '' : 's'} · {money(b.revenue, currency)}
                  </span>
                </div>
              ))}
            </Card>

            <Card title="Selling best" href="/tenant/analytics" hrefLabel="See analytics">
              {top.length === 0 ? (
                <Muted text="Nothing sold yet today." />
              ) : top.map(t => {
                const max = top[0].qty;
                return (
                  <div key={t.name} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                      <span style={{ fontSize: 13, color: C.muted }}>{t.qty}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((t.qty / max) * 100)}%`, height: '100%', background: C.red }} />
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card title="Your restaurants" href="/tenant/restaurants" hrefLabel="Manage">
              {branches.length === 0 ? (
                <Muted text="Add your first restaurant to start taking orders." />
              ) : branches.slice(0, 5).map(b => (
                <div key={b.restaurantId} style={row}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: C.subtle }}>{b.address?.city ?? '—'}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: b.isActive ? C.green : C.subtle, whiteSpace: 'nowrap',
                  }}>
                    {b.isActive ? '● open' : '● closed'}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: string;
}) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '15px 17px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: accent ?? C.muted, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? C.text, lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

function Card({ title, href, hrefLabel, children }: {
  title: string; href?: string; hrefLabel?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: '0 0 12px' }}>{title}</h2>
      {children}
      {href && (
        <Link href={href} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12,
          fontSize: 13, fontWeight: 700, color: C.red, textDecoration: 'none',
        }}>
          {hrefLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function Muted({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>{text}</p>;
}

const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 0', borderTop: `1px solid ${C.border}`,
};
const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
