'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Trash2, X, Loader2, RefreshCw, Tags, AlertCircle, CloudUpload } from 'lucide-react';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  type ApiCategory,
} from '@/lib/admin-api';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import Image from 'next/image';
import { getTheme } from '@/lib/theme';
import { toast } from 'sonner';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFF8F1',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  text: isDark ? '#F5F0E8' : '#1A1A1A',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  inputBg: isDark ? '#1C1C1C' : '#FFFFFF',
  inputBorder: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  inputText: isDark ? '#F5F0E8' : '#1A1A1A',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  placeholder: isDark ? '#6B7280' : '#888888',
  imageBg: isDark ? 'rgba(255,87,35,0.08)' : '#FFF3E0',
  imageBorder: isDark ? 'rgba(255,87,35,0.2)' : '#FED7AA',
  success: isDark ? '#4ade80' : '#0F9D58',
  danger: isDark ? '#ff8a5c' : '#E1251B',
  shadow: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(137,28,28,0.15)',
  modalOverlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
});

export default function CategoriesPage() {
  const restaurantId = String(useParams().restaurantId ?? '');
  const [isDark, setIsDark] = useState(false);
  const [rows, setRows] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    category?: ApiCategory;
  }>({ open: false });
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{
    open: boolean;
    edit?: ApiCategory;
    initialDisplayOrder?: number;
  }>({ open: false });

  // ── Theme listener ──
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

  const colors = getColors(isDark);

  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    if (kind === 'err') {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  };

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError('');
    try {
      setRows(await fetchCategories(restaurantId));
    } catch (e: any) {
      say(e?.message ?? 'Could not load categories. Please try again.', 'err');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(c: ApiCategory) {
    setDeleteModal({ open: true, category: c });
  }

  async function confirmDelete() {
    const category = deleteModal.category;
    if (!category?.categoryId) {
      say('Category ID is missing.', 'err');
      return;
    }
    try {
      await deleteCategory(category.categoryId, restaurantId);
      say('Category deleted');
      setDeleteModal({ open: false });
      await load();
    } catch (e: any) {
      say(e?.message ?? 'Could not delete category', 'err');
    }
  }

  // ── Button Styles ──
  const primaryButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: 'none',
    borderRadius: 10,
    background: BRAND,
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s ease',
    outline: 'none',
    whiteSpace: 'nowrap',
  };

  const ghostButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 10,
    background: 'transparent',
    color: colors.text,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s ease',
    outline: 'none',
    whiteSpace: 'nowrap',
  };

  const ghostBrandButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: `1.5px solid ${colors.imageBorder}`,
    borderRadius: 10,
    background: colors.imageBg,
    color: BRAND,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s ease',
    outline: 'none',
    whiteSpace: 'nowrap',
  };

  const dangerButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: `1.5px solid ${colors.danger}`,
    borderRadius: 10,
    background: 'transparent',
    color: colors.danger,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s ease',
    outline: 'none',
    whiteSpace: 'nowrap',
  };

  const modalGhostButton: React.CSSProperties = {
    ...ghostButton,
    width: '50%',
    height: 40,
    justifyContent: 'center',
  };

  const modalPrimaryButton: React.CSSProperties = {
    ...primaryButton,
    width: '50%',
    height: 40,
    justifyContent: 'center',
  };

  // ── Handlers ──
  const primaryHandlers = {
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
    },
    onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = 'none';
    },
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = '#e64a1a';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = BRAND;
    },
  };

  const ghostHandlers = {
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
      e.currentTarget.style.borderColor = BRAND;
    },
    onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = colors.border;
    },
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = colors.hoverBg;
      e.currentTarget.style.borderColor = BRAND;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderColor = colors.border;
    },
  };

  const ghostBrandHandlers = {
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
      e.currentTarget.style.borderColor = BRAND;
    },
    onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = colors.imageBorder;
    },
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = colors.hoverBg;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = colors.imageBg;
    },
  };

  return (
    <div style={{
      padding: '24px 20px 40px',
      background: colors.bg,
      minHeight: '100vh',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder,
        input::-webkit-input-placeholder,
        input::-moz-placeholder {
          color: ${colors.placeholder} !important;
          opacity: 0.8;
        }
        input:focus {
          outline: none;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 18,
      }}>
        <p style={{
          color: colors.muted,
          fontSize: 14,
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Sections of this branch&apos;s menu, shown to guests in display order.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* ── Ghost Button ── */}
          <button
            onClick={load}
            style={ghostButton}
            {...ghostHandlers}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {/* ── Primary Button ── */}
          <button
            onClick={() => {
              const nextOrder =
                rows.length > 0
                  ? Math.max(...rows.map(c => Number(c.displayOrder) || 0)) + 1
                  : 1;
              setModal({ open: true, initialDisplayOrder: nextOrder });
            }}
            style={primaryButton}
            {...primaryHandlers}
          >
            <Plus size={16} /> New Category
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: colors.muted,
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
            Loading categories…
          </p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '40px 20px',
          color: colors.danger,
        }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && rows.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: colors.subtle,
        }}>
          <Tags size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{
            margin: 0,
            fontWeight: 600,
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif",
          }}>No categories yet.</p>
          <p style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: colors.subtle,
            fontFamily: "'Poppins', sans-serif",
          }}>
            Add one — items are grouped under categories on the guest menu.
          </p>
        </div>
      )}

      {/* ── Categories Table ── */}
      {!loading && !error && rows.length > 0 && (
        <div style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          background: colors.card,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 500,
              fontFamily: "'Poppins', sans-serif",
            }}>
              <thead style={{ background: colors.card2 }}>
                <tr>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Image</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Name</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Order</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Visible</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}></th>
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => a.displayOrder - b.displayOrder).map(c => (
                  <tr key={c.categoryId} style={{ borderTop: `1px solid ${colors.border}` }}>
                    {/* Category Image */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                    }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: colors.imageBg,
                          border: `1px solid ${colors.imageBorder}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        {c.imageUrl ? (
                          <Image
                            src={c.imageUrl}
                            alt={c.name}
                            fill
                            sizes="44px"
                            style={{
                              objectFit: 'cover',
                              borderRadius: 10,
                            }}
                          />
                        ) : (
                          <Tags size={18} color={colors.subtle} />
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {c.name}
                    </td>

                    {/* Order */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {c.displayOrder}
                    </td>

                    {/* Visible */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: c.isActive ? colors.success : colors.subtle,
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        {c.isActive ? '● shown' : '● hidden'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {/* ── Ghost Brand Button ── */}
                      <button
                        onClick={() => setModal({ open: true, edit: c })}
                        style={{
                          ...ghostBrandButton,
                          marginRight: 6,
                        }}
                        {...ghostBrandHandlers}
                      >
                        <Edit2 size={14} />
                      </button>

                      {/* ── Danger Button ── */}
                      <button
                        onClick={() => onDelete(c)}
                        style={dangerButton}
                        {...ghostHandlers}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {modal.open && (
        <CategoryModal
          restaurantId={restaurantId}
          edit={modal.edit}
          initialDisplayOrder={modal.initialDisplayOrder}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
          say={say}
          colors={colors}
          isDark={isDark}
          primaryButton={primaryButton}
          ghostButton={ghostButton}
          modalGhostButton={modalGhostButton}
          modalPrimaryButton={modalPrimaryButton}
          primaryHandlers={primaryHandlers}
          ghostHandlers={ghostHandlers}
          existingCategories={rows}
        />
      )}

      {/* ── Confirm Delete Modal ── */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Category"
        message="Are you sure you want to delete this category? Items in this category may lose their category."
        itemName={deleteModal.category?.name}
        onCancel={() => setDeleteModal({ open: false })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ── Category Modal ──

function CategoryModal({
  restaurantId,
  edit,
  initialDisplayOrder,
  onClose,
  onSaved,
  say,
  colors,
  isDark,
  primaryButton,
  ghostButton,
  modalGhostButton,
  modalPrimaryButton,
  primaryHandlers,
  ghostHandlers,
  existingCategories,
}: {
  restaurantId: string;
  edit?: ApiCategory;
  initialDisplayOrder?: number;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
  primaryButton: React.CSSProperties;
  ghostButton: React.CSSProperties;
  modalGhostButton: React.CSSProperties;
  modalPrimaryButton: React.CSSProperties;
  primaryHandlers: any;
  ghostHandlers: any;
  existingCategories: ApiCategory[];
}) {
  const [f, setF] = useState({
    name: edit?.name ?? '',
    displayOrder: edit?.displayOrder ?? initialDisplayOrder ?? 1,
    isActive: edit?.isActive ?? true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(edit?.imageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  // ✅ Check for duplicate category name
  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError('Category name is required');
      return false;
    }

    const trimmedName = name.trim().toLowerCase();
    const isDuplicate = existingCategories.some(cat => {
      // If editing, exclude the current category from the check
      if (edit && cat.categoryId === edit.categoryId) {
        return false;
      }
      return cat.name.trim().toLowerCase() === trimmedName;
    });

    if (isDuplicate) {
      setNameError(`Category "${name.trim()}" already exists. Please use a different name.`);
      return false;
    }

    setNameError('');
    return true;
  };

  const handleNameChange = (value: string) => {
    set('name', value);
    if (value.trim()) {
      validateName(value);
    } else {
      setNameError('Category name is required');
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = BRAND;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = colors.border;
    e.currentTarget.style.boxShadow = 'none';
    if (f.name.trim()) {
      validateName(f.name);
    }
  };

  async function save() {
    // Validate before saving
    if (!validateName(f.name)) {
      return;
    }

    setSaving(true);
    try {
      if (edit) {
        if (!edit.categoryId) throw new Error('Category ID is missing.');
        await updateCategory(
          edit.categoryId,
          {
            name: f.name.trim(),
            displayOrder: f.displayOrder,
            isActive: f.isActive,
          },
          restaurantId,
          imageFile
        );
        say('Category updated successfully.');
      } else {
        await createCategory(
          {
            name: f.name.trim(),
            displayOrder: f.displayOrder,
            isActive: f.isActive,
          },
          restaurantId,
          imageFile
        );
        say('Category created successfully.');
      }
      onSaved();
    } catch (e: any) {
      console.error('CATEGORY SAVE ERROR:', e);
      say(
        e?.message ?? 'Could not save the category. Please try again.',
        'err'
      );
    } finally {
      setSaving(false);
    }
  }

  const canSave = f.name.trim().length > 0 && !nameError;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: colors.modalOverlay,
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving && canSave) {
            save();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.card,
          borderRadius: 16,
          padding: 'clamp(20px, 3vw, 24px)',
          width: '100%',
          maxWidth: 420,
          border: `1.5px solid ${colors.border}`,
          boxShadow: `0 8px 32px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'}`,
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {edit ? 'Edit Category' : 'New Category'}
          </h3>
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              cursor: 'pointer',
              color: colors.muted,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.hoverBg;
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colors.muted;
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* ── Name ── */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Name
            </label>
            <input
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1.5px solid ${nameError ? colors.danger : colors.border}`,
                borderRadius: 10,
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif",
                boxSizing: 'border-box',
                color: colors.text,
                background: colors.inputBg,
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              value={f.name}
              placeholder="Burgers"
              onChange={e => handleNameChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            {nameError && (
              <p style={{
                fontSize: 12,
                color: colors.danger,
                margin: '4px 0 0',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {nameError}
              </p>
            )}
          </div>

          {/* ── Image Upload ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Category Image
            </label>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 20,
                borderRadius: 16,
                border: `2px dashed ${imageFile ? colors.imageBorder : colors.border}`,
                background: imageFile ? colors.imageBg : colors.inputBg,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
              />
              <CloudUpload size={24} color={colors.subtle} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: colors.subtle,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {imageFile ? `✓ ${imageFile.name}` : 'Click to upload · PNG, JPG'}
              </span>
            </label>

            {imagePreview && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                <Image
                  src={imagePreview}
                  alt="category"
                  width={90}
                  height={90}
                  style={{
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Display Order ── */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Display Order
            </label>
            <input
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1.5px solid ${colors.border}`,
                borderRadius: 10,
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif",
                boxSizing: 'border-box',
                color: colors.text,
                background: colors.inputBg,
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              type="number"
              min={1}
              value={f.displayOrder}
              onChange={e =>
                set('displayOrder', Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            <p style={{
              fontSize: 12,
              color: colors.subtle,
              margin: '4px 0 0',
              fontFamily: "'Poppins', sans-serif",
            }}>
              Lower numbers appear first on the guest menu.
            </p>
          </div>

          {/* ── Active Checkbox ── */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: colors.text,
            cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
          }}>
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={e => set('isActive', e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: BRAND,
                cursor: 'pointer',
              }}
            />
            Show to guests
          </label>

          {/* ── Modal Actions ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={modalGhostButton}
              {...ghostHandlers}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !canSave}
              style={{
                ...modalPrimaryButton,
                opacity: (saving || !canSave) ? 0.6 : 1,
                cursor: (saving || !canSave) ? 'not-allowed' : 'pointer',
              }}
              {...primaryHandlers}
            >
              {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {edit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}