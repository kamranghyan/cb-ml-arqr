'use client';

import { Loader2, Trash2, X } from 'lucide-react';
import { useState } from 'react';

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
  danger: { bg: 'rgba(255,87,35,0.12)', border: 'rgba(255,87,35,0.3)', text: '#ff8a5c' },
  red: '#E1251B',
};

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function ConfirmDeleteModal({
  open,
  title = 'Delete',
  message = 'Are you sure you want to delete this item?',
  itemName,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (deleting) return;
    try {
      setDeleting(true);
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-[#1C1C1C] rounded-2xl p-6 shadow-2xl border border-[rgba(255,255,255,0.08)]"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="w-11 h-11 rounded-xl bg-[rgba(255,87,35,0.12)] flex items-center justify-center flex-shrink-0">
            <Trash2 size={21} color="#ff8a5c" />
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="w-8 h-8 border-none bg-transparent cursor-pointer text-[#6B7280] hover:text-[#F5F0E8] flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <h3 className="text-lg font-extrabold text-[#F5F0E8] m-0 mb-2">
          {title}
        </h3>

        <p className="text-sm text-[#9CA3AF] leading-relaxed m-0">
          {message}
        </p>

        {itemName && (
          <div className="mt-3.5 px-3 py-2.5 rounded-lg bg-[#242424] border border-[rgba(255,255,255,0.08)] text-sm font-bold text-[#F5F0E8]">
            {itemName}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent text-[#F5F0E8] text-sm font-bold cursor-pointer hover:bg-[#242424] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-none bg-[#E1251B] text-white text-sm font-bold cursor-pointer hover:bg-[#c41f18] transition-colors min-w-[100px] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {deleting && (
              <Loader2 size={15} className="animate-spin" />
            )}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}