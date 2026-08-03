'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Loader2, AlertCircle, RotateCcw,
  ZoomIn, ZoomOut, Monitor, Smartphone,
} from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
  glbUrl:    string;
  itemName?: string;
  emoji?:    string;
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

export default function ARViewer({ glbUrl, itemName = 'Menu Item', emoji = '🍽️' }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isMobile,  setIsMobile]  = useState<boolean>(false);
  const [status,    setStatus]    = useState<string>('detecting');
  const [loadPct,   setLoadPct]   = useState<number>(0);
  const [arSupport, setArSupport] = useState<boolean>(false);
  const [placed,    setPlaced]    = useState<boolean>(false);
  const [errorMsg,  setErrorMsg]  = useState<string>('');
  const [debugLog,  setDebugLog]  = useState<string[]>([]);

  const log = (msg: string) => {
    console.log('[AR]', msg);
    setDebugLog(p => [...p.slice(-6), msg]);
  };

  const threeRef = useRef<any>(null);
  const xrRef    = useRef<any>({
    session:       null,
    hitSrc:        null,
    renderer:      null,
    scene:         null,
    camera:        null,
    reticle:       null,
    model:         null,
    placed:        false,
    refSpace:      null,
    cameraCleanup: null,
  });

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
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animId);
        threeRef.current.renderer?.dispose();
        threeRef.current = null;
      }
      if (xrRef.current.cameraCleanup) xrRef.current.cameraCleanup();
      xrRef.current.session?.end().catch(() => {});
    };
  }, [glbUrl]);

  useEffect(() => {
    if (status !== 'loading-model') return;
    if (!canvasRef.current) return;
    loadModel();
  }, [status, isMobile]);

  function loadModel() {
    const canvas = canvasRef.current!;
    log('Starting Three.js...');

    const w = canvas.clientWidth  || window.innerWidth;
    const h = canvas.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0d0a);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    camera.position.set(0, 0.5, 2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.outputColorSpace    = THREE.SRGBColorSpace;
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dir = new THREE.DirectionalLight(0xffeedd, 2.5);
    dir.position.set(3, 5, 3);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xaaccff, 0.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    scene.add(new THREE.GridHelper(4, 20, 0x222222, 0x1a1a1a));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.08;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 1.5;
    controls.enableZoom      = true;
    controls.enablePan       = false;
    controls.target.set(0, 0.3, 0);

    log('Loading GLB...');
    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf: any) => {
        const model = gltf.scene;
        const box   = new THREE.Box3().setFromObject(model);
        const size  = box.getSize(new THREE.Vector3());
        const scale = 1.2 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scale));
        model.position.y = -box.min.y * scale;
        scene.add(model);
        setLoadPct(100);
        setStatus('model-ready');
        log('GLB loaded OK ✓');
      },
      (xhr: any) => {
        if (xhr.total) setLoadPct(Math.round((xhr.loaded / xhr.total) * 100));
      },
      (err: any) => {
        log(`GLB error: ${err?.message}`);
        setErrorMsg('Failed to load 3D model. Presigned URL may have expired — refresh.');
        setStatus('error');
      },
    );

    let animId: number = 0;
    const tick = () => {
      animId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w2 = canvas.clientWidth  || window.innerWidth;
      const h2 = canvas.clientHeight || 360;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener('resize', onResize);

    threeRef.current = {
      renderer, animId, camera, controls,
      cleanup: () => window.removeEventListener('resize', onResize),
    };
  }

  async function startAR() {
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
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9997;';
      document.body.appendChild(arRenderer.domElement);

      const arScene  = new THREE.Scene();
      const arCamera = new THREE.PerspectiveCamera(
        70, window.innerWidth / window.innerHeight, 0.01, 20,
      );
      arScene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const arDir = new THREE.DirectionalLight(0xffeedd, 2);
      arDir.position.set(1, 3, 1);
      arScene.add(arDir);

      // Gold reticle
      const geo     = new THREE.RingGeometry(0.08, 0.11, 32).rotateX(-Math.PI / 2);
      const mat     = new THREE.MeshBasicMaterial({ color: 0xd4a34e, side: THREE.DoubleSide });
      const reticle = new THREE.Mesh(geo, mat);
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      arScene.add(reticle);

      // ── DOM overlay on body ───────────────────────────────────────────────
      const domOverlayRoot = document.createElement('div');
      domOverlayRoot.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
      document.body.appendChild(domOverlayRoot);

      // Touch interceptor — full screen, pointer-events:auto so it captures touches
      const touchLayer = document.createElement('div');
      touchLayer.style.cssText =
        'position:absolute;inset:0;pointer-events:auto;touch-action:none;';
      domOverlayRoot.appendChild(touchLayer);

      // Top bar
      const topBar = document.createElement('div');
      topBar.style.cssText =
        'position:absolute;top:0;left:0;right:0;display:flex;align-items:center;' +
        'justify-content:space-between;padding:20px;pointer-events:auto;' +
        'background:linear-gradient(to bottom,rgba(0,0,0,0.75),transparent);z-index:1;';

      const liveLabel = document.createElement('div');
      liveLabel.style.cssText =
        'display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);' +
        'border-radius:100px;padding:6px 14px;';
      liveLabel.innerHTML =
        '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;"></span>' +
        '<span style="color:white;font-size:12px;font-weight:500;">AR Live</span>';

      const titleEl = document.createElement('p');
      titleEl.style.cssText = 'color:white;font-size:16px;font-weight:600;';
      titleEl.textContent   = itemName;

      const exitBtn = document.createElement('button');
      exitBtn.style.cssText =
        'background:rgba(0,0,0,0.6);border:none;border-radius:100px;' +
        'padding:6px 16px;color:white;font-size:13px;cursor:pointer;pointer-events:auto;';
      exitBtn.textContent = 'Exit AR';
      exitBtn.onclick = () => xrRef.current.session?.end().catch(() => {});

      topBar.appendChild(liveLabel);
      topBar.appendChild(titleEl);
      topBar.appendChild(exitBtn);
      domOverlayRoot.appendChild(topBar);

      // Hint
      const hintEl = document.createElement('div');
      hintEl.style.cssText =
        'position:absolute;bottom:150px;left:0;right:0;display:flex;justify-content:center;' +
        'pointer-events:none;z-index:1;';
      hintEl.innerHTML =
        '<div style="background:rgba(0,0,0,0.65);border-radius:100px;padding:10px 20px;">' +
        '<p id="ar-hint" style="color:white;font-size:13px;text-align:center;">' +
        'Point camera at a flat surface</p></div>';
      domOverlayRoot.appendChild(hintEl);

      // Controls hint
      const ctrlHint = document.createElement('div');
      ctrlHint.id = 'ctrl-hint';
      ctrlHint.style.cssText =
        'position:absolute;bottom:210px;left:0;right:0;display:none;' +
        'justify-content:center;pointer-events:none;z-index:1;';
      ctrlHint.innerHTML =
        '<div style="background:rgba(212,163,78,0.15);border:1px solid rgba(212,163,78,0.3);' +
        'border-radius:100px;padding:6px 16px;">' +
        '<p style="color:#14b8a6;font-size:11px;">1 finger: rotate · 2 fingers: pinch to scale</p></div>';
      domOverlayRoot.appendChild(ctrlHint);

      // Scale indicator
      const scaleEl = document.createElement('div');
      scaleEl.id = 'scale-el';
      scaleEl.style.cssText =
        'position:absolute;bottom:260px;left:0;right:0;display:none;' +
        'justify-content:center;pointer-events:none;z-index:1;';
      scaleEl.innerHTML =
        '<div style="background:rgba(0,0,0,0.5);border-radius:100px;padding:4px 12px;">' +
        '<p id="scale-txt" style="color:rgba(255,255,255,0.6);font-size:11px;font-family:monospace;">1.0×</p></div>';
      domOverlayRoot.appendChild(scaleEl);

      // Reposition button
      const repoBtn = document.createElement('button');
      repoBtn.style.cssText =
        'position:absolute;bottom:70px;left:50%;transform:translateX(-50%);' +
        'background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:100px;padding:10px 24px;color:white;font-size:13px;' +
        'cursor:pointer;pointer-events:auto;display:none;z-index:1;';
      repoBtn.textContent = '↺ Reposition';
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

      // Load GLB
      const loader = new GLTFLoader();
      loader.load(
        glbUrl,
        (gltf: any) => {
          const model = gltf.scene;
          const box   = new THREE.Box3().setFromObject(model);
          const size  = box.getSize(new THREE.Vector3());
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

      // XR render loop
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
          reticle.visible          = true;
          reticle.matrixAutoUpdate = true;
          reticle.position.set(0, -0.3, -0.8);
        }

        arRenderer.render(arScene, arCamera);
      });

      // Tap to place
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
          xr.model.position.set(0, -0.3, -0.8);
        }

        xr.model.visible       = true;
        reticle.visible        = false;
        xr.placed              = true;
        setPlaced(true);
        repoBtn.style.display  = 'block';
        ctrlHint.style.display = 'flex';
        scaleEl.style.display  = 'flex';
        const hint = document.getElementById('ar-hint');
        if (hint) hint.textContent = 'Drag to rotate · Pinch to scale';
        log('Model placed! ✓');
      });

      // ── Touch controls on touchLayer (not canvas) ─────────────────────────
      let lastTouchX    = 0;
      let lastTouchY    = 0;
      let lastPinchDist = 0;
      let modelScale    = 1.0;

      const onTouchStart = (e: TouchEvent) => {
        // Don't intercept button taps
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
          // Rotate
          const dx = (e.touches[0].clientX - lastTouchX) * 0.012;
          const dy = (e.touches[0].clientY - lastTouchY) * 0.012;
          xr.model.rotation.y += dx;
          xr.model.rotation.x  = Math.max(
            -Math.PI / 3,
            Math.min(Math.PI / 3, xr.model.rotation.x + dy),
          );
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }

        if (e.touches.length === 2) {
          // Pinch scale
          const dx    = e.touches[0].clientX - e.touches[1].clientX;
          const dy    = e.touches[0].clientY - e.touches[1].clientY;
          const dist  = Math.sqrt(dx * dx + dy * dy);
          const delta = dist / lastPinchDist;
          modelScale  = Math.max(0.15, Math.min(5.0, modelScale * delta));
          xr.model.scale.setScalar(0.25 * modelScale);
          lastPinchDist = dist;

          // Update scale indicator
          const scaleTxt = document.getElementById('scale-txt');
          if (scaleTxt) scaleTxt.textContent = `${modelScale.toFixed(1)}×`;
        }
      };

      // Attach to touchLayer — sits on top of XR canvas, captures all touches
      touchLayer.addEventListener('touchstart', onTouchStart, { passive: true  });
      touchLayer.addEventListener('touchmove',  onTouchMove,  { passive: false });

      // Reposition
      repoBtn.onclick = () => {
        const xr = xrRef.current;
        if (xr.model) {
          xr.model.visible = false;
          xr.model.rotation.set(0, 0, 0);
          xr.model.scale.setScalar(0.25);
        }
        modelScale             = 1.0;
        xr.placed              = false;
        reticle.visible        = false;
        reticle.matrixAutoUpdate = false;
        repoBtn.style.display  = 'none';
        ctrlHint.style.display = 'none';
        scaleEl.style.display  = 'none';
        setPlaced(false);
        const hint = document.getElementById('ar-hint');
        if (hint) hint.textContent = 'Point camera at a flat surface';
        const scaleTxt = document.getElementById('scale-txt');
        if (scaleTxt) scaleTxt.textContent = '1.0×';
      };

      session.addEventListener('end', () => {
        log('XR session ended');
        touchLayer.removeEventListener('touchstart', onTouchStart);
        touchLayer.removeEventListener('touchmove',  onTouchMove);
        arRenderer.setAnimationLoop(null);
        arRenderer.domElement.remove();
        arRenderer.dispose();
        domOverlayRoot.remove();
        setStatus('model-ready');
        setPlaced(false);
      });

    } catch (err: any) {
      log(`WebXR error: ${err?.message ?? String(err)}`);
      log('Falling back to camera AR...');
      await startCameraAR();
    }
  }

  async function startCameraAR() {
    log('Starting Camera AR fallback...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: window.innerWidth }, height: { ideal: window.innerHeight } },
        audio: false,
      });
      log('Camera stream ready ✓');

      const video = document.createElement('video');
      video.srcObject = stream; video.autoplay = true;
      video.playsInline = true; video.muted = true;
      video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:9990;';
      document.body.appendChild(video);
      await video.play();
      log('Video playing ✓');

      const arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      arRenderer.setPixelRatio(window.devicePixelRatio);
      arRenderer.setSize(window.innerWidth, window.innerHeight);
      arRenderer.setClearColor(0x000000, 0);
      arRenderer.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9991;touch-action:none;';
      document.body.appendChild(arRenderer.domElement);

      const arScene  = new THREE.Scene();
      const arCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
      arScene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const arDir = new THREE.DirectionalLight(0xffeedd, 2);
      arDir.position.set(1, 3, 1); arScene.add(arDir);
      const arFill = new THREE.DirectionalLight(0xaaccff, 0.5);
      arFill.position.set(-2, 1, -1); arScene.add(arFill);

      const loader = new GLTFLoader();
      loader.load(
        glbUrl,
        (gltf: any) => {
          const model = gltf.scene;
          const box   = new THREE.Box3().setFromObject(model);
          const size  = box.getSize(new THREE.Vector3());
          const scale = 0.4 / Math.max(size.x, size.y, size.z);
          model.scale.setScalar(scale);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center.multiplyScalar(scale));
          model.position.set(0, -0.3, -1.2);
          arScene.add(model);
          xrRef.current.model = model;
          log('Camera AR model placed ✓');
          setPlaced(true);
        },
        undefined,
        (err: any) => log(`GLB err: ${err?.message}`),
      );

      let lastTouchX    = 0;
      let lastTouchY    = 0;
      let lastPinchDist = 0;
      let modelScale    = 1.0;

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
          m.rotation.x  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, m.rotation.x + dy));
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }

        if (e.touches.length === 2) {
          const dx    = e.touches[0].clientX - e.touches[1].clientX;
          const dy    = e.touches[0].clientY - e.touches[1].clientY;
          const dist  = Math.sqrt(dx * dx + dy * dy);
          const delta = dist / lastPinchDist;
          modelScale  = Math.max(0.15, Math.min(5.0, modelScale * delta));
          m.scale.setScalar(0.4 * modelScale);
          lastPinchDist = dist;
        }
      };

      arRenderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true  });
      arRenderer.domElement.addEventListener('touchmove',  onTouchMove,  { passive: false });

      let animId = 0;
      const tick = () => {
        animId = requestAnimationFrame(tick);
        arRenderer.render(arScene, arCamera);
      };
      tick();

      const cleanup = () => {
        cancelAnimationFrame(animId);
        stream.getTracks().forEach(t => t.stop());
        video.remove();
        arRenderer.domElement.removeEventListener('touchstart', onTouchStart);
        arRenderer.domElement.removeEventListener('touchmove',  onTouchMove);
        arRenderer.domElement.remove();
        arRenderer.dispose();
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
    xrRef.current.session?.end().catch(() => {});
    setStatus('model-ready');
    setPlaced(false);
  }

  function reposition() {
    const xr = xrRef.current;
    if (xr.model) {
      xr.model.position.set(0, -0.3, -1.2);
      xr.model.rotation.set(0, 0, 0);
      xr.model.scale.setScalar(0.4);
    }
  }

  // ── AR ACTIVE (camera fallback overlay) ───────────────────────────────────
  if (status === 'ar-active') {
    return (
      <div
        ref={overlayRef}
        className="fixed inset-0"
        style={{ zIndex: 9999, pointerEvents: 'none' }}
      >
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-5"
          style={{ pointerEvents: 'auto', background: 'linear-gradient(to bottom,rgba(0,0,0,0.75),transparent)' }}
        >
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-white text-[12px] font-medium">AR Live</span>
          </div>
          <p className="font-serif text-white text-[16px] font-semibold drop-shadow">{itemName}</p>
          <button
            onClick={endAR}
            className="rounded-full px-4 py-1.5 text-white text-[13px] font-medium"
            style={{ pointerEvents: 'auto', background: 'rgba(0,0,0,0.6)' }}
          >
            Exit AR
          </button>
        </div>

        <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: 210, pointerEvents: 'none' }}>
          <div className="rounded-full px-4 py-1.5" style={{ background: 'rgba(212,163,78,0.15)', border: '1px solid rgba(212,163,78,0.3)' }}>
            <p className="text-[11px] text-center" style={{ color: '#14b8a6' }}>
              1 finger: rotate · 2 fingers: pinch to scale
            </p>
          </div>
        </div>

        <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: 150, pointerEvents: 'none' }}>
          <div className="rounded-full px-5 py-2.5" style={{ background: 'rgba(0,0,0,0.65)' }}>
            <p className="text-white text-[13px] text-center">Drag to rotate · Pinch to scale</p>
          </div>
        </div>

        <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: 70, pointerEvents: 'auto' }}>
          <button
            onClick={reposition}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-white text-[13px]"
            style={{ background: 'rgba(0,0,0,0.65)' }}
          >
            <RotateCcw size={15} /> Reset Position
          </button>
        </div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div
        className="w-full flex flex-col items-center justify-center gap-4 rounded-[24px] py-16 px-6"
        style={{ background: '#ffffff', border: '0.5px solid rgba(239,83,80,0.20)' }}
      >
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-[14px] text-white/50 text-center max-w-[280px] leading-relaxed">{errorMsg}</p>
        {debugLog.map((l, i) => (
          <p key={i} className="text-[10px] text-white/25 font-mono text-center">{l}</p>
        ))}
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-xl border border-white/10 text-white/40 text-[13px]"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── CANVAS ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className="relative w-full rounded-[24px] overflow-hidden border border-white/[0.06]"
        style={{ height: isMobile ? 360 : 480, background: '#ffffff' }}
      >
        <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />

        {(status === 'detecting' || status === 'loading-model' || loadPct < 100) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(15,13,10,0.92)' }}>
            <div className="text-[60px] opacity-40">{emoji}</div>
            <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[13px]">
                {status === 'detecting' ? 'Detecting device…' : `Loading 3D model… ${loadPct}%`}
              </span>
            </div>
            <div className="w-48 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${loadPct}%`, background: 'rgba(212,163,78,0.6)' }} />
            </div>
            <div className="mt-2 px-4">
              {debugLog.map((l, i) => (
                <p key={i} className="text-[10px] font-mono text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>{l}</p>
              ))}
            </div>
          </div>
        )}

        {status === 'model-ready' && (
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: 'rgba(0,0,0,0.55)' }}>
            {isMobile ? <Smartphone size={13} style={{ color: '#14b8a6' }} /> : <Monitor size={13} style={{ color: '#14b8a6' }} />}
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {isMobile ? '3D Preview' : '360° View — Drag to rotate'}
            </span>
          </div>
        )}

        {status === 'model-ready' && !isMobile && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            {[
              { icon: <RotateCcw size={15} />, action: () => { if (threeRef.current?.controls) threeRef.current.controls.autoRotate = !threeRef.current.controls.autoRotate; } },
              { icon: <ZoomIn size={15} />,    action: () => { if (threeRef.current?.camera) threeRef.current.camera.position.multiplyScalar(0.85); } },
              { icon: <ZoomOut size={15} />,   action: () => { if (threeRef.current?.camera) threeRef.current.camera.position.multiplyScalar(1.15); } },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 transition-all"
                style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.5)' }}>
                {btn.icon}
              </button>
            ))}
          </div>
        )}

        <p className="absolute bottom-4 left-4 text-[11px] pointer-events-none" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {isMobile ? 'Drag to rotate · Pinch to zoom' : 'Drag to rotate · Scroll to zoom'}
        </p>
      </div>

      {isMobile && status === 'model-ready' && (
        <div className="flex flex-col gap-3">
          <button
            onClick={startAR}
            className="w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-medium text-[16px] active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#14b8a6,#c4873c)', color: '#ffffff' }}
          >
            <Smartphone size={22} />
            Launch AR View
          </button>
          <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {arSupport ? 'WebXR AR — places dish on real surfaces' : 'Camera AR — dish overlay on live camera feed'}
          </p>
        </div>
      )}

      {debugLog.length > 0 && status === 'model-ready' && (
        <div className="rounded-xl p-3 border border-white/[0.05]" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <p className="text-[9px] text-white/15 uppercase tracking-widest mb-1 font-mono">Debug</p>
          {debugLog.map((l, i) => (
            <p key={i} className="text-[10px] text-white/30 font-mono leading-relaxed">{l}</p>
          ))}
          <p className="text-[10px] font-mono mt-1" style={{ color: arSupport ? '#81c784' : '#ffb74d' }}>
            WebXR: {arSupport ? 'SUPPORTED ✓' : 'Camera fallback mode'}
          </p>
          <p className="text-[10px] text-white/20 font-mono">
            Protocol: {typeof window !== 'undefined' ? window.location.protocol : ''}
          </p>
        </div>
      )}

      <div ref={overlayRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }} />
    </div>
  );
}