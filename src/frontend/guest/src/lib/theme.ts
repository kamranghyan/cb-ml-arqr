export type Theme = 'light' | 'dark';

const THEME_KEY = 'dp_theme';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  const stored = localStorage.getItem(THEME_KEY);

  return stored === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);

  // Notify all components that depend on the theme
  window.dispatchEvent(new CustomEvent('themeChange', {
    detail: theme,
  }));
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light';

  setTheme(next);

  return next;
}

export function initTheme() {
  if (typeof window === 'undefined') return;

  const theme = getTheme();

  document.documentElement.setAttribute('data-theme', theme);
}