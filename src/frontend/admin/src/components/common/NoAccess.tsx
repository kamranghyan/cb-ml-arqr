'use client';

import Link from 'next/link';
import { ShieldOff, ChevronRight } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { homeFor, ROLE_LABEL } from '@/lib/roles';

/**
 * Shown when someone reaches a page their role does not cover — usually a
 * link shared between two people with different access. It names the role
 * they are signed in as, which is the fastest way for them to realise they
 * are on the wrong account.
 */
export default function NoAccess({
  title = 'This page is not part of your account',
}: { title?: string }) {
  const { role } = useCurrentUser();

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
    }}>
      <ShieldOff size={30} color="#9CA3AF" style={{ marginBottom: 12 }} />
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A', margin: '0 0 6px' }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: '#687780', margin: '0 0 4px', maxWidth: 420 }}>
        You are signed in as {role ? ROLE_LABEL[role] : 'an unknown role'}.
      </p>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 18px', maxWidth: 420 }}>
        If you expected access here, the link may belong to a different account.
      </p>
      <Link href={homeFor(role)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '9px 16px', borderRadius: 9, background: '#E1251B',
        color: '#fff', textDecoration: 'none', fontSize: 13.5, fontWeight: 700,
      }}>
        Go to your dashboard <ChevronRight size={15} />
      </Link>
    </div>
  );
}
