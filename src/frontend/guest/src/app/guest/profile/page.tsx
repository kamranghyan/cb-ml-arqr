'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, User, MapPin, Sun, Moon, FileText, Heart, QrCode, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useGuestProfileStore } from '@/lib/guest-profile-store';
import { clearGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';
import GuestTopBar from '@/components/guest/GuestTopBar';
import jsQR from 'jsqr';

const BRAND = '#ff5723';

export default function ProfilePage() {
  const router = useRouter();
  const { isDark, toggle } = useTheme();
  const { fullName, phone, setFullName, setPhone } = useGuestProfileStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [nameInput, setNameInput] = useState(fullName);
  const [phoneInput, setPhoneInput] = useState(phone);
  const [saved, setSaved] = useState(false);
  const [tableNum, setTableNum] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    setTableNum(sessionStorage.getItem('lm_table') ?? '');
  }, []);

  // ── QR Scanner Logic ──────────────────────────────────────────────
  useEffect(() => {
    if (!showScanner) return;

    startScanner();

    return () => {
      stopScanner();
    };
  }, [showScanner]);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startScanner = async () => {
    setScanning(true);
    setScanError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      await video.play();

      // Camera ko initialize hone ka thora time do
      scanTimeoutRef.current = setTimeout(() => {
        scanQRCode();
      }, 500);

    } catch (err) {
      console.error('Camera error:', err);
      setScanError(
        'Unable to access camera. Please allow camera permissions.'
      );
      setScanning(false);
    }
  };
  useEffect(() => {
    let cancelled = false;

    if (!showScanner) return;

    const initScanner = async () => {
      setScanning(true);
      setScanError('');

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not supported');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const video = videoRef.current;

        if (!video) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');

        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.onloadedmetadata = () => resolve();
          }
        });

        await video.play();

        if (!cancelled) {
          scanQRCode();
        }

      } catch (error) {
        console.error('Camera error:', error);

        if (!cancelled) {
          setScanError(
            'Unable to access camera. Please allow camera permissions.'
          );
          setScanning(false);
        }
      }
    };

    initScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [showScanner]);

  const stopScanner = () => {
    setScanning(false);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    const video = videoRef.current;

    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;

      stream.getTracks().forEach(track => track.stop());

      video.srcObject = null;
    }
  };

  const scanQRCode = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    });

    if (!ctx) return;

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(() => {

      // ❌ IMPORTANT:
      // yahan `scanning` state check mat karo

      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const imageData = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

        const code = jsQR(
          imageData.data,
          imageData.width,
          imageData.height,
          {
            inversionAttempts: 'attemptBoth',
          }
        );

        if (code?.data) {
          console.log('✅ QR CODE FOUND:', code.data);

          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
          }

          handleScanResult(code.data);
        }

      } catch (err) {
        console.error('QR scan error:', err);
      }

    }, 200);
  };

  const onScanSuccess = (decodedText: string, decodedResult: any) => {
    console.log('✅ QR Code detected!');
    console.log('📦 Raw data:', decodedText);

    // // 🔥 Show what was scanned
    // alert('QR Scanned!\nData: ' + decodedText);

    stopScanner();
    
    setShowScanner(false);
    handleScanResult(decodedText);
  };

  const handleScanResult = (result: string) => {
    console.log('📦 Processing QR result:', result);

    // 🔥 TEST: Show alert
    alert('Processing QR: ' + result);

    setShowScanner(false);
    setScanning(false);

    try {
      // Try to parse as JSON first
      const data = JSON.parse(result);
      console.log('✅ Parsed as JSON:', data);

      if (data.restaurantId && data.tableId) {
        console.log('✅ Setting session data:', {
          rid: data.restaurantId,
          tid: data.tableId,
          table: data.tableNumber || ''
        });

        sessionStorage.setItem('lm_rid', data.restaurantId);
        sessionStorage.setItem('lm_tid', data.tableId);
        sessionStorage.setItem('lm_table', data.tableNumber || '');

        console.log('✅ Redirecting to /guest/menu');
        router.push('/guest/menu');
        return;
      } else {
        console.warn('⚠️ Missing restaurantId or tableId in JSON:', data);
        setScanError('Invalid QR data. Missing restaurant or table info.');
      }
    } catch (e) {
      console.log('Not JSON, trying URL...');
      // Not JSON, try URL params
      try {
        const url = new URL(result);
        console.log('✅ Parsed as URL:', url);

        const rid = url.searchParams.get('rid');
        const tid = url.searchParams.get('tid');

        console.log('URL params:', { rid, tid });

        if (rid && tid) {
          console.log('✅ Setting session from URL params');
          sessionStorage.setItem('lm_rid', rid);
          sessionStorage.setItem('lm_tid', tid);
          const tableNum = url.searchParams.get('table') || '';
          if (tableNum) sessionStorage.setItem('lm_table', tableNum);

          console.log('✅ Redirecting to /guest/menu');
          router.push('/guest/menu');
          return;
        } else {
          console.warn('⚠️ Missing rid or tid in URL:', { rid, tid });
          setScanError('Invalid QR URL. Missing restaurant or table info.');
        }
      } catch (err) {
        console.error('❌ Invalid QR code:', err);
        setScanError('Invalid QR code format. Please scan a valid table QR.');
        setTimeout(() => {
          setScanError('');
          setShowScanner(true);
        }, 2000);
      }
    }
  };



  const handleSave = () => {
    setFullName(nameInput.trim());
    setPhone(phoneInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handleSwitchTable = () => {
    clearGuestScope();
    sessionStorage.removeItem('lm_table');
    sessionStorage.removeItem('lm_rid');
    sessionStorage.removeItem('lm_tid');
    setShowScanner(true);
  };

  const initials = nameInput.trim()
    ? nameInput.trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 50, borderRadius: 12, padding: '0 16px', fontSize: 15,
    background: D.card2, border: `1.5px solid ${D.border}`, color: D.text, outline: 'none',
    boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif", marginBottom: 12,
  };

  return (
    <>
      <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <GuestTopBar />

        {/* Header */}
        <div style={{ padding: '35px 20px 16px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND, padding: 4, display: 'flex' }} aria-label="Back">
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", textAlign: "center", fontSize: 26, fontWeight: 700, color: BRAND, margin: '8px 0 0' }}>Profile</h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 120px' }}>

          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '12px 0 32px' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {initials
                ? <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 30, fontWeight: 700, color: '#fff' }}>{initials}</span>
                : <User size={36} color="#fff" strokeWidth={1.75} />}
            </div>
            <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 600, color: D.text, margin: 0 }}>{fullName || 'Guest'}</p>
            {tableNum && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={12} color={D.muted} />
                <span style={{ fontSize: 12, color: D.muted }}>Table {tableNum}</span>
              </div>
            )}
          </div>

          {/* Your Details */}
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: D.text, margin: '0 0 12px' }}>Your Details</h2>
          <input className='searchInput' value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Full Name" style={inputStyle} />
          <input className='searchInput' value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="Phone Number" type="tel" style={{ ...inputStyle, marginBottom: 14 }} />
          <button onClick={handleSave}
            style={{ width: '100%', height: 46, borderRadius: 12, background: saved ? '#22c55e' : BRAND, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 28, transition: 'background 0.2s' }}>
            {saved ? '✓ Saved' : 'Save Details'}
          </button>

          {/* Preferences */}
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: D.text, margin: '0 0 12px' }}>Preferences</h2>
          <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
            <button onClick={() => isDark && toggle()}
              style={{ flex: 1, height: 48, borderRadius: 12, border: `2px solid ${BRAND}`, background: !isDark ? BRAND : D.card, color: !isDark ? '#fff' : BRAND, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Sun size={16} /> Light
            </button>
            <button onClick={() => !isDark && toggle()}
              style={{ flex: 1, height: 48, borderRadius: 12, border: `2px solid ${BRAND}`, background: isDark ? BRAND : D.card, color: isDark ? '#fff' : BRAND, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Moon size={16} /> Dark
            </button>
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            <button onClick={() => router.push('/guest/tracking')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
              <FileText size={18} color={BRAND} />
              <span style={{ flex: 1, fontSize: 15, color: D.text, fontWeight: 500 }}>My Orders</span>
              <ChevronRight size={16} color={D.muted} />
            </button>
            <button onClick={() => router.push('/guest/favorites')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
              <Heart size={18} color={BRAND} />
              <span style={{ flex: 1, fontSize: 15, color: D.text, fontWeight: 500 }}>Favorites</span>
              <ChevronRight size={16} color={D.muted} />
            </button>
          </div>

          {/* Switch table button */}
          <button onClick={handleSwitchTable}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              background: BRAND,
              border: `1.5px solid ${BRAND}`,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 12px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e04a1a';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BRAND;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <QrCode size={18} /> Scan a Different Table
          </button>
        </div>

        <BottomNav />
      </div>

      {/* ── QR Scanner Modal ── */}
      {showScanner && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <button
            onClick={() => {
              stopScanner();
              setShowScanner(false);
            }}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              zIndex: 10,
            }}
          >
            <X size={24} />
          </button>

          <div style={{
            width: '100%',
            maxWidth: 400,
            background: '#1C1C1C',
            borderRadius: 20,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              background: BRAND,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
                Scan Table QR Code
              </h3>
            </div>

            <div style={{ padding: 20 }}>
              {/* Video for camera preview */}
              <div style={{
                width: '100%',
                aspectRatio: '1',
                background: '#000',
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
              }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  playsInline
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Scanner frame overlay */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '70%',
                  height: '70%',
                  border: '2px solid rgba(255,87,35,0.6)',
                  borderRadius: 12,
                  pointerEvents: 'none',
                  boxShadow: 'inset 0 0 30px rgba(255,87,35,0.1)',
                }}>
                  <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '3px solid #ff5723', borderLeft: '3px solid #ff5723', borderRadius: '4px 0 0 0' }} />
                  <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '3px solid #ff5723', borderRight: '3px solid #ff5723', borderRadius: '0 4px 0 0' }} />
                  <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '3px solid #ff5723', borderLeft: '3px solid #ff5723', borderRadius: '0 0 0 4px' }} />
                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '3px solid #ff5723', borderRight: '3px solid #ff5723', borderRadius: '0 0 4px 0' }} />
                </div>

                {scanning && (
                  <div style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '8px 16px',
                    borderRadius: 20,
                  }}>
                    <span style={{ color: '#fff', fontSize: 12 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ade80', marginRight: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      Scanning...
                    </span>
                  </div>
                )}
              </div>

              {scanError && (
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  background: 'rgba(255,87,35,0.15)',
                  borderRadius: 10,
                  textAlign: 'center',
                }}>
                  <p style={{ color: BRAND, fontSize: 13, margin: 0 }}>{scanError}</p>
                </div>
              )}

              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 10,
                textAlign: 'center',
              }}>
                <p style={{ color: '#9CA3AF', fontSize: 12, margin: 0 }}>
                  Position the QR code in the center of the frame
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}