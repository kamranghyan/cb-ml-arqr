'use client';

/**
 * /orders
 * =========
 * Shared route. Both roles open the same URL and each is shown the view that
 * fits their scope — an administrator works across companies, an owner works
 * inside one. Keeping the URL common means links can be shared between
 * colleagues without breaking.
 */

import { useCurrentUser } from '@/hooks/useCurrentUser';
import LoadingScreen from '@/components/common/LoadingScreen';
import NoAccess from '@/components/common/NoAccess';
import AdminOrders from '@/components/views/admin/AdminOrders';
import TenantOrders from '@/components/views/tenant/TenantOrders';

export default function OrdersPage() {
  const { role, loading } = useCurrentUser();

  if (loading) return <LoadingScreen />;

  if (role === 'admin')  return <AdminOrders />;
  if (role === 'tenant') return <TenantOrders />;

  return <NoAccess />;
}
