'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Heart, Plus } from 'lucide-react';
import { useFavoritesStore } from '@/lib/favorites-store';
import { useCartStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import BottomNav from '@/components/guest/BottomNav';

const BRAND = '#ff5723';

export default function FavoritesPage() {
  const router = useRouter();
  const { isDark } = useTheme();

  const { items, removeFavorite } = useFavoritesStore();
  const { addItem } = useCartStore();

  // Prevent Zustand persist hydration mismatch
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const D = isDark
    ? {
      bg: '#111111',
      card: '#1C1C1C',
      card2: '#242424',
      border: 'rgba(255,255,255,0.08)',
      text: '#F5F0E8',
      muted: '#9CA3AF',
    }
    : {
      bg: '#FFFFFF',
      card: '#FFFFFF',
      card2: '#F5F5F5',
      border: '#F0EBE6',
      text: '#000000',
      muted: '#6B6B6B',
    };

  const handleAddToCart = (item: (typeof items)[number]) => {
    addItem({
      menuItemId: item.id,
      name: item.name,
      emoji: item.emoji ?? '🍽️',
      imageUrl: item.imageUrl ?? undefined,
      price: item.price,
      quantity: 1,
      options: {},
    });
  };

  const handleRemoveFavorite = (id: string) => {
    removeFavorite(id);
  };

  const displayedItems = hydrated ? items : [];

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: D.bg,
        fontFamily: "'DM Sans', sans-serif",
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '52px 20px 16px' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: BRAND,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Back"
        >
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            marginTop: 8,
          }}
        >
          <h1
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontSize: 26,
              fontWeight: 700,
              color: BRAND,
              margin: 0,
            }}
          >
            Favorites
          </h1>

          <span
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: BRAND,
            }}
          >
            ({displayedItems.length})
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 120px',
        }}
      >
        {!hydrated ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              color: D.muted,
              fontSize: 14,
            }}
          >
            Loading favorites...
          </div>
        ) : displayedItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Heart
              size={48}
              color={BRAND}
              strokeWidth={1.5}
              style={{ opacity: 0.25 }}
            />

            <p
              style={{
                color: D.muted,
                fontSize: 14,
                marginTop: 16,
                marginBottom: 0,
              }}
            >
              No favorites yet
            </p>

            <p
              style={{
                color: D.muted,
                fontSize: 12,
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Tap the heart on any dish to save it here.
            </p>

            <button
              type="button"
              onClick={() => router.push('/guest/menu')}
              style={{
                marginTop: 20,
                padding: '10px 24px',
                borderRadius: 24,
                background: BRAND,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              paddingTop: 8,
            }}
          >
            {displayedItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                {/* Image */}
                <button
                  type="button"
                  onClick={() => router.push(`/guest/menu/${item.id}`)}
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 16,
                    background: D.card2,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 34,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    border: 'none',
                    padding: 0,
                  }}
                  aria-label={`View ${item.name}`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      width={84}
                      height={84}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <span>{item.emoji || '🍽️'}</span>
                  )}
                </button>

                {/* Details */}
                <button
                  type="button"
                  onClick={() => router.push(`/guest/menu/${item.id}`)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Baloo 2', sans-serif",
                      fontSize: 17,
                      fontWeight: 600,
                      color: BRAND,
                      margin: '0 0 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </p>

                  <p
                    style={{
                      fontFamily: "'Baloo 2', sans-serif",
                      fontSize: 15,
                      fontWeight: 700,
                      color: D.text,
                      margin: 0,
                    }}
                  >
                    Rs. {Number(item.price || 0).toLocaleString()}
                  </p>
                </button>

                {/* Add to cart */}
                <button
                  type="button"
                  onClick={() => handleAddToCart(item)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: BRAND,
                    border: 'none',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label={`Add ${item.name} to cart`}
                >
                  <Plus size={17} />
                </button>

                {/* Remove favorite */}
                <button
                  type="button"
                  onClick={() => handleRemoveFavorite(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: BRAND,
                    flexShrink: 0,
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label={`Remove ${item.name} from favorites`}
                >
                  <Heart size={20} fill={BRAND} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}