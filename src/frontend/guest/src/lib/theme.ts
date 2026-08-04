// src/lib/theme.ts — theme helpers, readable everywhere
export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem('dp_theme') as Theme) ?? 'light';
}

export function setTheme(t: Theme) {
  localStorage.setItem('dp_theme', t);
  document.documentElement.setAttribute('data-theme', t);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
}

export function initTheme() {
  const t = getTheme();
  document.documentElement.setAttribute('data-theme', t);
}