'use client';

import { useState, useEffect } from 'react';
import { Menu as MenuIcon, X } from 'lucide-react';

import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/useTheme';

/**
 * Every signed-in page lives under this layout: one sidebar, one session
 * check. Which menu items appear is decided by the person's permissions, not
 * by which folder the page sits in.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();

  const D = isDark ? {
    bg: '#111111', 
    white: '#1C1C1C', 
    border: 'rgba(255,255,255,0.08)', 
    text: '#F5F0E8',
    muted: '#9CA3AF',
  } : {
    bg: '#FFFFFF', 
    white: '#fff', 
    border: '#F0EBE6', 
    text: '#000000',
    muted: '#6B6B6B',
  };

  // Close mobile drawer on window resize (if switching to desktop)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AuthGuard>
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        overflow: 'hidden',
        background: D.bg, 
        transition: 'background 0.25s' 
      }}>
        {/* Mobile drawer overlay */}
        {open && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 39,
              transition: 'opacity 0.3s ease',
            }}
            onClick={() => setOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        {open && (
          <aside style={{
            width: 250,
            background: D.white,
            borderRight: `1px solid ${D.border}`,
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            inset: '0 auto 0 0',
            zIndex: 40,
            height: '100vh',
            overflow: 'hidden',
            animation: 'slideIn 0.3s ease',
          }}>
            <Sidebar />
          </aside>
        )}

        {/* Desktop Sidebar */}
        <aside className="sidebar-desktop" style={{
          background: D.white,
          flexDirection: 'column',
          flexShrink: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
        }}>
          <Sidebar />
        </aside>

        {/* Main Content Area */}
        <div style={{ 
          flex: 1, 
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}>
          {/* Mobile Header */}
          <header className="mobile-header" style={{
            height: 56,
            background: D.white,
            borderBottom: `1px solid ${D.border}`,
            display: 'none',
            alignItems: 'center',
            padding: '0 16px',
            gap: 12,
            flexShrink: 0,
          }}>
            <button 
              onClick={() => setOpen(!open)}
              style={{ 
                border: 'none', 
                background: 'none', 
                cursor: 'pointer', 
                color: D.text,
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {open ? <X size={20} /> : <MenuIcon size={20} />}
            </button>
            <span style={{ 
              fontWeight: 700, 
              color: D.text, 
              fontFamily: "'Baloo 2', sans-serif",
              fontSize: 16,
            }}>
              MenuLay
            </span>
          </header>

          {/* Content with scroll - hidden scrollbar */}
          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 0,
            background: D.bg,
            // Hide scrollbar for Firefox
            scrollbarWidth: 'none',
            // Hide scrollbar for IE/Edge
            msOverflowStyle: 'none',
          }}>
            {children}
          </main>
        </div>

        <style>{`
          .sidebar-desktop { 
            display: flex; 
          }
          .mobile-header { 
            display: none; 
          }
          
          @media (max-width: 768px) {
            .sidebar-desktop { 
              display: none; 
            }
            .mobile-header { 
              display: flex; 
            }
          }
          
          @keyframes spin { 
            to { transform: rotate(360deg); } 
          }
          
          @keyframes slideIn {
            from {
              transform: translateX(-100%);
            }
            to {
              transform: translateX(0);
            }
          }
          
          /* Hide scrollbar for Chrome, Safari and Opera */
          main::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }
          
          /* Alternative for Chrome, Safari and Opera */
          main::-webkit-scrollbar {
            width: 0px;
            background: transparent;
          }
        `}</style>
      </div>
    </AuthGuard>
  );
}