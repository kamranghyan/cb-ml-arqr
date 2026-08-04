'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';

const BRAND = '#ff5723';

const ORDER_TYPES      = ['Dine In', 'Pickup', 'Delivery'];
const PAYMENT_METHODS  = ['Cash', 'Card', 'Digital Wallet'];
// TODO(backend): there's no "list of tables" endpoint — placeholder range,
// defaulted below to the guest's real QR-scanned table when known.
const TABLE_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1));

export default function CheckoutPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { items, subtotal, clearCart } = useCartStore();

  const [orderType,     setOrderType]     = useState('Dine In');
  const [tableNumber,   setTableNumber]   = useState('1');
  const [fullName,      setFullName]      = useState('');
  const [phone,         setPhone]         = useState('');
  const [notes,         setNotes]         = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const [placing,    setPlacing]    = useState(false);
  const [placed,     setPlaced]     = useState(false);
  const [orderId,    setOrderId]    = useState('');
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }
    if (items.length === 0) { router.replace('/guest/cart'); return; }
    const tnum = sessionStorage.getItem('lm_table') ?? '';
    if (tnum) setTableNumber(tnum);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const taxAmt     = Math.round(subtotal() * 0.06);
  const grandTotal = subtotal() + taxAmt;

  const placeOrder = async () => {
    if (!items.length) return;
    setPlacing(true); setOrderError('');
    try {
      const scope = getGuestScope();
      // Table selection above is guest-facing only — the order is still
      // tagged with the real QR-scanned table (lm_tid) for backend
      // correctness, since there's no endpoint to validate a manually
      // chosen table number against this restaurant's actual floor plan.
      const tid = sessionStorage.getItem('lm_tid') ?? `table-${tableNumber.padStart(2, '0')}`;
      const lineItems = items.map(item => ({
        itemId: item.menuItemId, name: item.name, quantity: item.quantity,
        unitPriceMinorUnits:  Math.round(item.price * 100),
        totalPriceMinorUnits: Math.round(item.price * item.quantity * 100),
      }));
      const lineItemsTotal = lineItems.reduce((s, li) => s + li.totalPriceMinorUnits, 0);
      const payload = {
        restaurantId: scope.restaurantId,
        tableId: tid, currencyCode: 'PKR', totalAmountMinorUnits: lineItemsTotal, lineItems,
        ...(notes.trim()     && { notes: notes.trim() }),
        // TODO(backend): these four aren't in the documented orders
        // payload — included defensively in case the API stores them;
        // drop them if it rejects unknown fields.
        orderType,
        paymentMethod,
        ...(fullName.trim() && { customerName:  fullName.trim() }),
        ...(phone.trim()    && { customerPhone: phone.trim() }),
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
    text: '#F5F0E8', muted: '#9CA3AF',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B',
  };

  // ── Success screen ──────────────────────────────────────────────────────
  if (placed) return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 32px 100px', textAlign: 'center' }}>
        <div style={{ width: 130, height: 130, borderRadius: '50%', background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <Check size={62} color="#fff" strokeWidth={3} />
        </div>
        <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 30, fontWeight: 700, color: BRAND, margin: '0 0 32px', lineHeight: 1.25 }}>
          Order Placed Successfully!
        </h1>

        <p style={{ fontSize: 16, color: BRAND, margin: '0 0 4px' }}>Order ID</p>
        <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700, color: D.text, margin: '0 0 28px' }}>
          #{orderId ? orderId.slice(0, 8).toUpperCase() : '—'}
        </p>

        {/* TODO(backend): no per-order ETA field exists yet — placeholder */}
        <p style={{ fontSize: 16, color: BRAND, margin: '0 0 4px' }}>Estimated Time</p>
        <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700, color: D.text, margin: '0 0 40px' }}>20–30 mins</p>

        <button onClick={() => router.push('/guest/tracking')}
          style={{ width: '100%', height: 56, borderRadius: 16, background: BRAND, color: '#fff', border: 'none', fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, cursor: 'pointer', marginBottom: 20 }}>
          Track Order
        </button>
        <button onClick={() => router.push('/guest/menu')}
          style={{ background: 'none', border: 'none', fontSize: 16, fontWeight: 600, color: D.text, cursor: 'pointer' }}>
          Back to Menu
        </button>
      </div>
      <BottomNav />
    </div>
  );

  // ── Checkout form ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '20px 0 28px' }}>
          <button onClick={() => router.back()} style={{ position: 'absolute', left: 0, background: 'none', border: 'none', cursor: 'pointer', color: BRAND, padding: 4, display: 'flex' }} aria-label="Back">
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 24, fontWeight: 700, color: D.text, margin: 0 }}>Checkout</h1>
        </div>

        {/* Order Type */}
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Order Type</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {ORDER_TYPES.map(t => {
            const selected = orderType === t;
            return (
              <button key={t} onClick={() => setOrderType(t)}
                style={{ flex: 1, height: 56, borderRadius: 14, border: `2px solid ${BRAND}`, background: selected ? BRAND : D.card, color: selected ? '#fff' : BRAND, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                {t}
              </button>
            );
          })}
        </div>

        {/* Table Number */}
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Table Number</h2>
        <div style={{ position: 'relative', marginBottom: 28 }}>
          <select value={tableNumber} onChange={e => setTableNumber(e.target.value)}
            style={{ width: '100%', height: 56, borderRadius: 14, border: 'none', background: BRAND, color: '#fff', fontSize: 17, fontWeight: 500, padding: '0 44px 0 18px', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
            {TABLE_OPTIONS.map(n => <option key={n} value={n} style={{ color: '#000' }}>{n}</option>)}
          </select>
          <ChevronDown size={20} color="#fff" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        {/* Customer Details */}
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Customer Details</h2>
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="checkout-input"
          style={{ width: '100%', height: 56, borderRadius: 14, border: 'none', background: BRAND, color: '#fff', fontSize: 16, padding: '0 18px', marginBottom: 12, boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif" }} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" type="tel" className="checkout-input"
          style={{ width: '100%', height: 56, borderRadius: 14, border: 'none', background: BRAND, color: '#fff', fontSize: 16, padding: '0 18px', marginBottom: 28, boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif" }} />

        {/* Special Note */}
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Special Note (Optional)</h2>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Type here…." rows={4} className="checkout-input"
          style={{ width: '100%', borderRadius: 14, border: 'none', background: BRAND, color: '#fff', fontSize: 16, padding: '16px 18px', marginBottom: 28, resize: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif" }} />

        {/* Payment Method */}
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Payment Method</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {PAYMENT_METHODS.map(m => {
            const selected = paymentMethod === m;
            return (
              <button key={m} onClick={() => setPaymentMethod(m)}
                style={{ flex: 1, height: 56, borderRadius: 14, border: `2px solid ${BRAND}`, background: selected ? BRAND : D.card, color: selected ? '#fff' : BRAND, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {m}
              </button>
            );
          })}
        </div>
        {/* Payment method above is a stated preference only — no payment
            gateway is wired up, this doesn't actually process a card or
            wallet charge. */}

        {orderError && (
          <div style={{ padding: '12px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: 12, margin: '12px 0' }}>
            <p style={{ fontSize: 12, color: BRAND, margin: 0 }}>{orderError}</p>
          </div>
        )}

        <button onClick={placeOrder} disabled={placing}
          style={{ width: '100%', height: 58, borderRadius: 16, background: placing ? '#ccc' : BRAND, color: '#fff', border: 'none', fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer', marginTop: 16 }}>
          {placing
            ? <div style={{ width: 20, height: 20, margin: '0 auto', border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            : 'Place Order'}
        </button>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .checkout-input::placeholder{color:rgba(255,255,255,0.85)}
      `}</style>
    </div>
  );
}