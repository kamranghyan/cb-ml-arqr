'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Loader2, AlertCircle, RotateCcw,
  ZoomIn, ZoomOut, Monitor, Smartphone,
} from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
  gold: isDark ? '#d4a34e' : '#c4873c',
  goldBg: isDark ? 'rgba(212,163,78,0.15)' : 'rgba(196,135,60,0.15)',
  goldBorder: isDark ? 'rgba(212,163,78,0.3)' : 'rgba(196,135,60,0.3)',
  teal: isDark ? '#14b8a6' : '#0d9488',
});

interface Props {
  glbUrl: string;
  itemName?: string;
  emoji?: string;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const isNarrowScreen = window.innerWidth < 500;
  const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isNarrowScreen && mobileUA;
}

async function checkWebXR(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!('xr' in navigator)) return false;
  try {
    return await (navigator as any).xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

// ✅ Free every GPU resource a loaded glTF scene is holding — geometry,
// materials, and every texture map on every material. THREE's own
// renderer.dispose() only releases the renderer/context, never the
// model data it rendered. Without this, every AR-page visit leaks a
// full copy of the model's geometry + textures in GPU memory, and after
// a handful of visits the browser silently can't allocate a new WebGL
// context — the next canvas just stays blank, no error thrown.
function disposeObject3D(obj: THREE.Object3D | null) {
  if (!obj) return;
  obj.traverse((child: any) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat: THREE.Material) => {
        Object.values(mat as any).forEach((value: any) => {
          if (value && typeof value.dispose === 'function' && value.isTexture) {
            value.dispose();
          }
        });
        mat.dispose();
      });
    }
  });
}

