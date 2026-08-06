'use client';

/**
 * RoleGuard
 * =========
 * Renders children only for the listed roles.
 *
 * Use it for whole pages that belong to one role. For a section inside a page
 * that both roles open, prefer PermissionGuard — it says *why* something is
 * restricted rather than *who* it is for.
 */

import { useCurrentUser } from '@/hooks/useCurrentUser';
import LoadingScreen from '@/components/common/LoadingScreen';
import NoAccess from '@/components/common/NoAccess';
import type { Role } from '@/types/auth';

export default function RoleGuard({
  roles,
  children,
  fallback,
}: {
  roles: Role[];
  children: React.ReactNode;
  /** Shown instead of the default message — useful for inline sections. */
  fallback?: React.ReactNode;
}) {
  const { role, loading } = useCurrentUser();

  if (loading) return <LoadingScreen />;

  if (!role || !roles.includes(role)) {
    return <>{fallback ?? <NoAccess />}</>;
  }

  return <>{children}</>;
}
