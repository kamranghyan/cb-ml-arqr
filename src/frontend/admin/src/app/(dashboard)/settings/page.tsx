'use client';

/**
 * /settings
 * =========
 * Shared route. Both roles open the same URL and each is shown the view that
 * fits their scope — an administrator works across companies, an owner works
 * inside one. Keeping the URL common means links can be shared between
 * colleagues without breaking.
 */

import { useCurrentUser } from '@/hooks/useCurrentUser';
import LoadingScreen from '@/components/common/LoadingScreen';
import NoAccess from '@/components/common/NoAccess';
import AdminSettings from '@/components/views/admin/AdminSettings';
import TenantSettings from '@/components/views/tenant/TenantSettings';
import { getTheme } from '@/lib/theme';
import { useState, useEffect } from 'react';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: '#ff5723',
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
});

export default function SettingsPage() {
  const { role, loading } = useCurrentUser();
  const [isDark, setIsDark] = useState(false);

  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };
    
    updateTheme();
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);
    
    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  const colors = getColors(isDark);

  // Show loading state while checking user
  if (loading) {
    return (
      <div style={{
        background: colors.bg,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Poppins', sans-serif",
      }}>
        <LoadingScreen />
      </div>
    );
  }

  // Check if user has a valid role
  if (!role) {
    return (
      <div style={{
        background: colors.bg,
        minHeight: '100vh',
        padding: 24,
        fontFamily: "'Poppins', sans-serif",
      }}>
        <NoAccess />
      </div>
    );
  }

  // Render appropriate settings view based on role
  if (role === 'admin') {
    return <AdminSettings />;
  }

  if (role === 'tenant') {
    return <TenantSettings />;
  }

  // Fallback for any other role (should not happen)
  return (
    <div style={{
      background: colors.bg,
      minHeight: '100vh',
      padding: 24,
      fontFamily: "'Poppins', sans-serif",
    }}>
      <NoAccess title="Settings not available for your role" />
    </div>
  );
}