export default function ARViewer({ glbUrl, itemName = 'Menu Item', emoji = '🍽️' }: Props) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('detecting');
  const [loadPct, setLoadPct] = useState<number>(0);
  const [arSupport, setArSupport] = useState<boolean>(false);
  const [placed, setPlaced] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log('[AR]', msg);
    setDebugLog(p => [...p.slice(-6), msg]);
  };

  const threeRef = useRef<any>(null);
  const loadTokenRef = useRef(0); // ✅ guards against a stale/duplicate loadModel() finishing late
  const xrRef = useRef<any>({
    session: null,
    hitSrc: null,
    renderer: null,
    scene: null,
    camera: null,
    reticle: null,
    model: null,
    placed: false,
    refSpace: null,
    cameraCleanup: null,
    // Every DOM node ever appended directly to <body> for an AR attempt
    // (WebXR overlay OR camera fallback) gets tracked here — the single
    // source of truth for teardown, so nothing can leak regardless of
    // which code path created it or where it failed.
    domNodes: [] as HTMLElement[],
  });

  function trackDom<T extends HTMLElement>(el: T): T {
    xrRef.current.domNodes.push(el);
    return el;
  }

  function cleanupArDom() {
    xrRef.current.domNodes.forEach((el: HTMLElement) => {
      try {
        el.remove();
      } catch {
        // already removed — fine
      }
    });
    xrRef.current.domNodes = [];
  }

  useEffect(() => {
    const mobile = isMobileDevice();
    setIsMobile(mobile);
    log(`Device: ${mobile ? 'MOBILE' : 'DESKTOP'}`);
    log(`Screen: ${window.innerWidth}x${window.innerHeight}`);
    log(`Touch: ${navigator.maxTouchPoints}`);
    setStatus('loading-model');

    if (mobile) {
      checkWebXR().then(ok => {
        log(`WebXR immersive-ar: ${ok}`);
        setArSupport(ok);
      });
    }

    return () => {
      // Invalidate any in-flight load so its .then()/.onProgress callbacks
      // become no-ops if they resolve after we've already torn down.
      loadTokenRef.current += 1;

      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animId);
        threeRef.current.cleanup?.();
        disposeObject3D(threeRef.current.scene);
        // ✅ forceContextLoss(), not just dispose() — this is what
        // actually returns the WebGL context slot to the browser
        // immediately instead of waiting on GC timing. This one line is
        // the fix for "model doesn't show up when I come back".
        threeRef.current.renderer?.forceContextLoss();
        threeRef.current.renderer?.dispose();
        threeRef.current = null;
      }
      if (xrRef.current.cameraCleanup) xrRef.current.cameraCleanup();
      xrRef.current.session?.end().catch(() => { });
      xrRef.current.renderer?.forceContextLoss?.();
      cleanupArDom();
    };
  }, [glbUrl]);

  useEffect(() => {
    if (status !== 'loading-model') return;
    if (!canvasRef.current) return;
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isMobile]);

  function loadModel() {
    const canvas = canvasRef.current!;
    const myToken = ++loadTokenRef.current;
    log('Starting Three.js...');

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x0f0d0a : 0xf5f0e8);
    scene.fog = new THREE.Fog(isDark ? 0x0f0d0a : 0xf5f0e8, 6, 16);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    camera.position.set(0, 0.5, 2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    // ── Lighting (matches the nicer desktop-viewer treatment) ──
    const keyLight = new THREE.DirectionalLight(0xffd4a0, 2.4);
    keyLight.position.set(3, 5, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.7);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffa040, 1.0);
    rimLight.position.set(0, -1, -4);
    scene.add(rimLight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // ── Ground shadow disc + gold accent ring ──
    const groundGeo = new THREE.CircleGeometry(1.4, 64);
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

    const ringGeo = new THREE.TorusGeometry(0.65, 0.007, 16, 128);
    const ringMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0xd4a34e : 0xc4873c,
      metalness: 0.9,
      roughness: 0.1,
      emissive: isDark ? 0xd4a34e : 0xc4873c,
      emissiveIntensity: 0.15,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.minDistance = 0.8;
    controls.maxDistance = 6;
    controls.target.set(0, 0.3, 0);

    log('Loading GLB...');
    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf: any) => {
        if (myToken !== loadTokenRef.current) {
          // Component moved on (unmounted, or a newer load started) while
          // this fetch was in flight — dispose what we just loaded instead
          // of adding it to a scene nobody's rendering anymore.
          disposeObject3D(gltf.scene);
          return;
        }
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.2 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scale));
        model.position.y = -box.min.y * scale;
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(model);
        setLoadPct(100);
        setStatus('model-ready');
        log('GLB loaded OK ✓');
      },
      (xhr: any) => {
        if (myToken !== loadTokenRef.current) return;
        if (xhr.total) setLoadPct(Math.round((xhr.loaded / xhr.total) * 100));
      },
      (err: any) => {
        if (myToken !== loadTokenRef.current) return;
        log(`GLB error: ${err?.message}`);
        setErrorMsg('Failed to load 3D model. Presigned URL may have expired — refresh.');
        setStatus('error');
      },
    );

    let animId: number = 0;
    const tick = () => {
      animId = requestAnimationFrame(tick);
      ring.rotation.z += 0.004;
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w2 = canvas.clientWidth || window.innerWidth;
      const h2 = canvas.clientHeight || 360;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener('resize', onResize);

    threeRef.current = {
      renderer, animId, camera, controls, scene,
      cleanup: () => {
        window.removeEventListener('resize', onResize);
        controls.dispose();
      },
    };
  }

  async function startAR() {
    if (status === 'ar-active') return;

    log('Starting AR...');
    let webxrWorks = false;
    if ('xr' in navigator) {
      try {
        webxrWorks = await (navigator as any).xr.isSessionSupported('immersive-ar');
        log(`WebXR immersive-ar supported: ${webxrWorks}`);
      } catch { webxrWorks = false; }
    }
    if (webxrWorks) {
      await startWebXRAR();
    } else {
      log('WebXR not supported — using camera AR fallback');
      await startCameraAR();
    }
  }

  async function startWebXRAR() {
    log('Starting WebXR AR...');
    try {
      const arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      arRenderer.setPixelRatio(window.devicePixelRatio);
      arRenderer.xr.enabled = true;
      arRenderer.outputColorSpace = THREE.SRGBColorSpace;
      arRenderer.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9997;touch-action:none;';
      document.body.appendChild(arRenderer.domElement);
      trackDom(arRenderer.domElement);

      const arScene = new THREE.Scene();
      const arCamera = new THREE.PerspectiveCamera(
        70, window.innerWidth / window.innerHeight, 0.01, 20,
      );
      arScene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const arDir = new THREE.DirectionalLight(0xffeedd, 2);
      arDir.position.set(1, 3, 1);
      arScene.add(arDir);

      const geo = new THREE.RingGeometry(0.08, 0.11, 32).rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: isDark ? 0xd4a34e : 0xc4873c, side: THREE.DoubleSide });
      const reticle = new THREE.Mesh(geo, mat);
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      arScene.add(reticle);

      const domOverlayRoot = document.createElement('div');
      domOverlayRoot.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
      document.body.appendChild(domOverlayRoot);
      trackDom(domOverlayRoot);

      const touchLayer = document.createElement('div');
      touchLayer.style.cssText =
        'position:absolute;inset:0;pointer-events:auto;touch-action:none;';
      domOverlayRoot.appendChild(touchLayer);

      const topBar = document.createElement('div');
      topBar.style.cssText =
        'position:absolute;top:0;left:0;right:0;display:flex;align-items:center;' +
        'justify-content:space-between;padding:20px;pointer-events:auto;' +
        'background:linear-gradient(to bottom,rgba(0,0,0,0.75),transparent);z-index:1;font-family:Poppins,sans-serif;';

      const liveLabel = document.createElement('div');
      liveLabel.style.cssText =
        'display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);' +
        'border-radius:100px;padding:6px 14px;';
      liveLabel.innerHTML =
        '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;animation:pulse 1.5s ease-in-out infinite;"></span>' +
        '<span style="color:white;font-size:12px;font-weight:500;font-family:Poppins,sans-serif;">AR Live</span>';

      const titleEl = document.createElement('p');
      titleEl.style.cssText = 'color:white;font-size:16px;font-weight:600;font-family:Poppins,sans-serif;';
      titleEl.textContent = itemName;

      const exitBtn = document.createElement('button');
      exitBtn.style.cssText =
        'background:rgba(0,0,0,0.6);border:none;border-radius:100px;' +
        'padding:6px 16px;color:white;font-size:13px;cursor:pointer;pointer-events:auto;font-family:Poppins,sans-serif;' +
        'transition:all 0.2s ease;outline:none;';
      exitBtn.textContent = 'Exit AR';
      exitBtn.onmouseenter = () => { exitBtn.style.background = 'rgba(0,0,0,0.8)'; };
      exitBtn.onmouseleave = () => { exitBtn.style.background = 'rgba(0,0,0,0.6)'; };
      exitBtn.onfocus = () => { exitBtn.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)'; };
      exitBtn.onblur = () => { exitBtn.style.boxShadow = 'none'; };
      exitBtn.onclick = () => xrRef.current.session?.end().catch(() => { });

      topBar.appendChild(liveLabel);
      topBar.appendChild(titleEl);
      topBar.appendChild(exitBtn);
      domOverlayRoot.appendChild(topBar);

      const hintEl = document.createElement('div');
      hintEl.style.cssText =
        'position:absolute;bottom:150px;left:0;right:0;display:flex;justify-content:center;' +
        'pointer-events:none;z-index:1;font-family:Poppins,sans-serif;';
      hintEl.innerHTML =
        '<div style="background:rgba(0,0,0,0.65);border-radius:100px;padding:10px 20px;">' +
        '<p id="ar-hint" style="color:white;font-size:13px;text-align:center;font-family:Poppins,sans-serif;">' +
        'Point camera at a flat surface</p></div>';
      domOverlayRoot.appendChild(hintEl);

      const repoBtn = document.createElement('button');
      repoBtn.style.cssText =
        'position:absolute;bottom:70px;left:50%;transform:translateX(-50%);' +
        'background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:100px;padding:10px 24px;color:white;font-size:13px;' +
        'cursor:pointer;pointer-events:auto;display:none;z-index:1;font-family:Poppins,sans-serif;' +
        'transition:all 0.2s ease;outline:none;';
      repoBtn.textContent = '↺ Reposition';
      repoBtn.onmouseenter = () => { repoBtn.style.background = 'rgba(0,0,0,0.8)'; };
      repoBtn.onmouseleave = () => { repoBtn.style.background = 'rgba(0,0,0,0.65)'; };
      repoBtn.onfocus = () => { repoBtn.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)'; };
      repoBtn.onblur = () => { repoBtn.style.boxShadow = 'none'; };
      domOverlayRoot.appendChild(repoBtn);

      log('Requesting XR session...');
      const session: XRSession = await (navigator as any).xr.requestSession('immersive-ar', {
        requiredFeatures: [],
        optionalFeatures: ['hit-test', 'dom-overlay', 'anchors'],
        domOverlay: { root: domOverlayRoot },
      });
      log('XR session granted ✓');

      arRenderer.xr.setReferenceSpaceType('local');
      await arRenderer.xr.setSession(session);

      const refSpace = await session.requestReferenceSpace('local');

      let hitSrc: any = null;
      try {
        const viewerSpc = await session.requestReferenceSpace('viewer');
        hitSrc = await (session as any).requestHitTestSource({ space: viewerSpc });
        log('Hit-test source ready ✓');
      } catch {
        log('Hit-test not available — tap to place at fixed position');
      }

      Object.assign(xrRef.current, {
        session, hitSrc, renderer: arRenderer,
        scene: arScene, camera: arCamera,
        reticle, refSpace, placed: false,
      });

      const loader = new GLTFLoader();
      loader.load(
        glbUrl,
        (gltf: any) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const scale = 0.25 / Math.max(size.x, size.y, size.z);
          model.scale.setScalar(scale);
          model.visible = false;
          arScene.add(model);
          xrRef.current.model = model;
          log('AR model ready — point at surface');
        },
        undefined,
        (err: any) => log(`AR GLB err: ${err?.message}`),
      );

      setStatus('ar-active');
      setPlaced(false);

      arRenderer.setAnimationLoop((_time: number, frame: any) => {
        if (!frame) return;
        const xr = xrRef.current;

        if (!xr.placed && xr.hitSrc) {
          try {
            const hits = frame.getHitTestResults(xr.hitSrc);
            if (hits.length > 0) {
              const pose = hits[0].getPose(xr.refSpace);
              if (pose) {
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);
              }
            } else {
              reticle.visible = false;
            }
          } catch {
            reticle.visible = false;
          }
        }

        if (!xr.hitSrc && !xr.placed) {
          reticle.visible = true;
          reticle.matrixAutoUpdate = true;
          reticle.position.set(0, -0.3, -0.8);
        }

        arRenderer.render(arScene, arCamera);
      });

      session.addEventListener('select', () => {
        const xr = xrRef.current;
        if (xr.placed || !xr.model) return;

        if (reticle.visible && xr.hitSrc) {
          const pos = new THREE.Vector3();
          const rot = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          reticle.matrix.decompose(pos, rot, scl);
          xr.model.position.copy(pos);
          xr.model.quaternion.copy(rot);
        } else {
          xr.model.position.set(0, -0.1, -0.8);
        }

        xr.model.visible = true;
        reticle.visible = false;
        xr.placed = true;
        setPlaced(true);
        repoBtn.style.display = 'block';
        const hint = document.getElementById('ar-hint');
        if (hint) hint.textContent = 'Drag to rotate · Pinch to scale';
        log('Model placed! ✓');
      });

      let lastTouchX = 0;
      let lastTouchY = 0;
      let lastPinchDist = 0;
      let modelScale = 1.0;

      const onTouchStart = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON') return;

        if (e.touches.length === 1) {
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const xr = xrRef.current;
        if (!xr.model || !xr.placed) return;

        if (e.touches.length === 1) {
          const dx = (e.touches[0].clientX - lastTouchX) * 0.012;
          const dy = (e.touches[0].clientY - lastTouchY) * 0.012;
          xr.model.rotation.y += dx;
          xr.model.rotation.x = Math.max(
            -Math.PI / 3,
            Math.min(Math.PI / 3, xr.model.rotation.x + dy),
          );
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }

        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const delta = dist / lastPinchDist;
          modelScale = Math.max(0.15, Math.min(5.0, modelScale * delta));
          xr.model.scale.setScalar(0.25 * modelScale);
          lastPinchDist = dist;
        }
      };

      touchLayer.addEventListener('touchstart', onTouchStart, { passive: true });
      touchLayer.addEventListener('touchmove', onTouchMove, { passive: false });

      repoBtn.onclick = () => {
        const xr = xrRef.current;
        if (xr.model) {
          xr.model.visible = false;
          xr.model.rotation.set(0, 0, 0);
          xr.model.scale.setScalar(0.25);
        }
        modelScale = 1.0;
        xr.placed = false;
        reticle.visible = false;
        reticle.matrixAutoUpdate = false;
        repoBtn.style.display = 'none';
        setPlaced(false);
        const hint = document.getElementById('ar-hint');
        if (hint) hint.textContent = 'Point camera at a flat surface';
      };

      session.addEventListener('end', () => {
        log('XR session ended');
        touchLayer.removeEventListener('touchstart', onTouchStart);
        touchLayer.removeEventListener('touchmove', onTouchMove);
        arRenderer.setAnimationLoop(null);
        disposeObject3D(arScene);
        arRenderer.forceContextLoss();
        arRenderer.dispose();
        cleanupArDom();
        Object.assign(xrRef.current, {
          session: null, hitSrc: null, model: null, placed: false, renderer: null,
        });
        setStatus('model-ready');
        setPlaced(false);
      });

    } catch (err: any) {
      log(`WebXR error: ${err?.message ?? String(err)}`);
      log('Falling back to camera AR...');
      cleanupArDom();
      await startCameraAR();
    }
  }

  async function startCameraAR() {
    log('Starting Camera AR fallback...');
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: window.innerWidth }, height: { ideal: window.innerHeight } },
        audio: false,
      });
      log('Camera stream ready ✓');

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:9990;';
      document.body.appendChild(video);
      trackDom(video);
      await video.play();
      log('Video playing ✓');

      const arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      arRenderer.setPixelRatio(window.devicePixelRatio);
      arRenderer.setSize(window.innerWidth, window.innerHeight);
      arRenderer.setClearColor(0x000000, 0);
      arRenderer.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9991;touch-action:none;';
      document.body.appendChild(arRenderer.domElement);
      trackDom(arRenderer.domElement);

      const arScene = new THREE.Scene();
      const arCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
      arScene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const arDir = new THREE.DirectionalLight(0xffeedd, 2);
      arDir.position.set(1, 3, 1);
      arScene.add(arDir);
      const arFill = new THREE.DirectionalLight(0xaaccff, 0.5);
      arFill.position.set(-2, 1, -1);
      arScene.add(arFill);

      const loader = new GLTFLoader();
      loader.load(
        glbUrl,
        (gltf: any) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const scale = 0.4 / Math.max(size.x, size.y, size.z);
          model.scale.setScalar(scale);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center.multiplyScalar(scale));
          model.position.set(0, -0.1, -1.2);
          arScene.add(model);
          xrRef.current.model = model;
          log('Camera AR model placed ✓');
          setPlaced(true);
        },
        undefined,
        (err: any) => log(`GLB err: ${err?.message}`),
      );

      let lastTouchX = 0;
      let lastTouchY = 0;
      let lastPinchDist = 0;
      let modelScale = 1.0;

      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const m = xrRef.current.model;
        if (!m) return;

        if (e.touches.length === 1) {
          const dx = (e.touches[0].clientX - lastTouchX) * 0.012;
          const dy = (e.touches[0].clientY - lastTouchY) * 0.012;
          m.rotation.y += dx;
          m.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, m.rotation.x + dy));
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }

        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const delta = dist / lastPinchDist;
          modelScale = Math.max(0.15, Math.min(5.0, modelScale * delta));
          m.scale.setScalar(0.4 * modelScale);
          lastPinchDist = dist;
        }
      };

      arRenderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
      arRenderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });

      let animId = 0;
      const tick = () => {
        animId = requestAnimationFrame(tick);
        arRenderer.render(arScene, arCamera);
      };
      tick();

      const cleanup = () => {
        cancelAnimationFrame(animId);
        stream?.getTracks().forEach(t => t.stop());
        arRenderer.domElement.removeEventListener('touchstart', onTouchStart);
        arRenderer.domElement.removeEventListener('touchmove', onTouchMove);
        disposeObject3D(arScene);
        arRenderer.forceContextLoss();
        arRenderer.dispose();
        cleanupArDom();
      };

      Object.assign(xrRef.current, {
        session: null, renderer: arRenderer,
        scene: arScene, camera: arCamera,
        placed: true, cameraCleanup: cleanup,
      });

      setStatus('ar-active');
      setPlaced(true);

    } catch (err: any) {
      log(`Camera AR error: ${err?.message}`);
      stream?.getTracks().forEach(t => t.stop());
      cleanupArDom();
      setErrorMsg(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : `AR failed: ${err?.message ?? 'Unknown error'}`,
      );
      setStatus('error');
    }
  }

  function endAR() {
    if (xrRef.current.cameraCleanup) {
      xrRef.current.cameraCleanup();
      xrRef.current.cameraCleanup = null;
    }
    xrRef.current.session?.end().catch(() => { });
    cleanupArDom();
    setStatus('model-ready');
    setPlaced(false);
  }
