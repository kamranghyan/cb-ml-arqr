'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Smartphone, Monitor, Loader2, AlertCircle } from 'lucide-react';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
import { fetchArModel } from '@/lib/ar-api';

const DesktopModelViewer = dynamic(
  () => import('@/components/guest/DesktopModelViewer'),
  { ssr: false, loading: () => <ViewerSkeleton /> },
);

const MobileArViewer = dynamic(
  () => import('@/components/guest/MobileArViewer'),
  { ssr: false },
);

interface ArButtonProps {
  itemId:       string; 
  itemName:     string;
  itemEmoji:    string;
  arModelUrl?:  string; 
}

type FetchState = 'idle' | 'loading' | 'ready' | 'error';

export default function ArEntry({ itemId, itemName, itemEmoji, arModelUrl }: ArButtonProps) {
  const caps = useDeviceCapabilities();

  const [fetchState, setFetchState] = useState<FetchState>(arModelUrl ? 'ready' : 'idle');
  const [glbUrl,     setGlbUrl]     = useState<string | null>(arModelUrl ?? null);
  const [fetchError, setFetchError] = useState<string>('');
  const [showViewer, setShowViewer] = useState(false);

  const launch = useCallback(async () => {
    if (glbUrl) { setShowViewer(true); return; }

    setFetchState('loading');
    setFetchError('');

    try {
      // Get restaurant ID from session (set when QR scanned) or env
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

  if (caps.isLoading) {
    return (
      <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/25 text-[13px]">
        <Loader2 size={15} className="animate-spin" /> Checking AR…
      </div>
    );
  }

  // Desktop — 360° viewer
  if (!caps.isMobile) {
    return (
      <div className="w-full">
        {!showViewer ? (
          <button onClick={launch} disabled={fetchState === 'loading'}
            className="w-full h-11 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-violet-500/18 transition-all disabled:opacity-50">
            {fetchState === 'loading'
              ? <><Loader2 size={15} className="animate-spin" /> Loading model…</>
              : <><Monitor size={15} /> View 360° Model</>}
          </button>
        ) : glbUrl ? (
          <div className="w-full aspect-square rounded-2xl overflow-hidden mt-3 relative">
            <DesktopModelViewer glbUrl={glbUrl} itemName={itemName} itemEmoji={itemEmoji} />
            <button onClick={() => setShowViewer(false)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-black/60 border border-white/15 flex items-center justify-center text-white/60 hover:text-white text-sm">
              ✕
            </button>
          </div>
        ) : null}
        {fetchState === 'error' && (
          <p className="flex items-center gap-1.5 text-[11px] text-red-400 mt-2">
            <AlertCircle size={12} /> {fetchError}
          </p>
        )}
      </div>
    );
  }

  // Mobile
  return (
    <>
      {!showViewer && (
        <div className="w-full flex flex-col gap-2">
          <button onClick={launch} disabled={fetchState === 'loading'}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/30 text-violet-200 text-[14px] font-medium flex items-center justify-center gap-2.5 hover:from-violet-600/30 hover:to-blue-600/30 transition-all disabled:opacity-50">
            {fetchState === 'loading'
              ? <><Loader2 size={16} className="animate-spin" /> Loading AR model…</>
              : <><Smartphone size={16} /> 📦 View in AR</>}
          </button>
          <div className="flex items-center justify-center gap-1.5">
            {caps.supportsWebXR ? (
              <span className="flex items-center gap-1 text-[10px] text-green-400/70">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> WebXR AR ready
              </span>
            ) : caps.supportsARQuick ? (
              <span className="text-[10px] text-amber-400/60">iOS AR Quick Look available</span>
            ) : (
              <span className="text-[10px] text-white/20">Requires Chrome Android or Safari iOS 16+</span>
            )}
          </div>
          {fetchState === 'error' && (
            <p className="flex items-center gap-1.5 text-[11px] text-red-400">
              <AlertCircle size={12} /> {fetchError}
            </p>
          )}
        </div>
      )}
      {showViewer && glbUrl && (
        <MobileArViewer glbUrl={glbUrl} itemName={itemName} itemEmoji={itemEmoji} onClose={() => setShowViewer(false)} />
      )}
    </>
  );
}

function ViewerSkeleton() {
  return (
    <div className="w-full aspect-square rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mt-3">
      <div className="w-8 h-8 border-2 border-gold-400/40 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}