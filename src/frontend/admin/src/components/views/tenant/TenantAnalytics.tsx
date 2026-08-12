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
import { useTheme } from '@/hooks/useTheme';

// ── Color Schema (Matches KDS page) ──────────────────────────────────
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

export default function TenantAnalytics() {
  const { isDark } = useTheme();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [loadingB, setLoadB] = useState(true);
  const [loadingO, setLoadO] = useState(false);
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
  const revenue = revenueOf(orders);
  const avg = completed.length ? Math.round(revenue / completed.length) : 0;
  const currency = branches[0]?.currencyCode || 'PKR';
  const perBranch = byBranch(orders);
  const items = topItems(orders, 8);
  const hourly = ordersByHour(orders);
  const types = byOrderType(orders);
  const peakCount = Math.max(...hourly.map(h => h.count), 0);

  return (
    <div className="min-h-screen" style={{ background: colors.bg, padding: '16px 20px 40px', maxWidth: 1150, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: colors.text, margin: '0 0 2px' }}>
            Analytics
          </h1>
          <p style={{ color: colors.muted, fontSize: 13, margin: 0 }}>
            The last 24 hours — what sold, when, and where.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          style={{
            background: colors.card2,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={loadingO ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <BranchPicker branches={branches} value={branchId}
        onChange={setBranchId} loading={loadingB} />

      {!loadingB && branches.length > 0 && (
        <>
          {loadingO && (
            <div className="flex flex-col items-center justify-center py-16 text-[#9CA3AF]">
              <Loader2 size={22} className="animate-spin" />
              <p className="mt-3 text-sm">Loading analytics…</p>
            </div>
          )}

          {!loadingO && error && (
            <div className="flex items-center gap-2 py-12 text-center text-[#ff8a5c]">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {!loadingO && !error && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <Stat icon={<Receipt size={17} />} label="Orders" value={String(completed.length)} colors={colors} />
                <Stat icon={<TrendingUp size={17} />} label="Revenue" value={money(revenue, currency)} accent={accent.green.text} colors={colors} />
                <Stat icon={<BarChart2 size={17} />} label="Avg order" value={money(avg, currency)} colors={colors} />
                <Stat icon={<Clock size={17} />} label="Cancelled" value={String(orders.length - completed.length)} colors={colors} />
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {branchId === '' && branches.length > 1 && (
                  <Card title="How each restaurant did" colors={colors}>
                    {perBranch.length === 0 ? <Muted text="No orders yet today." colors={colors} /> :
                      perBranch.map(b => {
                        const max = perBranch[0].orders;
                        return (
                          <div key={b.branchName} className="mb-3">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-semibold" style={{ color: colors.text }}>{b.branchName}</span>
                              <span className="text-xs" style={{ color: colors.muted }}>
                                {b.orders} · {money(b.revenue, currency)}
                              </span>
                            </div>
                            <Bar pct={max ? Math.round((b.orders / max) * 100) : 0} colors={colors} />
                          </div>
                        );
                      })}
                  </Card>
                )}

                <Card title="Dine in, pickup or delivery" colors={colors}>
                  {types.length === 0 ? <Muted text="No orders yet today." colors={colors} /> :
                    types.map(t => {
                      const share = completed.length
                        ? Math.round((t.orders / orders.length) * 100) : 0;
                      return (
                        <div key={t.type} className="mb-3">
                          <div className="flex justify-between mb-1">
                            <span style={{
                              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: 0.4, padding: '2px 8px', borderRadius: 6,
                              background: `${ORDER_TYPE_COLOR[t.type]}15`,
                              color: ORDER_TYPE_COLOR[t.type],
                            }}>{ORDER_TYPE_LABEL[t.type]}</span>
                            <span className="text-xs" style={{ color: colors.muted }}>
                              {t.orders} · {money(t.revenue, currency)} · {share}%
                            </span>
                          </div>
                          <Bar pct={share} colors={colors} />
                        </div>
                      );
                    })}
                </Card>

                <Card title="Selling best" colors={colors}>
                  {items.length === 0 ? <Muted text="Nothing sold yet today." colors={colors} /> :
                    items.map(t => {
                      const max = items[0].qty;
                      return (
                        <div key={t.name} className="mb-2.5">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-semibold" style={{ color: colors.text }}>{t.name}</span>
                            <span className="text-sm" style={{ color: colors.muted }}>{t.qty}</span>
                          </div>
                          <Bar pct={Math.round((t.qty / max) * 100)} colors={colors} />
                        </div>
                      );
                    })}
                </Card>

                <Card title="When you are busy" colors={colors}>
                  {peakCount === 0 ? <Muted text="No orders to chart yet." colors={colors} /> : (
                    <>
                      <div className="flex items-end gap-1 h-[120px] mb-1.5">
                        {hourly.map(h => (
                          <div key={h.hour} title={`${h.hour}:00 — ${h.count} orders`}
                            style={{
                              flex: 1,
                              height: `${peakCount ? (h.count / peakCount) * 100 : 0}%`,
                              minHeight: h.count ? 3 : 1,
                              background: h.count ? BRAND : colors.border,
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 0.3s ease',
                            }} />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px]" style={{ color: colors.subtle }}>
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

// ── Sub-components ──────────────────────────────────────────────────

function Stat({ icon, label, value, accent, colors }: any) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: colors.card, borderColor: colors.border }}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
        {icon} {label}
      </div>
      <div className="text-xl font-bold mt-0.5" style={{ color: accent || colors.text }}>{value}</div>
    </div>
  );
}

function Card({ title, children, colors }: any) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: colors.card, borderColor: colors.border }}>
      <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>{title}</h3>
      {children}
    </div>
  );
}

function Bar({ pct, colors }: any) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: colors.border }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: BRAND }} />
    </div>
  );
}

function Muted({ text, colors }: any) {
  return <p className="text-sm py-6 text-center" style={{ color: colors.muted }}>{text}</p>;
}
