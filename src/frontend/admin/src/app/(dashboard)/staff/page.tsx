'use client';

/**
 * /staff
 * =========
 * Only for whoever holds `staff:read`. The middleware already turns others
 * away before this renders; the guard here is the readable second line —
 * it explains the refusal instead of bouncing silently.
 */

import PermissionGuard from '@/components/auth/PermissionGuard';
import StaffView from './_StaffView';

export default function StaffPage() {
  return (
    <PermissionGuard permission="staff:read" showMessage>
      <StaffView />
    </PermissionGuard>
  );
}
