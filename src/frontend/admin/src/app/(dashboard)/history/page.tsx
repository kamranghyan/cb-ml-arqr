'use client';

/**
 * /history
 * =========
 * Shared route. Both roles open the same URL and each is shown the view that
 * fits their scope — an administrator works across companies, an owner works
 * inside one. Keeping the URL common means links can be shared between
 * colleagues without breaking.
 */

import { useCurrentUser } from '@/hooks/useCurrentUser';
import LoadingScreen from '@/components/common/LoadingScreen';
import NoAccess from '@/components/common/NoAccess';
import AdminHistory from '@/components/views/admin/AdminHistory';
import TenantHistory from '@/components/views/tenant/TenantHistory';

export default function HistoryPage() {
  const { role, loading } = useCurrentUser();

  if (loading) return <LoadingScreen />;

  if (role === 'admin')  return <AdminHistory />;
  if (role === 'tenant') return <TenantHistory />;

  return <NoAccess />;
}
