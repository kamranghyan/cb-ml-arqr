'use client';

import { Loader2, Trash2, X } from 'lucide-react';
import { useState } from 'react';

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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#FFF1F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={21} color="#E1251B" />
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            style={{
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              cursor: deleting ? 'not-allowed' : 'pointer',
              color: '#687780',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 800,
            color: '#1A1A1A',
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: 0,
            color: '#687780',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        {itemName && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 8,
              background: '#FFF8F1',
              border: '1px solid #F0E8E0',
              fontSize: 14,
              fontWeight: 700,
              color: '#1A1A1A',
            }}
          >
            {itemName}
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #F0E8E0',
              background: '#fff',
              color: '#1A1A1A',
              fontSize: 13,
              fontWeight: 700,
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#E1251B',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: deleting ? 'not-allowed' : 'pointer',
              minWidth: 100,
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting && (
              <Loader2
                size={15}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            )}

            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}