//
  function reposition() {
    const xr = xrRef.current;
    if (xr.model) {
      xr.model.position.set(0, -0.1, -1.2);
      xr.model.rotation.set(0, 0, 0);
      xr.model.scale.setScalar(0.4);
    }
  }

  // ── AR ACTIVE ──
  if (status === 'ar-active') {
    return (
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px',
            pointerEvents: 'auto',
            background: 'linear-gradient(to bottom,rgba(0,0,0,0.75),transparent)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 100,
              padding: '6px 14px',
              background: 'rgba(0,0,0,0.6)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
            <span
              style={{
                color: 'white',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              AR Live
            </span>
          </div>
          <p
            style={{
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {itemName}
          </p>
          <button
            onClick={endAR}
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              borderRadius: 100,
              padding: '6px 16px',
              color: 'white',
              fontSize: 13,
              cursor: 'pointer',
              pointerEvents: 'auto',
              fontFamily: "'Poppins', sans-serif",
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
              e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
            }}
          >
            Exit AR
          </button>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 80,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              borderRadius: 100,
              padding: '10px 20px',
              background: 'rgba(0,0,0,0.65)',
            }}
          >
            <p
              style={{
                color: 'white',
                fontSize: 13,
                textAlign: 'center',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Drag to rotate · Pinch to scale
            </p>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            bottom: 50,
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={reposition}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 100,
              padding: '10px 24px',
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
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
              e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.65)';
            }}
          >
            <RotateCcw size={15} /> Reset Position
          </button>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (status === 'error') {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          borderRadius: 24,
          padding: '64px 24px',
          background: colors.card,
          border: `0.5px solid ${colors.danger}20`,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <AlertCircle size={36} color={colors.danger} />
        <p
          style={{
            fontSize: 14,
            color: colors.muted,
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 1.6,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {errorMsg}
        </p>
        {debugLog.map((l, i) => (
          <p
            key={i}
            style={{
              fontSize: 10,
              color: colors.subtle,
              fontFamily: 'monospace',
              textAlign: 'center',
            }}
          >
            {l}
          </p>
        ))}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 20px',
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            background: colors.card2,
            color: colors.muted,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
            transition: 'all 0.2s ease',
            outline: 'none',
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
            e.currentTarget.style.background = colors.card2;
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── CANVAS ──
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: 24,
          overflow: 'hidden',
          border: `1px solid ${colors.border}`,
          height: isMobile ? 360 : 480,
          background: colors.bg,
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {(status === 'detecting' || status === 'loading-model' || loadPct < 100) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              background: isDark ? 'rgba(15,13,10,0.92)' : 'rgba(255,255,255,0.92)',
            }}
          >
            <div style={{ fontSize: 60, opacity: 0.4 }}>{emoji}</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              }}
            >
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, fontFamily: "'Poppins', sans-serif" }}>
                {status === 'detecting' ? 'Detecting device…' : `Loading 3D model… ${loadPct}%`}
              </span>
            </div>
            <div
              style={{
                width: 192,
                height: 3,
                borderRadius: 3,
                overflow: 'hidden',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  width: `${loadPct}%`,
                  height: '100%',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                  background: isDark ? 'rgba(212,163,78,0.6)' : 'rgba(196,135,60,0.6)',
                }}
              />
            </div>
            <div style={{ marginTop: 8, padding: '0 16px' }}>
              {debugLog.map((l, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                  }}
                >
                  {l}
                </p>
              ))}
            </div>
          </div>
        )}

        {status === 'model-ready' && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 100,
              padding: '6px 14px',
              background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
            }}
          >
            {isMobile ? (
              <Smartphone size={13} color={colors.teal} />
            ) : (
              <Monitor size={13} color={colors.teal} />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {isMobile ? '3D Preview' : '360° View — Drag to rotate'}
            </span>
          </div>
        )}

        {status === 'model-ready' && !isMobile && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {[
              { icon: <RotateCcw size={15} />, action: () => { if (threeRef.current?.controls) threeRef.current.controls.autoRotate = !threeRef.current.controls.autoRotate; } },
              { icon: <ZoomIn size={15} />, action: () => { if (threeRef.current?.camera) threeRef.current.camera.position.multiplyScalar(0.85); } },
              { icon: <ZoomOut size={15} />, action: () => { if (threeRef.current?.camera) threeRef.current.camera.position.multiplyScalar(1.15); } },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
                  color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.95)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';
                }}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}

        <p
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            fontSize: 11,
            pointerEvents: 'none',
            color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {isMobile ? 'Drag to rotate · Pinch to zoom' : 'Drag to rotate · Scroll to zoom'}
        </p>
      </div>

      {isMobile && status === 'model-ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={startAR}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              fontWeight: 600,
              fontSize: 16,
              background: `linear-gradient(135deg, ${colors.teal}, ${colors.gold})`,
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              border: 'none',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'scale(1.01)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Smartphone size={22} /> Launch AR View
          </button>
          <p
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {arSupport ? 'WebXR AR — places dish on real surfaces' : 'Camera AR — dish overlay on live camera feed'}
          </p>
        </div>
      )}

      {debugLog.length > 0 && status === 'model-ready' && (
        <div
          style={{
            borderRadius: 12,
            padding: 12,
            border: `1px solid ${colors.border}`,
            background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)',
          }}
        >
          <p
            style={{
              fontSize: 9,
              color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 4,
              fontFamily: 'monospace',
            }}
          >
            Debug
          </p>
          {debugLog.map((l, i) => (
            <p
              key={i}
              style={{
                fontSize: 10,
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                fontFamily: 'monospace',
                lineHeight: 1.6,
              }}
            >
              {l}
            </p>
          ))}
          <p
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              marginTop: 4,
              color: arSupport ? colors.green : colors.amber,
            }}
          >
            WebXR: {arSupport ? 'SUPPORTED ✓' : 'Camera fallback mode'}
          </p>
          <p
            style={{
              fontSize: 10,
              color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              fontFamily: 'monospace',
            }}
          >
            Protocol: {typeof window !== 'undefined' ? window.location.protocol : ''}
          </p>
        </div>
      )}

      <div
        ref={overlayRef}
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}