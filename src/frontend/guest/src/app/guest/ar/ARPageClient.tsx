'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cuboid, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { fetchArModel } from '@/lib/ar-api';
import { useTheme } from '@/hooks/useTheme';
import { getGuestScope } from '@/lib/guest-scope';

const BRAND = '#ff5723';

const ARViewer = dynamic(
  () => import('@/components/guest/ARViewer'),
  {
    ssr: false,
    // Rendered outside the component's reactive scope (no access to the D
    // object / isDark here), so these are plain hardcoded values rather
    // than theme-aware — matching the light theme, same as every other
    // static/non-reactive fallback in the app.
    loading: () => (
      <div style={{ width: '100%', height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#F5F5F5', border: '1.5px solid #F0EBE6', borderRadius: 24 }}>
        <Loader2 size={20} color={BRAND} className="animate-spin" />
        <span style={{ fontSize: 13, color: '#6B6B6B' }}>Loading AR viewer…</span>
      </div>
    ),
  },
);

interface Props {
  restaurantId: string;
  itemId: string;
  itemName: string;
  emoji: string;
  imageUrl?: string;
  preloadedGlbUrl?: string;
}

export default function ARPageClient({
  restaurantId,
  itemId,
  itemName,
  emoji,
  imageUrl,
  preloadedGlbUrl
}: Props) {
  const router = useRouter();
  const { isDark } = useTheme();

  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noModel, setNoModel] = useState(false);

  useEffect(() => {
    if (preloadedGlbUrl?.trim()) {
      setGlbUrl(preloadedGlbUrl.trim());
      setLoading(false);
      return;
    }
    if (!itemId?.trim()) {
      setError('No item selected. Please open AR from a menu item.');
      setLoading(false);
      return;
    }
    const rid = restaurantId?.trim()
      || (typeof window !== 'undefined' ? sessionStorage.getItem('lm_rid') || '' : '')
      || getGuestScope().restaurantId;

    fetchArModel(rid, itemId.trim())
      .then(d => { setGlbUrl(d.presignedUrl); setLoading(false); })
      .catch(e => {
        const msg: string = e?.message ?? '';
        setLoading(false);
        if (msg.includes('item_not_found') || msg.includes('404')) setNoModel(true);
        else setError(msg || 'Failed to load 3D model.');
      });
  }, [restaurantId, itemId, preloadedGlbUrl]);

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', sub: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', sub: '#C4C4C4',
  };


  return (
    <main style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', transition: 'background 0.25s' }}>

      {/* ── Header ── */}
      <div style={{ background: BRAND, padding: '52px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.18)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={18} color="#fff" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemName}</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0' }}>AR & 3D Preview</p>
          </div>
          {glbUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '5px 12px', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Model Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Item info row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: D.card, borderBottom: `1.5px solid ${D.border}`, flexShrink: 0 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: isDark
              ? D.card2
              : 'linear-gradient(135deg,#ffe4d8,#ffcbb3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={itemName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <span style={{ fontSize: 26 }}>
              {emoji}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, fontWeight: 600, color: D.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemName}</p>
          {itemId && (
            <p style={{ fontSize: 11, color: D.sub, fontFamily: 'monospace', margin: '2px 0 0' }}>
              ID: {itemId.slice(0, 8)}…{itemId.slice(-4)}
            </p>
          )}
          <p style={{ fontSize: 11, color: D.sub, margin: '1px 0 0' }}>Presigned S3 GLB · 15 min</p>
        </div>
        <Cuboid size={20} color={BRAND} style={{ flexShrink: 0 }} />
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>

        {/* Loading */}
        {loading && (
          <div style={{ width: '100%', height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 24 }}>
            <span style={{ fontSize: 56, opacity: 0.2 }}>{emoji}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 18, border: `2.5px solid ${BRAND}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: D.muted }}>Fetching 3D model…</span>
            </div>
          </div>
        )}

        {/* No model — soft/informational, not an error */}
        {noModel && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: '#ffbca7', borderRadius: 24, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={28} color={BRAND} />
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: BRAND, margin: '0 0 8px' }}>3D Model Coming Soon</p>
              <p style={{ fontSize: 13, color: '#3a1a10', lineHeight: 1.6, margin: 0 }}>
                Our team is crafting a 3D model for{' '}
                <strong style={{ color: BRAND }}>{itemName}</strong>.
                Check back soon!
              </p>
            </div>
            <button onClick={() => router.back()}
              style={{ padding: '10px 24px', borderRadius: 20, background: BRAND, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ← Back to Menu
            </button>
          </div>
        )}

        {/* Error — same light-red-bg / brand-orange-text convention as Cart & Checkout */}
        {error && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: '#FFF0F0', border: '1.5px solid #FFD0D0', borderRadius: 24, padding: '48px 24px', textAlign: 'center' }}>
            <AlertCircle size={32} color={BRAND} />
            <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: BRAND, margin: 0 }}>Failed to Load Model</p>
            <p style={{ fontSize: 12, color: '#c2410c', lineHeight: 1.6, margin: 0 }}>{error}</p>
            <button onClick={() => window.location.reload()}
              style={{ padding: '10px 24px', borderRadius: 20, background: '#FFF0F0', border: `1.5px solid ${BRAND}`, color: BRAND, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {/* AR Viewer — wrapper restyled; the ARViewer component itself is
            untouched, out of scope for this pass */}
        {glbUrl && !loading && !error && (
          <>
            <div style={{ borderRadius: 24, overflow: 'hidden', border: `1.5px solid ${D.border}`, boxShadow: '0 8px 32px rgba(255,87,35,0.12)' }}>
              <ARViewer glbUrl={glbUrl} itemName={itemName} emoji={emoji} />
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: D.sub, marginTop: 14 }}>
              Pinch to zoom · Drag to rotate · Tap AR to place in your space
            </p>
          </>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.animate-spin{animation:spin 0.8s linear infinite}`}</style>
    </main>
  );
}