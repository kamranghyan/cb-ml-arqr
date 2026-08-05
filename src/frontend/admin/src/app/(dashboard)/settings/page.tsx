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

export default function SettingsPage() {
  const { role, loading } = useCurrentUser();

  if (loading) return <LoadingScreen />;

  if (role === 'admin')  return <AdminSettings />;
  if (role === 'tenant') return <TenantSettings />;

  return <NoAccess />;
}
