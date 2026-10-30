'use client';

/**
 * PermissionGuard
 * ===============
 * Renders children only when the signed-in person holds the permission.
 *
 * Wrapping a button in this hides it; it does not stop the underlying API
 * call. That is deliberate — the service is what enforces access. This is
 * here so people are not shown controls that would only fail.
 */

import { useCurrentUser } from '@/hooks/useCurrentUser';
import NoAccess from '@/components/common/NoAccess';
import type { Permission } from '@/types/auth';

export default function PermissionGuard({
  permission,
  anyOf,
  children,
  fallback = null,
  showMessage = false,
}: {
  permission?: Permission;
  /** Any one of these is enough. */
  anyOf?: Permission[];
  children: React.ReactNode;
  /** Rendered in place of the children. Defaults to nothing at all. */
  fallback?: React.ReactNode;
  /** Explain the refusal instead of hiding silently — for full pages. */
  showMessage?: boolean;
}) {
  const { can, canAny, loading } = useCurrentUser();

  if (loading) return null;

  const allowed = permission ? can(permission)
                : anyOf      ? canAny(anyOf)
                : true;

  if (!allowed) return <>{showMessage ? <NoAccess /> : fallback}</>;

  return <>{children}</>;
}
