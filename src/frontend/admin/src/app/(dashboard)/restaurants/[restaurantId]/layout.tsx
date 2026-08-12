'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ArrowLeft, UtensilsCrossed, Tags, Grid3x3, QrCode, Loader2 } from 'lucide-react';
import { fetchRestaurant, type ApiRestaurant } from '@/lib/admin-api';
import { useTheme } from '@/hooks/useTheme';

const BRAND = '#ff5723';

// Theme colors
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFF8F1',
  card: isDark ? '#1C1C1C' : '#ffffff',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  text: isDark ? '#F5F0E8' : '#1A1A1A',
  muted: isDark ? '#9CA3AF' : '#687780',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  success: isDark ? '#4ade80' : '#0F9D58',
  brand: BRAND,
  brandHover: '#e04a1a',
});

const TABS = [
  { seg: 'menu',       label: 'Menu Items', icon: UtensilsCrossed },
  { seg: 'categories', label: 'Categories', icon: Tags },
  { seg: 'tables',     label: 'Tables',     icon: Grid3x3 },
  { seg: 'qr',         label: 'QR Codes',   icon: QrCode },
];

export default function BranchLayout({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
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
    <div style={{ 
      background: colors.bg,
      minHeight: '100vh',
    }}>
      {/* Branch header */}
      <div style={{
        background: colors.card,
        borderBottom: `1px solid ${colors.border}`,
        padding: '16px 24px 0',
      }}>
        <Link href="/restaurants" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 13,
          color: colors.muted,
          textDecoration: 'none',
          marginBottom: 10,
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = colors.brand;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.muted;
        }}>
          <ArrowLeft size={14} /> All restaurants
        </Link>

        <div style={{ 
          display: 'flex', 
          alignItems: 'baseline', 
          gap: 10, 
          marginBottom: 14,
          flexWrap: 'wrap',
        }}>
          <h1 style={{ 
            fontSize: 'clamp(18px, 2.5vw, 22px)',
            fontWeight: 800,
            color: colors.text,
            margin: 0,
          }}>
            {loading
              ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              : restaurant?.name ?? 'Restaurant'}
          </h1>
          {restaurant && (
            <>
              <span style={{ 
                fontSize: 13, 
                color: colors.muted,
              }}>
                {restaurant.address?.city}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: restaurant.isActive ? colors.success : colors.subtle,
              }}>
                {restaurant.isActive ? '● open' : '● closed'}
              </span>
            </>
          )}
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: 4,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          <style>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {TABS.map(({ seg, label, icon: Icon }) => {
            const href   = `/restaurants/${restaurantId}/${seg}`;
            const active = pathname.endsWith(`/${seg}`);
            return (
              <Link key={seg} href={href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? colors.brand : colors.muted,
                borderBottom: active ? `2px solid ${colors.brand}` : `2px solid transparent`,
                marginBottom: -1,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = colors.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = colors.muted;
                }
              }}>
                <Icon size={15} /> {label}
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
        }
      `}</style>
      {children}
    </div>
  );
}