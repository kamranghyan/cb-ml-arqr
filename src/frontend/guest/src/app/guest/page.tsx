// /app/guest/page.tsx

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronRight, Star, Plus, Loader2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import {
  fetchMenuItems,
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

// Placeholder data
const PLACEHOLDER_CUISINE_TAGS = ['Sandwiches', 'Chinese', 'Thai Seafood', 'Beverages'];
const PLACEHOLDER_HOURS = '10:00AM – 11:00PM';
const PLACEHOLDER_RATING = '4.8/5 (100+)';
const PLACEHOLDER_DELIVERY = 'Free Delivery';
const STATIC_RESTAURANT_NAME = 'Cheezious';
const STATIC_TAGLINE = '';
const STATIC_IMAGE = '/images/menu/Restaurant-banner.avif';

function GuestContent() {
  const params = useSearchParams();
  const { isDark } = useTheme();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const qrRid = params.get('rid') || '';
  const tid = params.get('tid') || '';

  // ✅ State for table number
  const [tableNumber, setTableNumber] = useState<string>('');

  // ✅ State with static fallback values
  const [restaurantImage, setRestaurantImage] = useState('');
  const [restName, setRestName] = useState(STATIC_RESTAURANT_NAME);
  const [tagline, setTagline] = useState(STATIC_TAGLINE);
  const [zone, setZone] = useState('Main Hall');
  const [items, setItems] = useState<ApiMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null);
  const { addItem } = useCartStore();
  const [search, setSearch] = useState('');


  useEffect(() => {
    // ── 🔥 FORCE: Pehle se stored table number clear karein ──
    sessionStorage.removeItem('lm_table');
    console.log('🗑️ Cleared old lm_table from session');

    // ── Store IDs in session ──
    if (qrRid) sessionStorage.setItem('lm_rid', qrRid);
    if (tid) sessionStorage.setItem('lm_tid', tid);

    const rid = qrRid;
    if (!rid) {
      console.warn('⚠️ No restaurant ID found in URL');
      setLoading(false);
      return;
    }

    // ── ✅ FIX: Correct API endpoint use karein ──
    const fetchTableDetails = async () => {
      try {
        if (rid) {
          console.log('🔍 Fetching all tables for restaurant:', rid);

          // ✅ CORRECT ENDPOINT
          const res = await fetch(`/api/menu/restaurants/${rid}/tables`);
          console.log('📡 Response status:', res.status);

          if (res.ok) {
            const data = await res.json();
            console.log('✅ All tables response:', data);

            // 🔥 Extract tables array
            const tables = data.tables || data.data || [];
            console.log('📋 Total tables:', tables.length);

            // Find matching table by tableId
            const matchedTable = tables.find((t: any) => t.tableId === tid);

            if (matchedTable) {
              console.log('✅ Matched table:', matchedTable);

              let tableNumFormatted = matchedTable.tableNumber;
              if (!tableNumFormatted.startsWith('T-')) {
                const num = tableNumFormatted.replace(/[^0-9]/g, '');
                if (num) {
                  tableNumFormatted = `T-${num.padStart(2, '0')}`;
                }
              }

              // ✅ Set table number
              sessionStorage.setItem('lm_table', tableNumFormatted);
              setTableNumber(tableNumFormatted);
              console.log('✅ Table number set from API:', tableNumFormatted);

              if (matchedTable.zone) {
                setZone(matchedTable.zone);
                console.log('✅ Zone set from API:', matchedTable.zone);
              }
              return; // ✅ API se mil gaya
            } else {
              console.warn('⚠️ No table found with tableId:', tid);
              console.log('📋 Available tableIds:', tables.map((t: any) => t.tableId));
            }
          } else {
            console.warn('⚠️ API returned error status:', res.status);
          }
        }
      } catch (err) {
        console.error('❌ Failed to fetch tables:', err);
      }

      // ── ❌ FALLBACK ──
      console.log('⚠️ API failed, using fallback...');

      let tableNumFromSession = '';

      // URL se check karein
      const urlTableNum = params.get('table') || params.get('tableNumber') || '';
      if (urlTableNum) {
        if (urlTableNum.startsWith('T-')) {
          tableNumFromSession = urlTableNum;
        } else {
          const num = urlTableNum.replace(/[^0-9]/g, '');
          if (num) {
            tableNumFromSession = `T-${num.padStart(2, '0')}`;
          }
        }
      }

      // tid se extract karein
      if (!tableNumFromSession && tid) {
        const match = tid.match(/[Tt](?:able)?[-_]?(\d+)/);
        if (match) {
          tableNumFromSession = `T-${match[1].padStart(2, '0')}`;
        }
      }

      // Last resort
      if (!tableNumFromSession) {
        console.warn('⚠️ No table number found. Using default T-01');
        tableNumFromSession = 'T-01';
      }

      sessionStorage.setItem('lm_table', tableNumFromSession);
      setTableNumber(tableNumFromSession);
      console.log('⚠️ Table number set from fallback:', tableNumFromSession);
    };

    // ── Fetch Restaurant Data ──
    const fetchRestaurantData = async () => {
      try {
        console.log('🏪 Fetching restaurant by ID:', rid);
        const restaurant = await fetchRestaurantById(rid);
        console.log('✅ Restaurant response:', restaurant);
        if (restaurant) {
          setRestaurantData(restaurant);
          if (restaurant.name?.trim()) {
            setRestName(restaurant.name.trim());
          }
          const description = (restaurant as RestaurantData & { description?: string }).description;
          if (description?.trim()) {
            setTagline(description.trim());
          }
          if (restaurant.bannerUrl?.trim()) {
            setRestaurantImage(restaurant.bannerUrl.trim());
          }
        }
      } catch (err) {
        console.error('❌ Failed to fetch restaurant:', err);
      }
    };

    // ── Fetch Menu Data ──
    const fetchMenuData = async () => {
      try {
        const [itemsData, categoriesData] = await Promise.all([
          fetchMenuItems(rid),
          fetchCategories(rid),
        ]);
        const activeItems = itemsData.filter(
          (item) => item.status !== 'inactive'
        );
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
        console.log('🍔 ALL ITEMS:', itemsData.length);
        console.log('📂 ALL CATEGORIES:', categoriesData.length);
        console.log('✅ VISIBLE CATEGORIES:', visibleCategories.length);
      } catch (err) {
        console.error('❌ Failed to fetch menu data:', err);
        setItems([]);
        setCategories([]);
      }
    };

    // ── Fetch All Data ──
    const fetchAllData = async () => {
      setLoading(true);
      await fetchTableDetails(); // ✅ Correct endpoint se table number set hoga
      await Promise.all([fetchRestaurantData(), fetchMenuData()]);
      setLoading(false);
      console.log('✅ All data fetching complete!');
      console.log('📋 Final table number in session:', sessionStorage.getItem('lm_table'));
      console.log('📋 Final table number in state:', tableNumber);
    };

    fetchAllData();
  }, [qrRid, tid, params]);

  const menuUrl = `/guest/menu?rid=${qrRid}&tid=${tid}`;

  const popular = items.filter(i => i.status !== 'inactive').slice(0, 7);

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280', input: '#242424',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', sub: '#9CA3AF', input: '#FFFFFF',
  };

  const filteredSearch = items.filter(i =>
    i.status !== 'inactive' &&
    (i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.description ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const displayName = restName || STATIC_RESTAURANT_NAME;
  const displayTagline = tagline || STATIC_TAGLINE;

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
      youtube: '/images/social/youtube.png',
      linkedin: '/images/social/linkedIn.png',
      tiktok: '/images/social/tiktok.png',
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
      fontFamily: "'Poppins', sans-serif",
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background 0.25s'
    }}>
      <GuestTopBar />

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
          backgroundImage: `url(${restaurantData?.bannerUrl?.trim() || STATIC_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}>
          <p style={{
            fontFamily: "'Poppins', sans-serif",
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
            <h1 style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 800,
              fontSize: 23,
              color: '#fff',
              margin: '0 0 4px'
            }}>
              {displayName}
            </h1>

            {displayTagline && (
              <p style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.95)',
                margin: '0 0 6px',
                fontStyle: 'italic',
                fontFamily: "'Poppins', sans-serif",
                letterSpacing: 0.3,
              }}>
                {displayTagline}
              </p>
            )}

            {restaurantData?.address && (
              <p style={{
                fontSize: 12.5,
                color: 'rgba(255,255,255,0.92)',
                margin: '0 0 4px',
                lineHeight: 1.5,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {restaurantData.address.street}
                {restaurantData.address.city && `, ${restaurantData.address.city}`}
                {restaurantData.address.country && `, ${restaurantData.address.country}`}
              </p>
            )}

            <p style={{
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.92)',
              margin: '0 0 4px',
              fontFamily: "'Poppins', sans-serif",
            }}>
              {
                restaurantData?.cuisineTags?.length
                  ? restaurantData.cuisineTags.join(' | ')
                  : PLACEHOLDER_CUISINE_TAGS.join(' | ')
              }
            </p>

            <p style={{
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.92)',
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}>
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
                <SocialIcon platform="instagram" url={restaurantData.socialMedia.instagram} />
                <SocialIcon platform="facebook" url={restaurantData.socialMedia.facebook} />
                <SocialIcon platform="youtube" url={restaurantData.socialMedia.youtube} />
                <SocialIcon platform="linkedin" url={restaurantData.socialMedia.linkedin} />
                <SocialIcon platform="tiktok" url={restaurantData.socialMedia.tiktok} />
                <SocialIcon platform="x" url={restaurantData.socialMedia.x} />
              </div>
            )}
          </div>

          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              <Star size={13} fill="#fff" color="#fff" />
              <span style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {
                  restaurantData?.ratingValue
                    ? `${restaurantData.ratingValue}/5 (${restaurantData.ratingCount ?? 0}+)`
                    : PLACEHOLDER_RATING
                }
              </span>
            </div>
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
              <span style={{
                fontSize: 12.5,
                color: '#fff',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {restaurantData?.deliveryNote || PLACEHOLDER_DELIVERY}
              </span>
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
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: D.sub, transition: 'all 0.2s ease', outline: 'none', padding: '4px 8px', borderRadius: 6 }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
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
                    background: 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
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
                    <p style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: D.text,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Poppins', sans-serif",
                    }}>{item.name}</p>
                    <p style={{
                      fontSize: 12,
                      color: D.muted,
                      margin: '2px 0 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Poppins', sans-serif",
                    }}>{item.description || 'Restaurant special'}</p>
                  </div>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: BRAND,
                    flexShrink: 0,
                    fontFamily: "'Poppins', sans-serif",
                  }}>Rs. {item.price.toLocaleString()}</span>
                </Link>
              ))}
              {filteredSearch.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p style={{
                    fontSize: 13,
                    color: D.muted,
                    margin: 0,
                    fontFamily: "'Poppins', sans-serif",
                  }}>No items found for "{search}"</p>
                </div>
              )}
              {filteredSearch.length > 6 && (
                <Link href={`${menuUrl}&q=${encodeURIComponent(search)}`}
                  style={{ display: 'block', padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: BRAND, textDecoration: 'none', borderTop: `1px solid ${D.border}`, fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => setSearch('')}>
                  See all results →
                </Link>
              )}
            </div>
          )}

          {/* Promo banner */}
          <div style={{ borderRadius: 20, background: isDark ? '#2A1A1A' : '#ffbca7', padding: '22px 20px', marginTop: 20, marginBottom: 24 }}>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: isDark ? '#fbbf24' : '#3a1a10',
              margin: '0 0 6px'
            }}>Limited Time</p>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 26,
              fontWeight: 800,
              color: BRAND,
              margin: '0 0 6px'
            }}>Special Today</p>
            <p style={{
              fontSize: 13.5,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(58,26,16,0.75)',
              margin: '0 0 16px',
              fontFamily: "'Poppins', sans-serif",
            }}>Exclusive Table experience</p>
            <Link href={menuUrl} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: BRAND,
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 24,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e64a1a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = BRAND;
              }}
            >
              Order Now <ChevronRight size={16} />
            </Link>
          </div>

          {/* Categories */}
          <h2
            style={{
              fontFamily: "'Poppins', sans-serif",
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
                      fontFamily: "'Poppins', sans-serif",
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
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = `0 4px 12px rgba(255,87,35,0.2)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
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
                          fontFamily: "'Poppins', sans-serif",
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
          <h2 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: D.text,
            margin: '0 0 16px'
          }}>Popular Today</h2>

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
                  style={{
                    display: 'flex',
                    gap: 16,
                    padding: 16,
                    background: D.card,
                    border: `1.5px solid ${BRAND}`,
                    borderRadius: 20,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
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
                  <div style={{
                    width: 100,
                    height: 100,
                    borderRadius: 14,
                    background: D.card2,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                    overflow: 'hidden'
                  }}>
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
                    <p style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 19,
                      fontWeight: 700,
                      color: D.text,
                      margin: '0 0 6px'
                    }}>{item.name}</p>
                    <p style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 16,
                      fontWeight: 700,
                      color: BRAND,
                      margin: '0 0 6px'
                    }}>Rs. {item.price.toLocaleString()}</p>
                    <p style={{
                      fontSize: 13,
                      color: D.text,
                      margin: 0,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {item.description || 'Restaurant special'}
                    </p>
                  </div>
                  <button
                    onClick={e => {
                      e.preventDefault();
                      addItem({
                        menuItemId: item.id,
                        name: item.name,
                        emoji: item.emoji ?? '🍽️',
                        price: item.price,
                        quantity: 1,
                        options: {},
                        imageUrl: (item as any).imageUrl || '',
                      });
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: BRAND,
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      alignSelf: 'flex-end',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(255,87,35,0.35)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,87,35,0.3), 0 2px 8px rgba(255,87,35,0.35)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,87,35,0.35)';
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e64a1a';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = BRAND;
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
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
      <GuestContent />
    </Suspense>
  );
}