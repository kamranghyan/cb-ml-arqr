'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { getTheme } from '@/lib/theme';

// ── Theme Colors ──

const BRAND = '#ff5723';

const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  green: isDark ? '#4ade80' : '#16a34a',
  greenBg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
  greenBorder: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
  orange: isDark ? '#fb923c' : '#d97706',
  orangeBg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
  orangeBorder: isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A',
  danger: isDark ? '#ff8a5c' : BRAND,
  dangerBg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
  dangerBorder: isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0',
  red: isDark ? '#ff8a5c' : '#E1251B',
  redBg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
  redBorder: isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0',
  purple: isDark ? '#a78bfa' : '#7c3aed',
  purpleBg: isDark ? 'rgba(167,139,250,0.15)' : '#FAF5FF',
  purpleBorder: isDark ? 'rgba(167,139,250,0.3)' : '#DDD6FE',
  blue: isDark ? '#60a5fa' : '#1d4ed8',
  blueBg: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
  blueBorder: isDark ? 'rgba(96,165,250,0.3)' : '#BFDBFE',
});

// ─── Hook ──────────────────────────────────────────────────────────────────

function useThemeColors() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };
    
    updateTheme();
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);
    
    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  return getColors(isDark);
}

// ─── Button ──────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'surface' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading,
  className,
  ...props
}: ButtonProps) {
  const colors = useThemeColors();

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 600,
    borderRadius: 10,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    position: 'relative',
    fontFamily: "'Poppins', sans-serif",
    opacity: loading ? 0.6 : 1,
    pointerEvents: loading ? 'none' : 'auto',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: BRAND,
      color: '#fff',
    },
    ghost: {
      background: 'transparent',
      color: colors.muted,
      border: `1.5px solid ${colors.border}`,
    },
    surface: {
      background: colors.card2,
      color: colors.muted,
      border: `1.5px solid ${colors.border}`,
    },
    danger: {
      background: colors.dangerBg,
      color: colors.danger,
      border: `1.5px solid ${colors.dangerBorder}`,
    },
    success: {
      background: colors.greenBg,
      color: colors.green,
      border: `1.5px solid ${colors.greenBorder}`,
    },
  };

  const sizes: Record<string, React.CSSProperties> = {
    sm: { height: 32, padding: '0 12px', fontSize: 12 },
    md: { height: 40, padding: '0 16px', fontSize: 13 },
    lg: { height: 56, padding: '0 24px', fontSize: 14, width: '100%' },
  };

  const variantStyle = variants[variant] || variants.primary;
  const sizeStyle = sizes[size] || sizes.md;

  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    if (!loading) {
      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!loading) {
      if (variant === 'primary') {
        e.currentTarget.style.background = '#e64a1a';
        e.currentTarget.style.transform = 'translateY(-1px)';
      } else {
        e.currentTarget.style.background = colors.hoverBg;
        e.currentTarget.style.borderColor = BRAND;
      }
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!loading) {
      if (variant === 'primary') {
        e.currentTarget.style.background = BRAND;
        e.currentTarget.style.transform = 'translateY(0)';
      } else {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = colors.border;
      }
    }
  };

  return (
    <button
      className={cn(className)}
      style={{
        ...baseStyle,
        ...variantStyle,
        ...sizeStyle,
      }}
      disabled={loading}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: 16,
            height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      ) : children}
    </button>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
}

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  const colors = useThemeColors();

  const variants: Record<string, React.CSSProperties> = {
    default: {
      background: colors.card2,
      color: colors.muted,
    },
    primary: {
      background: colors.brandBg,
      color: BRAND,
    },
    success: {
      background: colors.greenBg,
      color: colors.green,
    },
    danger: {
      background: colors.dangerBg,
      color: colors.danger,
    },
    warning: {
      background: colors.orangeBg,
      color: colors.orange,
    },
  };

  return (
    <span
      className={cn(className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "'Poppins', sans-serif",
        ...variants[variant],
      }}
    >
      {children}
    </span>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className, onClick, hoverable = false }: CardProps) {
  const colors = useThemeColors();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      className={cn(className)}
      style={{
        background: colors.card,
        border: `1px solid ${isHovered && hoverable ? BRAND : colors.border}`,
        borderRadius: 14,
        padding: 'clamp(16px, 2vw, 20px)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        fontFamily: "'Poppins', sans-serif",
        ...(hoverable && {
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: isHovered ? '0 4px 24px rgba(0,0,0,0.08)' : 'none',
        }),
      }}
      onMouseEnter={() => hoverable && setIsHovered(true)}
      onMouseLeave={() => hoverable && setIsHovered(false)}
    >
      {children}
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  const colors = useThemeColors();

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 13,
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {label}
        </span>
      )}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 40,
          height: 22,
          borderRadius: 9999,
          background: checked ? BRAND : colors.border,
          transition: 'background 0.2s ease',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 18,
            height: 18,
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.2s ease',
          }}
        />
      </button>
    </label>
  );
}

// ─── StatusChip ──────────────────────────────────────────────────────────────

interface StatusChipProps {
  status: 'active' | 'inactive' | 'draft' | 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
}

const STATUS_LABELS: Record<StatusChipProps['status'], string> = {
  active: 'Active',
  inactive: 'Inactive',
  draft: 'Draft',
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function StatusChip({ status }: StatusChipProps) {
  const colors = useThemeColors();

  const statusColors: Record<StatusChipProps['status'], { bg: string; color: string; border: string }> = {
    active: {
      bg: colors.greenBg,
      color: colors.green,
      border: colors.greenBorder,
    },
    inactive: {
      bg: colors.card2,
      color: colors.muted,
      border: colors.border,
    },
    draft: {
      bg: colors.orangeBg,
      color: colors.orange,
      border: colors.orangeBorder,
    },
    new: {
      bg: colors.brandBg,
      color: BRAND,
      border: colors.border,
    },
    preparing: {
      bg: colors.blueBg,
      color: colors.blue,
      border: colors.blueBorder,
    },
    ready: {
      bg: colors.greenBg,
      color: colors.green,
      border: colors.greenBorder,
    },
    delivered: {
      bg: colors.purpleBg,
      color: colors.purple,
      border: colors.purpleBorder,
    },
    cancelled: {
      bg: colors.dangerBg,
      color: colors.danger,
      border: colors.dangerBorder,
    },
  };

  const style = statusColors[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: "'Poppins', sans-serif",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── SectionLabel ────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: ReactNode }) {
  const colors = useThemeColors();

  return (
    <p
      style={{
        fontSize: 11,
        color: colors.subtle,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 600,
        margin: 0,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {children}
    </p>
  );
}

// ─── LiveDot ─────────────────────────────────────────────────────────────────

export function LiveDot({ color = 'green' }: { color?: 'green' | 'amber' | 'red' }) {
  const colors = useThemeColors();

  const dotColors = {
    green: colors.green,
    amber: colors.orange,
    red: colors.danger,
  };

  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: dotColors[color],
        animation: 'blink 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  const colors = useThemeColors();

  return (
    <div
      className={cn(className)}
      style={{
        height: 1,
        background: colors.border,
        margin: '8px 0',
      }}
    />
  );
}

// ─── CSS Animations ─────────────────────────────────────────────────────────

export const animations = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;