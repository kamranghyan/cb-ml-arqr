'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ArrowLeft, UtensilsCrossed, Tags, Grid3x3, QrCode, Loader2 } from 'lucide-react';
import { fetchRestaurant, type ApiRestaurant } from '@/lib/admin-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

const TABS = [
  { seg: 'menu',       label: 'Menu Items', icon: UtensilsCrossed },
  { seg: 'categories', label: 'Categories', icon: Tags },
  { seg: 'tables',     label: 'Tables',     icon: Grid3x3 },
  { seg: 'qr',         label: 'QR Codes',   icon: QrCode },
];

export default function BranchLayout({ children }: { children: React.ReactNode }) {
  const params       = useParams();
  const pathname     = usePathname();
  const restaurantId = String(params.restaurantId ?? '');

  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    fetchRestaurant(restaurantId)
      .then(setRestaurant)
      .catch(() => setRestaurant(null))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  return (
    <div>
      {/* Branch header */}
      <div style={{
        background: C.white, borderBottom: `1px solid ${C.border}`, padding: '16px 24px 0',
      }}>
        <Link href="/tenant/restaurants" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 13, color: C.muted, textDecoration: 'none', marginBottom: 10,
        }}>
          <ArrowLeft size={14} /> All restaurants
        </Link>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
            {loading
              ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              : restaurant?.name ?? 'Restaurant'}
          </h1>
          {restaurant && (
            <>
              <span style={{ fontSize: 13, color: C.muted }}>
                {restaurant.address?.city}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: restaurant.isActive ? C.green : C.subtle,
              }}>
                {restaurant.isActive ? '● open' : '● closed'}
              </span>
            </>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(({ seg, label, icon: Icon }) => {
            const href   = `/tenant/restaurants/${restaurantId}/${seg}`;
            const active = pathname.endsWith(`/${seg}`);
            return (
              <Link key={seg} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', textDecoration: 'none',
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? C.red : C.muted,
                borderBottom: active ? `2px solid ${C.red}` : '2px solid transparent',
                marginBottom: -1,
              }}>
                <Icon size={15} /> {label}
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {children}
    </div>
  );
}
