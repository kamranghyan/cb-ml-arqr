'use client';

import { create } from 'zustand';
import type { CartItem } from './types';

interface CartStore {
  items: CartItem[];
  tableNumber: string;
  outlet: string;

  setTable: (table: string, outlet: string) => void;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;

  // Computed
  subtotal: () => number;
  serviceCharge: () => number;
  tax: () => number;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  tableNumber: '07',
  outlet: 'Main Hall',

  setTable: (tableNumber, outlet) => set({ tableNumber, outlet }),

  addItem: (item) => {
    const id = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ items: [...s.items, { ...item, id }] }));
  },

  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  updateQuantity: (id, qty) =>
    set((s) => ({
      items:
        qty <= 0
          ? s.items.filter((i) => i.id !== id)
          : s.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
    })),

  clearCart: () => set({ items: [] }),

  subtotal: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  serviceCharge: () => Math.round(get().subtotal() * 0.05),

  tax: () => Math.round(get().subtotal() * 0.15),

  total: () =>
    get().subtotal() + get().serviceCharge() + get().tax(),

  itemCount: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
