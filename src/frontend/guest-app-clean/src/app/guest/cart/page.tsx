'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Lock, Trash2, Tag, MapPin } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

export default function CartPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { items, updateQuantity, removeItem, subtotal, total, clearCart } = useCartStore();

  const [tableId,      setTableId]      = useState('');
  const [tableNum,     setTableNum]     = useState('');
  const [promo,        setPromo]        = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [placing,      setPlacing]      = useState(false);
  const [placed,       setPlaced]       = useState(false);
  const [orderId,      setOrderId]      = useState('');
  const [orderError,   setOrderError]   = useState('');
  const [notes,        setNotes]        = useState('');

  useEffect(() => {
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }
    const tid  = sessionStorage.getItem('lm_tid')   ?? '';
    const tnum = sessionStorage.getItem('lm_table') ?? '';
    setTableId(tid || `table-${tnum || '01'}`);
    setTableNum(tnum);
  }, []);

  const discount   = promoApplied ? Math.round(subtotal() * 0.1) : 0;
  const lineTotal  = items.reduce((s, i) => s + Math.round(i.price * i.quantity * 100), 0);
  const taxAmt     = Math.round(subtotal() * 0.15);
  const grandTotal = subtotal() - discount + taxAmt;

  const applyPromo = () => { if (promo.trim().toUpperCase() === 'HAPPY20') setPromoApplied(true); };

  const placeOrder = async () => {
    if (!items.length) return;
    setPlacing(true); setOrderError('');
    try {
      const tid = sessionStorage.getItem('lm_tid') ?? tableId ?? 'table-01';
      const lineItems = items.map(item => ({
        itemId: item.menuItemId, name: item.name, quantity: item.quantity,
        unitPriceMinorUnits:  Math.round(item.price * 100),
        totalPriceMinorUnits: Math.round(item.price * item.quantity * 100),
      }));
      const lineItemsTotal = lineItems.reduce((s, li) => s + li.totalPriceMinorUnits, 0);
      const payload = {
        tenantId: process.env.NEXT_PUBLIC_TENANT_ID_KDS, restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID_KDS,
        tableId: tid, currencyCode: 'PKR', totalAmountMinorUnits: lineItemsTotal, lineItems,
        ...(notes.trim() && { notes: notes.trim() }),
      };
      const res  = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? `Error ${res.status}`);
      setOrderId(data.orderId ?? ''); clearCart(); setPlaced(true);
    } catch (err: any) { setOrderError(err?.message ?? 'Failed to place order.'); }
    finally { setPlacing(false); }
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280',
  } : {
    bg: '#FFF8F1', card: '#FFFFFF', card2: '#F5F0EA', border: '#F0E8E0',
    text: '#1A1A1A', muted: '#687780', sub: '#9CA3AF',
  };

  // ── Success screen ──
  if (placed) return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, marginBottom: 24, boxShadow: '0 0 0 20px rgba(34,197,94,0.1)' }}>✓</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, color: D.text, fontFamily: 'Georgia,serif', margin: '0 0 8px', textAlign: 'center' }}>Order Placed!</h2>
      <p style={{ fontSize: 14, color: D.muted, textAlign: 'center', margin: '0 0 20px' }}>Your order has been sent to the kitchen.</p>
      {orderId && (
        <div style={{ background: '#FFF3E0', border: '2px solid #FFC72C', borderRadius: 24, padding: '10px 24px', marginBottom: 24 }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#891C1C', fontFamily: 'monospace' }}>#{orderId.slice(0,8).toUpperCase()}</span>
        </div>
      )}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => router.push('/guest/tracking')}
          style={{ width: '100%', height: 52, borderRadius: 26, background: '#E1251B', color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(225,37,27,0.3)' }}>
          📡 Track My Order
        </button>
        <button onClick={() => router.push('/guest/menu')}
          style={{ width: '100%', height: 48, borderRadius: 24, background: D.card, border: `1.5px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ← Back to Menu
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '52px 20px 16px', background: D.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: D.card, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={18} color={D.text} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: D.text, margin: 0, fontFamily: 'Georgia,serif' }}>Your Cart</h1>
            <p style={{ fontSize: 12, color: D.muted, margin: 0 }}>{items.length} item{items.length !== 1 ? 's' : ''} · {tableNum ? `Table ${tableNum}` : 'Walk-in'}</p>
          </div>
        </div>
      </div>

      {/* Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>

        {/* Items */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{ fontSize: 48, opacity: 0.2 }}>🛒</span>
            <p style={{ color: D.muted, fontSize: 14, marginTop: 12 }}>Your cart is empty</p>
            <button onClick={() => router.push('/guest/menu')}
              style={{ marginTop: 16, padding: '10px 24px', borderRadius: 24, background: '#E1251B', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Browse Menu
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {items.map(item => (
              <div key={item.id} style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 18, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: D.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                    {item.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: D.muted, margin: '0 0 8px' }}>
                      {Object.values(item.options).filter(Boolean).join(' · ') || 'No modifications'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#E1251B' }}>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: `1.5px solid ${D.border}`, borderRadius: 10, overflow: 'hidden' }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{ width: 32, height: 30, background: 'none', border: 'none', color: '#E1251B', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>−</button>
                        <span style={{ width: 28, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: D.text, borderLeft: `1px solid ${D.border}`, borderRight: `1px solid ${D.border}` }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ width: 32, height: 30, background: 'none', border: 'none', color: '#E1251B', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 size={13} color="#E1251B" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* Table */}
            <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 16, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={16} color="#E1251B" />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: D.muted, margin: 0 }}>Dining at</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>{tableNum ? `Table ${tableNum}` : tableId || 'Walk-in Guest'}</p>
              </div>
              <span style={{ color: '#22c55e', fontWeight: 800 }}>✓</span>
            </div>

            {/* Promo */}
            <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 16, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Tag size={16} color={D.muted} />
              <input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Add promo code"
                style={{ flex: 1, background: 'none', border: 'none', fontSize: 14, color: D.text, outline: 'none' }} />
              {promo && <button onClick={applyPromo} style={{ fontSize: 12, fontWeight: 700, color: '#E1251B', background: 'none', border: 'none', cursor: 'pointer' }}>Apply</button>}
              {promoApplied && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ 10% off</span>}
              <ChevronRight size={16} color={D.sub} />
            </div>

            {/* Bill */}
            <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 16, padding: '16px', marginBottom: 12 }}>
              {[
                ['Subtotal', `Rs. ${subtotal().toLocaleString()}`],
                ['Tax (15%)', `Rs. ${taxAmt.toLocaleString()}`],
                ...(promoApplied ? [['Promo Discount', `- Rs. ${discount.toLocaleString()}`]] : []),
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${D.border}` }}>
                  <span style={{ fontSize: 13, color: D.muted }}>{l}</span>
                  <span style={{ fontSize: 13, color: l === 'Promo Discount' ? '#16a34a' : D.muted, fontWeight: l === 'Promo Discount' ? 700 : 400 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: D.text }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#E1251B', fontFamily: 'Georgia,serif' }}>Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Notes */}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions for kitchen…" rows={2}
              style={{ width: '100%', borderRadius: 14, padding: '12px 14px', fontSize: 13, marginBottom: 12, resize: 'none', background: D.card, border: `1.5px solid ${D.border}`, color: D.text, outline: 'none', fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box' }} />

            {/* Error */}
            {orderError && <div style={{ padding: '12px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: '#E1251B', margin: 0 }}>{orderError}</p>
            </div>}
          </>
        )}
        <div style={{ height: 100 }} />
      </div>

      {/* Footer CTA */}
      {items.length > 0 && (
        <div style={{ padding: '14px 20px 32px', background: D.bg, borderTop: `1px solid ${D.border}` }}>
          <button onClick={placeOrder} disabled={placing}
            style={{ width: '100%', height: 56, borderRadius: 28, background: placing ? '#ccc' : '#E1251B', color: '#fff', border: 'none', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', cursor: placing ? 'not-allowed' : 'pointer', boxShadow: '0 6px 20px rgba(225,37,27,0.35)', transition: 'all 0.2s' }}>
            {placing
              ? <><div style={{ width: 20, height: 20, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></>
              : <><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={15} /> Place Order</span><span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 14px', borderRadius: 20 }}>→ Rs. {grandTotal.toLocaleString()}</span></>}
          </button>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}