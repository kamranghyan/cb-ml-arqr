
'use client';

import { getGuestScope } from '@/lib/guest-scope';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Trash2, Tag, MapPin, Minus, Plus } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import BottomNav from '@/components/guest/BottomNav';
import Image from 'next/image';
import GuestTopBar from '@/components/guest/GuestTopBar';

const BRAND = '#ff5723';

export default function CartPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { items, updateQuantity, removeItem, clearCart } = useCartStore();

  const [tableId, setTableId] = useState('');
  const [tableNum, setTableNum] = useState('');
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderError, setOrderError] = useState('');
  const [notes, setNotes] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [prepTime, setPrepTime] = useState('20-30 mins');

  // ✅ Restaurant Logo State
  const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);

  useEffect(() => {
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }
    const tid = sessionStorage.getItem('lm_tid') ?? '';
    const tnum = sessionStorage.getItem('lm_table') ?? '';
    setTableId(tid || `table-${tnum || '01'}`);
    setTableNum(tnum);

    // ✅ Fetch Restaurant Logo for Cart Page
    const fetchRestaurantDetails = async () => {
      try {
        const rid = getGuestScope().restaurantId;
        if (!rid) return;
        const res = await fetch(`/api/menu/restaurants/${rid}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setRestaurantLogo(data?.logoUrl || data?.imageUrl || null);
        }
      } catch (error) { }
    };
    fetchRestaurantDetails();
  }, []);

  const getItemUnitPrice = (item: any) => {
    let unitPrice = item.price;
    if (item.options?.sizeMultiplier) unitPrice = item.price * item.options.sizeMultiplier;
    if (item.options?.toppingsTotal) unitPrice += item.options.toppingsTotal;
    return Math.round(unitPrice);
  };

  const getItemTotal = (item: any) => getItemUnitPrice(item) * item.quantity;
  const calculateSubtotal = () => items.reduce((sum, item) => sum + getItemTotal(item), 0);

  const discount = promoApplied ? Math.round(calculateSubtotal() * 0.1) : 0;
  const taxAmt = Math.round(calculateSubtotal() * 0.06);
  const grandTotal = calculateSubtotal() - discount + taxAmt;

  const applyPromo = () => { if (promo.trim().toUpperCase() === 'HAPPY20') setPromoApplied(true); };

  const placeOrder = async () => {
    const scope = getGuestScope();
    if (!items.length) return;
    setPlacing(true); setOrderError('');
    try {
      const tid = sessionStorage.getItem('lm_tid') ?? tableId ?? 'table-01';
      const lineItems = items.map(item => {
        let unitPrice = item.price;
        if (item.options?.sizeMultiplier) unitPrice = item.price * item.options.sizeMultiplier;
        if (item.options?.toppingsTotal) unitPrice += item.options.toppingsTotal;
        unitPrice = Math.round(unitPrice);
        return {
          itemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          unitPriceMinorUnits: Math.round(unitPrice * 100),
          totalPriceMinorUnits: Math.round(unitPrice * item.quantity * 100),
        };
      });
      const lineItemsTotal = lineItems.reduce((s, li) => s + li.totalPriceMinorUnits, 0);
      const payload = {
        restaurantId: scope.restaurantId,
        tableId: tid,
        currencyCode: 'PKR',
        totalAmountMinorUnits: lineItemsTotal,
        lineItems,
        ...(notes.trim() && { notes: notes.trim() }),
      };
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? `Error ${res.status}`);
      if (data.prepTime) setPrepTime(data.prepTime);
      else if (data.estimatedTime) setPrepTime(data.estimatedTime);
      setOrderId(data.orderId ?? '');
      clearCart();
      setPlaced(true);
    } catch (err: any) {
      setOrderError(err?.message ?? 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', sub: '#9CA3AF',
  };

  if (placed) return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'Poppins', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Image src="/images/success/tick.png" alt="Success tick" width={130} height={130} />
      <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 28, fontWeight: 700, color: "#FF5723", margin: '70px 0 8px', textAlign: 'center' }}>Order Placed <br /> Successfully!</h2>
      <p style={{ fontSize: 14, color: "#FF5723", textAlign: 'center', margin: '40px 0 5px', fontFamily: "'Poppins', sans-serif" }}>Order ID</p>
      {orderId && <span style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: 'monospace', marginBottom: "40px" }}>#{orderId.slice(0, 8).toUpperCase()}</span>}
      <p style={{ fontSize: 14, color: "#FF5723", textAlign: 'center', margin: '10px 0 5px', fontFamily: "'Poppins', sans-serif" }}>Estimated Time</p>
      <span style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "'Poppins', sans-serif", marginBottom: "50px" }}>{prepTime}</span>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => router.push('/guest/tracking')} style={{ width: '100%', height: 52, borderRadius: 26, background: BRAND, color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease', outline: 'none' }} onMouseEnter={(e) => e.currentTarget.style.background = '#e64a1a'} onMouseLeave={(e) => e.currentTarget.style.background = BRAND}>📡 Track My Order</button>
        <button onClick={() => router.push('/guest/menu')} style={{ width: '100%', height: 48, borderRadius: 24, background: D.card, border: `1.5px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease', outline: 'none' }} onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'; e.currentTarget.style.borderColor = BRAND; }} onMouseLeave={(e) => { e.currentTarget.style.background = D.card; e.currentTarget.style.borderColor = D.border; }}>← Back to Menu</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'Poppins', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <GuestTopBar />

      {/* ── Header: Arrow + Logo + Title + Edit ── */}
      <div style={{ padding: '35px 20px 25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: "10px" }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND, padding: 4, display: 'flex', transition: 'all 0.2s ease', outline: 'none', borderRadius: 8 }}>
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND, margin: 0 }}>Your Cart</h1>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 700, color: BRAND }}>({items.length})</span>

          </div>
          {items.length > 0 && (
            <button onClick={() => setEditMode(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 600, color: BRAND, transition: 'all 0.2s ease', outline: 'none', padding: '4px 8px', borderRadius: 8 }}>{editMode ? 'Done' : 'Edit'}</button>
          )}
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', paddingBottom: items.length > 0 ? '160px' : '100px' }}>

        {/* ── Empty State ── */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{ fontSize: 48, opacity: 0.2 }}>🛒</span>
            <p style={{
              color: D.muted,
              fontSize: 14,
              marginTop: 12,
              fontFamily: "'Poppins', sans-serif",
            }}>Your cart is empty</p>
            <button
              onClick={() => router.push('/guest/menu')}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                borderRadius: 24,
                background: BRAND,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
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
              Browse Menu
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginBottom: 24 }}>
            {items.map(item => {
              const unitPrice = getItemUnitPrice(item);
              const itemTotal = getItemTotal(item);
              const optionsDisplay = [];
              if (item.options?.size) optionsDisplay.push(item.options.size);
              if (item.options?.toppings && item.options.toppings !== '') optionsDisplay.push(item.options.toppings);
              const variantLine = optionsDisplay.join(' · ');

              return (
                <div key={item.id} style={{ display: 'flex', gap: 16 }}>
                  <div
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 16,
                      background: D.card2,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 40,
                      overflow: 'hidden',
                    }}
                  >
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={100}
                        height={100}
                        unoptimized
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      item.emoji
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 19,
                        fontWeight: 600,
                        color: BRAND,
                        margin: '0 0 4px'
                      }}>{item.name}</p>
                      {editMode && (
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: D.muted,
                            flexShrink: 0,
                            padding: 2,
                            transition: 'all 0.2s ease',
                            outline: 'none',
                            borderRadius: 6,
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
                            e.currentTarget.style.color = D.muted;
                          }}
                          aria-label="Remove item"
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                    {variantLine && <p style={{
                      fontSize: 15,
                      color: D.text,
                      margin: '0 0 8px',
                      fontFamily: "'Poppins', sans-serif",
                    }}>{variantLine}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{
                        fontSize: 16,
                        color: D.text,
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        Rs. {unitPrice.toLocaleString()} ×{item.quantity}
                      </span>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                        color: BRAND
                      }}>Rs. {itemTotal.toLocaleString()}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      border: `1.5px solid ${D.border}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      width: 'fit-content'
                    }}>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        style={{
                          width: 38,
                          height: 40,
                          background: D.card,
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: BRAND,
                          transition: 'all 0.2s ease',
                          outline: 'none',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = D.card;
                        }}
                      >
                        <Minus size={15} />
                      </button>
                      <span style={{
                        width: 38,
                        height: 40,
                        background: D.card,
                        border: `1.5px solid ${D.border}`,
                        borderBottom: 'none',
                        borderTop: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        color: D.text,
                        fontFamily: "'Poppins', sans-serif",
                      }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        style={{
                          width: 38,
                          height: 40,
                          background: D.card,
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: BRAND,
                          transition: 'all 0.2s ease',
                          outline: 'none',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = D.card;
                        }}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* ── Table ── */}
            <div style={{
              background: D.card,
              border: `1.5px solid ${D.border}`,
              borderRadius: 16,
              padding: '12px 16px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <MapPin size={16} color={BRAND} />
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: 12,
                  color: D.muted,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>Dining at</p>
                <p style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: D.text,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>{tableNum ? `Table ${tableNum}` : tableId || 'Walk-in Guest'}</p>
              </div>
              <span style={{ color: '#22c55e', fontWeight: 800 }}>✓</span>
            </div>

            {/* ── Promo ── */}
            <div style={{
              background: D.card,
              border: `1.5px solid ${D.border}`,
              borderRadius: 16,
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <Tag size={16} color={D.muted} />
              <input
                className='searchInput'
                value={promo}
                onChange={e => setPromo(e.target.value)}
                placeholder="Add promo code"
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  fontSize: 14,
                  color: D.text,
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif",
                }}
              />
              {promo && (
                <button
                  onClick={applyPromo}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: BRAND,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Apply
                </button>
              )}
              {promoApplied && <span style={{
                fontSize: 11,
                color: '#16a34a',
                fontWeight: 700,
                fontFamily: "'Poppins', sans-serif",
              }}>✓ 10% off</span>}
              <ChevronRight size={16} color={D.sub} />
            </div>

            {/* ── Notes ── */}
            <textarea
              className='searchInput'
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions for kitchen…"
              rows={2}
              style={{
                width: '100%',
                borderRadius: 14,
                padding: '12px 14px',
                fontSize: 13,
                marginBottom: 20,
                resize: 'none',
                background: D.card,
                border: `1.5px solid ${D.border}`,
                color: D.text,
                outline: 'none',
                fontFamily: "'Poppins', sans-serif",
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = D.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />

            {/* ── Divider ── */}
            <div style={{ height: 1, background: BRAND, opacity: 0.35, marginBottom: 22 }} />

            {/* ── Bill ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: D.text
                }}>Subtotal</span>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: D.text
                }}>RS.{calculateSubtotal().toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: D.text
                }}>Tax (6%)</span>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: D.text
                }}>RS.{taxAmt.toLocaleString()}</span>
              </div>
              {promoApplied && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#16a34a'
                  }}>Promo Discount</span>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#16a34a'
                  }}>-RS.{discount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 19,
                  fontWeight: 700,
                  color: D.text
                }}>Total</span>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 19,
                  fontWeight: 700,
                  color: D.text
                }}>RS.{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* ── Error ── */}
            {orderError && (
              <div style={{
                padding: '12px 14px',
                background: '#FFF0F0',
                border: '1px solid #FFD0D0',
                borderRadius: 12,
                marginBottom: 16
              }}>
                <p style={{
                  fontSize: 12,
                  color: BRAND,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>{orderError}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Proceed to Checkout ── */}
      {items.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          padding: '0 20px',
          boxSizing: 'border-box',
          zIndex: 10
        }}>
          <button
            onClick={() => router.push('/guest/checkout')}
            disabled={placing}
            style={{
              width: '100%',
              height: 58,
              borderRadius: 16,
              background: placing ? D.sub : BRAND,
              color: '#fff',
              border: 'none',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              cursor: placing ? 'not-allowed' : 'pointer',
              boxShadow: placing ? 'none' : '0 8px 24px rgba(255,87,35,0.35)',
              opacity: placing ? 0.6 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (!placing) {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,87,35,0.3), 0 8px 24px rgba(255,87,35,0.35)';
              }
            }}
            onBlur={(e) => {
              if (!placing) {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,87,35,0.35)';
              }
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
              ? <div style={{ width: 20, height: 20, margin: '0 auto', border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : 'Proceed to Checkout'}
          </button>
        </div>
      )}

      {/* ── BottomNav ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        zIndex: 20
      }}>
        <BottomNav />
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}