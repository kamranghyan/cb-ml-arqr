'use client';

import { Loader2, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000', // ✅ Light theme: Black text
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  danger: isDark ? '#ff8a5c' : '#ff5723',
  dangerBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  dangerHover: isDark ? 'rgba(255,87,35,0.25)' : 'rgba(255,87,35,0.2)',
});

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function ConfirmDeleteModal({
  open,
  title = 'Delete',
  message = 'Are you sure you want to delete this item?',
  itemName,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
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

  if (!open) return null;

  const handleConfirm = async () => {
    if (deleting) return;
    try {
      setDeleting(true);
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: colors.card,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: isDark 
            ? '0 24px 48px rgba(0,0,0,0.6)' 
            : '0 24px 48px rgba(0,0,0,0.15)',
          border: `1px solid ${colors.border}`,
          animation: 'slideUp 0.25s ease',
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: colors.dangerBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Trash2 size={21} color={colors.danger} />
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: colors.subtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              outline: 'none',
              fontFamily: "'Poppins', sans-serif",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              e.currentTarget.style.color = colors.text;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.color = colors.subtle;
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.text;
              e.currentTarget.style.background = colors.hoverBg;
            }}
            onMouseLeave={(e) => {
              if (!deleting) {
                e.currentTarget.style.color = colors.subtle;
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Content ── */}
        <h3 style={{
          fontSize: '18px',
          fontWeight: 700,
          color: colors.text, // ✅ Light: #000000, Dark: #F5F0E8
          margin: '0 0 8px 0',
          fontFamily: "'Poppins', sans-serif",
        }}>
          {title}
        </h3>

        <p style={{
          fontSize: '14px',
          color: colors.muted,
          lineHeight: 1.6,
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {message}
        </p>

        {itemName && (
          <div style={{
            marginTop: '14px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: colors.card2,
            border: `1px solid ${colors.border}`,
            fontSize: '14px',
            fontWeight: 600,
            color: colors.text, // ✅ Light: #000000, Dark: #F5F0E8
            fontFamily: "'Poppins', sans-serif",
          }}>
            {itemName}
          </div>
        )}

        {/* ── Buttons ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '24px',
        }}>
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: `1.5px solid ${colors.border}`,
              background: 'transparent',
              color: colors.text, // ✅ Light: #000000, Dark: #F5F0E8
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              fontFamily: "'Poppins', sans-serif",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = colors.border;
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.hoverBg;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onMouseLeave={(e) => {
              if (!deleting) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = colors.border;
              }
            }}
          >
            Cancel
          </button>

          {/* Delete Button - Using BRAND color */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: BRAND,
              color: '#FFFFFF', // ✅ Always white on BRAND background
              fontSize: '13px',
              fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer',
              minWidth: '100px',
              transition: 'all 0.2s ease',
              outline: 'none',
              fontFamily: "'Poppins', sans-serif",
              opacity: deleting ? 0.7 : 1,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e64a1a';
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = `0 4px 16px rgba(255,87,35,0.3)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BRAND;
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {deleting && (
              <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
            )}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}