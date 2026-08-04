// /app/guest/page.tsx

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronRight, Star, Truck, Plus, Loader2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { fetchMenuItems, normaliseItem, type ApiMenuItem } from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';
import GuestTopBar from '@/components/guest/GuestTopBar';
import BottomNav from '@/components/guest/BottomNav';

// ✅ Use menu-api functions instead of direct fetch
// import { fetchMenuItems } from '@/lib/menu-api';

const BRAND = '#ff5723';

// ── Placeholder data ───────────────────────────────────────────────────────────
const PLACEHOLDER_CUISINE_TAGS = ['Sandwiches', 'Chinese', 'Thai Seafood', 'Beverages'];
const PLACEHOLDER_HOURS    = '10:00AM – 11:00PM';
const PLACEHOLDER_RATING   = '4.8/5 (100+)';
const PLACEHOLDER_DELIVERY = 'Free Delivery';

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
  const params  = useSearchParams();
  const { isDark } = useTheme();

  const qrRid    = params.get('rid') || '';
  const tid      = params.get('tid') || '';
  const tableNum = tid.replace(/^[Tt](?:able[-_]?)?/, '').replace(/\D/g, '') || '—';

  const [restName,  setRestName]  = useState('Das Pardes');
  const [tagline,   setTagline]   = useState('Fine Dining Experience');
  const [zone,      setZone]      = useState('Main Hall');
  const [items,     setItems]     = useState<ApiMenuItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const { addItem } = useCartStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const n = parseInt(tableNum, 10);
    setZone(n >= 11 ? 'Private Dining' : n >= 9 ? 'Garden Terrace' : 'Main Hall');
    if (qrRid) sessionStorage.setItem('lm_rid', qrRid);
    if (tid)   sessionStorage.setItem('lm_tid', tid);
    if (tableNum !== '—') sessionStorage.setItem('lm_table', tableNum);

    const rid = qrRid;
    if (!rid) {
      console.warn('⚠️ No restaurant ID found in URL');
      setLoading(false);
      return;
    }

    // ✅ Use menu-api fetchMenuItems (goes through /api/menu proxy)
    fetchMenuItems(rid)
      .then(data => {
        // Try to get restaurant name from first item
        if (data.length > 0 && (data[0] as any).restaurantName) {
          setRestName((data[0] as any).restaurantName);
        }
        if (data.length > 0 && (data[0] as any).restaurantTagline) {
          setTagline((data[0] as any).restaurantTagline);
        }
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('❌ Failed to load menu:', err);
        setLoading(false);
      });
  }, [qrRid, tid, tableNum]);

  const isQrScan = params.has('rid') && params.has('tid');
  const menuUrl  = `/guest/menu?rid=${qrRid}&tid=${tid}`;

  // Build categories from items
  const cats = Array.from(new Set(items.map(i => i.category).filter(Boolean))).map(c => {
    const isUuid = /^[0-9a-f]{6,}/i.test(c);
    return isUuid ? 'Dishes' : c.charAt(0).toUpperCase() + c.slice(1);
  });

  // Popular = first 4 items
  const popular = items.filter(i => i.status !== 'inactive').slice(0, 4);

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280', input: '#222222',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#9D9D9D', sub: '#C4C4C4', input: '#FFFFFF',
  };

  const filteredSearch = items.filter(i =>
    i.status !== 'inactive' &&
    (i.name.toLowerCase().includes(search.toLowerCase()) ||
     (i.description ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ 
      minHeight: '100dvh', 
      background: D.bg, 
      fontFamily: "'DM Sans', sans-serif", 
      maxWidth: 480, 
      margin: '0 auto', 
      display: 'flex', 
      flexDirection: 'column', 
      transition: 'background 0.25s' 
    }}>
      <GuestTopBar />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <div style={{
          position: 'relative', 
          width: '100%', 
          aspectRatio: '12 / 5', 
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #ff5723 0%, #ff8a5c 55%, #ffbca7 100%)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
        }}>
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            opacity: 0.14, 
            backgroundImage: 'radial-gradient(circle at 18% 25%, #fff 0%, transparent 42%), radial-gradient(circle at 82% 78%, #fff 0%, transparent 38%)' 
          }} />
          <p style={{
            fontFamily: "'Baloo 2', sans-serif", 
            fontWeight: 800, 
            fontSize: 32,
            color: '#fff', 
            textAlign: 'center', 
            letterSpacing: 1, 
            margin: 0,
            textTransform: 'uppercase', 
            textShadow: '0 2px 14px rgba(0,0,0,0.18)', 
            padding: '0 24px',
          }}>
            {restName}
          </p>
        </div>

        {/* ── Restaurant info strip ────────────────────────────────────────── */}
        <div style={{ background: BRAND, padding: '20px 20px 22px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 23, color: '#fff', margin: '0 0 6px' }}>
              {restName}
            </h1>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.92)', margin: '0 0 4px', lineHeight: 1.5 }}>
              {PLACEHOLDER_CUISINE_TAGS.join(' | ')}
            </p>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              Open: {PLACEHOLDER_HOURS}
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              <Star size={13} fill="#fff" color="#fff" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{PLACEHOLDER_RATING}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              <Truck size={13} color="#fff" />
              <span style={{ fontSize: 12.5, color: '#fff' }}>{PLACEHOLDER_DELIVERY}</span>
            </div>
          </div>
        </div>

        {/* ── Padded content ── */}
        <div style={{ padding: '20px 20px 0' }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: D.sub, pointerEvents: 'none', zIndex: 1 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu.."
              style={{ 
                width: '100%', 
                height: 50, 
                paddingLeft: 44, 
                paddingRight: search ? 44 : 16, 
                borderRadius: 14, 
                background: D.input, 
                border: `1.5px solid ${BRAND}`, 
                fontSize: 14, 
                color: D.text, 
                outline: 'none', 
                boxSizing: 'border-box', 
                fontFamily: "'DM Sans', sans-serif" 
              }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: D.sub }}>
                ✕
              </button>
            )}
          </div>

          {/* Search results */}
          {search.trim() && (
            <div style={{ 
              background: D.card, 
              border: `1.5px solid ${D.border}`, 
              borderRadius: 16, 
              overflow: 'hidden', 
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)', 
              marginTop: 8 
            }}>
              {filteredSearch.slice(0, 6).map((item, idx, arr) => (
                <Link key={item.id} href={`/guest/menu/${item.id}?rid=${qrRid}&tid=${tid}`}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: '12px 16px', 
                    textDecoration: 'none', 
                    borderBottom: idx < arr.length - 1 ? `1px solid ${D.border}` : 'none', 
                    background: 'transparent' 
                  }}
                  onClick={() => setSearch('')}>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: 12, 
                    background: D.card2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 22, 
                    flexShrink: 0, 
                    overflow: 'hidden' 
                  }}>
                    {(item as any).imageUrl
                      ? <img src={(item as any).imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : item.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ fontSize: 12, color: D.muted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || 'Restaurant special'}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: BRAND, flexShrink: 0 }}>Rs. {item.price.toLocaleString()}</span>
                </Link>
              ))}
              {filteredSearch.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: D.muted, margin: 0 }}>No items found for "{search}"</p>
                </div>
              )}
              {filteredSearch.length > 6 && (
                <Link href={`${menuUrl}&q=${encodeURIComponent(search)}`}
                  style={{ display: 'block', padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: BRAND, textDecoration: 'none', borderTop: `1px solid ${D.border}` }}
                  onClick={() => setSearch('')}>
                  See all results →
                </Link>
              )}
            </div>
          )}

          {/* Promo banner */}
          <div style={{ borderRadius: 20, background: '#ffbca7', padding: '22px 20px', marginTop: 20, marginBottom: 24 }}>
            <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, fontWeight: 600, color: '#3a1a10', margin: '0 0 6px' }}>Limited Time</p>
            <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: BRAND, margin: '0 0 6px' }}>Special Today</p>
            <p style={{ fontSize: 13.5, color: 'rgba(58,26,16,0.75)', margin: '0 0 16px' }}>Exclusive Table experience</p>
            <Link href={menuUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND, color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Order Now <ChevronRight size={16} />
            </Link>
          </div>

          {/* Categories */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ flexShrink: 0, width: 76, height: 76, borderRadius: 18, background: D.card2 }} />
              )) : cats.slice(0, 6).map(cat => (
                <Link key={cat} href={`${menuUrl}&cat=${cat.toLowerCase()}`}
                  style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                  <div style={{ width: 76, height: 76, borderRadius: 18, background: isDark ? D.card2 : 'linear-gradient(135deg,#ffe4d8,#ffcbb3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                    {getCatEmoji(cat)}
                  </div>
                  <span style={{ fontSize: 14, color: D.sub, textAlign: 'center' }}>{cat}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Popular Today */}
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700, color: D.text, margin: '0 0 16px' }}>Popular Today</h2>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} style={{ height: 150, borderRadius: 20, background: D.card2 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {popular.map(item => (
                <Link key={item.id} href={`/guest/menu/${item.id}?rid=${qrRid}&tid=${tid}`}
                  style={{ display: 'flex', gap: 16, padding: 16, background: D.card, border: `1.5px solid ${BRAND}`, borderRadius: 20, textDecoration: 'none' }}>
                  <div style={{ width: 100, height: 100, borderRadius: 14, background: D.card2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, overflow: 'hidden' }}>
                    {(item as any).imageUrl
                      ? <img src={(item as any).imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : item.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: D.text, margin: '0 0 6px' }}>{item.name}</p>
                    <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: BRAND, margin: '0 0 6px' }}>Rs. {item.price.toLocaleString()}</p>
                    <p style={{ fontSize: 13, color: D.text, margin: 0, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {item.description || 'Restaurant special'}
                    </p>
                  </div>
                  <button onClick={e => { e.preventDefault(); addItem({ menuItemId: item.id, name: item.name, emoji: item.emoji ?? '🍽️', price: item.price, quantity: 1, options: {} }); }}
                    style={{ width: 40, height: 40, borderRadius: '50%', background: BRAND, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', alignSelf: 'flex-end', flexShrink: 0, boxShadow: '0 2px 8px rgba(255,87,35,0.35)' }}>
                    <Plus size={18} />
                  </button>
                </Link>
              ))}
            </div>
          )}

          {/* QR Session info */}
          {isQrScan && (
            <div style={{ background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 16, padding: '12px 16px', margin: '24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FFF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', margin: 0 }}>QR Verified · Secure Session</p>
                <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>Table {tableNum} · {zone}</p>
              </div>
            </div>
          )}
          <div style={{ height: 96 }} />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default function GuestLandingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color="#ff5723" className="animate-spin" />
      </div>
    }>
      <GuestContent />
    </Suspense>
  );
}