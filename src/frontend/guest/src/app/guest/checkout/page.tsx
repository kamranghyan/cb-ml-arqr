'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Check, MapPin, CreditCard, Wallet, Smartphone, Shield, Lock } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useGuestProfileStore } from '@/lib/guest-profile-store';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';
import Image from 'next/image';

const BRAND = '#ff5723';

const ORDER_TYPES     = ['dine_in', 'pickup', 'delivery'];
const PAYMENT_METHODS = ['Cash', 'Card', 'Digital Wallet'];

// Display names for order types
const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine_in': 'Dine In',
  'pickup': 'Pickup',
  'delivery': 'Delivery'
};

export default function CheckoutPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { items, clearCart } = useCartStore();
  const savedProfile = useGuestProfileStore();

  const [orderType,     setOrderType]     = useState('dine_in');
  const [tableNumber,   setTableNumber]   = useState('');
  const [fullName,      setFullName]      = useState(savedProfile.fullName);
  const [phone,         setPhone]         = useState(savedProfile.phone);
  const [notes,         setNotes]         = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPhone, setContactPhone]   = useState('');

  // Card Details
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Digital Wallet
  const [walletProvider, setWalletProvider] = useState('');

  const [placing,    setPlacing]    = useState(false);
  const [placed,     setPlaced]     = useState(false);
  const [orderId,    setOrderId]    = useState('');
  const [orderError, setOrderError] = useState('');

  // ── Logging Helper ──────────────────────────────────────────────────────────
  const log = (step: string, data: any) => {
    console.log(`🔍 [${step}]`, JSON.stringify(data, null, 2));
  };

  useEffect(() => {
    console.log('═══════════════════════════════════════════════');
    console.log('📋 CHECKOUT PAGE INITIALIZED');
    console.log('═══════════════════════════════════════════════');
    
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    console.log('📋 Session exists:', !!hasSession);
    
    if (!hasSession) { 
      console.log('❌ No session found, redirecting to /guest');
      window.location.href = '/guest'; 
      return; 
    }
    
    if (items.length === 0) { 
      console.log('❌ Cart is empty, redirecting to /guest/cart');
      router.replace('/guest/cart'); 
      return; 
    }
    
    console.log('📋 Cart items:', items.length);
    items.forEach((item, idx) => {
      console.log(`   Item ${idx + 1}:`, {
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        options: item.options
      });
    });
    
    const tid = sessionStorage.getItem('lm_tid') ?? '';
    const tnum = sessionStorage.getItem('lm_table') ?? '';
    console.log('📋 Session data:', { tid, tnum });
    
    let tableNum = tnum;
    if (!tableNum && tid) {
      const match = tid.match(/table[-_]?(\d+)/i);
      if (match) {
        tableNum = match[1];
        console.log('📋 Extracted table number from tid:', tableNum);
      }
    }
    
    if (tableNum) {
      console.log('✅ Setting table number to:', tableNum);
      setTableNumber(tableNum);
    } else {
      console.log('ℹ️ No table number found in session');
    }
    
    // Set contact phone from saved profile
    if (savedProfile.phone) {
      console.log('📋 Setting contact phone from profile:', savedProfile.phone);
      setContactPhone(savedProfile.phone);
    }
    
    console.log('═══════════════════════════════════════════════');
  }, []);

  const showTableNumber = orderType === 'dine_in' && tableNumber;
  const showCardFields = paymentMethod === 'Card';
  const showWalletFields = paymentMethod === 'Digital Wallet';
  const showDeliveryFields = orderType === 'delivery';

  // Card number formatting
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/(\d{1,4})/g);
    if (groups) {
      return groups.join(' ').slice(0, 19);
    }
    return cleaned.slice(0, 16);
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardExpiry(formatExpiry(e.target.value));
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
  };

  const placeOrder = async () => {
    console.log('═══════════════════════════════════════════════');
    console.log('🔄 PLACE ORDER STARTED');
    console.log('═══════════════════════════════════════════════');
    
    console.log('📋 Current state:');
    console.log('   - Order Type:', orderType);
    console.log('   - Table Number:', tableNumber);
    console.log('   - Payment Method:', paymentMethod);
    console.log('   - Full Name:', fullName);
    console.log('   - Phone:', phone);
    console.log('   - Notes:', notes);
    console.log('   - Delivery Address:', deliveryAddress);
    console.log('   - Contact Phone:', contactPhone);
    
    if (!items.length) {
      console.log('❌ Cart is empty, cannot place order');
      setOrderError('Cart is empty');
      return;
    }
    
    console.log('📋 Items in cart:', items.length);
    items.forEach((item, idx) => {
      console.log(`   Item ${idx + 1}: ${item.name} x${item.quantity} = Rs.${item.price * item.quantity}`);
    });
    
    setPlacing(true); 
    setOrderError('');
    
    try {
      const scope = getGuestScope();
      console.log('📋 Guest Scope:', {
        restaurantId: scope.restaurantId,
        tenantId: scope.tenantId
      });
      
      // Get table ID - only for dine-in
      let tableId = '';
      if (orderType === 'dine_in') {
        const sessionTid = sessionStorage.getItem('lm_tid');
        tableId = sessionTid ?? `table-${tableNumber.padStart(2, '0')}`;
        console.log('📋 Dine-in table ID from session:', sessionTid);
        console.log('📋 Final table ID:', tableId);
      } else {
        console.log('📋 Order type:', orderType, '- No table ID needed');
      }
      
      // Calculate prices with options
      console.log('📋 Calculating prices for items...');
      const lineItems = items.map((item, idx) => {
        let unitPrice = item.price;
        console.log(`   Item ${idx + 1}: ${item.name}`);
        console.log(`      Base price: ${unitPrice}`);
        
        if (item.options?.sizeMultiplier) {
          const oldPrice = unitPrice;
          unitPrice = item.price * item.options.sizeMultiplier;
          console.log(`      Size multiplier: ${item.options.sizeMultiplier} → ${oldPrice} → ${unitPrice}`);
        }
        if (item.options?.toppingsTotal) {
          const oldPrice = unitPrice;
          unitPrice += item.options.toppingsTotal;
          console.log(`      Toppings total: ${item.options.toppingsTotal} → ${oldPrice} → ${unitPrice}`);
        }
        
        const result = {
          itemId: item.menuItemId || item.id,
          name: item.name,
          quantity: item.quantity,
          unitPriceMinorUnits: Math.round(unitPrice * 100),
          totalPriceMinorUnits: Math.round(unitPrice * item.quantity * 100),
        };
        console.log(`      Final: Rs.${unitPrice} × ${item.quantity} = Rs.${unitPrice * item.quantity}`);
        console.log(`      Minor units: ${result.unitPriceMinorUnits} × ${item.quantity} = ${result.totalPriceMinorUnits}`);
        return result;
      });
      
      const lineItemsTotal = lineItems.reduce((s, li) => s + li.totalPriceMinorUnits, 0);
      console.log('📋 Line items total:');
      console.log(`   Minor units: ${lineItemsTotal}`);
      console.log(`   Rs.: ${lineItemsTotal / 100}`);
      
      // ✅ Build payload matching the schema
      const payload: any = {
        restaurantId: scope.restaurantId,
        currencyCode: 'PKR',
        lineItems: lineItems,
        totalAmountMinorUnits: lineItemsTotal,
        orderType: orderType,
        tableId: tableId,
      };
      
      console.log('📋 Basic payload:');
      console.log(`   restaurantId: ${payload.restaurantId}`);
      console.log(`   currencyCode: ${payload.currencyCode}`);
      console.log(`   totalAmountMinorUnits: ${payload.totalAmountMinorUnits}`);
      console.log(`   orderType: ${payload.orderType}`);
      console.log(`   tableId: ${payload.tableId}`);
      console.log(`   lineItemsCount: ${payload.lineItems.length}`);

      // Add delivery fields if order type is delivery
      if (orderType === 'delivery') {
        console.log('📋 Processing delivery order...');
        if (!deliveryAddress.trim()) {
          console.log('❌ Delivery address missing');
          throw new Error('Delivery address is required');
        }
        if (!contactPhone.trim()) {
          console.log('❌ Contact phone missing');
          throw new Error('Contact phone is required for delivery');
        }
        payload.deliveryAddress = deliveryAddress.trim();
        payload.contactPhone = contactPhone.trim();
        console.log(`   deliveryAddress: ${payload.deliveryAddress}`);
        console.log(`   contactPhone: ${payload.contactPhone}`);
      }

      // Add notes if provided
      if (notes.trim()) {
        payload.notes = notes.trim();
        console.log(`   notes: ${payload.notes}`);
      }

      // Add payment method info
      payload.paymentMethod = paymentMethod;
      console.log(`   paymentMethod: ${payload.paymentMethod}`);
      
      if (paymentMethod === 'Card' && cardNumber) {
        payload.cardLast4 = cardNumber.slice(-4);
        console.log(`   cardLast4: ${payload.cardLast4}`);
      }
      
      if (paymentMethod === 'Digital Wallet' && walletProvider) {
        payload.walletProvider = walletProvider;
        console.log(`   walletProvider: ${payload.walletProvider}`);
      }

      console.log('═══════════════════════════════════════════════');
      console.log('📦 FINAL ORDER PAYLOAD:');
      console.log(JSON.stringify(payload, null, 2));
      console.log('═══════════════════════════════════════════════');
      
      console.log('📡 Sending request to /api/orders...');
      console.log(`   Headers: x-tenant-id: ${scope.restaurantId}`);
      
      const res = await fetch('/api/orders', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': scope.restaurantId,
        }, 
        body: JSON.stringify(payload) 
      });
      
      console.log(`📡 Response status: ${res.status}`);
      console.log(`📡 Response status text: ${res.statusText}`);
      console.log(`📡 Response ok: ${res.ok}`);
      
      const data = await res.json();
      console.log('📦 ORDER RESPONSE:');
      console.log(JSON.stringify(data, null, 2));
      console.log('═══════════════════════════════════════════════');
      
      if (!res.ok) {
        const errorMsg = data?.error || data?.message || `Error ${res.status}`;
        console.log(`❌ Order failed: ${errorMsg}`);
        if (data?.detail) {
          console.log(`   Detail: ${data.detail}`);
        }
        throw new Error(errorMsg);
      }
      
      console.log('✅ Order placed successfully!');
      console.log(`📋 Order ID: ${data.orderId}`);
      console.log(`📋 Status: ${data.status}`);
      if (data.stepFunctionsExecutionArn) {
        console.log(`📋 Execution ARN: ${data.stepFunctionsExecutionArn}`);
      }
      
      if (fullName.trim()) {
        savedProfile.setFullName(fullName.trim());
        console.log('📋 Saved full name to profile');
      }
      if (phone.trim()) {
        savedProfile.setPhone(phone.trim());
        console.log('📋 Saved phone to profile');
      }
      
      setOrderId(data.orderId ?? ''); 
      clearCart(); 
      setPlaced(true);
      console.log('✅ Cart cleared, redirecting to success screen');
      
    } catch (err: any) {
      console.log('❌ ORDER ERROR:');
      console.log(`   Error: ${err}`);
      console.log(`   Message: ${err?.message}`);
      console.log(`   Stack: ${err?.stack}`);
      console.log('═══════════════════════════════════════════════');
      setOrderError(err?.message ?? 'Failed to place order.');
    } finally {
      setPlacing(false);
      console.log('🔄 Place order completed (placing = false)');
    }
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B',
  };

  // ── Success screen ───────────────────────────────────────────────────────────
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

  // ── Checkout form ────────────────────────────────────────────────────────────
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
                {ORDER_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* Table Number - Only for Dine In */}
        {showTableNumber && (
          <>
            <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>
              Table Number
            </h2>
            <div style={{ 
              position: 'relative', 
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
            }}>
              <div style={{
                width: '100%',
                height: 56,
                borderRadius: 14,
                background: BRAND,
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px',
                gap: 12,
              }}>
                <MapPin size={20} color="rgba(255,255,255,0.7)" />
                <span style={{
                  color: '#fff',
                  fontSize: 17,
                  fontWeight: 500,
                }}>
                  Table {tableNumber}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Delivery Fields */}
        {showDeliveryFields && (
          <>
            <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>
              Delivery Details
            </h2>
            <input 
              value={deliveryAddress} 
              onChange={e => setDeliveryAddress(e.target.value)} 
              placeholder="Delivery Address *" 
              className="checkout-input"
              style={{ 
                width: '100%', 
                height: 56, 
                borderRadius: 14, 
                border: 'none', 
                background: BRAND, 
                color: '#fff', 
                fontSize: 16, 
                padding: '0 18px', 
                marginBottom: 12, 
                boxSizing: 'border-box', 
                fontFamily: "'DM Sans',sans-serif" 
              }} 
            />
            <input 
              value={contactPhone} 
              onChange={e => setContactPhone(e.target.value)} 
              placeholder="Contact Phone *" 
              type="tel" 
              className="checkout-input"
              style={{ 
                width: '100%', 
                height: 56, 
                borderRadius: 14, 
                border: 'none', 
                background: BRAND, 
                color: '#fff', 
                fontSize: 16, 
                padding: '0 18px', 
                marginBottom: 28, 
                boxSizing: 'border-box', 
                fontFamily: "'DM Sans',sans-serif" 
              }} 
            />
          </>
        )}

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

        {/* Card Payment UI */}
        {showCardFields && (
          <div style={{
            background: D.card,
            border: `1.5px solid ${D.border}`,
            borderRadius: 16,
            padding: '20px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <CreditCard size={20} color={BRAND} />
              <span style={{ fontSize: 16, fontWeight: 700, color: D.text }}>Card Details</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: D.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={14} /> Secure
              </span>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                value={cardNumber}
                onChange={handleCardNumberChange}
                placeholder="Card Number"
                className="checkout-input"
                maxLength={19}
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 12,
                  border: `1.5px solid ${D.border}`,
                  background: D.bg,
                  color: D.text,
                  fontSize: 16,
                  padding: '0 16px',
                  paddingLeft: 44,
                  boxSizing: 'border-box',
                  fontFamily: "'DM Sans',sans-serif",
                  outline: 'none',
                }}
              />
              <CreditCard size={18} color={D.muted} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  value={cardExpiry}
                  onChange={handleExpiryChange}
                  placeholder="MM/YY"
                  className="checkout-input"
                  maxLength={5}
                  style={{
                    width: '100%',
                    height: 50,
                    borderRadius: 12,
                    border: `1.5px solid ${D.border}`,
                    background: D.bg,
                    color: D.text,
                    fontSize: 16,
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    fontFamily: "'DM Sans',sans-serif",
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  value={cardCvv}
                  onChange={handleCvvChange}
                  placeholder="CVV"
                  className="checkout-input"
                  maxLength={4}
                  type="password"
                  style={{
                    width: '100%',
                    height: 50,
                    borderRadius: 12,
                    border: `1.5px solid ${D.border}`,
                    background: D.bg,
                    color: D.text,
                    fontSize: 16,
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    fontFamily: "'DM Sans',sans-serif",
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ position: 'relative', marginTop: 12 }}>
              <input
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                placeholder="Name on Card"
                className="checkout-input"
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 12,
                  border: `1.5px solid ${D.border}`,
                  background: D.bg,
                  color: D.text,
                  fontSize: 16,
                  padding: '0 16px',
                  boxSizing: 'border-box',
                  fontFamily: "'DM Sans',sans-serif",
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: D.muted, padding: '4px 12px', borderRadius: 4, background: isDark ? '#2d2d2d' : '#f0f0f0' }}>💳 Visa</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: D.muted, padding: '4px 12px', borderRadius: 4, background: isDark ? '#2d2d2d' : '#f0f0f0' }}>💳 Mastercard</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: D.muted, padding: '4px 12px', borderRadius: 4, background: isDark ? '#2d2d2d' : '#f0f0f0' }}>💳 Amex</span>
            </div>
          </div>
        )}

        {/* Digital Wallet UI */}
        {showWalletFields && (
          <div style={{
            background: D.card,
            border: `1.5px solid ${D.border}`,
            borderRadius: 16,
            padding: '20px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Wallet size={20} color={BRAND} />
              <span style={{ fontSize: 16, fontWeight: 700, color: D.text }}>Digital Wallet</span>
            </div>

            <p style={{ fontSize: 13, color: D.muted, marginBottom: 16 }}>
              Select your preferred digital wallet to complete the payment
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['EasyPaisa', 'JazzCash', 'SadaPay', 'NayaPay'].map(wallet => (
                <button
                  key={wallet}
                  onClick={() => setWalletProvider(wallet)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: `2px solid ${walletProvider === wallet ? BRAND : D.border}`,
                    background: walletProvider === wallet ? 'rgba(255,87,35,0.08)' : D.bg,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: isDark ? '#333' : '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {wallet === 'EasyPaisa' && '📱'}
                    {wallet === 'JazzCash' && '📲'}
                    {wallet === 'SadaPay' && '💳'}
                    {wallet === 'NayaPay' && '🏦'}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: D.text, margin: 0 }}>{wallet}</p>
                    <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>Pay with {wallet}</p>
                  </div>
                  {walletProvider === wallet && (
                    <Check size={20} color={BRAND} />
                  )}
                </button>
              ))}
            </div>

            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 10,
              background: isDark ? 'rgba(255,87,35,0.15)' : 'rgba(255,87,35,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <Shield size={16} color={BRAND} />
              <span style={{ fontSize: 12, color: D.muted }}>
                Secured payment via {walletProvider || 'your selected wallet'}
              </span>
            </div>
          </div>
        )}

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