'use client';

import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { getTheme } from '@/lib/theme';

export default function ThemeToaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const updateTheme = () => {
      setTheme(getTheme() === 'dark' ? 'dark' : 'light');
    };

    updateTheme();

    const handleThemeChange = () => updateTheme();

    window.addEventListener('themeChange', handleThemeChange);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
    };
  }, []);

  return (
    <Toaster
      position="top-center"
      richColors
      theme={theme}
    />
  );
}