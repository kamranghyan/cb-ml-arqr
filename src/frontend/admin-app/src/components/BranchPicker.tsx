'use client';

import { Store, Loader2 } from 'lucide-react';
import type { Branch } from '@/lib/tenant-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF',
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
      <div style={{ ...bar, color: C.muted }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 13 }}>Loading your restaurants…</span>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div style={{ ...bar, color: C.subtle }}>
        <Store size={15} />
        <span style={{ fontSize: 13 }}>
          No restaurants yet — add one to start taking orders.
        </span>
      </div>
    );
  }

  // With a single branch there is nothing to choose.
  if (branches.length === 1 && !allowAll) return null;

  return (
    <div style={bar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted }}>
        <Store size={15} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Restaurant
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
              <span style={{ opacity: 0.6, fontWeight: 500 }}> · closed</span>
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
    <button onClick={onClick} style={{
      padding: '6px 13px', borderRadius: 20, cursor: 'pointer',
      fontSize: 12.5, fontWeight: 700,
      border: `1px solid ${active ? C.red : C.border}`,
      background: active ? C.red : '#fff',
      color:      active ? '#fff' : C.muted,
    }}>
      {children}
    </button>
  );
}

const bar: React.CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '12px 14px', marginBottom: 18,
};
