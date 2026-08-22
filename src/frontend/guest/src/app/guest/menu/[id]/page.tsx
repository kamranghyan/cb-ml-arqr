'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Heart, Star, Plus, Minus, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  fetchMenuItem,
  normaliseItem,
  fetchAddOns,
  type ApiMenuItem,
} from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';
import { useFavoritesStore } from '@/lib/favorites-store';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';
import GuestTopBar from '@/components/guest/GuestTopBar';
import BottomNav from '@/components/guest/BottomNav';

const BRAND = '#ff5723';
const AUTO_SLIDE_INTERVAL = 3000; // 3 seconds

// ── Types ──
interface AddOn {
  addOnId: string;
  menuItemId: string;
  name: string;
  priceMinorUnits: number;
  isActive: boolean;
  sortOrder?: number;
  description?: string;
}

interface SizeOption {
  label: string;
  price: number;
  mult: number;
}

// ── Fallback sizes ──
const FALLBACK_SIZES: SizeOption[] = [
  { label: 'Small', price: 0, mult: 0.75 },
  { label: 'Medium', price: 0, mult: 1.00 },
  { label: 'Large', price: 0, mult: 1.25 },
];

export default function ItemDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { isDark } = useTheme();

  const [item, setItem] = useState<ApiMenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sizeIndex, setSizeIndex] = useState(1);
  const [qty, setQty] = useState(1);

  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [toppings, setToppings] = useState<string[]>([]);

  const [added, setAdded] = useState(false);
  const { addItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const liked = item ? isFavorite(item.id) : false;

  // ✅ Restaurant Logo State
  const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);

  // ── Image carousel ──
  const [activeImg, setActiveImg] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Fetch Restaurant Details for Logo
  useEffect(() => {
    const fetchRestaurantDetails = async () => {
      try {
        const rid = getGuestScope().restaurantId;
        if (!rid) return;

        // ✅ API call to fetch restaurant data (from your provided URL)
        const res = await fetch(`/api/menu/restaurants/${rid}`, {
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          // Assuming the API returns a 'logoUrl' or 'imageUrl' field
          // You might need to check the exact property name in your API response
          const logo = data?.logoUrl || data?.imageUrl || null;
          setRestaurantLogo(logo);
        } else {
          console.warn('Failed to fetch restaurant details');
          setRestaurantLogo(null);
        }
      } catch (error) {
        console.error('Error fetching restaurant:', error);
        setRestaurantLogo(null);
      }
    };

    fetchRestaurantDetails();
  }, []);

  // ✅ Get images from slides or main image
  const getImages = (): string[] => {
    if (!item) return [];
    const slides = (item as any)?.slides || [];
    const mainImage = (item as any)?.imageUrl;

    if (slides.length > 0) {
      const slideImages = slides
        .map((s: any) => s.imageUrl || s.url || s)
        .filter(Boolean);
      if (slideImages.length > 0) return slideImages;
    }
    return mainImage ? [mainImage] : [];
  };

  const images = getImages();
  const hasMultipleImages = images.length > 1;

  // ── Auto-slide logic ──
  const startAutoSlide = () => {
    if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    if (hasMultipleImages && images.length > 0) {
      autoSlideTimerRef.current = setInterval(() => {
        const nextIndex = (activeImg + 1) % images.length;
        goToSlide(nextIndex);
      }, AUTO_SLIDE_INTERVAL);
    }
  };

  const stopAutoSlide = () => {
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }
  };

  // ── Handle manual scroll ──
  const handleCarouselScroll = (): void => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const newIndex = Math.round(el.scrollLeft / el.clientWidth);
    if (newIndex !== activeImg && newIndex < images.length) {
      setActiveImg(newIndex);
      if (hasMultipleImages) { stopAutoSlide(); startAutoSlide(); }
    }
  };

  // ── Navigate to specific slide ──
  const goToSlide = (index: number): void => {
    const el = scrollRef.current;
    if (!el || index < 0 || index >= images.length) return;

    setActiveImg(index);
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });

    if (hasMultipleImages) { stopAutoSlide(); startAutoSlide(); }
  };

  // ── Load data ──
  useEffect(() => {
    if (!id) return;
    const urlParams = new URLSearchParams(window.location.search);
    const urlRid = urlParams.get('rid');
    const urlTid = urlParams.get('tid');
    if (urlRid) sessionStorage.setItem('lm_rid', urlRid);
    if (urlTid) sessionStorage.setItem('lm_tid', urlTid);

    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }

    const rid = getGuestScope().restaurantId;

    Promise.all([fetchMenuItem(id, rid), fetchAddOns(id, rid)])
      .then(([rawItem, rawAddons]) => {
        const normalisedItem = normaliseItem(rawItem);
        setItem(normalisedItem);
        setAddOns(
          (rawAddons || []).map((addon) => ({
            ...addon,
            priceMinorUnits:
              (addon as { priceMinorUnits?: number; price?: number })
                .priceMinorUnits ?? Math.round((addon.price ?? 0) * 100),
          }))
        );
        setLoading(false);
      })
      .catch((err) => { console.error('Failed to load item details:', err); setLoading(false); });
  }, [id]);

  // ── Start/stop auto-slide ──
  useEffect(() => {
    if (hasMultipleImages && images.length > 0) startAutoSlide();
    return () => stopAutoSlide();
  }, [images.length, hasMultipleImages]);

  useEffect(() => { return () => stopAutoSlide(); }, []);

  const toggleTopping = (label: string): void => {
    setToppings((prev) => prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]);
  };

  type MenuItemSize = { name?: string; price?: number; priceMinorUnits?: number; };

  // ── Sizes ──
  const getSizes = (): SizeOption[] => {
    const itemWithSizes = item as (ApiMenuItem & { sizes?: MenuItemSize[] }) | null;
    const basePrice = item?.price || 0;

    if (itemWithSizes?.sizes && itemWithSizes.sizes.length > 0) {
      return itemWithSizes.sizes.map((s: MenuItemSize): SizeOption => {
        let price = 0;
        if (typeof s.price === 'number' && s.price > 0) price = s.price;
        else if (typeof s.priceMinorUnits === 'number' && s.priceMinorUnits > 0) price = s.priceMinorUnits / 100;
        else price = basePrice;

        return { label: s.name || 'Medium', price, mult: price > 0 && basePrice > 0 ? price / basePrice : 1 };
      });
    }
    return FALLBACK_SIZES.map((s) => ({ ...s, price: Math.round(basePrice * s.mult), mult: s.mult }));
  };

  const sizeOptions: SizeOption[] = getSizes();
  const safeSizeIndex = Math.min(sizeIndex, sizeOptions.length - 1);
  const selectedSize = sizeOptions[safeSizeIndex] || sizeOptions[0] || { label: 'Medium', price: 0, mult: 1 };
  const sizePrice = selectedSize?.price ?? item?.price ?? 0;

  const toppingsTotal = toppings.reduce((sum, label) => {
    const addon = addOns.find((a) => a.name === label);
    return sum + (addon ? addon.priceMinorUnits / 100 : 0);
  }, 0);

  const unitPrice = sizePrice + toppingsTotal;
  const finalPrice = Math.round(unitPrice * qty);

  // ── AR ──
  const hasAr = !!(item as any)?.arModelKey || !!(item as any)?.arModelUrl;
  const arUrl = (item as any)?.arModelUrl ?? '';
  const rid = getGuestScope().restaurantId;
  const arHref = `/guest/ar?rid=${encodeURIComponent(rid)}&iid=${encodeURIComponent(id ?? '')}&name=${encodeURIComponent(item?.name ?? '')}&emoji=${encodeURIComponent(item?.emoji ?? '🍽️')}&imageUrl=${encodeURIComponent((item as any)?.imageUrl ?? '')}${arUrl ? '&url=' + encodeURIComponent(arUrl) : ''}`;

  // ── Add to cart ──
