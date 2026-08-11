// /app/guest/page.tsx

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronRight, Star, Truck, Plus, Loader2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import {
  fetchMenuItems,
  fetchRestaurants,
  fetchCategories,
  type ApiMenuItem,
  type RestaurantData,
  fetchRestaurantById,
  ApiCategory
} from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';
import GuestTopBar from '@/components/guest/GuestTopBar';
import BottomNav from '@/components/guest/BottomNav';
import Image from 'next/image';

const BRAND = '#ff5723';

// ── Placeholder data ───────────────────────────────────────────────────────────
const PLACEHOLDER_CUISINE_TAGS = ['Sandwiches', 'Chinese', 'Thai Seafood', 'Beverages'];
const PLACEHOLDER_HOURS = '10:00AM – 11:00PM';
const PLACEHOLDER_RATING = '4.8/5 (100+)';
const PLACEHOLDER_DELIVERY = 'Free Delivery';

// ✅ Static fallback values
const STATIC_RESTAURANT_NAME = 'Cheezious';
const STATIC_TAGLINE = 'Fine Dining Experience';
const STATIC_IMAGE = '/images/menu/Restaurant-banner.avif';

const CAT_EMOJI: Record<string, string> = {
  all: '🍽️', starters: '🥗', mains: '🍽️', desserts: '🍰', beverages: '🥤',
  drinks: '🥤', coffee: '☕', hot: '☕', iced: '🧊', pizza: '🍕',
  burgers: '🍔', pasta: '🍝', seafood: '🐟', grill: '🔥', soup: '🍜',
  bread: '🍞', cake: '🎂', other: '🍽️',
};
function getCatEmoji(cat: string) {
  const c = cat.toLowerCase();
  for (const [k, v] of Object.entries(CAT_EMOJI)) if (c.includes(k)) return v;
  return '🍽️';
}

