'use client';

import Link from 'next/link';
import { ShieldOff, ChevronRight } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { homeFor, ROLE_LABEL } from '@/lib/roles';

// ── Color Schema (Matches other pages) ──────────────────────────────────
const BRAND = '#ff5723';
const D = {
  bg: '#111111',
  card: '#1C1C1C',
  card2: '#242424',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F0E8',
  muted: '#9CA3AF',
  subtle: '#6B7280',
};

/**
 * Shown when someone reaches a page their role does not cover — usually a
 * link shared between two people with different access. It names the role
 * they are signed in as, which is the fastest way for them to realise they
 * are on the wrong account.
 */
export default function NoAccess({
  title = 'This page is not part of your account',
}: { title?: string }) {
  const { isDark } = useTheme();
  const { role } = useCurrentUser();

  // Theme-aware colors
  const colors = isDark ? D : {
    bg: '#FFFFFF',
    card: '#ffffff',
    card2: '#F9FAFB',
    border: '#F0EBE6',
    text: '#000000',
    muted: '#6B6B6B',
    subtle: '#9CA3AF',
  };

  return (
    <div style={{
      background: colors.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: 'clamp(16px, 5vw, 40px)',
    }}>
      <div style={{
        maxWidth: 420,
        width: '100%',
        padding: 'clamp(24px, 4vw, 40px)',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <ShieldOff size={30} color={BRAND} />
          </div>

          <h2 style={{
            fontSize: 'clamp(18px, 2.5vw, 22px)',
            fontWeight: 800,
            color: colors.text,
            margin: '0 0 8px',
          }}>
            {title}
          </h2>

          <p style={{
            fontSize: 'clamp(13px, 1.5vw, 15px)',
            color: colors.muted,
            margin: '0 0 4px',
            maxWidth: '100%',
          }}>
            You are signed in as <strong style={{ color: colors.text }}>
              {role ? ROLE_LABEL[role] : 'an unknown role'}
            </strong>.
          </p>

          <p style={{
            fontSize: 'clamp(12px, 1.3vw, 14px)',
            color: colors.subtle,
            margin: '0 0 24px',
            maxWidth: '100%',
          }}>
            If you expected access here, the link may belong to a different account.
          </p>

          <Link
            href={homeFor(role)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              borderRadius: 9,
              background: BRAND,
              color: '#fff',
              textDecoration: 'none',
              fontSize: 'clamp(13px, 1.3vw, 14px)',
              fontWeight: 700,
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e04a1a';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,87,35,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BRAND;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Go to your dashboard
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}