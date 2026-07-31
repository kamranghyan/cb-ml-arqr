'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, ShoppingCart, Home, BookOpen, Clock, Loader2, Plus, Check, type LucideIcon } from 'lucide-react';
import { fetchMenuItems, normaliseItem, type ApiMenuItem } from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Menu: BookOpen, Cart: ShoppingCart, Tracking: Clock,
};

const CAT_EMOJI: Record<string, string> = { all:'🍽️', starters:'🥗', mains:'🍽️', desserts:'🍰', beverages:'🥤', drinks:'🥤', coffee:'☕', hot:'☕', iced:'🧊', pizza:'🍕', burgers:'🍔', pasta:'🍝', seafood:'🐟', grill:'🔥', other:'🍽️' };
function getCatEmoji(cat: string) { const c = cat.toLowerCase(); for (const [k,v] of Object.entries(CAT_EMOJI)) if (c.includes(k)) return v; return '🍽️'; }

function MenuContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();

  const [items,          setItems]          = useState<ApiMenuItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search,         setSearch]         = useState('');
  const [added,          setAdded]          = useState<Record<string, boolean>>({});
  const [restName,       setRestName]       = useState('Coffee Menu');
  const { addItem, itemCount } = useCartStore();
  const cartCount = itemCount();

  useEffect(() => {
    const urlRid    = params.get('rid') || '';
    const urlTid    = params.get('tid') || '';
    const storedRid = sessionStorage.getItem('lm_rid') || '';
    const storedTid = sessionStorage.getItem('lm_tid') || '';
    if (!urlRid && !urlTid && !storedRid && !storedTid) { window.location.href = '/guest'; return; }
    if (urlRid) sessionStorage.setItem('lm_rid', urlRid);
    if (urlTid) sessionStorage.setItem('lm_tid', urlTid);

    const menuRid = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID || process.env.NEXT_PUBLIC_RESTAURANT_ID || '2687382e-3b00-4f57-9014-f484df89e3fe';
    const timeout = setTimeout(() => { setLoading(false); }, 15000);
    fetchMenuItems(menuRid)
      .then(raw => {
        clearTimeout(timeout);
        const norm = raw.map(normaliseItem);
        setItems(norm);
        if ((raw[0] as any)?.restaurantName) setRestName((raw[0] as any).restaurantName + ' Menu');
        setLoading(false);
      })
      .catch(() => { clearTimeout(timeout); setLoading(false); });
  }, [params]);

  const catRaw = params.get('cat') || 'all';
  useEffect(() => { setActiveCategory(catRaw); }, [catRaw]);

  const categories = [
    { id: 'all', name: 'All', emoji: '🍽️' },
    ...Array.from(new Set(items.map(i => i.category).filter(Boolean))).map(cat => {
      const isUuid = /^[0-9a-f]{6,}/i.test(cat);
      const name   = isUuid ? 'Dishes' : cat.charAt(0).toUpperCase() + cat.slice(1);
      return { id: cat, name, emoji: getCatEmoji(cat) };
    }),
  ];

  const filtered = items.filter(item => {
    const matchCat    = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || (item.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && item.status !== 'inactive';
  });

  const handleAdd = (item: ApiMenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({ menuItemId: item.id, name: item.name, emoji: item.emoji ?? '🍽️', price: item.price, quantity: 1, options: {} });
    setAdded(p => ({ ...p, [item.id]: true }));
    setTimeout(() => setAdded(p => ({ ...p, [item.id]: false })), 1600);
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280', nav: '#181818', input: '#222222',
  } : {
    bg: '#FFF8F1', card: '#FFFFFF', card2: '#F5F0EA', border: '#F0E8E0',
    text: '#1A1A1A', muted: '#687780', sub: '#9CA3AF', nav: '#FFFFFF', input: '#F5F0EA',
  };

  const menuUrl = `/guest/menu?rid=${params.get('rid') || ''}&tid=${params.get('tid') || ''}`;

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ padding: '52px 20px 0', background: D.bg, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, background: D.card, border: `1.5px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={18} color={D.text} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: D.text, margin: 0 }}>{restName}</h1>
            <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>{filtered.length} drinks available</p>
          </div>
          <button onClick={() => router.push('/guest/cart')} style={{ width: 40, height: 40, borderRadius: 12, background: '#E1251B', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <ShoppingCart size={17} color="#fff" />
            {cartCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: '#FFC72C', color: '#891C1C', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>}
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: D.sub }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search food & drinks…"
            style={{ width: '100%', height: 46, paddingLeft: 42, paddingRight: 14, borderRadius: 14, background: D.input, border: `1.5px solid ${D.border}`, fontSize: 14, color: D.text, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 14 }}>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${activeCategory === cat.id ? '#E1251B' : D.border}`, background: activeCategory === cat.id ? '#E1251B' : D.card, color: activeCategory === cat.id ? '#fff' : D.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Items list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
            <Loader2 size={28} color="#E1251B" className="animate-spin" />
            <p style={{ color: D.muted, fontSize: 14 }}>Loading menu…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <span style={{ fontSize: 40, opacity: 0.2 }}>🍽️</span>
            <p style={{ color: D.muted, fontSize: 14, marginTop: 10 }}>No items found</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          {filtered.map(item => (
            <div key={item.id} onClick={() => router.push(`/guest/menu/${item.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s' }}>
              {/* Image */}
              <div style={{ width: 80, height: 80, borderRadius: 14, background: D.card2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, overflow: 'hidden', position: 'relative' }}>
                {(item as any).imageUrl
                  ? <img src={(item as any).imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : item.emoji}
                {(item.tags ?? []).includes('chef') && (
                  <span style={{ position: 'absolute', top: 4, left: 4, background: '#E1251B', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 8 }}>Popular</span>
                )}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: D.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                <p style={{ fontSize: 12, color: D.muted, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || 'Restaurant special'}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#E1251B' }}>Rs. {item.price.toLocaleString()}</span>
                  <button onClick={e => handleAdd(item, e)}
                    style={{ width: 32, height: 32, borderRadius: 10, background: added[item.id] ? '#22c55e' : '#E1251B', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 3px 10px rgba(225,37,27,0.3)' }}>
                    {added[item.id] ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: D.nav, borderTop: `1px solid ${D.border}`, padding: '10px 0 24px', display: 'flex', justifyContent: 'space-around', zIndex: 100 }}>
        {([
          { icon: 'Home',     label: 'Home',   href: '/guest',           active: false },
          { icon: 'Menu',     label: 'Menu',   href: menuUrl,            active: true  },
          { icon: 'Cart',     label: 'Cart',   href: '/guest/cart'                     },
          { icon: 'Tracking', label: 'Orders', href: '/guest/tracking'                 },
        ] as { icon: string; label: string; href: string; active?: boolean }[]).map(n => {
          const Icon = ICON_MAP[n.icon] ?? Home;
          return (
            <button key={n.label} onClick={() => router.push(n.href)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: n.active ? '#E1251B' : D.sub }}>
              <Icon size={22} color={n.active ? '#E1251B' : D.sub} />
              <span style={{ fontSize: 10, fontWeight: n.active ? 700 : 500 }}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: 440, zIndex: 99 }}>
          <button onClick={() => router.push('/guest/cart')}
            style={{ width: '100%', height: 52, borderRadius: 26, background: '#E1251B', color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(225,37,27,0.4)' }}>
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 13 }}>{cartCount}</span>
            <span>View Cart</span>
            <ShoppingCart size={18} />
          </button>
        </div>
      )}
      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={28} color="#E1251B" className="animate-spin" /></div>}>
      <MenuContent />
    </Suspense>
  );
}