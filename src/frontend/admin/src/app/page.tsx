'use client';

/**
 * /restaurants
 * =========
 * Only for whoever holds `restaurants:read`. The middleware already turns others
 * away before this renders; the guard here is the readable second line —
 * it explains the refusal instead of bouncing silently.
 */

import PermissionGuard from '@/components/auth/PermissionGuard';
import RestaurantsView from '@/app/(dashboard)/restaurants/_RestaurantsView';

export default function RestaurantsPage() {
  return (
    <PermissionGuard permission="restaurants:read" showMessage>
      <RestaurantsView />
    </PermissionGuard>
  );
}
