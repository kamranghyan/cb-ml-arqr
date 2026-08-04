'use client';

/**
 * GuestTopBar
 * ===========
 * Shared top bar: logo mark + wordmark, bell, hamburger.
 *
 * New in the Figma redesign — the old header was just greeting text, no
 * persistent top bar existed before. Self-contained (reads theme itself)
 * so any screen can drop it in with no props.
 *
 * Two things NOT in the Figma but kept for now, both flagged to Irfan:
 *  - Light/dark toggle: the Figma has no toggle button anywhere on this
 *    screen, but dropping it would remove working functionality, so it's
 *    kept here as a small icon rather than deleted. Easy to relocate
 *    (e.g. into the hamburger drawer) once that's built.
 *  - Bell / hamburger are visual-only for now — no notifications panel or
 *    drawer menu exists yet, so they don't navigate anywhere.
 *
 * Logo mark is a hand-approximated SVG redraw of the Figma icon (no
 * vector/asset file was provided) — swap in the real logo file if/when
 * you have the source asset.
 */

import { Bell, Menu as MenuIcon, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import Image from 'next/image';

const BRAND = '#ff5723';

export default function GuestTopBar() {
  const { isDark, toggle } = useTheme();

  const bg     = isDark ? '#1C1C1C' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px 14px', background: bg, borderBottom: `1px solid ${border}`,
      }}
    >
      {/* Logo mark + wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/Images/nav/logo.png" alt="Menulay Logo" width={107.5} height={35} />
      </div>

      {/* Bell + hamburger (+ theme toggle, kept for now — see note above) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          aria-label="Notifications"
          style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: BRAND,
          }}
        >
        <Image src="/Images/nav/Bell.png" alt="Menulay Logo" width={32} height={32} />
        </button>
        <button
          aria-label="Menu"
          style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: BRAND,
          }}
        >
        <Image src="/Images/nav/Menu.png" alt="Menulay Logo" width={32} height={32} />
        </button>
      </div>
    </div>
  );
}