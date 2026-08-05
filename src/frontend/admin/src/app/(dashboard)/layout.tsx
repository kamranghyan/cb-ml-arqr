'use client';

import { useState } from 'react';
import { Menu as MenuIcon, X } from 'lucide-react';

import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';

const C = { bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A' };

/**
 * Every signed-in page lives under this layout: one sidebar, one session
 * check. Which menu items appear is decided by the person's permissions, not
 * by which folder the page sits in.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <AuthGuard>
      <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
        {/* Mobile drawer */}
        {open && (
          <aside style={{
            width: 250, background: C.white, borderRight: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column',
            position: 'fixed', inset: '0 auto 0 0', zIndex: 40,
          }}>
            <Sidebar />
          </aside>
        )}

        <aside className="sidebar-desktop" style={{
          width: 250, background: C.white, borderRight: `1px solid ${C.border}`,
          flexDirection: 'column', flexShrink: 0,
        }}>
          <Sidebar />
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          <header className="mobile-header" style={{
            height: 56, background: C.white, borderBottom: `1px solid ${C.border}`,
            alignItems: 'center', padding: '0 16px', gap: 12,
          }}>
            <button onClick={() => setOpen(!open)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
              {open ? <X size={20} /> : <MenuIcon size={20} />}
            </button>
            <span style={{ fontWeight: 800, color: C.text }}>MenuLay</span>
          </header>

          <main>{children}</main>
        </div>

        <style>{`
          .sidebar-desktop { display: flex; }
          .mobile-header { display: none; }
          @media (max-width: 768px) {
            .sidebar-desktop { display: none; }
            .mobile-header { display: flex; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </AuthGuard>
  );
}
