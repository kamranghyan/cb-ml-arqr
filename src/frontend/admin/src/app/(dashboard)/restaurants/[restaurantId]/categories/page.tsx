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
import { useTheme } from '@/hooks/useTheme';

const BRAND = '#ff5723';

// Theme colors
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#ffffff',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#1A1A1A',
  muted: isDark ? '#9CA3AF' : '#687780',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  inputBg: isDark ? '#1C1C1C' : '#ffffff',
  inputBorder: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  inputText: isDark ? '#F5F0E8' : '#000000',
  placeholder: isDark ? '#6B7280' : '#999999',
  imageBg: isDark ? 'rgba(255,87,35,0.08)' : '#FFF3E0',
  imageBorder: isDark ? 'rgba(255,87,35,0.2)' : '#FED7AA',
  brand: BRAND,
  brandHover: '#e04a1a',
  success: isDark ? '#4ade80' : '#0F9D58',
  danger: isDark ? '#ff8a5c' : '#E1251B',
});

export default function CategoriesPage() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const restaurantId = String(useParams().restaurantId ?? '');

  const [rows, setRows] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    category?: ApiCategory;
  }>({
    open: false,
  });
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    edit?: ApiCategory;
    initialDisplayOrder?: number;
  }>({ open: false });

  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true); setError('');
    try { setRows(await fetchCategories(restaurantId)); }
    catch (e: any) { setError(e?.message ?? 'Could not load categories'); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(c: ApiCategory) {
    setDeleteModal({
      open: true,
      category: c,
    });
  }

  async function confirmDelete() {
    const category = deleteModal.category;

    if (!category?.categoryId) {
      say('Category ID is missing.', 'err');
      return;
    }

    try {
      await deleteCategory(
        category.categoryId,
        restaurantId
      );

      say('Category deleted');

      setDeleteModal({
        open: false,
      });

      await load();
    } catch (e: any) {
      say(
        e?.message ?? 'Could not delete category',
        'err'
      );
    }
  }

  return (
    <div style={{ 
      padding: '24px 20px 40px', 
      background: colors.bg,
      minHeight: '100vh',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 18 
      }}>
        <p style={{ 
          color: colors.muted, 
          fontSize: 14, 
          margin: 0 
        }}>
          Sections of this branch&apos;s menu, shown to guests in display order.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button 
            onClick={load} 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              background: colors.card2,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              color: colors.text,
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              const nextOrder =
                rows.length > 0
                  ? Math.max(...rows.map(c => Number(c.displayOrder) || 0)) + 1
                  : 1;

              setModal({
                open: true,
                initialDisplayOrder: nextOrder,
              });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              border: 'none',
              borderRadius: 8,
              background: BRAND,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} /> New Category
          </button>
        </div>
      </div>

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
          <p style={{ marginTop: 12, fontSize: 14 }}>Loading categories…</p>
        </div>
      )}

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
          <p style={{ margin: 0, fontWeight: 600, color: colors.muted }}>No categories yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtle }}>
            Add one — items are grouped under categories on the guest menu.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ 
          border: `1px solid ${colors.border}`, 
          borderRadius: 12, 
          overflow: 'hidden',
          background: colors.card,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
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
                  }}></th>
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => a.displayOrder - b.displayOrder).map(c => (
                  <tr
                    key={c.categoryId}
                    style={{ borderTop: `1px solid ${colors.border}` }}
                  >
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
                          <Tags
                            size={18}
                            color={colors.subtle}
                          />
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: colors.text,
                    }}>
                      {c.name}
                    </td>

                    {/* Order */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                    }}>
                      {c.displayOrder}
                    </td>

                    {/* Visible */}
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                    }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: c.isActive ? colors.success : colors.subtle,
                        }}
                      >
                        {c.isActive ? '● shown' : '● hidden'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td
                      style={{
                        padding: '11px 12px',
                        fontSize: 14,
                        color: colors.text,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <button
                        onClick={() => setModal({ open: true, edit: c })}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          background: colors.card2,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                          color: colors.text,
                          marginRight: 6,
                        }}
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        onClick={() => onDelete(c)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          background: colors.card2,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                          color: colors.danger,
                        }}
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

      {modal.open && (
        <CategoryModal
          restaurantId={restaurantId}
          edit={modal.edit}
          initialDisplayOrder={modal.initialDisplayOrder}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            load();
          }}
          say={say}
          isDark={isDark}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 18px',
            borderRadius: 10,
            background: toast.kind === 'ok' ? colors.success : colors.danger,
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast.msg}
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Category"
        message="Are you sure you want to delete this category? Items in this category may lose their category."
        itemName={deleteModal.category?.name}
        onCancel={() =>
          setDeleteModal({
            open: false,
          })
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CategoryModal({
  restaurantId,
  edit,
  initialDisplayOrder,
  onClose,
  onSaved,
  say,
  isDark,
}: {
  restaurantId: string;
  edit?: ApiCategory;
  initialDisplayOrder?: number;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
  isDark: boolean;
}) {
  const colors = getColors(isDark);
  const [f, setF] = useState({
    name: edit?.name ?? '',
    displayOrder: edit?.displayOrder ?? initialDisplayOrder ?? 1,
    isActive: edit?.isActive ?? true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(
    edit?.imageUrl ?? ''
  );
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);

    try {
      if (edit) {
        if (!edit.categoryId) {
          throw new Error('Category ID is missing.');
        }

        await updateCategory(
          edit.categoryId,
          {
            name: f.name,
            displayOrder: f.displayOrder,
            isActive: f.isActive,
          },
          restaurantId,
          imageFile
        );

        say('Category updated');
      } else {
        await createCategory(
          {
            name: f.name,
            displayOrder: f.displayOrder,
            isActive: f.isActive,
          },
          restaurantId,
          imageFile
        );

        say('Category created');
      }

      onSaved();

    } catch (e: any) {
      console.error('CATEGORY SAVE ERROR:', e);
      say(
        e?.message ?? 'Something went wrong',
        'err'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: 16,
      backdropFilter: 'blur(4px)',
    }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving && f.name.trim()) {
            save();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.card,
          borderRadius: 14,
          padding: 'clamp(20px, 3vw, 24px)',
          width: '100%',
          maxWidth: 420,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: 18, 
            fontWeight: 800,
            color: colors.text,
          }}>
            {edit ? 'Edit Category' : 'New Category'}
          </h3>
          <button 
            onClick={onClose} 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px',
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              color: colors.muted,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
            }}>Name</label>
            <input
              style={{
                width: '100%',
                padding: '9px 11px',
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box',
                color: colors.inputText,
                background: colors.inputBg,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              value={f.name}
              placeholder="Burgers"
              onChange={e => set('name', e.target.value)}
              onFocus={(e) => {
                e.target.style.borderColor = BRAND;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.inputBorder;
              }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
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
                background: imageFile ? colors.imageBg : colors.card2,
                cursor: 'pointer',
                transition: 'all 0.2s',
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

              <CloudUpload
                size={24}
                color={colors.subtle}
              />

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.subtle,
                }}
              >
                {imageFile
                  ? `✓ ${imageFile.name}`
                  : 'Click to upload · PNG, JPG'}
              </span>
            </label>

            {imagePreview && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
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
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
            }}>Display Order</label>
            <input
              style={{
                width: '100%',
                padding: '9px 11px',
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box',
                color: colors.inputText,
                background: colors.inputBg,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              type="number"
              min={1}
              value={f.displayOrder}
              onChange={e =>
                set(
                  'displayOrder',
                  Math.max(1, parseInt(e.target.value, 10) || 1)
                )
              }
              onFocus={(e) => {
                e.target.style.borderColor = BRAND;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.inputBorder;
              }}
            />
            <p style={{ 
              fontSize: 12, 
              color: colors.subtle, 
              margin: '4px 0 0' 
            }}>
              Lower numbers appear first on the guest menu.
            </p>
          </div>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            fontSize: 14, 
            color: colors.text,
            cursor: 'pointer',
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
          <button
            type="submit"
            disabled={saving || !f.name.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 14px',
              border: 'none',
              borderRadius: 8,
              background: BRAND,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: saving || !f.name.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !f.name.trim() ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {edit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}