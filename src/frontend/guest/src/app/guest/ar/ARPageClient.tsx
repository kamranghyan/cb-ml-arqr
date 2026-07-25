'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cuboid, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { fetchArModel } from '@/lib/ar-api';
import { useTheme } from '@/hooks/useTheme';

const ARViewer = dynamic(
  () => import('@/components/guest/ARViewer'),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: '100%', height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-muted)', border: '1.5px solid var(--border)', borderRadius: 24 }}>
        <Loader2 size={20} color="#E1251B" className="animate-spin" />
        <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>Loading AR viewer…</span>
      </div>
    ),
  },
);

interface Props {
  restaurantId:     string;
  itemId:           string;
  itemName:         string;
  emoji:            string;
  preloadedGlbUrl?: string;
}

export default function ARPageClient({ restaurantId, itemId, itemName, emoji, preloadedGlbUrl }: Props) {
  const router     = useRouter();
  const { isDark } = useTheme();

  const [glbUrl,  setGlbUrl]  = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
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
      || process.env.NEXT_PUBLIC_RESTAURANT_ID
      || '53591ab9-ac4e-4841-958b-d38853a90f0b';

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
    bg: '#FFF8F1', card: '#FFFFFF', card2: '#F5F0EA', border: '#F0E8E0',
    text: '#1A1A1A', muted: '#687780', sub: '#9CA3AF',
  };

  return (
    <main style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', transition: 'background 0.25s' }}>

      {/* ── Red gradient header ── */}
      <div style={{ background: 'linear-gradient(135deg, #891C1C, #B22222)', padding: '52px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={18} color="#fff" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Georgia, serif' }}>{itemName}</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>AR & 3D Preview</p>
          </div>
          {glbUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,199,44,0.2)', border: '1px solid rgba(255,199,44,0.4)', borderRadius: 20, padding: '5px 12px', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFC72C', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: '#FFC72C', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Model Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Item info row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: D.card, borderBottom: `1.5px solid ${D.border}`, flexShrink: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: '#FFF3E0', border: '1.5px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemName}</p>
          {itemId && (
            <p style={{ fontSize: 11, color: D.sub, fontFamily: 'monospace', margin: '2px 0 0' }}>
              ID: {itemId.slice(0, 8)}…{itemId.slice(-4)}
            </p>
          )}
          <p style={{ fontSize: 11, color: D.sub, margin: '1px 0 0' }}>Presigned S3 GLB · 15 min</p>
        </div>
        <Cuboid size={20} color="#E1251B" style={{ flexShrink: 0 }} />
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>

        {/* Loading */}
        {loading && (
          <div style={{ width: '100%', height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 24 }}>
            <span style={{ fontSize: 56, opacity: 0.2 }}>{emoji}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 18, border: '2.5px solid #E1251B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: D.muted }}>Fetching 3D model…</span>
            </div>
          </div>
        )}

        {/* No model */}
        {noModel && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: '#FFF3E0', border: '1.5px solid #FED7AA', borderRadius: 24, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#FFF0EE', border: '1.5px solid #FED0CC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={28} color="#E1251B" />
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#891C1C', fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>3D Model Coming Soon</p>
              <p style={{ fontSize: 13, color: '#c2410c', lineHeight: 1.6, margin: 0 }}>
                Our team is crafting a 3D model for{' '}
                <strong style={{ color: '#891C1C' }}>{itemName}</strong>.
                Check back soon!
              </p>
            </div>
            <button onClick={() => router.back()}
              style={{ padding: '10px 24px', borderRadius: 20, background: '#E1251B', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,37,27,0.3)' }}>
              ← Back to Menu
            </button>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: '#FFF0F0', border: '1.5px solid #FFD0D0', borderRadius: 24, padding: '48px 24px', textAlign: 'center' }}>
            <AlertCircle size={32} color="#E1251B" />
            <p style={{ fontSize: 15, fontWeight: 700, color: '#E1251B', margin: 0, fontFamily: 'Georgia, serif' }}>Failed to Load Model</p>
            <p style={{ fontSize: 12, color: '#c2410c', lineHeight: 1.6, margin: 0 }}>{error}</p>
            <button onClick={() => window.location.reload()}
              style={{ padding: '10px 24px', borderRadius: 20, background: '#FFF0F0', border: '1.5px solid #FFD0D0', color: '#E1251B', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {/* AR Viewer */}
        {glbUrl && !loading && !error && (
          <>
            <div style={{ borderRadius: 24, overflow: 'hidden', border: `1.5px solid ${D.border}`, boxShadow: '0 8px 32px rgba(137,28,28,0.1)' }}>
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