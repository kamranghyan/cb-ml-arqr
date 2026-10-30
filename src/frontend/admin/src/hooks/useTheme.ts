// hooks/useTheme.ts
'use client';

import { useState, useEffect } from 'react';
import { getTheme, toggleTheme as toggleThemeLib } from '@/lib/theme';

export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const updateTheme = () => {
      setIsDark(getTheme() === 'dark');
    };
    
    updateTheme();
    
    // Listen for theme changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('themeChange', updateTheme);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', updateTheme);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = toggleThemeLib();
    setIsDark(newTheme === 'dark');
    // Dispatch event for other components
    window.dispatchEvent(new Event('themeChange'));
  };

  return { isDark, toggleTheme, mounted };
}