const handleAddToCart = (): void => {
  if (!item) return;

  const selectedSizeLabel =
    sizeOptions[safeSizeIndex]?.label || 'Medium';

  // Get complete selected addon objects
  const selectedAddOns = addOns.filter((addon) =>
    toppings.includes(addon.name)
  );

  const selectedAddOnIds = selectedAddOns.map(
    (addon) => addon.addOnId
  );

  addItem({
    menuItemId: item.id,
    name: item.name,
    emoji: item.emoji ?? '🍽️',
    imageUrl: (item as any)?.imageUrl || undefined,
    price: item.price,
    quantity: qty,

    options: {
      size: selectedSizeLabel,

      sizeMultiplier:
        sizeOptions[safeSizeIndex]?.mult || 1,

      toppings: selectedAddOns
        .map((addon) => addon.name)
        .join(', '),

      toppingsTotal,

      // ✅ IMPORTANT
      addOnIds: selectedAddOnIds,

      // ✅ IMPORTANT
      addOns: selectedAddOns.map((addon) => ({
        addOnId: addon.addOnId,
        name: addon.name,
        priceMinorUnits: addon.priceMinorUnits,
        quantity: 1,
      })),
    },
  });

  setAdded(true);

  setTimeout(() => {
    setAdded(false);
    router.push('/guest/cart');
  }, 800);
};

  // ── Theme colors ──
  const D = isDark
    ? { bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)', text: '#F5F0E8', muted: '#9CA3AF', subtle: '#6B7280' }
    : { bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6', text: '#000000', muted: '#6B6B6B', subtle: '#9CA3AF' };

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${BRAND}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', fontFamily: "'Poppins', sans-serif" }}>
        <span style={{ fontSize: 48, opacity: 0.2 }}>🍽️</span>
        <p style={{ color: D.muted, fontSize: 14, marginTop: 12, fontFamily: "'Poppins', sans-serif" }}>Item not found</p>
        <button onClick={() => router.back()} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 24, background: BRAND, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease', outline: 'none' }} onMouseEnter={(e) => e.currentTarget.style.background = '#e64a1a'} onMouseLeave={(e) => e.currentTarget.style.background = BRAND}>Go Back</button>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'Poppins', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', transition: 'background 0.25s' }}>
      <GuestTopBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 160px' }}>

        {/* ── Header with Back Arrow, Restaurant Logo, Title & Favorite ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px', gap: 10 }}>

          {/* Left Side: Back Arrow + Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Back Arrow Button */}
            <button
              onClick={() => router.back()}
              style={{
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

          </div>
          {/* Title */}
          <h1 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: D.text,
            margin: 0,
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {item?.name}
          </h1>

          {/* Favorite Heart Icon */}
          <button
            onClick={() =>
              item &&
              toggleFavorite({
                id: item.id,
                name: item.name,
                price: item.price,
                emoji: item.emoji ?? '🍽️',
                imageUrl: (item as any)?.imageUrl,
                description: item.description,
              })
            }
            style={{
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
            aria-label="Save to favorites"
          >
            <Heart size={26} strokeWidth={2} fill={liked ? BRAND : 'none'} />
          </button>
        </div>
        {/* ── Image carousel with auto-slide (NO ARROWS) ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            ref={scrollRef}
            onScroll={handleCarouselScroll}
            onMouseEnter={stopAutoSlide}
            onMouseLeave={startAutoSlide}
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              borderRadius: 20,
              position: 'relative',
            }}
          >
            {images.length > 0 ? (
              images.map((src: string, i: number) => (
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
                  <Image src={src} alt={`${item?.name ?? 'Menu item'} - Image ${i + 1}`} fill sizes="(max-width: 480px) 100vw, 480px" unoptimized style={{ objectFit: 'cover', borderRadius: 20 }} />
                </div>
              ))
            ) : (
              <div style={{ width: '100%', flexShrink: 0, aspectRatio: '16 / 9', borderRadius: 20, background: D.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>{item?.emoji ?? '🍽️'}</div>
            )}
          </div>

          {/* ── DOTS (MOVED OUTSIDE IMAGE CONTAINER - NEECHE) ── */}
          {hasMultipleImages && images.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 4,
                marginTop: 16,
                paddingBottom: 4,
              }}
            >
              {images.map((_, i: number) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.3s ease',
                    background: i === activeImg ? '#FF5723' : 'rgba(255, 87, 35, 0.3)'
                  }}
                  onMouseEnter={(e) => { if (i !== activeImg) e.currentTarget.style.transform = 'scale(1.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Info card ── */}
        <div style={{ background: BRAND, borderRadius: 20, padding: '18px 20px', marginBottom: 24, marginTop: "20px" }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star size={16} fill="#fff" color="#fff" />
              <span style={{ fontSize: 15, color: '#fff', fontFamily: "'Poppins', sans-serif" }}>{(item?.rating ?? 4.5).toFixed(1)} ({item?.reviewCount ?? 0} reviews)</span>
            </div>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>Rs. {item?.price?.toLocaleString() ?? 0}</span>
          </div>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.95)', margin: 0, lineHeight: 1.6, fontFamily: "'Poppins', sans-serif" }}>{item?.description || 'A carefully crafted dish made with the finest ingredients.'}</p>
        </div>

        {/* ── AR entry ── */}
        {hasAr && (
          <Link href={arHref} style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 24px', padding: '14px 16px', background: BRAND, borderRadius: 16, textDecoration: 'none', transition: 'all 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>🫙</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0, fontFamily: "'Poppins', sans-serif" }}>View in Augmented Reality</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, margin: '2px 0 0', fontFamily: "'Poppins', sans-serif" }}>Place on your table · Mobile & Desktop</p>
            </div>
            <span style={{ color: '#fff', fontSize: 20 }}>›</span>
          </Link>
        )}

        {/* ── Choose Size ── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Choose Size</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            {sizeOptions.map((s: SizeOption, i: number) => {
              const selected = sizeIndex === i;
              return (
                <button key={`${s.label}-${i}`} onClick={() => setSizeIndex(i)} style={{ flex: 1, padding: '16px 8px', borderRadius: 16, border: `2px solid ${BRAND}`, background: selected ? BRAND : D.card, cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Poppins', sans-serif", outline: 'none' }}>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 600, margin: '0 0 4px', color: selected ? '#fff' : BRAND }}>{s.label}</p>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, margin: 0, color: selected ? '#fff' : BRAND }}>{s.price?.toLocaleString() || '0'}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Extra Toppings ── */}
        {addOns.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 14px' }}>Extra Toppings</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {addOns.map((addon: AddOn) => {
                const checked = toppings.includes(addon.name);
                const price = addon.priceMinorUnits / 100;
                return (
                  <button key={addon.addOnId} onClick={() => toggleTopping(addon.name)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: "'Poppins', sans-serif", outline: 'none', borderRadius: 8, transition: 'all 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${BRAND}`, background: D.card, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <Check size={16} color={isDark ? '#fff' : '#363853'} strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1, fontSize: 16, color: D.text, fontFamily: "'Poppins', sans-serif" }}>{addon.name}</span>
                    <span style={{ fontSize: 15, color: D.text, fontFamily: "'Poppins', sans-serif" }}>RS:{price.toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '18px 20px 32px', background: isDark ? '#1C1C1C' : '#FFFFFF', borderTop: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 16, boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.3)' : '0 -4px 20px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${D.border}`, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
          <button onClick={() => setQty((q: number) => Math.max(1, q - 1))} style={{ width: 46, height: 54, background: isDark ? '#2A2A2A' : '#F5F5F5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: BRAND, transition: 'all 0.2s ease', outline: 'none' }}><Minus size={18} /></button>
          <span style={{ width: 46, height: 54, background: isDark ? '#1C1C1C' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: D.text, fontFamily: "'Poppins', sans-serif" }}>{qty}</span>
          <button onClick={() => setQty((q: number) => q + 1)} style={{ width: 46, height: 54, background: isDark ? '#2A2A2A' : '#F5F5F5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: BRAND, transition: 'all 0.2s ease', outline: 'none' }}><Plus size={18} /></button>
        </div>

        <button onClick={handleAddToCart} style={{ flex: 1, height: 54, borderRadius: 14, background: added ? 'rgba(255,87,35,0.3)' : BRAND, border: 'none', color: '#fff', fontSize: 17, fontWeight: 700, cursor: added ? 'default' : 'pointer', transition: 'all 0.2s ease', fontFamily: "'Poppins', sans-serif", outline: 'none', opacity: added ? 0.8 : 1 }} onMouseEnter={(e) => { if (!added) e.currentTarget.style.background = '#e64a1a'; }} onMouseLeave={(e) => { if (!added) e.currentTarget.style.background = BRAND; }}>{added ? '✓ Added!' : 'Add to Cart'}</button>
      </div>

      <div style={{ position: 'fixed', bottom: 164, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, textAlign: 'center', pointerEvents: 'none', padding: '0 20px' }}>
        <span style={{ background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)', color: isDark ? '#fff' : '#000', fontSize: 12, fontWeight: 600, padding: '4px 14px', borderRadius: 20, border: `1px solid ${D.border}`, fontFamily: "'Poppins', sans-serif", boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.08)' }}>Total: Rs. {finalPrice.toLocaleString()}</span>
      </div>

      <BottomNav />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}