'use client';

import { Store, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Branch } from '@/lib/tenant-api';
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  chipText: isDark ? '#9CA3AF' : '#000000', // ✅ Chip text color
  labelText: isDark ? '#9CA3AF' : '#000000', // ✅ Label text color
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
});

export default function BranchPicker({
  branches,
  value,
  onChange,
  loading = false,
  allowAll = true,
}: {
  branches: Branch[];
  value: string;                 // '' means all branches
  onChange: (restaurantId: string) => void;
  loading?: boolean;
  allowAll?: boolean;
}) {
  const [isDark, setIsDark] = useState(false);

  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };
    
    updateTheme();
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);
    
    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  const colors = getColors(isDark);

  // ── Loading State ──
  if (loading) {
    return (
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          color: colors.muted,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
          Loading your restaurants…
        </span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // ── Empty State ──
  if (branches.length === 0) {
    return (
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          color: colors.subtle,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <Store size={15} />
        <span style={{ fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
          No restaurants yet — add one to start taking orders.
        </span>
      </div>
    );
  }

  // With a single branch there is nothing to choose.
  if (branches.length === 1 && !allowAll) return null;

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flexWrap: 'wrap',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 16,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: colors.labelText, // ✅ Light: Black, Dark: #9CA3AF
          flexShrink: 0,
        }}
      >
        <Store size={15} color={colors.labelText} /> {/* ✅ Store icon bhi black */}
        <span 
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontFamily: "'Poppins', sans-serif",
            color: colors.labelText, // ✅ Light: Black, Dark: #9CA3AF
          }}
        >
          Restaurant
        </span>
      </div>

      <div 
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          flex: 1,
        }}
      >
        {allowAll && (
          <Chip 
            active={value === ''} 
            onClick={() => onChange('')}
            colors={colors}
          >
            All branches
          </Chip>
        )}
        {branches.map(b => (
          <Chip
            key={b.restaurantId}
            active={value === b.restaurantId}
            onClick={() => onChange(b.restaurantId)}
            colors={colors}
          >
            {b.name}
            {!b.isActive && (
              <span style={{ opacity: 0.6, fontWeight: 500 }}>
                {' '}· closed
              </span>
            )}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ── Chip Component ──
function Chip({ 
  active, 
  onClick, 
  children,
  colors,
}: {
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 9999,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
        fontFamily: "'Poppins', sans-serif",
        border: 'none',
        outline: 'none',
        background: active ? BRAND : colors.card2,
        color: active ? '#FFFFFF' : colors.chipText, // ✅ Light: Black, Dark: #9CA3AF
        boxShadow: active 
          ? `0 0 16px rgba(255,87,35,0.25)` 
          : 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = active 
          ? `0 0 16px rgba(255,87,35,0.25), 0 0 0 3px ${colors.focusRing}`
          : `0 0 0 3px ${colors.focusRing}`;
        if (!active) {
          e.currentTarget.style.color = colors.chipText;
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = active 
          ? `0 0 16px rgba(255,87,35,0.25)` 
          : 'none';
        if (!active) {
          e.currentTarget.style.color = colors.chipText;
        }
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = colors.hoverBg;
          e.currentTarget.style.color = colors.chipText;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = colors.card2;
          e.currentTarget.style.color = colors.chipText;
        }
      }}
    >
      {children}
    </button>
  );
}