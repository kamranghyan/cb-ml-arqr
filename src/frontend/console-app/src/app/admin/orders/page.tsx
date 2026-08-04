'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChefHat, Loader2, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import ScopePicker, { EMPTY_SCOPE, type Scope } from '@/components/ScopePicker';
import {
  fetchOrdersForRestaurant, derivedStatus, isLive, money, timeAgo,
  STATUS_LABEL, STATUS_COLOR, type SupportOrder,
} from '@/lib/support-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

const REFRESH_MS = 15000;

export default function KitchenOrdersPage() {
  const [scope, setScope]     = useState<Scope>(EMPTY_SCOPE);
  const [orders, setOrders]   = useState<SupportOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [lastAt, setLastAt]   = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!scope.tenantId || !scope.restaurantId) { setOrders([]); return; }
    if (!quiet) setLoading(true);
    setError('');
    try {
      const list = await fetchOrdersForRestaurant(scope.tenantId, scope.restaurantId, 4);
      setOrders(list);
      setLastAt(new Date());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [scope.tenantId, scope.restaurantId]);

  useEffect(() => { load(); }, [load]);

  // A kitchen board is only useful if it keeps itself current.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (scope.restaurantId) timer.current = setInterval(() => load(true), REFRESH_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [scope.restaurantId, load]);

  const live = orders.filter(isLive);
  const byStatus = (s: string) => live.filter(o => derivedStatus(o) === s);

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
            Kitchen Orders
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            What a branch is cooking right now. Read-only — the kitchen screen
            is where orders actually move.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastAt && (
            <span style={{ fontSize: 12, color: C.subtle }}>
              updated {lastAt.toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => load()} style={ghost}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <ScopePicker value={scope} onChange={setScope} />

      {!scope.restaurantId && (
        <Empty icon={<ChefHat size={28} />} title="Pick a company and restaurant"
               text="Then you will see that branch's live orders." />
      )}

      {scope.restaurantId && loading && (
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading orders…
        </div>
      )}

      {scope.restaurantId && !loading && error && (
        <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {scope.restaurantId && !loading && !error && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <Stat label="Live"      value={live.length} />
            <Stat label="Waiting"   value={byStatus('pending').length} />
            <Stat label="Preparing" value={byStatus('preparing').length} accent={C.red} />
            <Stat label="Ready"     value={byStatus('ready').length} accent={C.green} />
          </div>

          {live.length === 0 ? (
            <Empty icon={<ChefHat size={28} />} title="Nothing cooking"
                   text="No live orders at this branch in the last 4 hours." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
              {live
                .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''))
                .map(o => <OrderCard key={o.orderId} order={o} currency={scope.currency} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrderCard({ order, currency }: { order: SupportOrder; currency: string }) {
  const status = derivedStatus(order);
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
            Table {order.tableId || '—'}
          </div>
          <div style={{ fontSize: 12, color: C.subtle, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> {timeAgo(order.placedAt ?? order.createdAt)}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          padding: '4px 9px', borderRadius: 6,
          background: `${STATUS_COLOR[status]}15`, color: STATUS_COLOR[status],
        }}>{STATUS_LABEL[status]}</span>
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        {(order.lineItems ?? []).map((li, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
            <span style={{ color: C.text }}>
              <strong style={{ color: C.red }}>{li.quantity}×</strong> {li.name}
            </span>
            <span style={{ color: C.muted }}>{money(li.totalPriceMinorUnits, currency)}</span>
          </div>
        ))}
      </div>

      <div style={{
        borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 14, fontWeight: 800, color: C.text,
      }}>
        <span>Total</span>
        <span>{money(order.totalAmountMinorUnits, currency)}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 18px', minWidth: 100 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: C.subtle }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? C.text }}>{value}</div>
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: C.subtle }}>
      <div style={{ opacity: 0.4, marginBottom: 8 }}>{icon}</div>
      <p style={{ margin: 0, fontWeight: 600, color: C.muted }}>{title}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>{text}</p>
    </div>
  );
}

const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
