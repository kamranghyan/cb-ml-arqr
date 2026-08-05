'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Loader2, RefreshCw, AlertCircle, TrendingUp, Receipt, Clock,
} from 'lucide-react';
import BranchPicker from '@/components/BranchPicker';
import {
  fetchMyBranches, fetchOrders, revenueOf, byBranch, topItems,
  ordersByHour, derivedStatus, byOrderType, type Branch, type BranchOrder,
} from '@/lib/tenant-api';
import { money, ORDER_TYPE_LABEL, ORDER_TYPE_COLOR } from '@/lib/support-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

export default function TenantAnalytics() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders]     = useState<BranchOrder[]>([]);
  const [loadingB, setLoadB]    = useState(true);
  const [loadingO, setLoadO]    = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetchMyBranches()
      .then(setBranches)
      .catch(e => setError(e?.message ?? 'Could not load your restaurants'))
      .finally(() => setLoadB(false));
  }, []);

  const load = useCallback(async () => {
    if (branches.length === 0) return;
    setLoadO(true); setError('');
    try { setOrders(await fetchOrders(branches, branchId, 24)); }
    catch (e: any) { setError(e?.message ?? 'Could not load analytics'); }
    finally { setLoadO(false); }
  }, [branches, branchId]);

  useEffect(() => { load(); }, [load]);

  const completed = orders.filter(o => derivedStatus(o) !== 'cancelled');
  const revenue   = revenueOf(orders);
  const avg       = completed.length ? Math.round(revenue / completed.length) : 0;
  const currency  = branches[0]?.currencyCode || 'PKR';
  const perBranch = byBranch(orders);
  const items     = topItems(orders, 8);
  const hourly    = ordersByHour(orders);
  const types     = byOrderType(orders);
  const peakCount = Math.max(...hourly.map(h => h.count), 0);

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
            Analytics
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            The last 24 hours — what sold, when, and where.
          </p>
        </div>
        <button onClick={load} style={ghost}><RefreshCw size={14} /> Refresh</button>
      </div>

      <BranchPicker branches={branches} value={branchId}
                    onChange={setBranchId} loading={loadingB} />

      {!loadingB && branches.length > 0 && (
        <>
          {loadingO && (
            <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          )}

          {!loadingO && error && (
            <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
              <AlertCircle size={20} /> {error}
            </div>
          )}

          {!loadingO && !error && (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                gap: 14, marginBottom: 20,
              }}>
                <Stat icon={<Receipt size={17} />}    label="Orders"    value={String(completed.length)} />
                <Stat icon={<TrendingUp size={17} />} label="Revenue"   value={money(revenue, currency)} accent={C.green} />
                <Stat icon={<BarChart2 size={17} />}  label="Avg order" value={money(avg, currency)} />
                <Stat icon={<Clock size={17} />}      label="Cancelled" value={String(orders.length - completed.length)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>

                {branchId === '' && branches.length > 1 && (
                  <Card title="How each restaurant did">
                    {perBranch.length === 0 ? <Muted text="No orders yet today." /> :
                      perBranch.map(b => {
                        const max = perBranch[0].orders;
                        return (
                          <div key={b.branchName} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{b.branchName}</span>
                              <span style={{ fontSize: 12, color: C.muted }}>
                                {b.orders} · {money(b.revenue, currency)}
                              </span>
                            </div>
                            <Bar pct={max ? Math.round((b.orders / max) * 100) : 0} />
                          </div>
                        );
                      })}
                  </Card>
                )}

                <Card title="Dine in, pickup or delivery">
                  {types.length === 0 ? <Muted text="No orders yet today." /> :
                    types.map(t => {
                      const share = completed.length
                        ? Math.round((t.orders / orders.length) * 100) : 0;
                      return (
                        <div key={t.type} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: 0.4, padding: '2px 8px', borderRadius: 6,
                              background: `${ORDER_TYPE_COLOR[t.type]}15`,
                              color: ORDER_TYPE_COLOR[t.type],
                            }}>{ORDER_TYPE_LABEL[t.type]}</span>
                            <span style={{ fontSize: 12, color: C.muted }}>
                              {t.orders} · {money(t.revenue, currency)} · {share}%
                            </span>
                          </div>
                          <Bar pct={share} />
                        </div>
                      );
                    })}
                </Card>

                <Card title="Selling best">
                  {items.length === 0 ? <Muted text="Nothing sold yet today." /> :
                    items.map(t => {
                      const max = items[0].qty;
                      return (
                        <div key={t.name} style={{ marginBottom: 11 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                            <span style={{ fontSize: 13, color: C.muted }}>{t.qty}</span>
                          </div>
                          <Bar pct={Math.round((t.qty / max) * 100)} />
                        </div>
                      );
                    })}
                </Card>

                <Card title="When you are busy">
                  {peakCount === 0 ? <Muted text="No orders to chart yet." /> : (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'flex-end', gap: 2,
                        height: 120, marginBottom: 6,
                      }}>
                        {hourly.map(h => (
                          <div key={h.hour} title={`${h.hour}:00 — ${h.count} orders`}
                               style={{
                                 flex: 1,
                                 height: `${peakCount ? (h.count / peakCount) * 100 : 0}%`,
                                 minHeight: h.count ? 3 : 1,
                                 background: h.count ? C.red : C.border,
                                 borderRadius: '3px 3px 0 0',
                               }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.subtle }}>
                        <span>00:00</span><span>12:00</span><span>23:00</span>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            </>
          )}
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
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? C.text, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: '0 0 14px' }}>{title}</h2>
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

function Muted({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>{text}</p>;
}

const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
