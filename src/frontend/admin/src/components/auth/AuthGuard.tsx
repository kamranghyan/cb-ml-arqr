'use client';

/**
 * AuthGuard
 * =========
 * Waits for the session to resolve before rendering children.
 *
 * The middleware has already turned away anyone without a session, so this is
 * about the brief moment before the client knows who it is — without it,
 * pages flash empty state for a frame and then fill in.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import LoadingScreen from '@/components/common/LoadingScreen';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) return <LoadingScreen message="Checking your session…" />;
  if (!user)   return <LoadingScreen message="Redirecting to sign in…" />;

  return <>{children}</>;
}
