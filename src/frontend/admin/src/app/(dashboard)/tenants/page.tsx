'use client';

/**
 * /tenants
 * =========
 * Only for whoever holds `tenants:read`. The middleware already turns others
 * away before this renders; the guard here is the readable second line —
 * it explains the refusal instead of bouncing silently.
 */

import PermissionGuard from '@/components/auth/PermissionGuard';
import TenantsView from './_TenantsView';

export default function TenantsPage() {
  return (
    <PermissionGuard permission="tenants:read" showMessage>
      <TenantsView />
    </PermissionGuard>
  );
}
