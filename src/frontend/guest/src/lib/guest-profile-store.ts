'use client';

/**
 * guest-profile-store.ts
 * =======================
 * Lightweight persisted "who is this guest" info — just a name and phone
 * number the guest can optionally fill in once (on the Profile page, or at
 * Checkout) and have reused the other place, so they're not retyping it
 * every order.
 *
 * There's no guest account system in this app (guests are anonymous,
 * scoped only by the QR code they scanned — see guest-scope.ts), so this
 * is intentionally minimal: local to the device/browser, same pattern as
 * favorites-store.ts, not tied to any backend identity.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GuestProfileStore {
  fullName: string;
  phone: string;
  setFullName: (v: string) => void;
  setPhone: (v: string) => void;
}

export const useGuestProfileStore = create<GuestProfileStore>()(
  persist(
    (set) => ({
      fullName: '',
      phone: '',
      setFullName: (fullName) => set({ fullName }),
      setPhone: (phone) => set({ phone }),
    }),
    { name: 'menulay_guest_profile' }
  )
);