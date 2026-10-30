import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteItem {
  id: string;
  name: string;
  price: number;
  emoji?: string;
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

      isFavorite: (id) =>
        get().items.some((item) => item.id === id),

      toggleFavorite: (item) =>
        set((state) => {
          const exists = state.items.some(
            (favorite) => favorite.id === item.id
          );

          return exists
            ? {
                items: state.items.filter(
                  (favorite) => favorite.id !== item.id
                ),
              }
            : {
                items: [...state.items, item],
              };
        }),

      removeFavorite: (id) =>
        set((state) => ({
          items: state.items.filter(
            (item) => item.id !== id
          ),
        })),
    }),
    {
      name: 'menulay_favorites',
    }
  )
);