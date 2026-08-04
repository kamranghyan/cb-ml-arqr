'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MobileArViewerProps {
  glbUrl:    string;
  itemName:  string;
  itemEmoji: string;
  onClose:   () => void;
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
  const overlayRef  = useRef<HTMLDivElement>(null);
  const cleanupRef  = useRef<(() => void) | null>(null);
  const [phase, setPhase]   = useState<ArPhase>('idle');
  const [error, setError]   = useState<string>('');
  const [scale, setScale]   = useState(1);
  const scaleRef = useRef(1);

  const startAR = useCallback(async () => {
    setPhase('requesting');
    setError('');

    try {
      const THREE          = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

      // ── XR Session ──────────────────────────────────────────────────────────
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

      // ── Renderer ─────────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session as any);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping      = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;';

      // ── Scene ─────────────────────────────────────────────────────────────────
      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

      // ── Lighting ──────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      const dirLight = new THREE.DirectionalLight(0xffd4a0, 2.0);
      dirLight.position.set(1, 3, 1);
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xa0c8ff, 0.6);
      fillLight.position.set(-2, 1, -1);
      scene.add(fillLight);

      // ── Reticle (surface indicator) ──────────────────────────────────────────
      const reticleGroup = new THREE.Group();

      // Outer ring
      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.006, 16, 64),
        new THREE.MeshStandardMaterial({ color: 0xd4a34e, metalness: 0.8, roughness: 0.2, emissive: 0xd4a34e, emissiveIntensity: 0.4 }),
      );
      outerRing.rotation.x = -Math.PI / 2;
      reticleGroup.add(outerRing);

      // Inner dot
      const innerDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.02, 32),
        new THREE.MeshStandardMaterial({ color: 0xd4a34e, emissive: 0xd4a34e, emissiveIntensity: 0.6 }),
      );
      innerDot.rotation.x = -Math.PI / 2;
      reticleGroup.add(innerDot);

      reticleGroup.visible = false;
      scene.add(reticleGroup);

      // ── Load GLB model ────────────────────────────────────────────────────────
      let model: any = null;
      let modelPlaced = false;

      const loader = new GLTFLoader();
      loader.load(glbUrl, (gltf) => {
        model = gltf.scene;

        // Auto-scale to ~0.25m
        const box    = new THREE.Box3().setFromObject(model);
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        model.scale.setScalar(0.25 / maxDim);

        // Centre horizontally
        const centre = box.getCenter(new THREE.Vector3());
        model.position.sub(centre.multiplyScalar(0.25 / maxDim));

        model.visible = false;
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
          }
        });
        scene.add(model);
      }, undefined, (err) => {
        console.error('GLTF load error:', err);
      });

      // ── Hit-test source ──────────────────────────────────────────────────────
      const refSpace: XRReferenceSpace = await session.requestReferenceSpace('local');
      const viewerSpace: XRReferenceSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource: XRHitTestSource = await (session as any).requestHitTestSource({
        space: viewerSpace,
      });

      // ── Tap to place ─────────────────────────────────────────────────────────
      const tempMatrix = new THREE.Matrix4();
      let currentHitMatrix: any = null;
      
      const onSelect = () => {
        if (!model || !currentHitMatrix) return;
        model.position.setFromMatrixPosition(currentHitMatrix);
        model.visible  = true;
        modelPlaced    = true;
        setPhase('placed');
        reticleGroup.visible = false; // hide reticle after placement
      };
      session.addEventListener('select', onSelect);

      // ── Render loop ───────────────────────────────────────────────────────────
      let lastTime = 0;
      const onXRFrame: XRFrameRequestCallback = (time, frame) => {
        const delta = (time - lastTime) / 1000;
        lastTime = time;

        // Slowly rotate the model
        if (model && modelPlaced) {
          model.rotation.y += delta * 0.4;
          const s = scaleRef.current;
          model.scale.setScalar((0.25 / 1) * s); // base scale × user scale
        }

        // Hit-test
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

      // ── Session end ───────────────────────────────────────────────────────────
      session.addEventListener('end', () => {
        renderer.setAnimationLoop(null);
        renderer.domElement.remove();
        renderer.dispose();
        onClose();
      });

      cleanupRef.current = () => {
        session.end().catch(() => {});
        hitTestSource.cancel();
      };

    } catch (err: any) {
      console.error('WebXR error:', err);
      setError(err?.message ?? 'AR failed to start');
      setPhase('error');
    }
  }, [glbUrl, onClose]);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const adjustScale = (delta: number) => {
    const next = Math.max(0.3, Math.min(3.0, scaleRef.current + delta));
    scaleRef.current = next;
    setScale(next);
  };

  return (
    <>
      {/* Launch screen — shown before AR starts */}
      {phase === 'idle' && (
        <div className="fixed inset-0 z-[9999] bg-surface flex flex-col items-center justify-center gap-6 px-8">
          <div className="text-[72px] animate-pulse-slow">{itemEmoji}</div>
          <div className="text-center">
            <h2 className="font-serif text-[24px] text-[#f5e9d0] font-semibold mb-2">
              View in Your Space
            </h2>
            <p className="text-[14px] text-white/40 leading-relaxed">
              Place <strong className="text-white/60">{itemName}</strong> on your table
              using your camera. Tap the surface to position the dish.
            </p>
          </div>
          <button onClick={startAR} className="btn-gold max-w-[260px]">
            📷 Launch AR View
          </button>
          <button onClick={onClose} className="text-[13px] text-white/25 hover:text-white/50 transition-colors">
            Cancel
          </button>
        </div>
      )}

      {/* Requesting session */}
      {phase === 'requesting' && (
        <div className="fixed inset-0 z-[9999] bg-surface flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-white/40">Starting AR session…</p>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div className="fixed inset-0 z-[9999] bg-surface flex flex-col items-center justify-center gap-4 px-8">
          <div className="text-5xl">⚠️</div>
          <h2 className="font-serif text-[20px] text-[#f5e9d0] text-center">AR Not Available</h2>
          <p className="text-[13px] text-white/40 text-center leading-relaxed">{error}</p>
          <div className="text-[12px] text-white/25 text-center space-y-1">
            <p>Requires Chrome on Android or Safari on iOS 16+</p>
            <p>Make sure camera permission is granted</p>
          </div>
          <button onClick={onClose} className="btn-gold max-w-[240px]">
            Close
          </button>
        </div>
      )}

      {/* DOM Overlay — shown over the camera feed during AR */}
      <div
        ref={overlayRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 9999, display: phase === 'scanning' || phase === 'placed' ? 'block' : 'none' }}
      >
        {/* Header */}
        <div className="pointer-events-auto absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-safe-top pt-4 pb-3"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{itemEmoji}</span>
            <div>
              <p className="text-[13px] font-medium text-white">{itemName}</p>
              <p className="text-[10px] text-white/50">
                {phase === 'scanning' ? '🔍 Scan surface to place' : '✓ Tap surface to reposition'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { cleanupRef.current?.(); onClose(); }}
            className="w-10 h-10 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Scanning hint */}
        {phase === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 border border-gold-400/40 rounded-2xl px-6 py-4 text-center mx-10">
              <div className="text-3xl mb-2 animate-pulse-slow">📱</div>
              <p className="text-[14px] font-medium text-white mb-1">Move your phone slowly</p>
              <p className="text-[12px] text-white/50">Point at a flat surface like your table</p>
            </div>
          </div>
        )}

        {/* Placed hint */}
        {phase === 'placed' && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-black/50 border border-gold-400/30 rounded-full px-4 py-2">
              <p className="text-[11px] text-white/60">Tap anywhere to reposition</p>
            </div>
          </div>
        )}

        {/* Scale controls */}
        {phase === 'placed' && (
          <div className="pointer-events-auto absolute right-4 bottom-40 flex flex-col gap-2">
            <button
              onClick={() => adjustScale(0.2)}
              className="w-11 h-11 rounded-xl bg-black/60 border border-white/15 flex items-center justify-center"
            >
              <ZoomIn size={20} className="text-white" />
            </button>
            <div className="w-11 h-8 flex items-center justify-center">
              <span className="text-[11px] text-white/50 font-mono-dm">{scale.toFixed(1)}×</span>
            </div>
            <button
              onClick={() => adjustScale(-0.2)}
              className="w-11 h-11 rounded-xl bg-black/60 border border-white/15 flex items-center justify-center"
            >
              <ZoomOut size={20} className="text-white" />
            </button>
          </div>
        )}

        {/* Bottom controls */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 px-5 pb-safe-bottom pb-8 pt-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
          <div className="flex items-center justify-center gap-3">
            {phase === 'placed' && (
              <button
                onClick={() => { setPhase('scanning'); scaleRef.current = 1; setScale(1); }}
                className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-white/10 border border-white/20 text-[13px] text-white"
              >
                <RotateCcw size={15} /> Replace
              </button>
            )}
            <button
              onClick={() => { cleanupRef.current?.(); onClose(); }}
              className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-black/50 border border-white/15 text-[13px] text-white"
            >
              <X size={15} /> Exit AR
            </button>
          </div>

          <p className="text-center text-[10px] text-white/25 mt-3">
            WebXR · Surface detection active
          </p>
        </div>
      </div>
    </>
  );
}
