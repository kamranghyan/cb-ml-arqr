'use client';

import { useState, useEffect } from 'react';
import {
  getTheme,
  toggleTheme,
  initTheme,
  type Theme,
} from '@/lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    initTheme();
    setThemeState(getTheme());

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<Theme>;
      setThemeState(customEvent.detail || getTheme());
    };

    window.addEventListener('themeChange', handleThemeChange);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
    };
  }, []);

  const toggle = () => {
    const next = toggleTheme();
    setThemeState(next);
  };

  return {
    theme,
    toggle,
    isDark: theme === 'dark',
  };
}