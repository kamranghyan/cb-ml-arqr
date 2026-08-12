'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';

// ─── Theme Colors ──────────────────────────────────────────────────────────

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
const L = {
  bg: '#FFFFFF',
  card: '#ffffff',
  card2: '#F9FAFB',
  border: '#F0EBE6',
  text: '#000000',
  muted: '#6B6B6B',
  subtle: '#9CA3AF',
};

// ─── Hook to get theme colors ────────────────────────────────────────────

function useThemeColors() {
  const { isDark } = useTheme();
  return isDark ? D : L;
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
  const isDark = useTheme().isDark;

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 600,
    borderRadius: 12,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    position: 'relative' as const,
  };

  const variants = {
    primary: {
      background: BRAND,
      color: '#fff',
      ':hover': { background: '#e04a1a', transform: 'translateY(-1px)' },
      ':active': { transform: 'scale(0.97)' },
    },
    ghost: {
      background: 'transparent',
      color: isDark ? D.muted : L.muted,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6'}`,
      ':hover': {
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      },
    },
    surface: {
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6'}`,
      ':hover': {
        background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
      },
    },
    danger: {
      background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
      color: isDark ? '#ff8a5c' : BRAND,
      border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`,
      ':hover': {
        background: isDark ? 'rgba(255,87,35,0.18)' : '#FFE8E8',
      },
    },
    success: {
      background: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
      color: isDark ? '#4ade80' : '#16a34a',
      border: `1px solid ${isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0'}`,
      ':hover': {
        background: isDark ? 'rgba(34,197,94,0.18)' : '#E6F9ED',
      },
    },
  };

  const sizes = {
    sm: { height: 32, padding: '0 12px', fontSize: 12 },
    md: { height: 40, padding: '0 16px', fontSize: 13 },
    lg: { height: 56, padding: '0 24px', fontSize: 14, width: '100%' },
  };

  const variantStyle = variants[variant];
  const sizeStyle = sizes[size];

  return (
    <button
      className={cn(className)}
      style={{
        ...base,
        ...variantStyle,
        ...sizeStyle,
        opacity: loading ? 0.5 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
      disabled={loading}
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
  const { isDark } = useTheme();
  const colors = useThemeColors();

  const variants = {
    default: {
      background: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
      color: colors.muted,
    },
    primary: {
      background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
      color: BRAND,
    },
    success: {
      background: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
      color: isDark ? '#4ade80' : '#16a34a',
    },
    danger: {
      background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
      color: isDark ? '#ff8a5c' : BRAND,
    },
    warning: {
      background: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
      color: isDark ? '#fb923c' : '#d97706',
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

  return (
    <div
      onClick={onClick}
      className={cn(className)}
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 'clamp(16px, 2vw, 20px)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        ...(hoverable && {
          ':hover': {
            borderColor: BRAND,
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          },
        }),
      }}
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
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 13,
            color: colors.muted,
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
  const { isDark } = useTheme();

  const statusColors: Record<StatusChipProps['status'], { bg: string; color: string }> = {
    active: {
      bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
      color: isDark ? '#4ade80' : '#16a34a',
    },
    inactive: {
      bg: isDark ? 'rgba(156,163,175,0.12)' : '#F3F4F6',
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    draft: {
      bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
      color: isDark ? '#fb923c' : '#d97706',
    },
    new: {
      bg: isDark ? 'rgba(96,165,250,0.12)' : '#EFF6FF',
      color: isDark ? '#60a5fa' : '#2563eb',
    },
    preparing: {
      bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
      color: isDark ? '#fb923c' : '#d97706',
    },
    ready: {
      bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
      color: isDark ? '#4ade80' : '#16a34a',
    },
    delivered: {
      bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
      color: isDark ? '#4ade80' : '#16a34a',
    },
    cancelled: {
      bg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
      color: isDark ? '#ff8a5c' : BRAND,
    },
  };

  const colors = statusColors[status];

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
        ...colors,
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
        fontWeight: 500,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

// ─── LiveDot ─────────────────────────────────────────────────────────────────

export function LiveDot({ color = 'green' }: { color?: 'green' | 'amber' | 'red' }) {
  const colors = {
    green: '#4ade80',
    amber: '#fb923c',
    red: '#ff8a5c',
  };

  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colors[color],
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

// ─── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  const colors = useThemeColors();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          {label}
        </label>
      )}
      <input
        className={cn(className)}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${error ? BRAND : colors.border}`,
          background: colors.card2,
          color: colors.text,
          fontSize: 13,
          outline: 'none',
          transition: 'border-color 0.2s ease',
          width: '100%',
          boxSizing: 'border-box',
        }}
        {...props}
      />
      {error && (
        <span
          style={{
            fontSize: 12,
            color: BRAND,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
}

export function Select({ label, options, error, className, ...props }: SelectProps) {
  const colors = useThemeColors();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          {label}
        </label>
      )}
      <select
        className={cn(className)}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${error ? BRAND : colors.border}`,
          background: colors.card2,
          color: colors.text,
          fontSize: 13,
          outline: 'none',
          transition: 'border-color 0.2s ease',
          width: '100%',
          boxSizing: 'border-box',
          cursor: 'pointer',
        }}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span
          style={{
            fontSize: 12,
            color: BRAND,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${BRAND}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
}

// ─── Toast/Alert ────────────────────────────────────────────────────────────

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
}

export function Alert({ type = 'info', title, message }: AlertProps) {
  const { isDark } = useTheme();

  const types = {
    info: {
      bg: isDark ? 'rgba(96,165,250,0.12)' : '#EFF6FF',
      border: isDark ? 'rgba(96,165,250,0.3)' : '#BFDBFE',
      color: isDark ? '#60a5fa' : '#2563eb',
    },
    success: {
      bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
      border: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
      color: isDark ? '#4ade80' : '#16a34a',
    },
    warning: {
      bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
      border: isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A',
      color: isDark ? '#fb923c' : '#d97706',
    },
    error: {
      bg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
      border: isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0',
      color: isDark ? '#ff8a5c' : BRAND,
    },
  };

  const style = types[type];

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        background: style.bg,
        border: `1px solid ${style.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: style.color,
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          color: isDark ? D.muted : L.muted,
        }}
      >
        {message}
      </div>
    </div>
  );
}

// ─── CSS Animations ─────────────────────────────────────────────────────────

// Add these to your global CSS or as a style tag in your root layout
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