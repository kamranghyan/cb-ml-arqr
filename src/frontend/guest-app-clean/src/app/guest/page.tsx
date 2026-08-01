'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ShoppingCart, User, Home, BookOpen, Clock, Loader2, MapPin, Star, ChevronRight, Bell, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { fetchMenuItems, normaliseItem, type ApiMenuItem } from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Menu: BookOpen, Cart: ShoppingCart, Tracking: Clock, User,
};

const MENU_RID  = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID || process.env.NEXT_PUBLIC_RESTAURANT_ID || '2687382e-3b00-4f57-9014-f484df89e3fe';
const API_BASE  = process.env.NEXT_PUBLIC_API_BASE  || 'https://g1ou0w5x4m.execute-api.ap-south-1.amazonaws.com/dev';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const CAT_EMOJI: Record<string, string> = {
  all:'🍽️', starters:'🥗', mains:'🍽️', desserts:'🍰', beverages:'🥤',
  drinks:'🥤', coffee:'☕', hot:'☕', iced:'🧊', pizza:'🍕',
  burgers:'🍔', pasta:'🍝', seafood:'🐟', grill:'🔥', soup:'🍜',
  bread:'🍞', cake:'🎂', other:'🍽️',
};
function getCatEmoji(cat: string) {
  const c = cat.toLowerCase();
  for (const [k,v] of Object.entries(CAT_EMOJI)) if (c.includes(k)) return v;
  return '🍽️';
}

