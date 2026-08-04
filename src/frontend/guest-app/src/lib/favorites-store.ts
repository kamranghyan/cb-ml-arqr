'use client';

/**
 * favorites-store.ts
 * ===================
 * Guest-side "favorites" — lets a guest heart a menu item on the Item Detail
 * page and see it again on the Favorites page.
 *
 * There's no backend support for favorites at all yet (no endpoint, no
 * guest account to attach them to), so this is a self-contained client
 * store, persisted to localStorage so a guest's favorites survive a
 * refresh within the same device/browser. Stores a small snapshot of each
 * item (name/price/emoji/image) rather than just an id, so the Favorites
 * page doesn't need a second network round-trip to render — the tradeoff
 * is that a favorited item's displayed price/name won't update if the
 * menu changes later. Reasonable for this scope; worth revisiting once
 * there's a real backend-favorites endpoint.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  imageUrl?: string | null;
  description?: string;
}

interface FavoritesStore {
  items: FavoriteItem[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
  removeFavorite: (id: string) => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      items: [],

      isFavorite: (id) => get().items.some((i) => i.id === id),

      toggleFavorite: (item) =>
        set((s) =>
          s.items.some((i) => i.id === item.id)
            ? { items: s.items.filter((i) => i.id !== item.id) }
            : { items: [...s.items, item] }
        ),

      removeFavorite: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    }),
    { name: 'menulay_favorites' }
  )
);