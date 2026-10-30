// src/hooks/useTheme.ts
'use client';
import { useState, useEffect } from 'react';
import { getTheme, toggleTheme, initTheme, type Theme } from '@/lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    initTheme();
    setThemeState(getTheme());
  }, []);

  const toggle = () => {
    const next = toggleTheme();
    setThemeState(next);
  };

  return { theme, toggle, isDark: theme === 'dark' };
}