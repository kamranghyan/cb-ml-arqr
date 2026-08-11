'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Heart, Plus } from 'lucide-react';
import { useFavoritesStore } from '@/lib/favorites-store';
import { useCartStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import BottomNav from '@/components/guest/BottomNav';
import Image from 'next/image';

/**
 * Favorites page — no Figma was provided for this one. Built to match the
 * established visual language from the other sections: same header pattern
 * as Cart ("Your Cart (N)" → "Favorites (N)"), same borderless list-row
 * style as Cart's items, same empty-state pattern as Cart/Tracking.
 *
 * Backed by the new favorites-store (src/lib/favorites-store.ts), a small
 * persisted client store — there's no backend favorites endpoint, so this
 * is entirely local to the guest's device/browser for now.
 */

const BRAND = '#ff5723';

export default function FavoritesPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { items, removeFavorite } = useFavoritesStore();
  const { addItem } = useCartStore();

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B',
  };

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '52px 20px 16px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND, padding: 4, display: 'flex' }} aria-label="Back">
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND, margin: 0 }}>Favorites</h1>
          <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700, color: BRAND }}>({items.length})</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 120px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Heart size={48} color={BRAND} strokeWidth={1.5} style={{ opacity: 0.25 }} />
            <p style={{ color: D.muted, fontSize: 14, marginTop: 16 }}>No favorites yet</p>
            <p style={{ color: D.muted, fontSize: 12, marginTop: 4 }}>Tap the heart on any dish to save it here.</p>
            <button onClick={() => router.push('/guest/menu')}
              style={{ marginTop: 20, padding: '10px 24px', borderRadius: 24, background: BRAND, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Browse Menu
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div onClick={() => router.push(`/guest/menu/${item.id}`)}
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
                  }}>
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="84px"
                      unoptimized
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    item.emoji
                  )}
                </div>
                <div onClick={() => router.push(`/guest/menu/${item.id}`)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 600, color: BRAND, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, fontWeight: 700, color: D.text, margin: 0 }}>Rs. {item.price.toLocaleString()}</p>
                </div>
                <button onClick={() => addItem({ menuItemId: item.id, name: item.name, emoji: item.emoji, price: item.price, quantity: 1, options: {} })}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: BRAND, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  aria-label="Add to cart">
                  <Plus size={17} />
                </button>
                <button onClick={() => removeFavorite(item.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND, flexShrink: 0, padding: 2, display: 'flex' }}
                  aria-label="Remove from favorites">
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