'use client';

/**
 * /dashboard
 * =========
 * Shared route. Both roles open the same URL and each is shown the view that
 * fits their scope — an administrator works across companies, an owner works
 * inside one. Keeping the URL common means links can be shared between
 * colleagues without breaking.
 */

import { useCurrentUser } from '@/hooks/useCurrentUser';
import LoadingScreen from '@/components/common/LoadingScreen';
import NoAccess from '@/components/common/NoAccess';
import AdminDashboard from '@/components/views/admin/AdminDashboard';
import TenantDashboard from '@/components/views/tenant/TenantDashboard';

export default function DashboardPage() {
  const { role, loading } = useCurrentUser();

  if (loading) return <LoadingScreen />;

  if (role === 'admin')  return <AdminDashboard />;
  if (role === 'tenant') return <TenantDashboard />;

  return <NoAccess />;
}
