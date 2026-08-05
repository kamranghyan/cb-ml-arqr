'use client';

/**
 * hooks/useCurrentUser.ts
 * =======================
 * Who is signed in, from the token this browser already holds.
 *
 * Reading the token rather than an API call keeps every page render free of a
 * round trip. The token is refreshed by `lib/cognito.ts` when it nears
 * expiry, so this stays current without polling.
 */

import { useEffect, useState } from 'react';

import { userFromToken } from '@/lib/auth';
import { getStoredIdToken } from '@/lib/cognito';
import type { AuthUser, Permission, Role } from '@/types/auth';

export interface CurrentUser {
  user:    AuthUser | null;
  loading: boolean;
  role:    Role | null;
  is:      (role: Role) => boolean;
  can:     (permission: Permission) => boolean;
  canAny:  (permissions: Permission[]) => boolean;
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredIdToken();
    setUser(token ? userFromToken(token) : null);
    setLoading(false);
  }, []);

  return {
    user,
    loading,
    role:   user?.role ?? null,
    is:     (role) => user?.role === role,
    can:    (permission) => user?.permissions.includes(permission) ?? false,
    canAny: (permissions) => permissions.some(p => user?.permissions.includes(p)),
  };
}
