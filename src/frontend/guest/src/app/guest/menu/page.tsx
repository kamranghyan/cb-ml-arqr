'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, ShoppingCart, Loader2, Plus, Check } from 'lucide-react';
import { fetchMenuItems, normaliseItem, type ApiMenuItem } from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';
import Image from 'next/image';
import GuestTopBar from '@/components/guest/GuestTopBar';

const BRAND = '#ff5723';

const CAT_EMOJI: Record<string, string> = {
  all: '🍽️', starters: '🥗', mains: '🍽️', desserts: '🍰', beverages: '🥤',
  drinks: '🥤', coffee: '☕', hot: '☕', iced: '🧊', pizza: '🍕',
  burgers: '🍔', pasta: '🍝', seafood: '🐟', grill: '🔥', other: '🍽️'
};

function getCatEmoji(cat: string) {
  const c = cat.toLowerCase();
  for (const [k, v] of Object.entries(CAT_EMOJI)) if (c.includes(k)) return v;
  return '🍽️';
}

function MenuContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();

  const [items, setItems] = useState<ApiMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [restName, setRestName] = useState('Menu Items');
  const { addItem, itemCount } = useCartStore();
  const cartCount = itemCount();

  useEffect(() => {
    const urlRid = params.get('rid') || '';
    const urlTid = params.get('tid') || '';
    const storedRid = sessionStorage.getItem('lm_rid') || '';
    const storedTid = sessionStorage.getItem('lm_tid') || '';
    if (!urlRid && !urlTid && !storedRid && !storedTid) { window.location.href = '/guest'; return; }
    if (urlRid) sessionStorage.setItem('lm_rid', urlRid);
    if (urlTid) sessionStorage.setItem('lm_tid', urlTid);

    const menuRid = getGuestScope().restaurantId;
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

  useEffect(() => {
    setActiveCategory(catRaw);
  }, [catRaw]);

  const categories = [
    { id: 'all', name: 'All', emoji: '🍽️' },
    ...Array.from(
      new Map(
        items
          .filter(item => item.status !== 'inactive')
          .map(item => {
            const categoryName =
              item.categoryName?.trim() ||
              item.category?.trim() ||
              'Other';

            return [
              categoryName.toLowerCase(),
              {
                id: categoryName.toLowerCase(),
                name:
                  categoryName.charAt(0).toUpperCase() +
                  categoryName.slice(1),
                emoji: getCatEmoji(categoryName),
              },
            ];
          })
      ).values()
    ),
  ];

  const filtered = items.filter(item => {
    const categoryName =
      item.categoryName?.trim().toLowerCase() ||
      item.category?.trim().toLowerCase() ||
      '';

    const matchCat =
      activeCategory === 'all' ||
      categoryName === activeCategory.toLowerCase();

    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description ?? '').toLowerCase().includes(search.toLowerCase());

    return matchCat && matchSearch && item.status !== 'inactive';
  });

  const handleAdd = (item: ApiMenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      menuItemId: item.id,
      name: item.name,
      emoji: item.emoji ?? '🍽️',
      price: item.price,
      quantity: 1,
      options: {},
      imageUrl: (item as any).imageUrl || '',
    });
    setAdded(p => ({ ...p, [item.id]: true }));
    setTimeout(() => setAdded(p => ({ ...p, [item.id]: false })), 1600);
  };

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280', input: '#242424',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', sub: '#9CA3AF', input: '#FFFFFF',
  };

  const activeCategoryName =
    categories.find(cat => cat.id === activeCategory)?.name ?? 'All';

  return (
    <div style={{
      minHeight: '100dvh',
      background: D.bg,
      fontFamily: "'Poppins', sans-serif",
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background 0.25s',
    }}>
      <GuestTopBar />

      {/* ── Header ── */}
      <div style={{
        padding: '35px 20px 0',
        background: D.bg,
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: D.card,
              border: `1.5px solid ${D.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
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
            <ArrowLeft size={18} color={D.text} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: D.text,
              margin: 0
            }}>{restName}</h1>
            <p style={{
              fontSize: 11,
              color: D.muted,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}>
              {filtered.length} {activeCategoryName.toLowerCase()} available
            </p>
          </div>
          <button
            onClick={() => router.push('/guest/cart')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: BRAND,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
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
            <ShoppingCart size={17} color="#fff" />
            {cartCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -5,
                right: -5,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                color: BRAND,
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Search ── */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: D.sub
          }} />
          <input
            className='searchInput'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search food & drinks…"
            style={{
              width: '100%',
              height: 46,
              paddingLeft: 42,
              paddingRight: 14,
              borderRadius: 14,
              background: D.input,
              border: `1.5px solid ${BRAND}`,
              fontSize: 14,
              color: D.text,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* ── Category tabs ── */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: 14
        }}>
          {categories.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  const url = new URL(window.location.href);
                  if (cat.id === 'all') {
                    url.searchParams.delete('cat');
                  } else {
                    url.searchParams.set('cat', cat.id);
                  }
                  router.replace(url.pathname + url.search);
                }}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: `1.5px solid ${active ? BRAND : D.border}`,
                  background: active ? BRAND : D.card,
                  color: active ? '#fff' : D.muted,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: "'Poppins', sans-serif",
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
                    e.currentTarget.style.color = isDark ? '#F5F0E8' : '#000000';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = D.card;
                    e.currentTarget.style.color = D.muted;
                  }
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Items list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '60px 0',
            gap: 12
          }}>
            <Loader2 size={28} color={BRAND} className="animate-spin" />
            <p style={{
              color: D.muted,
              fontSize: 14,
              fontFamily: "'Poppins', sans-serif",
            }}>Loading menu…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <span style={{ fontSize: 40, opacity: 0.2 }}>🍽️</span>
            <p style={{
              color: D.muted,
              fontSize: 14,
              marginTop: 10,
              fontFamily: "'Poppins', sans-serif",
            }}>No items found</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          {filtered.map(item => (
            <div
              key={item.id}
              onClick={() => router.push(`/guest/menu/${item.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px',
                background: D.card,
                border: `1.5px solid ${BRAND}`,
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 4px 16px ${isDark ? 'rgba(255,87,35,0.15)' : 'rgba(255,87,35,0.1)'}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* ── Image ── */}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 14,
                background: D.card2,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                overflow: 'hidden',
                position: 'relative'
              }}>
                {(item as any).imageUrl ? (
                  <Image
                    src={(item as any).imageUrl}
                    alt={item.name}
                    fill
                    sizes="80px"
                    unoptimized
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: 36 }}>{item.emoji}</span>
                )}
                {(item.tags ?? []).includes('chef') && (
                  <span style={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    background: BRAND,
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 8,
                    fontFamily: "'Poppins', sans-serif",
                  }}>Popular</span>
                )}
              </div>

              {/* ── Info ── */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 16,
                  fontWeight: 600,
                  color: D.text,
                  margin: '0 0 3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{item.name}</p>
                <p style={{
                  fontSize: 12,
                  color: D.muted,
                  margin: '0 0 8px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: "'Poppins', sans-serif",
                }}>{item.description || 'Restaurant special'}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: BRAND
                  }}>Rs. {item.price.toLocaleString()}</span>
                  <button
                    onClick={e => handleAdd(item, e)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: added[item.id] ? '#e64a1a' : BRAND,
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: added? "1" : "0.5",
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxShadow: added[item.id] ? 'none' : '0 3px 10px rgba(255,87,35,0.3)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = added[item.id] ? 'none' : '0 3px 10px rgba(255,87,35,0.3)';
                    }}
                    onMouseEnter={(e) => {
                      if (!added[item.id]) {
                        e.currentTarget.style.background = '#e64a1a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!added[item.id]) {
                        e.currentTarget.style.background = BRAND;
                      }
                    }}
                  >
                     <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />

      {/* ── Sticky cart bar ── */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 82,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 40px)',
          maxWidth: 440,
          zIndex: 99
        }}>
          <button
            onClick={() => router.push('/guest/cart')}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 26,
              background: BRAND,
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              boxShadow: '0 8px 24px rgba(255,87,35,0.4)',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,87,35,0.3), 0 8px 24px rgba(255,87,35,0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,87,35,0.4)';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e64a1a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BRAND;
            }}
          >
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 13,
              fontFamily: "'Poppins', sans-serif",
            }}>{cartCount}</span>
            <span>View Cart</span>
            <ShoppingCart size={18} />
          </button>
        </div>
      )}

      <style>{`
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: ${D.muted};
          opacity: 0.7;
        }
        .searchInput:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100dvh',
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Poppins', sans-serif",
      }}>
        <Loader2 size={28} color="#ff5723" className="animate-spin" />
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}