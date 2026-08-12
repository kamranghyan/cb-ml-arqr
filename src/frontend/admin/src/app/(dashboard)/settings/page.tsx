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
import { useTheme } from '@/hooks/useTheme';

// ── Color Schema ──────────────────────────────────────────────────────────
const D = {
  bg: '#111111',
  card: '#1C1C1C',
  card2: '#242424',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F0E8',
  muted: '#9CA3AF',
  subtle: '#6B7280',
};
const L = {
  bg: '#FFFFFF',
  card: '#ffffff',
  card2: '#F9FAFB',
  border: '#F0EBE6',
  text: '#000000',
  muted: '#6B6B6B',
  subtle: '#9CA3AF',
};

export default function SettingsPage() {
  const { role, loading } = useCurrentUser();
  const { isDark } = useTheme();
  const colors = isDark ? D : L;

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
    }}>
      <NoAccess title="Settings not available for your role" />
    </div>
  );
}