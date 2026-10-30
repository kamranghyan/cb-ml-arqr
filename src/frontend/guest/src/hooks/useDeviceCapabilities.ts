'use client';

import { useEffect, useState } from 'react';

export interface DeviceCapabilities {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  iosVersion: number | null;

  supportsWebXR: boolean | null;
  supportsARQuick: boolean;

  // Whether immersive-ar is available.
  // Actual hit-test support should still be handled by ARViewer/session.
  supportsHitTest: boolean | null;

  isLoading: boolean;
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [caps, setCaps] = useState<DeviceCapabilities>({
    isMobile: false,
    isIOS: false,
    isAndroid: false,
    iosVersion: null,
    supportsWebXR: null,
    supportsARQuick: false,
    supportsHitTest: null,
    isLoading: true,
  });

  useEffect(() => {
    const ua = navigator.userAgent;

    const isIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as any).MSStream;

    const isAndroid = /Android/i.test(ua);

    const isMobile =
      isIOS ||
      isAndroid ||
      /Mobi|Tablet/i.test(ua);

    let iosVersion: number | null = null;

    if (isIOS) {
      const match = ua.match(/OS (\d+)[._]/);

      if (match) {
        iosVersion = Number.parseInt(match[1], 10);
      }
    }

    const supportsARQuick =
      isIOS &&
      (iosVersion ?? 0) >= 12;

    const xr = (navigator as Navigator & {
      xr?: {
        isSessionSupported?: (
          mode: string
        ) => Promise<boolean>;
      };
    }).xr;

    if (
      xr &&
      typeof xr.isSessionSupported === 'function'
    ) {
      xr
        .isSessionSupported('immersive-ar')
        .then((supported) => {
          setCaps({
            isMobile,
            isIOS,
            isAndroid,
            iosVersion,
            supportsWebXR: supported,
            supportsARQuick,
            supportsHitTest: supported,
            isLoading: false,
          });
        })
        .catch(() => {
          setCaps({
            isMobile,
            isIOS,
            isAndroid,
            iosVersion,
            supportsWebXR: false,
            supportsARQuick,
            supportsHitTest: false,
            isLoading: false,
          });
        });
    } else {
      setCaps({
        isMobile,
        isIOS,
        isAndroid,
        iosVersion,
        supportsWebXR: false,
        supportsARQuick,
        supportsHitTest: false,
        isLoading: false,
      });
    }
  }, []);

  return caps;
}