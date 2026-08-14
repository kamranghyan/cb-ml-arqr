'use client';

import { useState, useEffect } from 'react';
import { Menu as MenuIcon, X, Sun, Moon } from 'lucide-react';

import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/useTheme';
import { getTheme, toggleTheme } from '@/lib/theme';

/**
 * Every signed-in page lives under this layout: one sidebar, one session
 * check. Which menu items appear is decided by the person's permissions, not
 * by which folder the page sits in.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Get initial theme
  useEffect(() => {
    const currentTheme = getTheme();
    setTheme(currentTheme);
  }, []);

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      const currentTheme = getTheme();
      setTheme(currentTheme);
    };
    window.addEventListener('themeChange', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);
    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  const handleToggleTheme = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);
    window.dispatchEvent(new Event('themeChange'));
  };

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

  // Close drawer when escape key is pressed
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <AuthGuard>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: D.bg,
        transition: 'background 0.25s'
      }}>
        {/* Desktop Header - Fixed at top */}
        <header className="desktop-header" style={{
          height: 64,
          background: '#ff5723',
          borderBottom: `1px solid rgba(255,255,255,0.1)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
        }}>
          {/* Logo - Left side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img 
              src='/Images/logo.png' 
              alt="Menulay Logo" 
              style={{ 
                width: 120, 
                height: 32, 
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)'
              }} 
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'Baloo 2', sans-serif",
                fontSize: 16,
                lineHeight: 1.1,
              }}>
                Admin
              </span>
              <span style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                lineHeight: 1,
              }}>
                Dashboard
              </span>
            </div>
          </div>

          {/* Right side - Theme toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#fff',
            fontSize: 14,
          }}>
            <button 
              onClick={handleToggleTheme} 
              aria-label="Toggle theme"
              style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 8, 
                border: '1.5px solid rgba(255,255,255,0.2)', 
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                flexShrink: 0,
                color: '#fff',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
            >
              {theme === 'dark' ? (
                <Sun size={18} color="#fff" />
              ) : (
                <Moon size={18} color="#fff" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Header - Fixed at top */}
        <header className="mobile-header" style={{
          height: 56,
          background: '#ff5723',
          borderBottom: `1px solid rgba(255,255,255,0.1)`,
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: 12,
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
        }}>
      

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Menu button */}
          <button
            onClick={() => setOpen(!open)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#fff',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            {open ? <X size={24} /> : <MenuIcon size={24} />}
          </button>
            <img
              src='/Images/logo.png'
              alt="Menulay Logo"
              style={{
                width: 80,
                height: 24,
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'Baloo 2', sans-serif",
                fontSize: 14,
                lineHeight: 1.1,
              }}>
                Admin
              </span>
              <span style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 7,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                lineHeight: 1,
              }}>
                Dashboard
              </span>
            </div>
          </div>

          {/* Theme toggle button for mobile */}
          <button 
            onClick={handleToggleTheme} 
            aria-label="Toggle theme"
            style={{ 
              width: 34, 
              height: 34, 
              borderRadius: 8, 
              border: '1.5px solid rgba(255,255,255,0.2)', 
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer', 
              flexShrink: 0,
              color: '#fff',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
          >
            {theme === 'dark' ? (
              <Sun size={16} color="#fff" />
            ) : (
              <Moon size={16} color="#fff" />
            )}
          </button>
        </header>

        {/* Main content area with sidebar and children */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
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
              width: 239,
              background: D.white,
              borderRight: `1px solid ${D.border}`,
              display: 'flex',
              flexDirection: 'column',
              position: 'fixed',
              inset: '56px auto 0 0',
              zIndex: 40,
              height: 'calc(100vh - 56px)',
              overflow: 'hidden',
              animation: 'slideIn 0.3s ease',
              boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
            }}>
              <Sidebar />
            </aside>
          )}

          {/* Desktop Sidebar - Fixed, doesn't scroll */}
          <aside className="sidebar-desktop" style={{
            background: D.white,
            flexDirection: 'column',
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            width: 240,
            borderRight: `1px solid ${D.border}`,
          }}>
            <Sidebar />
          </aside>

          {/* Content - This scrolls independently */}
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
          .desktop-header {
            display: flex;
          }
          
          @media (max-width: 768px) {
            .sidebar-desktop { 
              display: none !important; 
            }
            .mobile-header { 
              display: flex !important; 
            }
            .desktop-header {
              display: none !important;
            }
          }
          
          @media (min-width: 769px) {
            .desktop-header {
              display: flex !important;
            }
            .mobile-header {
              display: none !important;
            }
            .sidebar-desktop {
              display: flex !important;
            }
          }
          
          @keyframes spin { 
            to { transform: rotate(360deg); } 
          }
          
          @keyframes slideIn {
            from {
              transform: translateX(-100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
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
          
          /* Mobile responsive adjustments */
          @media (max-width: 480px) {
            .mobile-header {
              height: 50px !important;
              padding: 0 12px !important;
            }
            .mobile-header img {
              width: 60px !important;
              height: 18px !important;
            }
            .mobile-header span:first-child {
              font-size: 12px !important;
            }
            .mobile-header span:last-child {
              font-size: 6px !important;
            }
            .mobile-header button {
              padding: 2px !important;
            }
            .mobile-header button svg {
              width: 20px !important;
              height: 20px !important;
            }
            
            .desktop-header {
              height: 56px !important;
              padding: 0 16px !important;
            }
            .desktop-header img {
              width: 100px !important;
              height: 28px !important;
            }
            .desktop-header span:first-child {
              font-size: 14px !important;
            }
          }
        `}</style>
      </div>
    </AuthGuard>
  );
}