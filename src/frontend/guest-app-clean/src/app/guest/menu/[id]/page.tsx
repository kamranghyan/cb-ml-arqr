'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Heart, Star, ShoppingCart, Plus, Minus, Check } from 'lucide-react';
import Link from 'next/link';
import { fetchMenuItem, normaliseItem, type ApiMenuItem } from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';

const SIZES = [
  { label: 'S',   desc: '12oz',  mult: 0.85 },
  { label: 'M',   desc: '16oz',  mult: 1.00 },
  { label: 'L',   desc: '20oz',  mult: 1.15 },
];
const EXTRAS = ['Extra shot', 'Oat milk', 'Less sugar', 'Extra hot', 'No ice'];

export default function ItemDetailPage() {
  const router    = useRouter();
  const { id }    = useParams<{ id: string }>();
  const { isDark }= useTheme();

  const [item,     setItem]     = useState<ApiMenuItem | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [size,     setSize]     = useState(1); // index
  const [qty,      setQty]      = useState(1);
  const [extras,   setExtras]   = useState<string[]>([]);
  const [liked,    setLiked]    = useState(false);
  const [added,    setAdded]    = useState(false);
  const { addItem, itemCount }  = useCartStore();

  const cartCount = itemCount();

  useEffect(() => {
    if (!id) return;
    // Also accept rid/tid from URL params (direct link from landing page)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRid = urlParams.get('rid'); const urlTid = urlParams.get('tid');
    if (urlRid) sessionStorage.setItem('lm_rid', urlRid);
    if (urlTid) sessionStorage.setItem('lm_tid', urlTid);
    const hasSession = sessionStorage.getItem('lm_rid') || sessionStorage.getItem('lm_tid');
    if (!hasSession) { window.location.href = '/guest'; return; }
    const rid = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID || process.env.NEXT_PUBLIC_RESTAURANT_ID || '2687382e-3b00-4f57-9014-f484df89e3fe';
    fetchMenuItem(id, rid)
      .then(raw => { setItem(normaliseItem(raw)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const toggleExtra = (e: string) => setExtras(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]);

  const finalPrice = item ? Math.round(item.price * SIZES[size].mult * qty) : 0;
  const hasAr  = !!(item as any)?.arModelKey || !!(item as any)?.arModelUrl;
  const arUrl  = (item as any)?.arModelUrl ?? '';
  const rid    = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID || process.env.NEXT_PUBLIC_RESTAURANT_ID || '2687382e-3b00-4f57-9014-f484df89e3fe';
  const arHref = `/guest/ar?rid=${encodeURIComponent(rid)}&iid=${encodeURIComponent(id ?? '')}&name=${encodeURIComponent(item?.name ?? '')}&emoji=${encodeURIComponent(item?.emoji ?? '🍽️')}${arUrl ? '&url=' + encodeURIComponent(arUrl) : ''}`;

  const handleAddToCart = () => {
    if (!item) return;
    addItem({
      menuItemId: item.id, name: item.name, emoji: item.emoji ?? '🍽️',
      price: Math.round(item.price * SIZES[size].mult),
      quantity: qty,
      options: { doneness: SIZES[size].label, side: extras.join(', ') },
    });
    setAdded(true);
    setTimeout(() => { setAdded(false); router.push('/guest/cart'); }, 800);
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280',
  } : {
    bg: '#FFF8F1', card: '#FFFFFF', card2: '#F5F0EA', border: '#F0E8E0',
    text: '#1A1A1A', muted: '#687780', sub: '#9CA3AF',
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #E1251B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* ── Item Hero ── */}
      <div style={{ position: 'relative', background: D.card2, paddingBottom: 30 }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '52px 20px 20px' }}>
          <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: D.card, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={18} color={D.text} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setLiked(!liked)}
              style={{ width: 40, height: 40, borderRadius: 12, background: liked ? '#FFF0F0' : D.card, border: `1.5px solid ${liked ? '#FFD0D0' : D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Heart size={18} color={liked ? '#E1251B' : D.muted} fill={liked ? '#E1251B' : 'none'} />
            </button>
            <button onClick={() => router.push('/guest/cart')} style={{ width: 40, height: 40, borderRadius: 12, background: '#E1251B', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <ShoppingCart size={17} color="#fff" />
              {cartCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: '#FFC72C', color: '#891C1C', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* Item image */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px 20px' }}>
          <div style={{ width: 160, height: 160, borderRadius: '50%', background: isDark ? '#2A2A2A' : '#E8DDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            {(item as any)?.imageUrl
              ? <img src={(item as any).imageUrl} alt={item?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : item?.emoji}
          </div>
        </div>

        {/* Rating pill */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFC72C', padding: '6px 16px', borderRadius: 20 }}>
            <Star size={13} fill="#891C1C" color="#891C1C" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#891C1C' }}>4.8 · 2.4k reviews</span>
          </div>
          {hasAr && (
            <Link href={arHref}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#891C1C,#E1251B)', padding: '6px 16px', borderRadius: 20, textDecoration: 'none' }}>
              <span style={{ fontSize: 13 }}>🫙</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>View in 3D</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Scrollable Details ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 120px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: D.text, margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>{item?.name}</h1>
        <p style={{ fontSize: 14, color: D.muted, margin: '0 0 24px', lineHeight: 1.6 }}>{item?.description || 'A carefully crafted dish made with the finest ingredients.'}</p>

        {/* AR banner — only when item has a 3D model */}
        {hasAr && (
          <Link href={arHref} style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 24px', padding: '14px 16px', background: 'linear-gradient(135deg, #891C1C, #B22222)', borderRadius: 16, textDecoration: 'none', boxShadow: '0 4px 16px rgba(137,28,28,0.25)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,199,44,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>🫙</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0 }}>View in Augmented Reality</p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: '2px 0 0' }}>Place on your table · Mobile & Desktop</p>
            </div>
            <span style={{ color: '#FFC72C', fontSize: 20 }}>›</span>
          </Link>
        )}

        {/* Size selector */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: '0 0 12px' }}>Choose Size</p>
          <div style={{ display: 'flex', gap: 10 }}>
            {SIZES.map((s, i) => (
              <button key={s.label} onClick={() => setSize(i)}
                style={{ flex: 1, padding: '12px 8px', borderRadius: 14, border: `2px solid ${size === i ? '#E1251B' : D.border}`, background: size === i ? '#E1251B' : D.card, color: size === i ? '#fff' : D.text, cursor: 'pointer', transition: 'all 0.2s' }}>
                <p style={{ fontSize: 18, fontWeight: 800, margin: '0 0 2px' }}>{s.label}</p>
                <p style={{ fontSize: 11, margin: '0 0 4px', opacity: 0.7 }}>{s.desc}</p>
                <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Rs. {Math.round((item?.price || 0) * s.mult).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Customise */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: '0 0 12px' }}>Customise</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXTRAS.map(e => (
              <button key={e} onClick={() => toggleExtra(e)}
                style={{ padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${extras.includes(e) ? '#E1251B' : D.border}`, background: extras.includes(e) ? '#FFF0EE' : D.card, color: extras.includes(e) ? '#E1251B' : D.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: D.text }}>Quantity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, borderRadius: 10, background: D.card2, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Minus size={16} color={D.text} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 800, color: D.text, minWidth: 24, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)}
              style={{ width: 36, height: 36, borderRadius: 10, background: '#E1251B', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Plus size={16} color="#fff" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Add to Cart CTA ── */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '16px 20px 32px', background: D.bg, borderTop: `1px solid ${D.border}` }}>
        <button onClick={handleAddToCart}
          style={{ width: '100%', height: 56, borderRadius: 28, background: added ? '#22c55e' : '#E1251B', color: '#fff', border: 'none', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', cursor: 'pointer', boxShadow: added ? '0 6px 20px rgba(34,197,94,0.35)' : '0 6px 20px rgba(225,37,27,0.35)', transition: 'all 0.3s' }}>
          <span>{added ? '✓ Added!' : 'Add to Cart'}</span>
          <span style={{ background: 'rgba(255,255,255,0.25)', padding: '4px 14px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
            Rs. {finalPrice.toLocaleString()}
          </span>
        </button>
      </div>
    </div>
  );
}