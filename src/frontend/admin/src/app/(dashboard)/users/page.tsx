'use client';

/**
 * /users
 * =========
 * Only for whoever holds `users:read`. The middleware already turns others
 * away before this renders; the guard here is the readable second line —
 * it explains the refusal instead of bouncing silently.
 */

import PermissionGuard from '@/components/auth/PermissionGuard';
import UsersView from './_UsersView';

export default function UsersPage() {
  return (
    <PermissionGuard permission="users:read" showMessage>
      <UsersView />
    </PermissionGuard>
  );
}
