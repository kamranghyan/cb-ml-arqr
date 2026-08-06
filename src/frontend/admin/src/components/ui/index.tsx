'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// ─── Button ──────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'ghost' | 'surface' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'gold', size = 'md', children, loading, className, ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    gold:    'bg-gradient-to-br from-gold-400 to-gold-500 text-surface hover:opacity-90',
    ghost:   'bg-transparent border border-gold-400/25 text-gold-400/70 hover:bg-gold-400/5 hover:border-gold-400/40',
    surface: 'bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.07]',
    danger:  'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/18',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-14 px-6 text-base w-full',
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

interface BadgeProps { children: ReactNode; className?: string }

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium',
      className,
    )}>
      {children}
    </span>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps { children: ReactNode; className?: string; onClick?: () => void }

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface-100 border border-white/[0.06] rounded-2xl',
        onClick && 'cursor-pointer hover:border-gold-400/15 transition-colors',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; label?: string }

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      {label && <span className="text-sm text-white/50">{label}</span>}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-[22px] rounded-full transition-colors',
          checked ? 'bg-gold-400/90' : 'bg-white/10',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}

// ─── StatusChip ──────────────────────────────────────────────────────────────

interface StatusChipProps {
  status: 'active' | 'inactive' | 'draft' | 'new' | 'preparing' | 'ready' | 'delivered';
}

const STATUS_MAP: Record<StatusChipProps['status'], string> = {
  active:    'chip-active',
  inactive:  'chip-inactive',
  draft:     'chip-draft',
  new:       'chip-new',
  preparing: 'chip-preparing',
  ready:     'chip-ready',
  delivered: 'chip-delivered',
};
const STATUS_LABELS: Record<StatusChipProps['status'], string> = {
  active: 'Active', inactive: 'Inactive', draft: 'Draft',
  new: 'New', preparing: 'Preparing', ready: 'Ready', delivered: 'Delivered',
};

export function StatusChip({ status }: StatusChipProps) {
  return (
    <span className={cn('inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium', STATUS_MAP[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── SectionLabel ────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] text-white/30 uppercase tracking-widest font-medium">
      {children}
    </p>
  );
}

// ─── LiveDot ─────────────────────────────────────────────────────────────────

export function LiveDot({ color = 'green' }: { color?: 'green' | 'amber' | 'red' }) {
  const colors = { green: 'bg-green-400', amber: 'bg-amber-400', red: 'bg-red-400' };
  return <span className={cn('w-[7px] h-[7px] rounded-full animate-blink', colors[color])} />;
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-white/[0.05]', className)} />;
}
