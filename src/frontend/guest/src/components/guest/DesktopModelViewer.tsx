'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface DesktopModelViewerProps {
  glbUrl:    string;
  itemName:  string;
  itemEmoji: string;
}

/**
 * Desktop 360° viewer using Three.js + GLTFLoader.
 * No AR — mouse/touch drag to orbit, scroll to zoom.
 * Loaded dynamically to avoid SSR issues.
 */
export default function DesktopModelViewer({ glbUrl, itemName, itemEmoji }: DesktopModelViewerProps) {
  const canvasRef  = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;
    let cancelled = false;

    async function init() {
      try {
        // Dynamic import — keeps Three.js out of the initial bundle
        const THREE          = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (cancelled) return;

        // ── Scene ────────────────────────────────────────────────────────────
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f0d0a);

        // Ambient fog
        scene.fog = new THREE.Fog(0x0f0d0a, 8, 20);

        // ── Camera ───────────────────────────────────────────────────────────
        const w = container.clientWidth  || 400;
        const h = container.clientHeight || 400;
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
        camera.position.set(0, 0.5, 2.5);

        // ── Renderer ─────────────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace  = THREE.SRGBColorSpace;
        renderer.toneMapping       = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        // ── Lighting ─────────────────────────────────────────────────────────
        // Key light (warm gold)
        const keyLight = new THREE.DirectionalLight(0xffd4a0, 2.5);
        keyLight.position.set(3, 5, 3);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);

        // Fill light (cool blue)
        const fillLight = new THREE.DirectionalLight(0xa0c8ff, 0.8);
        fillLight.position.set(-3, 2, -2);
        scene.add(fillLight);

        // Rim light
        const rimLight = new THREE.DirectionalLight(0xffa040, 1.2);
        rimLight.position.set(0, -1, -4);
        scene.add(rimLight);

        // Ambient
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // ── Ground shadow plane ───────────────────────────────────────────────
        const groundGeo = new THREE.CircleGeometry(1.5, 64);
        const groundMat = new THREE.MeshStandardMaterial({
          color: 0x1a1510, roughness: 1, metalness: 0,
          transparent: true, opacity: 0.5,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        scene.add(ground);

        // ── Gold ring accent ─────────────────────────────────────────────────
        const ringGeo = new THREE.TorusGeometry(0.7, 0.008, 16, 128);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xd4a34e, metalness: 0.9, roughness: 0.1, emissive: 0xd4a34e, emissiveIntensity: 0.15,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0;
        scene.add(ring);

        // ── GLTF Loader ───────────────────────────────────────────────────────
        const loader = new GLTFLoader();
        loader.load(
          glbUrl,
          (gltf) => {
            if (cancelled) return;

            const model = gltf.scene;

            // Auto-center & scale
            const box    = new THREE.Box3().setFromObject(model);
            const size   = box.getSize(new THREE.Vector3());
            const centre = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale  = 1.4 / maxDim;

            model.scale.setScalar(scale);
            model.position.sub(centre.multiplyScalar(scale));
            model.position.y += size.y * scale * 0.1; // lift slightly above ring

            // Enable shadows on all meshes
           model.traverse((child: any) => {
              if (child.isMesh) {
                child.castShadow    = true;
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

        // ── Orbit Controls ────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping    = true;
        controls.dampingFactor    = 0.08;
        controls.autoRotate       = true;
        controls.autoRotateSpeed  = 1.2;
        controls.minDistance      = 0.8;
        controls.maxDistance      = 6;
        controls.minPolarAngle    = Math.PI / 6;
        controls.maxPolarAngle    = Math.PI / 1.8;
        controls.target.set(0, 0.2, 0);

        // Expose auto-rotate toggle
        (window as any).__kdsControls = controls;

        // ── Resize handler ───────────────────────────────────────────────────
        const onResize = () => {
          const w2 = container.clientWidth;
          const h2 = container.clientHeight;
          camera.aspect = w2 / h2;
          camera.updateProjectionMatrix();
          renderer.setSize(w2, h2);
        };
        window.addEventListener('resize', onResize);

        // ── Render loop ──────────────────────────────────────────────────────
        let rafId: number;
        const animate = () => {
          rafId = requestAnimationFrame(animate);
          ring.rotation.z += 0.004; // slowly spin the gold ring
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // ── Cleanup ──────────────────────────────────────────────────────────
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
  }, [glbUrl]);

  const toggleAutoRotate = () => {
    const ctrl = (window as any).__kdsControls;
    if (ctrl) {
      ctrl.autoRotate = !ctrl.autoRotate;
      setAutoRotate(ctrl.autoRotate);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#ffffff] rounded-2xl overflow-hidden">
      {/* Three.js mount point */}
      <div ref={canvasRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#ffffff] gap-4">
          <div className="text-6xl animate-pulse-slow">{itemEmoji}</div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/40">Loading 3D model…</span>
          </div>
          <p className="text-xs text-white/20">Fetching from S3</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#ffffff] gap-3">
          <div className="text-5xl">{itemEmoji}</div>
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-white/25">3D preview unavailable</p>
        </div>
      )}

      {/* Desktop badge */}
      {!loading && !error && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
          <span className="text-[10px] text-white/50">🖥</span>
          <span className="text-[10px] text-white/50 uppercase tracking-widest">360° Preview</span>
        </div>
      )}

      {/* Controls */}
      {!loading && !error && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={toggleAutoRotate}
            title={autoRotate ? 'Pause rotation' : 'Resume rotation'}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
              autoRotate
                ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
                : 'bg-black/50 border-white/10 text-white/40'
            }`}
          >
            <RotateCw size={14} />
          </button>
        </div>
      )}

      {/* Hint text */}
      {!loading && !error && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
          <span className="text-[10px] text-white/35">Drag to rotate · Scroll to zoom</span>
        </div>
      )}
    </div>
  );
}