function GuestContent() {
  const params   = useSearchParams();
  const router   = useRouter();
  const { theme, toggle, isDark } = useTheme();

  const qrRid    = params.get('rid') || '';
  const tid      = params.get('tid') || '';
  const tableNum = tid.replace(/^[Tt](?:able[-_]?)?/, '').replace(/\D/g, '') || '—';

  const [restName,  setRestName]  = useState('Das Pardes');
  const [tagline,   setTagline]   = useState('Fine Dining Experience');
  const [zone,      setZone]      = useState('Main Hall');
  const [items,     setItems]     = useState<ApiMenuItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const { itemCount, addItem } = useCartStore();
  const [search, setSearch] = useState('');
  const cartCount = itemCount();

  useEffect(() => {
    const n = parseInt(tableNum, 10);
    setZone(n >= 11 ? 'Private Dining' : n >= 9 ? 'Garden Terrace' : 'Main Hall');
    if (qrRid) sessionStorage.setItem('lm_rid', qrRid);
    if (tid)   sessionStorage.setItem('lm_tid', tid);
    if (tableNum !== '—') sessionStorage.setItem('lm_table', tableNum);

    const rid = qrRid || MENU_RID;
    fetch(`${API_BASE}/menus/restaurants/${rid}/items`, {
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT_ID }, cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const raw = data?.items ?? data ?? [];
        if (raw[0]?.restaurantName) setRestName(raw[0].restaurantName);
        if (raw[0]?.restaurantTagline) setTagline(raw[0].restaurantTagline);
        setItems(raw.map(normaliseItem));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [qrRid, tid, tableNum]);

  const isQrScan = params.has('rid') && params.has('tid');
  const menuUrl  = `/guest/menu?rid=${qrRid || MENU_RID}&tid=${tid}`;

  // Build categories from items
  const cats = ['All', ...Array.from(new Set(items.map(i => i.category).filter(Boolean))).map(c => {
    const isUuid = /^[0-9a-f]{6,}/i.test(c);
    return isUuid ? 'Dishes' : c.charAt(0).toUpperCase() + c.slice(1);
  })];

  // Popular = first 4 items
  const popular = items.filter(i => i.status !== 'inactive').slice(0, 4);

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280', nav: '#181818',
    input: '#222222', promo: '#1A2A1A',
  } : {
    bg: '#FFF8F1', card: '#FFFFFF', card2: '#F5F0EA', border: '#F0E8E0',
    text: '#1A1A1A', muted: '#687780', sub: '#9CA3AF', nav: '#FFFFFF',
    input: '#F5F0EA', promo: '#F0FFF4',
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', transition: 'background 0.25s' }}>

      {/* ── Header ── */}
      <div style={{ padding: '52px 20px 16px', background: D.bg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#E1251B', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 4px' }}>{greeting}</p>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: D.text, margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>
              {restName} <span style={{ fontSize: 22 }}>👋</span>
            </h1>
            {tableNum !== '—' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={12} color="#E1251B" />
                <span style={{ fontSize: 12, color: D.muted }}>Table {tableNum} · {zone}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={toggle}
              style={{ width: 42, height: 42, borderRadius: 14, background: D.card, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>
              {isDark ? '☀️' : '🌙'}
            </button>
            <button onClick={() => router.push('/guest/tracking')}
              style={{ width: 42, height: 42, borderRadius: 14, background: D.card, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color={D.muted} />
            </button>
            <button onClick={() => router.push('/guest/cart')} style={{ width: 42, height: 42, borderRadius: 14, background: '#E1251B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', border: 'none' }}>
              <ShoppingCart size={18} color="#fff" />
              {cartCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#FFC72C', color: '#891C1C', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', marginTop: 20 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: D.sub, pointerEvents: 'none', zIndex: 1 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search food & drinks…"
            style={{ width: '100%', height: 48, paddingLeft: 44, paddingRight: search ? 44 : 14, borderRadius: 16, background: D.input, border: `1.5px solid ${search ? '#E1251B' : D.border}`, fontSize: 14, color: D.text, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", transition: 'border-color 0.2s' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: D.card2, border: `1px solid ${D.border}`, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, color: D.muted }}>
              ✕
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {search.trim() && (
          <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: 8 }}>
            {items.filter(i =>
              i.status !== 'inactive' &&
              (i.name.toLowerCase().includes(search.toLowerCase()) ||
               (i.description ?? '').toLowerCase().includes(search.toLowerCase()))
            ).slice(0, 6).map((item, idx, arr) => (
              <Link key={item.id} href={`/guest/menu/${item.id}?rid=${qrRid || MENU_RID}&tid=${tid}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textDecoration: 'none', borderBottom: idx < arr.length - 1 ? `1px solid ${D.border}` : 'none', background: 'transparent' }}
                onClick={() => setSearch('')}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: D.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, overflow: 'hidden' }}>
                  {(item as any).imageUrl
                    ? <img src={(item as any).imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : item.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <p style={{ fontSize: 12, color: D.muted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || 'Restaurant special'}</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#E1251B', flexShrink: 0 }}>Rs. {item.price.toLocaleString()}</span>
              </Link>
            ))}
            {items.filter(i =>
              i.status !== 'inactive' &&
              (i.name.toLowerCase().includes(search.toLowerCase()) ||
               (i.description ?? '').toLowerCase().includes(search.toLowerCase()))
            ).length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: D.muted, margin: 0 }}>No items found for "{search}"</p>
              </div>
            )}
            {items.filter(i =>
              i.status !== 'inactive' &&
              (i.name.toLowerCase().includes(search.toLowerCase()) ||
               (i.description ?? '').toLowerCase().includes(search.toLowerCase()))
            ).length > 6 && (
              <Link href={`${menuUrl}&q=${encodeURIComponent(search)}`}
                style={{ display: 'block', padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#E1251B', textDecoration: 'none', borderTop: `1px solid ${D.border}` }}
                onClick={() => setSearch('')}>
                See all results →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>

        {/* Promo banner */}
        <div style={{ borderRadius: 20, background: 'linear-gradient(135deg, #891C1C 0%, #B22222 60%, #C0392B 100%)', padding: '20px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,199,44,0.15)' }} />
          <div style={{ position: 'absolute', bottom: -15, right: 20, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: '#FFC72C', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 6px' }}>Limited Time</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'Georgia, serif', margin: '0 0 4px' }}>Special Today</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 14px' }}>Exclusive table experience</p>
          <Link href={menuUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFC72C', color: '#891C1C', padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
            Order Now <ChevronRight size={14} />
          </Link>
        </div>

        {/* Categories */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: D.text, margin: 0 }}>Categories</h2>
            <Link href={menuUrl} style={{ fontSize: 12, color: '#E1251B', fontWeight: 700, textDecoration: 'none' }}>See all</Link>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ flexShrink: 0, width: 72, height: 80, borderRadius: 16, background: D.card2 }} />
            )) : cats.slice(0, 6).map((cat, i) => (
              <Link key={cat} href={`${menuUrl}&cat=${cat.toLowerCase()}`}
                style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 72, padding: '12px 8px', borderRadius: 16, background: i === 0 ? '#E1251B' : D.card, border: `1.5px solid ${i === 0 ? '#E1251B' : D.border}`, textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: 26 }}>{getCatEmoji(cat)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? '#fff' : D.text, textAlign: 'center', lineHeight: 1.2 }}>{cat}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Popular Now */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: D.text, margin: 0 }}>Popular Now 🔥</h2>
            <Link href={menuUrl} style={{ fontSize: 12, color: '#E1251B', fontWeight: 700, textDecoration: 'none' }}>See all</Link>
          </div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 180, borderRadius: 20, background: D.card }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {popular.map(item => (
                <Link key={item.id} href={`/guest/menu/${item.id}?rid=${qrRid || MENU_RID}&tid=${tid}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 20, padding: 14, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ width: '100%', aspectRatio: '1', borderRadius: 14, background: D.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, marginBottom: 10, overflow: 'hidden' }}>
                      {(item as any).imageUrl
                        ? <img src={(item as any).imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
                        : item.emoji}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: D.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: D.muted, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description?.slice(0, 30) || 'Restaurant special'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#E1251B' }}>Rs. {item.price.toLocaleString()}</span>
                      <button onClick={e => { e.preventDefault(); addItem({ menuItemId: item.id, name: item.name, emoji: item.emoji ?? '🍽️', price: item.price, quantity: 1, options: {} }); }}
                        style={{ width: 28, height: 28, borderRadius: 8, background: '#E1251B', border: 'none', color: '#fff', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* QR Session info */}
        {isQrScan && (
          <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 16, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FFF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', margin: 0 }}>QR Verified · Secure Session</p>
              <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>Table {tableNum} · {zone}</p>
            </div>
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: D.nav, borderTop: `1px solid ${D.border}`, padding: '10px 0 24px', display: 'flex', justifyContent: 'space-around', zIndex: 100 }}>
        {([
          { icon: 'Home',     label: 'Home',   href: `/guest?rid=${qrRid}&tid=${tid}`, active: true },
          { icon: 'Menu',     label: 'Menu',   href: menuUrl },
          { icon: 'Cart',     label: 'Cart',   href: '/guest/cart' },
          { icon: 'Tracking', label: 'Orders', href: '/guest/tracking' },
        ] as { icon: string; label: string; href: string; active?: boolean }[]).map(n => {
          const Icon = ICON_MAP[n.icon] ?? Home;
          return (
            <Link key={n.label} href={n.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none', color: n.active ? '#E1251B' : D.sub }}>
              <Icon size={22} color={n.active ? '#E1251B' : D.sub} />
              <span style={{ fontSize: 10, fontWeight: n.active ? 700 : 500 }}>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function GuestLandingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color="#E1251B" className="animate-spin" />
      </div>
    }>
      <GuestContent />
    </Suspense>
  );
}