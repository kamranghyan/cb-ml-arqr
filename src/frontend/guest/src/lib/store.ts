// lib/store.ts

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
  updateAddOnQuantity: (itemId: string, addOnId: string, quantity: number) => void;

  subtotal: () => number;
  serviceCharge: () => number;
  tax: () => number;
  total: () => number;
  itemCount: () => number;
  
  // ✅ NEW: Add-ons total alag se calculate karne ke liye
  addOnsTotal: () => number;
  itemsTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  tableNumber: '07',
  outlet: 'Main Hall',

  setTable: (tableNumber, outlet) => set({ tableNumber, outlet }),

  addItem: (item) => {
    const id = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    set((s) => {
      // ✅ Normalized JSON comparison for exact option matching
      const existing = s.items.find((i) => {
        if (i.menuItemId !== item.menuItemId) return false;
        return JSON.stringify(i.options) === JSON.stringify(item.options);
      });

      if (existing) {
        return {
          items: s.items.map((i) =>
            i.id === existing.id
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          ),
        };
      }
      
      // ✅ Ensure addOns are properly stored
      const newItem = { 
        ...item, 
        id,
        options: {
          ...item.options,
          addOns: item.options?.addOns || [],
          addOnIds: item.options?.addOnIds || [],
        }
      };
      
      console.log('🛒 Adding item:', newItem); // Debug
      
      return { items: [...s.items, newItem] };
    });
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

  updateAddOnQuantity: (itemId: string, addOnId: string, quantity: number) => {
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== itemId) return item;

        const updatedAddOns = (item.options?.addOns || [])
          .map((addon) =>
            addon.addOnId === addOnId ? { ...addon, quantity } : addon
          )
          .filter((addon) => ((addon as { quantity?: number }).quantity ?? 0) > 0);

        return {
          ...item,
          options: {
            ...item.options,
            addOns: updatedAddOns,
          },
        };
      }),
    }));
  },

  clearCart: () => set({ items: [] }),

  // ✅ Base items total (without add-ons)
  itemsTotal: () => {
    const items = get().items;
    let total = 0;
    
    for (const item of items) {
      total += item.price * item.quantity;
    }
    return Math.round(total);
  },

  // ✅ Add-ons total (only add-ons)
  addOnsTotal: () => {
    const items = get().items;
    let total = 0;
    
    for (const item of items) {
      if (item.options?.addOns) {
        const addOnsTotal = item.options.addOns.reduce(
          (sum, a) =>
            sum +
            (a.priceMinorUnits / 100) *
              ((a as { quantity?: number }).quantity || 1),
          0
        );
        total += addOnsTotal * item.quantity;
      }
    }
    return Math.round(total);
  },

  // ✅ Subtotal (items + add-ons)
  subtotal: () => {
    return get().itemsTotal() + get().addOnsTotal();
  },

  serviceCharge: () => Math.round(get().subtotal() * 0.05),

  tax: () => Math.round(get().subtotal() * 0.15),

  total: () => get().subtotal() + get().serviceCharge() + get().tax(),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));