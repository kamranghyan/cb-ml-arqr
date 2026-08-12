'use client';

import { Store, Loader2 } from 'lucide-react';
import type { Branch } from '@/lib/tenant-api';

// ── Color Schema (Matches your KDS page) ──────────────────────────────
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
const TONE = {
  orange: { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' },
};

/**
 * Which branch an owner is looking at. Unlike the admin's picker, the company
 * is already known from the token — and an owner can look across all their
 * branches at once, which is the point of owning several.
 *
 * Rendered as chips rather than a dropdown: a handful of branches is the
 * normal case, and seeing them all at once is faster than opening a menu.
 */
export default function BranchPicker({
  branches,
  value,
  onChange,
  loading = false,
  allowAll = true,
}: {
  branches: Branch[];
  value: string;                 // '' means all branches
  onChange: (restaurantId: string) => void;
  loading?: boolean;
  allowAll?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 flex-wrap bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-xl px-3.5 py-3 mb-4 text-[#9CA3AF]">
        <Loader2 size={15} className="animate-spin" />
        <span className="text-sm">Loading your restaurants…</span>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="flex items-center gap-3 flex-wrap bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-xl px-3.5 py-3 mb-4 text-[#6B7280]">
        <Store size={15} />
        <span className="text-sm">No restaurants yet — add one to start taking orders.</span>
      </div>
    );
  }

  // With a single branch there is nothing to choose.
  if (branches.length === 1 && !allowAll) return null;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3 flex-wrap bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-xl px-3.5 py-3 mb-4">
      <div className="flex items-center gap-1.5 text-[#9CA3AF] flex-shrink-0">
        <Store size={15} />
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline">
          Restaurant
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 flex-1">
        {allowAll && (
          <Chip active={value === ''} onClick={() => onChange('')}>
            All branches
          </Chip>
        )}
        {branches.map(b => (
          <Chip
            key={b.restaurantId}
            active={value === b.restaurantId}
            onClick={() => onChange(b.restaurantId)}
          >
            {b.name}
            {!b.isActive && (
              <span className="opacity-60 font-medium"> · closed</span>
            )}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3.5 py-1.5 rounded-full cursor-pointer text-xs font-bold transition-all duration-200
        whitespace-nowrap
        ${active
          ? 'bg-[#ff5723] text-white border border-[#ff5723] shadow-[0_0_12px_rgba(255,87,35,0.25)]'
          : 'bg-[#242424] text-[#9CA3AF] border border-[rgba(255,255,255,0.08)] hover:bg-[#2A2A2A] hover:text-[#F5F0E8]'
        }
      `}
    >
      {children}
    </button>
  );
}