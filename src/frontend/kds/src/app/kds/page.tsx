'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Volume2, VolumeX, RefreshCw, Wifi, WifiOff, Radio, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { formatTimer, timerColorClass, timerBarColor, playNewOrderBeep } from '@/lib/utils';
import { fetchOrders, patchOrderStatus, normaliseOrder, toKdsStatus, WS_URL } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { connectWebSocket } from '@/lib/orders-api';

type Filter = 'all' | 'new' | 'preparing' | 'ready' | 'delivered';
type WsState = 'connecting' | 'connected' | 'disconnected' | 'error';

const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing', preparing: 'ready', ready: 'delivered', delivered: null,
};
const STATUS_ORDER: Record<KdsStatus, number> = { new: 0, preparing: 1, ready: 2, delivered: 3 };
const STATUS_RANK: Record<string, number> = { new: 0, preparing: 1, ready: 2, delivered: 3 };
const STRIP_COLOR: Record<KdsStatus, string> = {
  new: '#ff5723', preparing: '#3b82f6', ready: '#22c55e', delivered: '#a855f7',
};
const BRAND = '#ff5723';
const POLL_INTERVAL = 15000;

export default function KitchenDisplayPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [audio, setAudio] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [pollPct, setPollPct] = useState(0);
  const [apiState, setApiState] = useState<'loading' | 'live' | 'error'>('loading');
  const [apiError, setApiError] = useState('');
  const [wsState, setWsState] = useState<WsState>('disconnected');
  const [wsLog, setWsLog] = useState<string[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pollStart = useRef(Date.now());
  const prevIds = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleLogout() { setLoggingOut(true); await logout(); router.push('/login/kds'); }

  useEffect(() => { const tick = () => { const n = new Date(); setClock([n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2, '0')).join(':')); }; tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => { setOrders(prev => prev.map(o => o.status !== 'delivered' ? { ...o, elapsedSeconds: Math.min(o.elapsedSeconds + 1, o.maxSeconds + 300) } : o)); }, 1000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => { setPollPct(Math.min(100, ((Date.now() - pollStart.current) % POLL_INTERVAL) / POLL_INTERVAL * 100)); }, 200); return () => clearInterval(id); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };
  const addWsLog = (msg: string) => { const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); setWsLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 9)]); };

  const connectWs = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsState('connecting'); addWsLog('Connecting to WebSocket…');
    const ws = await connectWebSocket(); wsRef.current = ws;
    ws.onopen = () => { setWsState('connected'); addWsLog('✓ Connected'); ws.send(JSON.stringify({ action: 'subscribe', channel: 'orders' })); };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data); addWsLog(`← ${JSON.stringify(msg).slice(0, 80)}`);
        const orderId = msg.orderId ?? msg.order_id; const status = msg.status ?? msg.orderStatus; const flags = msg.flags;
        if (orderId && (status || flags)) {
          const kdsStatus = toKdsStatus(status ?? '', flags); const displayId = `LM-${orderId.slice(0, 6).toUpperCase()}`;
          setOrders(prev => {
            const exists = prev.find(o => (o as any)._apiId === orderId || o.id === displayId);
            if (exists) { showToast(`📡 WS: Order #${displayId} → ${kdsStatus.toUpperCase()}`); return prev.map(o => ((o as any)._apiId === orderId || o.id === displayId) ? { ...o, status: kdsStatus } : o); }
            else if (msg.lineItems || msg.items) { const n = normaliseOrder(msg); showToast(`🔔 WS: New order #${n.id} — Table ${n.table}`); if (audio) playNewOrderBeep(); return [n, ...prev]; }
            return prev;
          });
        }
      } catch { addWsLog(`← (non-JSON) ${event.data?.slice(0, 60)}`); }
    };
    ws.onerror = () => { setWsState('error'); addWsLog('✗ WebSocket error'); };
    ws.onclose = (e) => { setWsState('disconnected'); addWsLog(`✗ Disconnected (code ${e.code})`); if (wsRetryRef.current) clearTimeout(wsRetryRef.current); wsRetryRef.current = setTimeout(connectWs, 5000); };
  }, [audio]);

  useEffect(() => { connectWs(); return () => { if (wsRetryRef.current) clearTimeout(wsRetryRef.current); wsRef.current?.close(); }; }, [connectWs]);
  const wsSend = (p: object) => { if (wsRef.current?.readyState === WebSocket.OPEN) { const m = JSON.stringify(p); wsRef.current.send(m); addWsLog(`→ ${m.slice(0, 80)}`); } };

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setApiState('loading');
    try {
      const fresh = await fetchOrders(); const freshIds = new Set(fresh.map((o: any) => o.id));
      const newOnes = fresh.filter((o: any) => !prevIds.current.has(o.id));
      if (newOnes.length > 0 && prevIds.current.size > 0) newOnes.forEach((o: any) => { showToast(`🔔 New order #${o.id} — Table ${o.table}`); if (audio) playNewOrderBeep(); });
      prevIds.current = freshIds;
      setOrders(prev => { const m = new Map(prev.map(o => [o.id, o])); return fresh.map((o: any) => { const e = m.get(o.id); if (!e) return o; const er = STATUS_RANK[e.status] ?? 0; const fr = STATUS_RANK[o.status] ?? 0; const status = er > fr ? e.status : o.status; return { ...o, status, elapsedSeconds: e.elapsedSeconds, items: e.items }; }); });
      setApiState('live'); pollStart.current = Date.now();
    } catch (err: any) { setApiError(err?.message ?? 'Failed'); setApiState('error'); }
  }, [audio]);

  useEffect(() => { loadOrders(); const id = setInterval(() => loadOrders(true), POLL_INTERVAL); return () => clearInterval(id); }, [loadOrders]);

  const advanceOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId); if (!order) return;
    const next = STATUS_NEXT[order.status]; if (!next) return;
    setAdvancing(orderId); setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: next } : o));
    try { const apiId = (order as any)._apiId ?? orderId; await patchOrderStatus(apiId, next); wsSend({ action: 'orderStatusUpdate', orderId: apiId, status: next }); showToast(`Order #${orderId} → ${next.toUpperCase()}`); }
    catch (err: any) { setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: order.status } : o)); showToast(`⚠ Failed: ${err?.message}`); }
    finally { setAdvancing(null); }
  };

  const toggleDish = (orderId: string, idx: number) => { setOrders(prev => prev.map(o => { if (o.id !== orderId) return o; const items = o.items.map((it, i) => i === idx ? { ...it, done: !it.done } : it); return { ...o, items }; })); };

  const filtered = orders.filter(o => { if (filter === 'all') return o.status !== 'delivered'; if (filter === 'delivered') return o.status === 'delivered'; return o.status === filter; }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.elapsedSeconds - a.elapsedSeconds);
  const counts = { pending: orders.filter(o => o.status === 'new').length, preparing: orders.filter(o => o.status === 'preparing').length, ready: orders.filter(o => o.status === 'ready').length };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', subtle: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#ffffff', card2: '#F9FAFB', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', subtle: '#9CA3AF',
  };
  const TONE = {
    green: isDark ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' } : { bg: '#F0FFF4', border: '#BBF7D0', text: '#16a34a' },
    amber: isDark ? { bg: 'rgba(217,119,6,0.15)', border: 'rgba(217,119,6,0.35)', text: '#fbbf24' } : { bg: '#FFFBEB', border: '#FDE68A', text: '#d97706' },
    danger: isDark ? { bg: 'rgba(255,87,35,0.12)', border: 'rgba(255,87,35,0.3)', text: '#ff8a5c' } : { bg: '#FFF0F0', border: '#FFD0D0', text: BRAND },
    blue: isDark ? { bg: 'rgba(59,130,246,0.15)', border: 'rgba(96,165,250,0.3)', text: '#60a5fa' } : { bg: '#EFF6FF', border: '#BFDBFE', text: '#1d4ed8' },
    orange: isDark ? { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' } : { bg: '#FFF3E0', border: '#FED7AA', text: '#c2410c' },
    purple: isDark ? { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)', text: '#a78bfa' } : { bg: '#FAF5FF', border: '#DDD6FE', text: '#7c3aed' },
    gray: isDark ? { bg: D.card2, border: D.border, text: D.subtle } : { bg: '#F9FAFB', border: '#E5E7EB', text: '#9CA3AF' },
  };
  const BTN_CFG: Record<KdsStatus, { label: string; bg: string; color: string; border: string }[]> = {
    new: [{ label: '✓ Accept', bg: TONE.blue.bg, color: TONE.blue.text, border: TONE.blue.border }, { label: '🔥 Preparing', bg: TONE.orange.bg, color: TONE.orange.text, border: TONE.orange.border }],
    preparing: [{ label: '🔔 Mark Ready', bg: TONE.green.bg, color: TONE.green.text, border: TONE.green.border }],
    ready: [{ label: '✓ Delivered', bg: TONE.purple.bg, color: TONE.purple.text, border: TONE.purple.border }],
    delivered: [{ label: '✓ Completed', bg: TONE.gray.bg, color: TONE.gray.text, border: TONE.gray.border }],
  };

  const apiColor = apiState === 'live' ? TONE.green : apiState === 'error' ? TONE.danger : TONE.amber;
  const wsColor = wsState === 'connected' ? TONE.green : wsState === 'connecting' ? TONE.amber : TONE.danger;

  // Mobile menu toggle
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans,sans-serif', transition: 'background 0.25s' }}>

      {toast && <div style={{ position: 'fixed', top: 80, right: 20, zIndex: 50, background: D.card, border: `1.5px solid ${TONE.orange.border}`, borderRadius: 18, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 24px rgba(255,87,35,0.15)', maxWidth: 320 }}><div style={{ width: 32, height: 32, borderRadius: 10, background: TONE.orange.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔔</div><p style={{ fontSize: 13, fontWeight: 600, color: D.text, margin: 0 }}>{toast}</p></div>}

      {/* Header — Responsive */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: BRAND,
        boxShadow: '0 2px 12px rgba(255,87,35,0.25)',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '8px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        {/* Logo - Always visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src='./Images/logo.png' alt="Menulay Logo" style={{ width: 120, height: 32, objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0, fontFamily: "'Baloo 2', sans-serif", lineHeight: 1 }}>KDS</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Kitchen Display</p>
          </div>
        </div>

        {/* Mobile: Clock + Counts + Menu Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Clock - always visible on mobile */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>{clock || '00:00:00'}</p>
            <p className="hidden sm:block text-[8px] text-white/50 m-0">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>          </div>

          {/* Counts - visible on mobile */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[{ val: counts.pending, label: 'P' }, { val: counts.preparing, label: 'Pr' }, { val: counts.ready, label: 'R' }].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: "'Baloo 2', sans-serif", lineHeight: 1 }}>{s.val}</span>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Hamburger Menu Toggle */}
          <button onClick={toggleMobileMenu} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div style={{
          background: D.card,
          borderBottom: `1px solid ${D.border}`,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'sticky',
          top: 60,
          zIndex: 9,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {/* Status Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: apiColor.bg, border: `1px solid ${apiColor.border}`, borderRadius: 16, padding: '4px 10px' }}>
              {apiState === 'live' ? <Wifi size={10} color={apiColor.text} /> : apiState === 'error' ? <WifiOff size={10} color={apiColor.text} /> : <RefreshCw size={10} color={apiColor.text} className="animate-spin" />}
              <span style={{ fontSize: 9, fontWeight: 700, color: apiColor.text, textTransform: 'uppercase' }}>{apiState === 'live' ? 'REST' : apiState === 'error' ? 'Error' : '…'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: wsColor.bg, border: `1px solid ${wsColor.border}`, borderRadius: 16, padding: '4px 10px' }}>
              <Radio size={10} color={wsColor.text} />
              <span style={{ fontSize: 9, fontWeight: 700, color: wsColor.text, textTransform: 'uppercase' }}>WS {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '…' : 'Off'}</span>
              {wsState === 'connected' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />}
            </div>
          </div>
          <div className='flex gap-2'>
            {/* Audio Toggle */}
            <button onClick={() => setAudio(!audio)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${audio ? 'rgba(255,255,255,0.2)' : '#FFD0D0'}`, background: audio ? 'rgba(255,255,255,0.08)' : '#FFF0F0', color: audio ? D.text : BRAND, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>
              {audio ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            {/* Theme Toggle */}
            <button onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${D.border}`, background: D.card2, color: D.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
          {/* Logout */}
          <button onClick={handleLogout} disabled={loggingOut} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FFD0D0', background: '#FFF0F0', color: BRAND, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>
            <LogOut size={14} /> {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      )}


      {/* Poll bar */}
      <div style={{ height: 3, background: D.border, flexShrink: 0 }}><div style={{ height: '100%', background: BRAND, transition: 'width 0.2s', width: `${pollPct}%` }} /></div>

      {/* API error */}
      {apiState === 'error' && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: TONE.danger.bg, borderBottom: `1px solid ${TONE.danger.border}`, flexShrink: 0 }}><WifiOff size={14} color={TONE.danger.text} /><p style={{ fontSize: 12, color: TONE.danger.text, flex: 1, margin: 0 }}>{apiError}</p><button onClick={() => loadOrders()} style={{ padding: '4px 14px', borderRadius: 8, background: TONE.danger.bg, border: `1px solid ${TONE.danger.border}`, color: TONE.danger.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Retry</button></div>}

      {/* Filter bar - Responsive */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: D.card,
        borderBottom: `1.5px solid ${D.border}`,
        flexShrink: 0,
        overflowX: 'auto',
        flexWrap: 'nowrap'
      }}>
        {([{ key: 'all', label: 'All' }, { key: 'new', label: '🟠 New' }, { key: 'preparing', label: '🔵 Prep' }, { key: 'ready', label: '🟢 Ready' }] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '4px 12px',
            borderRadius: 16,
            border: `1.5px solid ${filter === f.key ? BRAND : D.border}`,
            background: filter === f.key ? TONE.danger.bg : D.card,
            color: filter === f.key ? BRAND : D.muted,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>{f.label}</button>
        ))}
        <div style={{ width: 1, height: 16, background: D.border, margin: '0 4px', flexShrink: 0 }} />
        <button onClick={() => setFilter('delivered')} style={{
          padding: '4px 12px',
          borderRadius: 16,
          border: `1.5px solid ${filter === 'delivered' ? '#7c3aed' : D.border}`,
          background: filter === 'delivered' ? TONE.purple.bg : D.card,
          color: filter === 'delivered' ? TONE.purple.text : D.muted,
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>✓ Done</button>
      </div>

      {/* WS log - Responsive */}
      {wsLog.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: TONE.green.bg, borderBottom: `1px solid ${TONE.green.border}`, flexShrink: 0, overflow: 'hidden' }}>
        <Radio size={10} color={TONE.green.text} style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 9, color: TONE.green.text, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, margin: 0 }}>{wsLog[0]}</p>
        <span style={{ fontSize: 8, color: D.subtle, flexShrink: 0 }}>{wsLog.length}</span>
      </div>}

      {/* Loading */}
      {apiState === 'loading' && orders.length === 0 && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px' }}><div style={{ width: 40, height: 40, border: `3px solid ${BRAND}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><p style={{ fontSize: 14, color: D.muted, fontWeight: 600 }}>Loading orders…</p></div>}

      {/* Grid - Responsive */}
      {(apiState !== 'loading' || orders.length > 0) && (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          padding: '12px',
          alignContent: 'start',
          overflowY: 'auto'
        }}>
          {filtered.length === 0 && <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', gap: 12, border: `2px dashed ${D.border}`, borderRadius: 20, background: D.card }}><span style={{ fontSize: 32, opacity: 0.2 }}>✓</span><p style={{ fontSize: 13, color: D.muted, fontWeight: 600, margin: 0 }}>No orders in this category</p></div>}

          {filtered.map(order => {
            const pct = Math.min(100, (order.elapsedSeconds / order.maxSeconds) * 100);
            const isUrgent = pct >= 90; const isAdvancing = advancing === order.id; const allDone = order.items.every(i => i.done);
            return (
              <div key={order.id} style={{
                background: D.card,
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                border: `1.5px solid ${isUrgent ? TONE.danger.border : D.border}`,
                boxShadow: isUrgent ? '0 0 0 3px rgba(255,87,35,0.08),0 4px 16px rgba(255,87,35,0.08)' : (isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)'),
                transition: 'all 0.2s',
                overflow: 'hidden',
                minWidth: 0
              }}>
                <div style={{ height: 4, background: STRIP_COLOR[order.status] }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px 8px', borderBottom: `1px solid ${D.border}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: D.text, margin: 0 }}>#{order.id}</p>
                      {allDone && order.status !== 'delivered' && <span style={{ fontSize: 8, background: TONE.green.bg, border: `1px solid ${TONE.green.border}`, color: TONE.green.text, padding: '1px 6px', borderRadius: 12, fontWeight: 700 }}>DONE</span>}
                    </div>
                    <p style={{ fontSize: 10, color: D.muted, margin: '2px 0 0' }}>🪑 Table {order.table} · {order.zone}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, margin: 0 }} className={timerColorClass(order.elapsedSeconds, order.maxSeconds)}>{formatTimer(order.elapsedSeconds)}</p>
                    <p style={{ fontSize: 9, color: D.subtle, margin: '1px 0 0' }}>{order.placedAt}</p>
                  </div>
                </div>
                <div style={{ height: 3, background: D.border }}><div style={{ height: '100%', borderRadius: 4, transition: 'width 1s', width: `${pct}%`, background: timerBarColor(order.elapsedSeconds, order.maxSeconds) }} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', flex: 1 }}>
                  {order.items.map((dish, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{dish.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: dish.done ? D.subtle : D.text, textDecoration: dish.done ? 'line-through' : 'none' }}>{dish.name}</p>
                        {dish.mods && <p style={{ fontSize: 9, color: D.subtle, margin: 0 }}>{dish.mods}</p>}
                      </div>
                      <span style={{ fontSize: 11, color: D.muted, fontWeight: 600, flexShrink: 0 }}>×{dish.qty}</span>
                      <button onClick={() => toggleDish(order.id, i)} style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${dish.done ? BRAND : D.border}`, background: dish.done ? BRAND : D.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
                        {dish.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                      </button>
                    </div>
                  ))}
                </div>
                {order.note && <div style={{ margin: '0 10px 6px', padding: '6px 10px', background: TONE.amber.bg, border: `1px solid ${TONE.amber.border}`, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 4 }}><span style={{ color: TONE.amber.text, fontSize: 10, marginTop: 1 }}>⚠</span><p style={{ fontSize: 9, color: TONE.amber.text, lineHeight: 1.4, margin: 0, fontWeight: 600 }}>{order.note}</p></div>}
                <div style={{ display: 'flex', gap: 6, padding: '8px 10px 10px', borderTop: `1px solid ${D.border}` }}>
                  {BTN_CFG[order.status].map((btn, i) => (
                    <button key={btn.label} onClick={() => i === 0 && advanceOrder(order.id)} disabled={order.status === 'delivered' || isAdvancing}
                      style={{ flex: 1, height: 32, borderRadius: 8, border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontSize: 10, fontWeight: 700, cursor: order.status === 'delivered' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.2s', opacity: (order.status === 'delivered' || isAdvancing) ? 0.5 : 1 }}>
                      {isAdvancing && i === 0 ? <div style={{ width: 12, height: 12, border: `2px solid ${btn.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : btn.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}