function GuestContent() {
  const params = useSearchParams();
  const { isDark } = useTheme();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const qrRid = params.get('rid') || '';
  const tid = params.get('tid') || '';
  const tableNum = tid.replace(/^[Tt](?:able[-_]?)?/, '').replace(/\D/g, '') || '—';

  // ✅ State with static fallback values
  const [restaurantImage, setRestaurantImage] = useState('');
  const [restName, setRestName] = useState(STATIC_RESTAURANT_NAME);
  const [zone, setZone] = useState('Main Hall');
  const [items, setItems] = useState<ApiMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null);
  const { addItem } = useCartStore();
  const [search, setSearch] = useState('');


  useEffect(() => {
    const n = parseInt(tableNum, 10);
    setZone(n >= 11 ? 'Private Dining' : n >= 9 ? 'Garden Terrace' : 'Main Hall');
    if (qrRid) sessionStorage.setItem('lm_rid', qrRid);
    if (tid) sessionStorage.setItem('lm_tid', tid);
    if (tableNum !== '—') sessionStorage.setItem('lm_table', tableNum);

    const rid = qrRid;
    if (!rid) {
      console.warn('⚠️ No restaurant ID found in URL');
      setLoading(false);
      return;
    }

    // ✅ Fetch Restaurant Data
    const fetchRestaurantData = async () => {
      try {
        console.log('🏪 Fetching restaurant by ID:', rid);

        const restaurant = await fetchRestaurantById(rid);

        console.log('✅ Restaurant response:', restaurant);

        if (restaurant) {
          setRestaurantData(restaurant);

          // ✅ Restaurant hero image comes from bannerUrl
          if (restaurant.bannerUrl?.trim()) {
            setRestaurantImage(restaurant.bannerUrl);
          }
        }
      } catch (err) {
        console.error('❌ Failed to fetch restaurant:', err);
      }
    };

    const fetchMenuData = async () => {
      try {
        const [itemsData, categoriesData] = await Promise.all([
          fetchMenuItems(rid),
          fetchCategories(rid),
        ]);

        // Only active items should make a category visible
        const activeItems = itemsData.filter(
          (item) => item.status !== 'inactive'
        );

        // Get category IDs/names that actually contain items
        const usedCategoryIds = new Set(
          activeItems
            .map((item) => item.categoryId?.trim())
            .filter(Boolean)
        );

        const usedCategoryNames = new Set(
          activeItems
            .map((item) => item.categoryName?.trim().toLowerCase())
            .filter(Boolean)
        );

        // Only keep categories that have at least one item
        const visibleCategories = categoriesData.filter((category) => {
          const categoryId = category.categoryId?.trim() || '';

          const categoryName = category.name?.trim().toLowerCase();

          return (
            (categoryId && usedCategoryIds.has(categoryId)) ||
            (categoryName && usedCategoryNames.has(categoryName))
          );
        });

        setItems(itemsData);
        setCategories(visibleCategories);

        console.log('🍔 ALL ITEMS:', itemsData);
        console.log('📂 ALL CATEGORIES:', categoriesData);
        console.log('✅ VISIBLE CATEGORIES:', visibleCategories);

      } catch (err) {
        console.error('❌ Failed to fetch menu data:', err);

        setItems([]);
        setCategories([]);
      }
    };

    // ✅ Fetch both in parallel
    Promise.all([fetchRestaurantData(), fetchMenuData()])
      .finally(() => {
        console.log('✅ All data fetching complete!');
        setLoading(false);
      });

  }, [qrRid, tid, tableNum]);



  const isQrScan = params.has('rid') && params.has('tid');
  const menuUrl = `/guest/menu?rid=${qrRid}&tid=${tid}`;

  const cats = categories.map(c => ({
    id: c.categoryId,
    name: c.name,
    imageUrl: c.imageUrl,
  }));

  console.log("FINAL CATEGORIES:", categories);
  console.log("ITEMS:", items);
  console.log("CATEGORIES:", categories);

  // Popular = first 4 items
  const popular = items.filter(i => i.status !== 'inactive').slice(0, 7);

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
  const guestUrl = `/guest?rid=${qrRid}&tid=${tid}`;

  // ✅ Display name: Restaurant Name or Static
  const displayName = restName || STATIC_RESTAURANT_NAME;

  function getSocialUrl(url?: string | null) {
    if (!url?.trim()) return null;

    const value = url.trim();

    return /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;
  }
  function SocialIcon({
    platform,
    url,
  }: {
    platform: string;
    url?: string | null;
  }) {
    const socialUrl = getSocialUrl(url);

    if (!socialUrl) return null;

    const icons: Record<string, string> = {
      instagram: '/images/social/instagram.png',
      facebook: '/images/social/facebook.png',
      youtube: '/images/social/X.png',
      linkedin: '/images/social/linkedIn.png',
      tiktok: '/images/social/X.png',
      x: '/images/social/x.png',
    };

    const icon = icons[platform];

    if (!icon) return null;

    return (
      <a
        href={socialUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={platform}
        style={{
          width: 32,
          height: 32,
          minWidth: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.opacity = '0.85';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.opacity = '1';
        }}
      >
        <Image
          src={icon}
          alt={platform}
          width={26}
          height={26}
          style={{
            width: 26,
            height: 26,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </a>
    );
  }

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
          aspectRatio: '14 / 7',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: `url(${restaurantData?.bannerUrl?.trim() || STATIC_IMAGE
            })`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}>
          <p style={{
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 800,
            fontSize: 32,
            color: '#fff',
            textAlign: 'center',
            letterSpacing: 1,
            margin: 0,
            textTransform: 'uppercase',
            padding: '0 24px',
            position: 'relative',
            zIndex: 2,
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}>
            {displayName}
          </p>
        </div>

        {/* ── Restaurant info strip ────────────────────────────────────────── */}
        <div style={{ background: BRAND, padding: '20px 20px 22px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 23, color: '#fff', margin: '0 0 6px' }}>
              {displayName}
            </h1>

            {/* ✅ Show address from API if available */}
            {restaurantData?.address && (
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.92)', margin: '0 0 4px', lineHeight: 1.5 }}>
                {restaurantData.address.street}
                {restaurantData.address.city && `, ${restaurantData.address.city}`}
                {restaurantData.address.country && `, ${restaurantData.address.country}`}
              </p>
            )}

            <p style={{
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.92)',
              margin: '0 0 4px'
            }}>
              {
                restaurantData?.cuisineTags?.length
                  ? restaurantData.cuisineTags.join(' | ')
                  : PLACEHOLDER_CUISINE_TAGS.join(' | ')
              }
            </p>

            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              Open: {
                restaurantData?.openingHours || PLACEHOLDER_HOURS
              }
            </p>
            {restaurantData?.socialMedia && (
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  maxWidth: '100%',
                }}
              >
                <SocialIcon
                  platform="instagram"
                  url={restaurantData.socialMedia.instagram}
                />

                <SocialIcon
                  platform="facebook"
                  url={restaurantData.socialMedia.facebook}
                />

                <SocialIcon
                  platform="youtube"
                  url={restaurantData.socialMedia.youtube}
                />

                <SocialIcon
                  platform="linkedin"
                  url={restaurantData.socialMedia.linkedin}
                />

                <SocialIcon
                  platform="tiktok"
                  url={restaurantData.socialMedia.tiktok}
                />

                <SocialIcon
                  platform="x"
                  url={restaurantData.socialMedia.x}
                />
              </div>
            )}
          </div>

          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              <Star size={13} fill="#fff" color="#fff" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}><span>
                {
                  restaurantData?.ratingValue
                    ?
                    `${restaurantData.ratingValue}/5 (${restaurantData.ratingCount ?? 0}+)`
                    :
                    PLACEHOLDER_RATING
                }
              </span></span>
            </div>
            ```tsx
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              <Image
                src="/images/menu/delivery.png"
                alt="Delivery"
                width={30}
                height={30}
                style={{
                  width: 30,
                  height: 30,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />

              <span style={{ fontSize: 12.5, color: '#fff' }}>
                {restaurantData?.deliveryNote || PLACEHOLDER_DELIVERY}
              </span>
            </div>
            ```

          </div>

        </div>

        {/* ── Padded content ── //*/}
        <div style={{ padding: '20px 20px 0' }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: D.sub, pointerEvents: 'none', zIndex: 1 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu.."
              className='searchInput'
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
                      ? <Image
                        src={(item as any).imageUrl}
                        alt={item.name}
                        width={44}
                        height={44}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
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
          <h2
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: D.text,
              margin: '0 0 16px',
            }}
          >
            Categories
          </h2>

          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                gap: 14,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                paddingBottom: 4,
              }}
            >
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flexShrink: 0,
                      width: 76,
                      height: 76,
                      borderRadius: 18,
                      background: D.card2,
                    }}
                  />
                ))
              ) : categories.length === 0 ? (
                <div
                  style={{
                    width: '100%',
                    padding: '20px 0',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: D.muted,
                    }}
                  >
                    No menu categories available
                  </p>
                </div>
              ) : (
                categories.map((cat) => {
                  const categoryId = cat.categoryId || '';

                  return (
                    <Link
                      key={categoryId || cat.name}
                      href={`${menuUrl}&cat=${encodeURIComponent(
                        cat.name.toLowerCase()
                      )}`}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        textDecoration: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: 18,
                          overflow: 'hidden',
                          position: 'relative',
                          border: `2px solid ${BRAND}`,
                          background: isDark
                            ? D.card2
                            : 'linear-gradient(135deg,#ffe4d8,#ffcbb3)',
                        }}
                      >
                        {cat.imageUrl ? (
                          <Image
                            src={cat.imageUrl}
                            alt={cat.name}
                            width={76}
                            height={76}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            onError={(e) => {
                              e.currentTarget.src = '/images/menu/burger.jpg';
                            }}
                          />
                        ) : (
                          <Image
                            src="/images/menu/burger.jpg"
                            alt={cat.name}
                            width={76}
                            height={76}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: 14,
                          color: D.text,
                          textAlign: 'center',
                          maxWidth: 76,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cat.name}
                      </span>
                    </Link>
                  );
                })
              )}
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
                    {(item as any).imageUrl ? (
                      <Image
                        src={(item as any).imageUrl}
                        alt={item.name}
                        width={100}
                        height={100}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                        <Image
                          src='/images/menu/pizza.jpg'
                          alt={item.name}
                          width={100}
                          height={100}
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    )}
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