import type { Metadata, Viewport } from 'next';
// @ts-ignore: Allow side-effect CSS import without type declarations
import './globals.css';

export const metadata: Metadata = {
  title: 'Menulay — Digital Menu',
  description: 'Fine dining experience — scan, order, track',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Menulay',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&family=Baloo+2:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Theme initialization script - runs before anything else */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('admin_theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                  // Also set theme-color meta for mobile browsers
                  const meta = document.querySelector('meta[name="theme-color"]');
                  if (meta) {
                    meta.content = theme === 'dark' ? '#111111' : '#ffffff';
                  }
                } catch (e) {
                  // Fallback to light theme if localStorage is not available
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}