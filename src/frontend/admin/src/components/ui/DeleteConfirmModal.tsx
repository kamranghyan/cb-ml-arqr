// /components/ui/DeleteConfirmModal.tsx

'use client';

import { Trash2, X } from 'lucide-react';

const C = {
  red: '#E1251B',
  dark: '#891C1C',
  bg: '#FFF8F1',
  border: '#F0E8E0',
  text: '#1A1A1A',
  muted: '#687780',
};

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
  itemType?: 'table' | 'category' | 'item' | 'restaurant';
  isLoading?: boolean;
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Delete Item?',
  message = 'Are you sure you want to delete',
  itemName = '',
  itemType = 'item',
  isLoading = false,
}: DeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#FFF0F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <Trash2 size={28} color={C.red} />
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: C.text,
            margin: '0 0 8px',
            textAlign: 'center',
            fontFamily: 'Georgia, serif',
          }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: C.muted,
            margin: '0 0 20px',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {message}{' '}
          {itemName && (
            <strong style={{ color: C.text }}>"{itemName}"</strong>
          )}
          ?
          <br />
          This action cannot be undone.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 10,
              background: C.bg,
              border: `1.5px solid ${C.border}`,
              color: C.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = C.bg;
              }
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 10,
              background: C.red,
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(225,37,27,0.25)',
              opacity: isLoading ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = C.dark;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = C.red;
              }
            }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid #fff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}