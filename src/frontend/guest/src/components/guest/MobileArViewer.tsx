'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
  gold: isDark ? '#d4a34e' : '#c4873c',
  goldBg: isDark ? 'rgba(212,163,78,0.15)' : 'rgba(196,135,60,0.15)',
  goldBorder: isDark ? 'rgba(212,163,78,0.3)' : 'rgba(196,135,60,0.3)',
  danger: isDark ? '#ff8a5c' : '#E1251B',
});

interface MobileArViewerProps {
  glbUrl: string;
  itemName: string;
  itemEmoji: string;
  onClose: () => void;
}

type ArPhase =
  | 'idle'           // not started
  | 'requesting'     // waiting for XR session
  | 'scanning'       // session running, looking for surface
  | 'placed'         // model placed on surface
  | 'error';

/**
 * Full WebXR AR viewer for mobile.
 *
 * Flow:
 * 1. Request immersive-ar session with hit-test + dom-overlay features
 * 2. Cast a hit-test ray from the centre of the screen against detected surfaces
 * 3. On first tap → place the GLB model at the hit-test intersection
 * 4. Subsequent taps → move model to new position
 * 5. Scale buttons → scale model up/down
 * 6. DOM overlay shows UI buttons over the camera feed
 */
export default function MobileArViewer({ glbUrl, itemName, itemEmoji, onClose }: MobileArViewerProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<ArPhase>('idle');
  const [error, setError] = useState<string>('');
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);

  const startAR = useCallback(async () => {
    setPhase('requesting');
    setError('');

    try {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

      // ── XR Session ──
      const xr = (navigator as any).xr;
      if (!xr) throw new Error('WebXR not available on this browser');

      const supported = await xr.isSessionSupported('immersive-ar');
      if (!supported) throw new Error('AR not supported on this device');

      const session: XRSession = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'light-estimation'],
        domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined,
      });

      setPhase('scanning');

      // ── Renderer ──
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session as any);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;';

      // ── Scene ──
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

      // ── Lighting ──
      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      const dirLight = new THREE.DirectionalLight(0xffd4a0, 2.0);
      dirLight.position.set(1, 3, 1);
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xa0c8ff, 0.6);
      fillLight.position.set(-2, 1, -1);
      scene.add(fillLight);

      // ── Reticle ──
      const reticleGroup = new THREE.Group();

      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.006, 16, 64),
        new THREE.MeshStandardMaterial({
          color: isDark ? 0xd4a34e : 0xc4873c,
          metalness: 0.8,
          roughness: 0.2,
          emissive: isDark ? 0xd4a34e : 0xc4873c,
          emissiveIntensity: 0.4,
        }),
      );
      outerRing.rotation.x = -Math.PI / 2;
      reticleGroup.add(outerRing);

      const innerDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.02, 32),
        new THREE.MeshStandardMaterial({
          color: isDark ? 0xd4a34e : 0xc4873c,
          emissive: isDark ? 0xd4a34e : 0xc4873c,
          emissiveIntensity: 0.6,
        }),
      );
      innerDot.rotation.x = -Math.PI / 2;
      reticleGroup.add(innerDot);

      reticleGroup.visible = false;
      scene.add(reticleGroup);

      // ── Load GLB model ──
      let model: any = null;
      let modelPlaced = false;

      const loader = new GLTFLoader();
      loader.load(glbUrl, (gltf) => {
        model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        model.scale.setScalar(0.25 / maxDim);

        const centre = box.getCenter(new THREE.Vector3());
        model.position.sub(centre.multiplyScalar(0.25 / maxDim));

        model.visible = false;
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(model);
      }, undefined, (err) => {
        console.error('GLTF load error:', err);
      });

      // ── Hit-test source ──
      const refSpace: XRReferenceSpace = await session.requestReferenceSpace('local');
      const viewerSpace: XRReferenceSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource: XRHitTestSource = await (session as any).requestHitTestSource({
        space: viewerSpace,
      });

      // ── Tap to place ──
      const tempMatrix = new THREE.Matrix4();
      let currentHitMatrix: any = null;

      const onSelect = () => {
        if (!model || !currentHitMatrix) return;
        model.position.setFromMatrixPosition(currentHitMatrix);
        model.visible = true;
        modelPlaced = true;
        setPhase('placed');
        reticleGroup.visible = false;
      };
      session.addEventListener('select', onSelect);

      // ── Render loop ──
      let lastTime = 0;
      const onXRFrame: XRFrameRequestCallback = (time, frame) => {
        const delta = (time - lastTime) / 1000;
        lastTime = time;

        if (model && modelPlaced) {
          model.rotation.y += delta * 0.4;
          const s = scaleRef.current;
          model.scale.setScalar((0.25 / 1) * s);
        }

        if (!modelPlaced) {
          const hitResults = frame.getHitTestResults(hitTestSource);
          if (hitResults.length > 0) {
            const pose = hitResults[0].getPose(refSpace);
            if (pose) {
              tempMatrix.fromArray(pose.transform.matrix);
              reticleGroup.visible = true;
              reticleGroup.position.setFromMatrixPosition(tempMatrix);
              reticleGroup.quaternion.setFromRotationMatrix(tempMatrix);
              currentHitMatrix = tempMatrix.clone();
            }
          } else {
            reticleGroup.visible = false;
          }
        }

        renderer.render(scene, camera);
      };

      renderer.setAnimationLoop(onXRFrame);

      session.addEventListener('end', () => {
        renderer.setAnimationLoop(null);
        renderer.domElement.remove();
        renderer.dispose();
        onClose();
      });

      cleanupRef.current = () => {
        session.end().catch(() => { });
        hitTestSource.cancel();
      };

    } catch (err: any) {
      console.error('WebXR error:', err);
      setError(err?.message ?? 'AR failed to start');
      setPhase('error');
    }
  }, [glbUrl, onClose, isDark]);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const adjustScale = (delta: number) => {
    const next = Math.max(0.3, Math.min(3.0, scaleRef.current + delta));
    scaleRef.current = next;
    setScale(next);
  };

  // ── Focus/Blur handlers ──
  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
  };

  const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  };

  const handleButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
  };

  return (
    <>
      {/* ── Launch screen ── */}
      {phase === 'idle' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: colors.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: '0 32px',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <div style={{ fontSize: 72, animation: 'pulse 2s ease-in-out infinite' }}>{itemEmoji}</div>
          <div style={{ textAlign: 'center' }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: isDark ? '#f5e9d0' : colors.text,
                marginBottom: 8,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              View in Your Space
            </h2>
            <p
              style={{
                fontSize: 14,
                color: colors.muted,
                lineHeight: 1.6,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Place <strong style={{ color: colors.text }}>{itemName}</strong> on your table
              using your camera. Tap the surface to position the dish.
            </p>
          </div>
          <button
            onClick={startAR}
            style={{
              width: '100%',
              maxWidth: 260,
              padding: '14px 24px',
              borderRadius: 14,
              background: `linear-gradient(135deg, ${isDark ? '#d4a34e' : '#c4873c'}, ${isDark ? '#c4873c' : '#a06b30'})`,
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            📷 Launch AR View
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 13,
              color: colors.muted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
              padding: '4px 8px',
              borderRadius: 6,
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.muted;
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Requesting session ── */}
      {phase === 'requesting' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: colors.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: `2px solid ${colors.gold}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p
            style={{
              fontSize: 14,
              color: colors.muted,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Starting AR session…
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {phase === 'error' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: colors.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '0 32px',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: colors.text,
              textAlign: 'center',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            AR Not Available
          </h2>
          <p
            style={{
              fontSize: 13,
              color: colors.muted,
              textAlign: 'center',
              lineHeight: 1.6,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {error}
          </p>
          <div
            style={{
              fontSize: 12,
              color: colors.subtle,
              textAlign: 'center',
              lineHeight: 1.6,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <p style={{ margin: 0 }}>Requires Chrome on Android or Safari on iOS 16+</p>
            <p style={{ margin: 0 }}>Make sure camera permission is granted</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              maxWidth: 240,
              padding: '12px 24px',
              borderRadius: 14,
              background: BRAND,
              color: '#fff',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e64a1a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BRAND;
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* ── DOM Overlay ── */}
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          display: phase === 'scanning' || phase === 'placed' ? 'block' : 'none',
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 12px',
            paddingTop: 'env(safe-area-inset-top, 16px)',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>{itemEmoji}</span>
            <div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {itemName}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.5)',
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {phase === 'scanning' ? '🔍 Scan surface to place' : '✓ Tap surface to reposition'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { cleanupRef.current?.(); onClose(); }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
            }}
          >
            <X size={18} color="#fff" />
          </button>
        </div>

        {/* Scanning hint */}
        {phase === 'scanning' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: `1px solid ${colors.goldBorder}`,
                borderRadius: 16,
                padding: '16px 24px',
                textAlign: 'center',
                margin: '0 40px',
                maxWidth: 320,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8, animation: 'pulse 2s ease-in-out infinite' }}>📱</div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#fff',
                  marginBottom: 4,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Move your phone slowly
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Point at a flat surface like your table
              </p>
            </div>
          </div>
        )}

        {/* Placed hint */}
        {phase === 'placed' && (
          <div
            style={{
              position: 'absolute',
              top: 96,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: `1px solid ${colors.goldBorder}`,
                borderRadius: 100,
                padding: '6px 16px',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.6)',
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Tap anywhere to reposition
              </p>
            </div>
          </div>
        )}

        {/* Scale controls */}
        {phase === 'placed' && (
          <div
            style={{
              position: 'absolute',
              right: 16,
              bottom: 160,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={() => adjustScale(0.2)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease',
                color: '#fff',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
              }}
            >
              <ZoomIn size={20} />
            </button>
            <div
              style={{
                width: 44,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'monospace',
                }}
              >
                {scale.toFixed(1)}×
              </span>
            </div>
            <button
              onClick={() => adjustScale(-0.2)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease',
                color: '#fff',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
              }}
            >
              <ZoomOut size={20} />
            </button>
          </div>
        )}

        {/* Bottom controls */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 20px 20px',
            paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {phase === 'placed' && (
              <button
                onClick={() => { setPhase('scanning'); scaleRef.current = 1; setScale(1); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 44,
                  padding: '0 20px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                <RotateCcw size={15} /> Replace
              </button>
            )}
            <button
              onClick={() => { cleanupRef.current?.(); onClose(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 44,
                padding: '0 20px',
                borderRadius: 16,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
              }}
            >
              <X size={15} /> Exit AR
            </button>
          </div>

          <p
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: 'rgba(255,255,255,0.25)',
              marginTop: 12,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            WebXR · Surface detection active
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}