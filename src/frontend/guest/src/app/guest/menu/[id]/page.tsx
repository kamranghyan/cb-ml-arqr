'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Heart, Star, Plus, Minus, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { fetchMenuItem, normaliseItem, fetchAddOns, type ApiMenuItem, type ApiAddOn } from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';
import { useFavoritesStore } from '@/lib/favorites-store';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';
import GuestTopBar from '@/components/guest/GuestTopBar';
import BottomNav from '@/components/guest/BottomNav';

const BRAND = '#ff5723';

// ── Placeholder data — not yet available from the backend ───────────────────
// TODO(backend): ApiMenuItem.customisations has no size pricing today. These
// replace the old free-text SIZES with a priced model — multipliers
// (0.75 / 1.00 / 1.25) are derived from the Figma's example (600 / 800 /
// 1000 on an Rs.800 item), applied to the real item.price so it's correct
// for whatever item a guest is actually viewing.
const SIZES = [
  { label: 'Small', mult: 0.75 },
  { label: 'Medium', mult: 1.00 },
  { label: 'Large', mult: 1.25 },
];
// TOPPINGS placeholder is gone — "Extra Toppings" is now real data from
// fetchAddOns() (the new addons.py backend endpoint), see below.

export default function ItemDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { isDark } = useTheme();

  const [item, setItem] = useState<ApiMenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState(1); // index — Medium default (see note below)
  const [qty, setQty] = useState(1);

  // ── Extra Toppings — real add-ons for this item ──────────────────────────
  const [addOns, setAddOns] = useState<ApiAddOn[]>([]);
  const [toppings, setToppings] = useState<string[]>([]); // selected add-on names

  const [added, setAdded] = useState(false);
  const { addItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const liked = item ? isFavorite(item.id) : false;


  // ── Image carousel — structurally real (scroll-snap + dots), but
  // ApiMenuItem only has one imageUrl field today, so it renders as a single
  // static image with no dots until the backend adds an images[] array.
  const [activeImg, setActiveImg] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const images = [(item as any)?.imageUrl].filter(Boolean) as string[];

  function handleCarouselScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveImg(Math.round(el.scrollLeft / el.clientWidth));
  }

  useEffect(() => {
    if (!id) return;
    // Also accept rid/tid from URL params (direct link from landing page)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRid = urlParams.get('rid'); const urlTid = urlParams.get('tid');
    if (urlRid) sessionStorage.setItem('lm_rid', urlRid);
    if (urlTid) sessionStorage.setItem('lm_tid', urlTid);
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }
    const rid = getGuestScope().restaurantId;

    // Item and add-ons are independent (add-ons don't block the item from
    // showing), fetched in parallel rather than one after the other.
    fetchMenuItem(id, rid)
      .then(raw => {
        setItem(normaliseItem(raw));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetchAddOns(id, rid)
      .then(setAddOns)
      .catch(() => setAddOns([])); // no add-ons for this item is normal, not an error
  }, [id]);

  const toggleTopping = (label: string) =>
    setToppings(p => p.includes(label) ? p.filter(x => x !== label) : [...p, label]);

  const sizePrice = item ? item.price * SIZES[size].mult : 0;
  const toppingsTotal = toppings.reduce((sum, label) => sum + (addOns.find(a => a.name === label)?.price ?? 0), 0);
  const unitPrice = sizePrice + toppingsTotal;
  const finalPrice = Math.round(unitPrice * qty);

  const hasAr = !!(item as any)?.arModelKey || !!(item as any)?.arModelUrl;
  const arUrl = (item as any)?.arModelUrl ?? '';
  // TEMP DEBUG — remove once the AR-banner issue is confirmed fixed.
  // Tells us exactly which of the three cases we're in:
  //   arModelKey/arModelUrl both null  -> backend has no AR model for this item (not a frontend bug)
  //   hasArModel true but hasAr false  -> normaliseItem() and the component disagree, real frontend bug
  //   everything populated but hasAr false -> render/condition bug, look at the JSX
  if (!loading && item) {
    console.log('🔍 AR debug:', {
      itemId: item.id,
      arModelKey: (item as any).arModelKey,
      arModelUrl: (item as any).arModelUrl,
      hasArModel_fromNormaliseItem: (item as any).hasArModel,
      hasAr_computedHere: hasAr,
    });
  }
  const rid = getGuestScope().restaurantId;
  const arHref =
    `/guest/ar?rid=${encodeURIComponent(rid)}` +
    `&iid=${encodeURIComponent(id ?? '')}` +
    `&name=${encodeURIComponent(item?.name ?? '')}` +
    `&emoji=${encodeURIComponent(item?.emoji ?? '🍽️')}` +
    `&imageUrl=${encodeURIComponent((item as any)?.imageUrl ?? '')}` +
    `${arUrl ? '&url=' + encodeURIComponent(arUrl) : ''}`;

  const handleAddToCart = () => {
    if (!item) return;

    const selectedSize = SIZES[size];

    addItem({
      menuItemId: item.id,
      name: item.name,
      emoji: item.emoji ?? '🍽️',
      imageUrl: item.imageUrl || undefined,

      // Base item price
      price: item.price,

      quantity: qty,

      options: {
        size: selectedSize.label,
        sizeMultiplier: selectedSize.mult,
        toppings: toppings.join(', '),
        toppingsTotal: toppingsTotal,
      },
    });

    setAdded(true);

    setTimeout(() => {
      setAdded(false);
      router.push('/guest/cart');
    }, 800);
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B',
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${BRAND}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <GuestTopBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 160px' }}>

        {/* ── Header — bare icons, no button chrome, matches Figma ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND, padding: 4, display: 'flex' }} aria-label="Back">
            <ChevronLeft size={30} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => item && toggleFavorite({
              id: item.id,
              name: item.name,
              price: item.price,
              emoji: item.emoji ?? '🍽️',
              imageUrl: item.imageUrl,
              description: item.description,
            })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND, padding: 4, display: 'flex' }}
            aria-label="Save to favorites"
          >
            <Heart size={26} strokeWidth={2} fill={liked ? BRAND : 'none'} />
          </button>
        </div>

        {/* ── Image carousel ── */}
        <div>
          <div
            ref={scrollRef}
            onScroll={handleCarouselScroll}
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              borderRadius: 20,
            }}
          >
            {images.length > 0 ? (
              images.map((src, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: '100%',
                    flexShrink: 0,
                    aspectRatio: '16 / 9',
                    borderRadius: 20,
                    overflow: 'hidden',
                    scrollSnapAlign: 'center',
                  }}
                >
                  <Image
                    src={src}
                    alt={item?.name ?? 'Menu item'}
                    fill
                    sizes="(max-width: 480px) 100vw, 480px"
                    unoptimized
                    style={{
                      objectFit: 'cover',
                      borderRadius: 20,
                    }}
                  />
                </div>
              ))
            ) : (
              <div
                style={{
                  width: '100%',
                  flexShrink: 0,
                  aspectRatio: '16 / 9',
                  borderRadius: 20,
                  background: D.card2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 72,
                }}
              >
                {item?.emoji ?? '🍽️'}
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 6,
                marginTop: 14,
              }}
            >
              {images.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i === activeImg ? BRAND : '#ffbca7',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Title ── */}
        <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 28, fontWeight: 700, color: D.text, margin: '20px 0 16px' }}>
          {item?.name}
        </h1>

        {/* ── Info card: rating + price + description ── */}
        <div style={{ background: BRAND, borderRadius: 20, padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star size={16} fill="#fff" color="#fff" />
              <span style={{ fontSize: 15, color: '#fff' }}>{(item?.rating ?? 4.5).toFixed(1)} ({item?.reviewCount ?? 0} reviews)</span>
            </div>
            <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>Rs. {item?.price?.toLocaleString() ?? 0}</span>
          </div>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.95)', margin: 0, lineHeight: 1.6 }}>
            {item?.description || 'A carefully crafted dish made with the finest ingredients.'}
          </p>
        </div>

        {/* ── AR entry — only when this item actually has a 3D model ── */}
        {hasAr && (
          <Link href={arHref} style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 24px', padding: '14px 16px', background: BRAND, borderRadius: 16, textDecoration: 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>🫙</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0 }}>View in Augmented Reality</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, margin: '2px 0 0' }}>Place on your table · Mobile & Desktop</p>
            </div>
            <span style={{ color: '#fff', fontSize: 20 }}>›</span>
          </Link>
        )}

        {/* ── Choose Size ── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Choose Size</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            {SIZES.map((s, i) => {
              const selected = size === i;
              return (
                <button key={s.label} onClick={() => setSize(i)}
                  style={{ flex: 1, padding: '16px 8px', borderRadius: 16, border: `2px solid ${BRAND}`, background: selected ? BRAND : D.card, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 600, margin: '0 0 4px', color: selected ? '#fff' : BRAND }}>{s.label}</p>
                  <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, margin: 0, color: selected ? '#fff' : BRAND }}>
                    {Math.round((item?.price || 0) * s.mult).toLocaleString()}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Extra Toppings — real add-ons for this item, hidden entirely
             when there are none rather than showing an empty section ── */}
        {addOns.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Extra Toppings</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {addOns.map(addon => {
                const checked = toppings.includes(addon.name);
                return (
                  <button key={addon.addOnId} onClick={() => toggleTopping(addon.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${BRAND}`, background: D.card, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <Check size={16} color="#363853" strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1, fontSize: 16, color: D.text }}>{addon.name}</span>
                    <span style={{ fontSize: 15, color: D.text }}>RS:{addon.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom bar: quantity stepper + Add to Cart ── */}
      <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '18px 20px 32px', background: 'rgb(28, 28, 28)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))}
            style={{ width: 46, height: 54, background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: BRAND }}>
            <Minus size={18} />
          </button>
          <span style={{ width: 46, height: 54, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#000' }}>{qty}</span>
          <button onClick={() => setQty(q => q + 1)}
            style={{ width: 46, height: 54, background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: BRAND }}>
            <Plus size={18} />
          </button>
        </div>
        <button onClick={handleAddToCart}
          style={{ flex: 1, height: 54, borderRadius: 14, background: '#e74f21', opacity: added ? '0.5' :"1", border: '1.5px solid rgba(0,0,0,0.15)', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}>
          {added ? '✓ Added!' : 'Add to Cart'}
        </button>
      </div>
      {/* Total isn't on the Figma button itself, but it's shown here so the
          guest isn't blindsided at checkout — flagged in chat, remove if
          you'd rather match the mockup with zero additions. */}
      <div style={{ position: 'fixed', bottom: 80, left: '35%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, textAlign: 'center', pointerEvents: 'none' }}>
        <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 14px', borderRadius: 20 }}>
          Total: Rs. {finalPrice.toLocaleString()}
        </span>
      </div>
      <BottomNav />
    </div>
  );
}