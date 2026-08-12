// components/ThemeWrapper.tsx
'use client';

import { useEffect } from 'react';
import { initTheme } from '@/lib/theme';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTheme();
  }, []);
  
  return <>{children}</>;
}