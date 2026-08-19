'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Smartphone, Monitor, Loader2, AlertCircle } from 'lucide-react';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
import { fetchArModel } from '@/lib/ar-api';
import { useTheme } from '@/hooks/useTheme';

// ── Theme Colors ──
const BRAND = '#ff5723';

const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  green: isDark ? '#4ade80' : '#16a34a',
  danger: isDark ? '#ff8a5c' : '#E1251B',
  amber: isDark ? '#fbbf24' : '#d97706',
  violet: isDark ? '#a78bfa' : '#7c3aed',
  violetBg: isDark ? 'rgba(124,58,237,0.12)' : '#FAF5FF',
  violetBorder: isDark ? 'rgba(124,58,237,0.3)' : '#DDD6FE',
  blueBg: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
  blueBorder: isDark ? 'rgba(96,165,250,0.3)' : '#BFDBFE',
});

const DesktopModelViewer = dynamic(
  () => import('@/components/guest/DesktopModelViewer'),
  { ssr: false, loading: () => <ViewerSkeleton /> },
);

const MobileArViewer = dynamic(
  () => import('@/components/guest/MobileArViewer'),
  { ssr: false },
);

interface ArButtonProps {
  itemId: string;
  itemName: string;
  itemEmoji: string;
  arModelUrl?: string;
}

type FetchState = 'idle' | 'loading' | 'ready' | 'error';

export default function ArEntry({ itemId, itemName, itemEmoji, arModelUrl }: ArButtonProps) {
  const caps = useDeviceCapabilities();
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  const [fetchState, setFetchState] = useState<FetchState>(arModelUrl ? 'ready' : 'idle');
  const [glbUrl, setGlbUrl] = useState<string | null>(arModelUrl ?? null);
  const [fetchError, setFetchError] = useState<string>('');
  const [showViewer, setShowViewer] = useState(false);

  const launch = useCallback(async () => {
    if (glbUrl) { setShowViewer(true); return; }

    setFetchState('loading');
    setFetchError('');

    try {
      const rid = (typeof window !== 'undefined' ? sessionStorage.getItem('lm_rid') : null)
        || process.env.NEXT_PUBLIC_RESTAURANT_ID
        || '';

      if (!rid) throw new Error('Restaurant ID not found. Please scan the QR code.');

      const data = await fetchArModel(rid, itemId);
      setGlbUrl(data.presignedUrl);
      setFetchState('ready');
      setShowViewer(true);
    } catch (err: any) {
      console.error('AR fetch error:', err);
      setFetchError(err?.message ?? 'Could not load AR model');
      setFetchState('error');
    }
  }, [itemId, glbUrl]);

  const handleClose = () => {
    setShowViewer(false);
  };

  if (caps.isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 16px',
        borderRadius: 12,
        background: colors.card2,
        border: `1px solid ${colors.border}`,
        color: colors.muted,
        fontSize: 13,
        fontFamily: "'Poppins', sans-serif",
      }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Checking AR…
      </div>
    );
  }

  // ── Desktop — 360° viewer ──
  if (!caps.isMobile) {
    return (
      <div style={{ width: '100%', fontFamily: "'Poppins', sans-serif" }}>
        {!showViewer ? (
          <button
            onClick={launch}
            disabled={fetchState === 'loading'}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              background: colors.violetBg,
              border: `1px solid ${colors.violetBorder}`,
              color: colors.violet,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: fetchState === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              opacity: fetchState === 'loading' ? 0.5 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (fetchState !== 'loading') {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              if (fetchState !== 'loading') {
                e.currentTarget.style.background = isDark ? 'rgba(124,58,237,0.2)' : '#F3E8FF';
              }
            }}
            onMouseLeave={(e) => {
              if (fetchState !== 'loading') {
                e.currentTarget.style.background = colors.violetBg;
              }
            }}
          >
            {fetchState === 'loading'
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Loading model…</>
              : <><Monitor size={15} /> View 360° Model</>}
          </button>
        ) : glbUrl ? (
          <div style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: 16,
            overflow: 'hidden',
            marginTop: 12,
            position: 'relative',
          }}>
            <DesktopModelViewer glbUrl={glbUrl} itemName={itemName} itemEmoji={itemEmoji} />
            <button
              onClick={() => setShowViewer(false)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 10,
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
              }}
            >
              ✕
            </button>
          </div>
        ) : null}
        {fetchState === 'error' && (
          <p style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: colors.danger,
            marginTop: 8,
            fontFamily: "'Poppins', sans-serif",
          }}>
            <AlertCircle size={12} /> {fetchError}
          </p>
        )}
      </div>
    );
  }

  // ── Mobile ──
  return (
    <>
      {!showViewer && (
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <button
            onClick={launch}
            disabled={fetchState === 'loading'}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 12,
              background: isDark
                ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.2))'
                : 'linear-gradient(135deg, #FAF5FF, #EFF6FF)',
              border: `1px solid ${isDark ? 'rgba(124,58,237,0.3)' : '#DDD6FE'}`,
              color: isDark ? '#a78bfa' : '#7c3aed',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: fetchState === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              opacity: fetchState === 'loading' ? 0.5 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (fetchState !== 'loading') {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              if (fetchState !== 'loading') {
                e.currentTarget.style.opacity = '0.85';
              }
            }}
            onMouseLeave={(e) => {
              if (fetchState !== 'loading') {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {fetchState === 'loading'
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading AR model…</>
              : <><Smartphone size={16} /> 📦 View in AR</>}
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
            {caps.supportsWebXR ? (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                color: colors.green,
                fontFamily: "'Poppins', sans-serif",
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: colors.green,
                }} /> WebXR AR ready
              </span>
            ) : caps.supportsARQuick ? (
              <span style={{
                fontSize: 10,
                color: colors.amber,
                fontFamily: "'Poppins', sans-serif",
              }}>
                iOS AR Quick Look available
              </span>
            ) : (
              <span style={{
                fontSize: 10,
                color: colors.muted,
                fontFamily: "'Poppins', sans-serif",
              }}>
                Requires Chrome Android or Safari iOS 16+
              </span>
            )}
          </div>

          {fetchState === 'error' && (
            <p style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: colors.danger,
              fontFamily: "'Poppins', sans-serif",
            }}>
              <AlertCircle size={12} /> {fetchError}
            </p>
          )}
        </div>
      )}

      {showViewer && glbUrl && (
        <MobileArViewer
          glbUrl={glbUrl}
          itemName={itemName}
          itemEmoji={itemEmoji}
          onClose={handleClose}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

function ViewerSkeleton() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  return (
    <div style={{
      width: '100%',
      aspectRatio: '1',
      borderRadius: 16,
      background: colors.card2,
      border: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: `2px solid ${colors.brand}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
    </div>
  );
}