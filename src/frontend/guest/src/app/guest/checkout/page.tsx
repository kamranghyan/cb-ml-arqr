'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Check, MapPin, CreditCard, Wallet, Smartphone, Shield, Lock, Clock } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useGuestProfileStore } from '@/lib/guest-profile-store';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';
import Image from 'next/image';
import GuestTopBar from '@/components/guest/GuestTopBar';

const BRAND = '#ff5723';

const ORDER_TYPES = ['dine_in', 'pickup', 'delivery'];
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

  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [fullName, setFullName] = useState(savedProfile.fullName);
  const [phone, setPhone] = useState(savedProfile.phone);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // ✅ Pickup Time
  const [pickupTime, setPickupTime] = useState('');

  // Card Details
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Digital Wallet
  const [walletProvider, setWalletProvider] = useState('');

  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderError, setOrderError] = useState('');

  // ✅ State for preparation time from API
  const [prepTime, setPrepTime] = useState('20-30 mins');

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

    // ✅ Set default pickup time to 20 minutes from now
    const defaultPickup = new Date(Date.now() + 20 * 60000);
    // Format: YYYY-MM-DDTHH:mm (for datetime-local input)
    const formattedTime = defaultPickup.toISOString().slice(0, 16);
    setPickupTime(formattedTime);
    console.log('📋 Default pickup time set to:', formattedTime);

    console.log('═══════════════════════════════════════════════');
  }, []);

  const showTableNumber = orderType === 'dine_in' && tableNumber;
  const showCardFields = paymentMethod === 'Card';
  const showWalletFields = paymentMethod === 'Digital Wallet';
  const showDeliveryFields = orderType === 'delivery';
  const showPickupFields = orderType === 'pickup';

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

  if (!items.length) {
    console.log('❌ Cart is empty, cannot place order');
    setOrderError('Cart is empty');
    return;
  }

  setPlacing(true);
  setOrderError('');

  try {
    const scope = getGuestScope();
    console.log('📋 Guest Scope:', scope);

    // ── 1. Get table ID for dine-in ──
    let tableId = '';
    if (orderType === 'dine_in') {
      const sessionTid = sessionStorage.getItem('lm_tid');
      tableId = sessionTid ?? `table-${tableNumber.padStart(2, '0')}`;
      console.log('📋 Dine-in table ID:', tableId);
    } else {
      console.log('📋 Order type:', orderType, '- No table ID needed');
    }

    // ── 2. Calculate line items ──
    console.log('📋 Calculating prices for items...');
    const lineItems = items.map((item) => {
      // ✅ FIX: Use BASE price (without size multiplier)
      let unitPrice = item.price; // Base price from menu item
      
      // ❌ DO NOT apply size multiplier to unitPrice
      // Size selection is for display/total calculation only
      
      // ✅ Add toppings total (add-ons are extra charges)
      if (item.options?.toppingsTotal) {
        unitPrice += item.options.toppingsTotal;
      }

      console.log(`   Item: ${item.name}`);
      console.log(`      Base price: ${item.price}`);
      console.log(`      Size multiplier: ${item.options?.sizeMultiplier || 1} (for display only)`);
      console.log(`      Toppings total: ${item.options?.toppingsTotal || 0}`);
      console.log(`      Final unit price (base + toppings): ${unitPrice}`);
      console.log(`      Quantity: ${item.quantity}`);
      console.log(`      Total: ${unitPrice * item.quantity}`);

      return {
        itemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unitPriceMinorUnits: Math.round(unitPrice * 100),
        totalPriceMinorUnits: Math.round(unitPrice * item.quantity * 100),
      };
    });

    const lineItemsTotal = lineItems.reduce((s, li) => s + li.totalPriceMinorUnits, 0);
    console.log('📋 Line items total:', lineItemsTotal / 100);

    // ── 3. Build payload ──
    const payload: any = {
      restaurantId: scope.restaurantId,
      currencyCode: 'PKR',
      lineItems: lineItems,
      totalAmountMinorUnits: lineItemsTotal,
      orderType: orderType,
      tableId: tableId,
      customerName: fullName || null,
      contactPhone: phone || null,
      paymentMethod: paymentMethod,
    };

    // ── 4. Add order-type specific fields ──
    if (orderType === 'dine_in') {
      console.log('📋 Processing DINE-IN order');
    } else if (orderType === 'pickup') {
      console.log('📋 Processing PICKUP order');
      if (!fullName.trim()) {
        throw new Error('Full name is required for pickup orders');
      }
      if (!phone.trim()) {
        throw new Error('Phone number is required for pickup orders');
      }
      if (!pickupTime) {
        throw new Error('Pickup time is required');
      }
      payload.customerName = fullName.trim();
      payload.contactPhone = phone.trim();
      const pickupDate = new Date(pickupTime);
      payload.pickupTime = pickupDate.toISOString();
      console.log(`   pickupTime: ${payload.pickupTime}`);
    } else if (orderType === 'delivery') {
      console.log('📋 Processing DELIVERY order');
      if (!deliveryAddress.trim()) {
        throw new Error('Delivery address is required');
      }
      if (!contactPhone.trim()) {
        throw new Error('Contact phone is required for delivery');
      }
      payload.deliveryAddress = deliveryAddress.trim();
      payload.contactPhone = contactPhone.trim();
      payload.deliveryFeeMinorUnits = 0;
    }

    // ── 5. Add notes if provided ──
    if (notes.trim()) {
      payload.notes = notes.trim();
    }

    // ── 6. Add payment method info ──
    if (paymentMethod === 'Card' && cardNumber) {
      payload.cardLast4 = cardNumber.slice(-4);
    }
    if (paymentMethod === 'Digital Wallet' && walletProvider) {
      payload.walletProvider = walletProvider;
    }

    console.log('═══════════════════════════════════════════════');
    console.log('📦 FINAL ORDER PAYLOAD:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('═══════════════════════════════════════════════');

    // ── 7. Call guest orders API ──
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `Error ${res.status}`;
      console.log(`❌ Order failed: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log('✅ Order placed successfully!');
    console.log(`📋 Order ID: ${data.orderId}`);

    // ── 8. Get prep time ──
    let prepTimeValue = '20-30 mins';
    if (data.prepTime) {
      prepTimeValue = data.prepTime;
    } else if (data.estimatedTime) {
      prepTimeValue = data.estimatedTime;
    } else {
      try {
        const menuRes = await fetch(`/api/menu/restaurants/${scope.restaurantId}/items`, {
          headers: { 'x-tenant-id': scope.restaurantId }
        });
        if (menuRes.ok) {
          const menuData = await menuRes.json();
          const prepTimeMap: Record<string, number> = {};
          menuData.items?.forEach((item: any) => {
            prepTimeMap[item.itemId] = item.prepTime || 20;
          });
          let maxPrepTime = 0;
          items.forEach(cartItem => {
            const prepTime = prepTimeMap[cartItem.menuItemId] || 20;
            if (prepTime > maxPrepTime) maxPrepTime = prepTime;
          });
          prepTimeValue = `${maxPrepTime}-${maxPrepTime + 5} mins`;
        }
      } catch (menuErr) {
        console.log('⚠️ Could not fetch prep time, using default');
      }
    }
    setPrepTime(prepTimeValue);

    // ── 9. Save profile and clear cart ──
    if (fullName.trim()) {
      savedProfile.setFullName(fullName.trim());
    }
    if (phone.trim()) {
      savedProfile.setPhone(phone.trim());
    }

    setOrderId(data.orderId ?? '');
    clearCart();
    setPlaced(true);

  } catch (err: any) {
    console.log('❌ ORDER ERROR:', err);
    setOrderError(err?.message ?? 'Failed to place order.');
  } finally {
    setPlacing(false);
  }
};

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)', selected: "rgba(255, 87, 35, 0.12)",
    text: '#F5F0E8', muted: '#9CA3AF', placeholder: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', placeholder: '#888888',
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (placed) return (
    <div style={{
      minHeight: '100dvh',
      background: D.bg,
      fontFamily: "'Poppins', sans-serif",
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <GuestTopBar />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 32px 100px',
        textAlign: 'center'
      }}>
        <div style={{
          width: 130,
          height: 130,
          borderRadius: '50%',
          background: BRAND,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 32
        }}>
          <Check size={62} color="#fff" strokeWidth={3} />
        </div>
        <h1 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 30,
          fontWeight: 700,
          color: BRAND,
          margin: '0 0 32px',
          lineHeight: 1.25
        }}>
          Order Placed Successfully!
        </h1>
        <p style={{
          fontSize: 16,
          color: BRAND,
          margin: '0 0 4px',
          fontFamily: "'Poppins', sans-serif",
        }}>Order ID</p>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          color: D.text,
          margin: '0 0 28px'
        }}>
          #{orderId ? orderId.slice(0, 8).toUpperCase() : '—'}
        </p>
        <p style={{
          fontSize: 16,
          color: BRAND,
          margin: '0 0 4px',
          fontFamily: "'Poppins', sans-serif",
        }}>Estimated Time</p>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          color: D.text,
          margin: '0 0 40px'
        }}>
          {prepTime}
        </p>

        <button
          onClick={() => router.push('/guest/tracking')}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 16,
            background: BRAND,
            color: '#fff',
            border: 'none',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,87,35,0.3)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e64a1a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = BRAND;
          }}
        >
          Track Order
        </button>
        <button
          onClick={() => router.push('/guest/menu')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 16,
            fontWeight: 600,
            color: D.text,
            cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
            transition: 'all 0.2s ease',
            outline: 'none',
            padding: '4px 8px',
            borderRadius: 8,
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = BRAND;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = D.text;
          }}
        >
          Back to Menu
        </button>
      </div>
      <BottomNav />
    </div>
  );

  // ── Checkout form ────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100dvh',
      background: D.bg,
      fontFamily: "'Poppins', sans-serif",
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <GuestTopBar />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 124px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '20px 0 28px'
        }}>
          <button
            onClick={() => router.back()}
            style={{
              position: 'absolute',
              left: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: BRAND,
              padding: 4,
              display: 'flex',
              transition: 'all 0.2s ease',
              outline: 'none',
              borderRadius: 8,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            aria-label="Back"
          >
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: BRAND,
            margin: 0
          }}>Checkout</h1>
        </div>

        {/* Order Type */}
        <h2 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 19,
          fontWeight: 700,
          color: D.text,
          margin: '0 0 14px'
        }}>Order Type</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {ORDER_TYPES.map(t => {
            const selected = orderType === t;
            return (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: 14,
                  border: `2px solid ${BRAND}`,
                  background: selected ? BRAND : D.card,
                  color: selected ? '#fff' : BRAND,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {ORDER_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* Table Number - Only for Dine In */}
        {showTableNumber && (
          <>
            <h2 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 19,
              fontWeight: 700,
              color: D.text,
              margin: '0 0 14px'
            }}>
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
                background: D.card,
                border: `2px solid ${D.border}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px',
                gap: 12,
              }}>
                <MapPin size={20} color={D.muted} />
                <span style={{
                  color: D.text,
                  fontSize: 17,
                  fontWeight: 500,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  Table {tableNumber}
                </span>
              </div>
            </div>
          </>
        )}

        {/* ✅ Pickup Fields */}
        {showPickupFields && (
          <>
            <h2 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 19,
              fontWeight: 700,
              color: D.text,
              margin: '0 0 14px'
            }}>
              Pickup Details
            </h2>
            <div style={{
              position: 'relative',
              marginBottom: 12,
            }}>
              <Clock size={20} style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: D.muted,
                pointerEvents: 'none',
                zIndex: 1,
              }} />
              <input
                value={pickupTime}
                onChange={e => setPickupTime(e.target.value)}
                type="datetime-local"
                className="checkout-input"
                style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 14,
                  border: `1.5px solid ${D.border}`,
                  background: D.card,
                  color: D.text,
                  fontSize: 16,
                  padding: '0 18px 0 44px',
                  marginBottom: 0,
                  boxSizing: 'border-box',
                  fontFamily: "'Poppins', sans-serif",
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={e => {
                  e.target.style.borderColor = BRAND;
                  e.target.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                }}
                onBlur={e => {
                  e.target.style.borderColor = D.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <p style={{
              fontSize: 12,
              color: D.muted,
              margin: '0 0 28px',
              fontFamily: "'Poppins', sans-serif",
            }}>
              Please select your preferred pickup time (minimum 20 minutes from now)
            </p>
          </>
        )}

        {/* Delivery Fields */}
        {showDeliveryFields && (
          <>
            <h2 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 19,
              fontWeight: 700,
              color: D.text,
              margin: '0 0 14px'
            }}>
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
                border: `1.5px solid ${D.border}`,
                background: D.card,
                color: D.text,
                fontSize: 16,
                padding: '0 18px',
                marginBottom: 12,
                boxSizing: 'border-box',
                fontFamily: "'Poppins', sans-serif",
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = BRAND;
                e.target.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
              }}
              onBlur={e => {
                e.target.style.borderColor = D.border;
                e.target.style.boxShadow = 'none';
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
                border: `1.5px solid ${D.border}`,
                background: D.card,
                color: D.text,
                fontSize: 16,
                padding: '0 18px',
                marginBottom: 28,
                boxSizing: 'border-box',
                fontFamily: "'Poppins', sans-serif",
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = BRAND;
                e.target.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
              }}
              onBlur={e => {
                e.target.style.borderColor = D.border;
                e.target.style.boxShadow = 'none';
              }}
            />
          </>
        )}

        {/* Customer Details */}
        <h2 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 19,
          fontWeight: 700,
          color: D.text,
          margin: '0 0 14px'
        }}>
          Customer Details
        </h2>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Full Name"
          className="checkout-input"
          style={{
            width: '100%',
            height: 56,
            borderRadius: 14,
            border: `1.5px solid ${D.border}`,
            background: D.card,
            color: D.text,
            fontSize: 16,
            padding: '0 18px',
            marginBottom: 12,
            boxSizing: 'border-box',
            fontFamily: "'Poppins', sans-serif",
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onFocus={e => {
            e.target.style.borderColor = BRAND;
            e.target.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
          }}
          onBlur={e => {
            e.target.style.borderColor = D.border;
            e.target.style.boxShadow = 'none';
          }}
        />
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="Phone Number"
          type="tel"
          className="checkout-input"
          style={{
            width: '100%',
            height: 56,
            borderRadius: 14,
            border: `1.5px solid ${D.border}`,
            background: D.card,
            color: D.text,
            fontSize: 16,
            padding: '0 18px',
            marginBottom: 28,
            boxSizing: 'border-box',
            fontFamily: "'Poppins', sans-serif",
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onFocus={e => {
            e.target.style.borderColor = BRAND;
            e.target.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
          }}
          onBlur={e => {
            e.target.style.borderColor = D.border;
            e.target.style.boxShadow = 'none';
          }}
        />

        {/* Special Note */}
        <h2 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 19,
          fontWeight: 700,
          color: D.text,
          margin: '0 0 14px'
        }}>
          Special Note (Optional)
        </h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Type here…."
          rows={4}
          className="checkout-input"
          style={{
            width: '100%',
            borderRadius: 14,
            border: `1.5px solid ${D.border}`,
            background: D.card,
            color: D.text,
            fontSize: 16,
            padding: '16px 18px',
            marginBottom: 28,
            resize: 'none',
            boxSizing: 'border-box',
            fontFamily: "'Poppins', sans-serif",
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onFocus={e => {
            e.target.style.borderColor = BRAND;
            e.target.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
          }}
          onBlur={e => {
            e.target.style.borderColor = D.border;
            e.target.style.boxShadow = 'none';
          }}
        />

        {/* Payment Method */}
        <h2 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 19,
          fontWeight: 700,
          color: D.text,
          margin: '0 0 14px'
        }}>Payment Method</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {PAYMENT_METHODS.map(m => {
            const selected = paymentMethod === m;
            const isDisabled = m === 'Card' || m === 'Digital Wallet';
            return (
              <button
                key={m}
                onClick={() => {
                  if (isDisabled) return;
                  setPaymentMethod(m);
                }}
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: 14,
                  border: `2px solid ${BRAND}`,
                  background: selected ? BRAND : D.card,
                  color: selected ? '#fff' : BRAND,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.4 : 1,
                  position: 'relative',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {m}
                {isDisabled && (
                  <span style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    fontSize: 8,
                    background: D.bg,
                    color: D.muted,
                    padding: '1px 6px',
                    borderRadius: 10,
                    border: `1px solid ${D.border}`,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {orderError && (
          <div style={{
            padding: '12px 14px',
            background: '#FFF0F0',
            border: '1px solid #FFD0D0',
            borderRadius: 12,
            margin: '12px 0'
          }}>
            <p style={{
              fontSize: 12,
              color: BRAND,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}>{orderError}</p>
          </div>
        )}

        <button
          onClick={placeOrder}
          disabled={placing}
          style={{
            width: '100%',
            height: 58,
            borderRadius: 16,
            background: placing ? `rgba(255,87,35,0.6)` : BRAND,
            color: '#fff',
            border: 'none',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            cursor: placing ? 'not-allowed' : 'pointer',
            marginTop: 16,
            opacity: placing ? 0.7 : 1,
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
          onFocus={(e) => {
            if (!placing) {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,87,35,0.3)';
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseEnter={(e) => {
            if (!placing) {
              e.currentTarget.style.background = '#e64a1a';
            }
          }}
          onMouseLeave={(e) => {
            if (!placing) {
              e.currentTarget.style.background = BRAND;
            }
          }}
        >
          {placing
            ? <div style={{
              width: 20,
              height: 20,
              margin: '0 auto',
              border: '2.5px solid #fff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            : 'Place Order'}
        </button>
      </div>
      <BottomNav />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .checkout-input::placeholder {
          color: ${D.placeholder};
          opacity: 0.7;
        }
        .checkout-input:focus {
          outline: none;
        }
        input[type="datetime-local"] {
          color-scheme: ${isDark ? 'dark' : 'light'};
        }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: ${isDark ? 'invert(1)' : 'none'};
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}