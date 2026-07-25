'use client';

import { useState, useEffect } from 'react';

export interface DeviceCapabilities {
  isMobile:        boolean;
  isIOS:           boolean;
  isAndroid:       boolean;
  iosVersion:      number | null;     // major version e.g. 16
  supportsWebXR:   boolean | null;    // null = still checking
  supportsARQuick: boolean;           // iOS AR Quick Look (.usdz)
  supportsHitTest: boolean | null;    // WebXR hit-test module
  isLoading:       boolean;
}

/**
 * Detect device type and XR capabilities.
 *
 * Strategy:
 * - Mobile  → try WebXR AR (Chrome Android / iOS Safari 16+)
 * - Desktop → 360° Three.js model viewer only
 */
export function useDeviceCapabilities(): DeviceCapabilities {
  const [caps, setCaps] = useState<DeviceCapabilities>({
    isMobile: false, isIOS: false, isAndroid: false,
    iosVersion: null, supportsWebXR: null, supportsARQuick: false,
    supportsHitTest: null, isLoading: true,
  });

  useEffect(() => {
    const ua = navigator.userAgent;

    const isIOS     = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isMobile  = isIOS || isAndroid || /Mobi|Tablet/i.test(ua);

    // iOS version detection (for AR Quick Look: iOS 12+, WebXR: iOS 16+)
    let iosVersion: number | null = null;
    if (isIOS) {
      const m = ua.match(/OS (\d+)_/);
      if (m) iosVersion = parseInt(m[1], 10);
    }

    // iOS AR Quick Look — supported on iOS 12+ Safari with .usdz
    const supportsARQuick = isIOS && (iosVersion ?? 0) >= 12;

    // Check WebXR AR support
    const xrNav = (navigator as any).xr;
    if (xrNav && typeof xrNav.isSessionSupported === 'function') {
      xrNav.isSessionSupported('immersive-ar').then((supported: boolean) => {
        setCaps({
          isMobile, isIOS, isAndroid, iosVersion,
          supportsWebXR: supported,
          supportsARQuick,
          supportsHitTest: supported, // hit-test requires immersive-ar
          isLoading: false,
        });
      }).catch(() => {
        setCaps((p) => ({ ...p, supportsWebXR: false, supportsHitTest: false, isLoading: false }));
      });
    } else {
      setCaps({
        isMobile, isIOS, isAndroid, iosVersion,
        supportsWebXR: false,
        supportsARQuick,
        supportsHitTest: false,
        isLoading: false,
      });
    }
  }, []);

  return caps;
}
