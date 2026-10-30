'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

// ── Theme Colors ──
const BRAND = '#ff5723';

const getColors = (isDark: boolean) => ({
  bg: isDark ? '#0f0d0a' : '#f5f0e8',
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

interface DesktopModelViewerProps {
  glbUrl: string;
  itemName: string;
  itemEmoji: string;
}

/**
 * Desktop 360° viewer using Three.js + GLTFLoader.
 * No AR — mouse/touch drag to orbit, scroll to zoom.
 * Loaded dynamically to avoid SSR issues.
 */
export default function DesktopModelViewer({ glbUrl, itemName, itemEmoji }: DesktopModelViewerProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;
    let cancelled = false;

    async function init() {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (cancelled) return;

        // ── Scene ──
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(isDark ? 0x0f0d0a : 0xf5f0e8);
        scene.fog = new THREE.Fog(isDark ? 0x0f0d0a : 0xf5f0e8, 8, 20);

        // ── Camera ──
        const w = container.clientWidth || 400;
        const h = container.clientHeight || 400;
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
        camera.position.set(0, 0.5, 2.5);

        // ── Renderer ──
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        // ── Lighting ──
        const keyLight = new THREE.DirectionalLight(0xffd4a0, 2.5);
        keyLight.position.set(3, 5, 3);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xa0c8ff, 0.8);
        fillLight.position.set(-3, 2, -2);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffa040, 1.2);
        rimLight.position.set(0, -1, -4);
        scene.add(rimLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // ── Ground shadow plane ──
        const groundGeo = new THREE.CircleGeometry(1.5, 64);
        const groundMat = new THREE.MeshStandardMaterial({
          color: isDark ? 0x1a1510 : 0xe8e0d8,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: isDark ? 0.5 : 0.3,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        scene.add(ground);

        // ── Gold ring accent ──
        const ringGeo = new THREE.TorusGeometry(0.7, 0.008, 16, 128);
        const ringMat = new THREE.MeshStandardMaterial({
          color: isDark ? 0xd4a34e : 0xc4873c,
          metalness: 0.9,
          roughness: 0.1,
          emissive: isDark ? 0xd4a34e : 0xc4873c,
          emissiveIntensity: 0.15,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0;
        scene.add(ring);

        // ── GLTF Loader ──
        const loader = new GLTFLoader();
        loader.load(
          glbUrl,
          (gltf) => {
            if (cancelled) return;

            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const centre = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.4 / maxDim;

            model.scale.setScalar(scale);
            model.position.sub(centre.multiplyScalar(scale));
            model.position.y += size.y * scale * 0.1;

            model.traverse((child: any) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            scene.add(model);
            setLoading(false);
          },
          undefined,
          (err) => {
            console.error('GLTFLoader error:', err);
            setError('Could not load 3D model');
            setLoading(false);
          },
        );

        // ── Orbit Controls ──
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;
        controls.minDistance = 0.8;
        controls.maxDistance = 6;
        controls.minPolarAngle = Math.PI / 6;
        controls.maxPolarAngle = Math.PI / 1.8;
        controls.target.set(0, 0.2, 0);

        (window as any).__kdsControls = controls;

        // ── Resize handler ──
        const onResize = () => {
          const w2 = container.clientWidth;
          const h2 = container.clientHeight;
          camera.aspect = w2 / h2;
          camera.updateProjectionMatrix();
          renderer.setSize(w2, h2);
        };
        window.addEventListener('resize', onResize);

        // ── Render loop ──
        let rafId: number;
        const animate = () => {
          rafId = requestAnimationFrame(animate);
          ring.rotation.z += 0.004;
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // ── Cleanup ──
        cleanupRef.current = () => {
          cancelAnimationFrame(rafId);
          window.removeEventListener('resize', onResize);
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (err) {
        console.error('Viewer init error:', err);
        setError('Three.js could not initialise');
        setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, [glbUrl, isDark]);

  const toggleAutoRotate = () => {
    const ctrl = (window as any).__kdsControls;
    if (ctrl) {
      ctrl.autoRotate = !ctrl.autoRotate;
      setAutoRotate(ctrl.autoRotate);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: colors.bg,
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* ── Three.js mount point ── */}
      <div ref={canvasRef} style={{ width: '100%', height: '100%' }} />

      {/* ── Loading overlay ── */}
      {loading && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: colors.bg,
            gap: 16,
          }}
        >
          <div style={{ fontSize: 60, opacity: 0.4 }}>{itemEmoji}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 20,
                border: `2px solid ${colors.gold}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Loading 3D model…
            </span>
          </div>
          <p
            style={{
              fontSize: 11,
              color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Fetching from S3
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: colors.bg,
            gap: 12,
          }}
        >
          <div style={{ fontSize: 48 }}>{itemEmoji}</div>
          <p
            style={{
              fontSize: 13,
              color: colors.danger,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {error}
          </p>
          <p
            style={{
              fontSize: 11,
              color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            3D preview unavailable
          </p>
        </div>
      )}

      {/* ── Desktop badge ── */}
      {!loading && !error && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            borderRadius: 100,
            padding: '6px 14px',
          }}
        >
          <span style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
            🖥
          </span>
          <span
            style={{
              fontSize: 10,
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            360° Preview
          </span>
        </div>
      )}

      {/* ── Controls ── */}
      {!loading && !error && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <button
            onClick={toggleAutoRotate}
            title={autoRotate ? 'Pause rotation' : 'Resume rotation'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${autoRotate ? colors.goldBorder : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: autoRotate ? colors.goldBg : isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)',
              color: autoRotate ? colors.gold : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              fontFamily: "'Poppins', sans-serif",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = autoRotate ? colors.goldBg : isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = autoRotate ? colors.goldBg : isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)';
            }}
          >
            <RotateCw size={14} />
          </button>
        </div>
      )}

      {/* ── Hint text ── */}
      {!loading && !error && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            borderRadius: 100,
            padding: '6px 14px',
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Drag to rotate · Scroll to zoom
          </span>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}