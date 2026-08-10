'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Trash2, X, Loader2, RefreshCw, Tags, AlertCircle, CloudUpload } from 'lucide-react';
import {
  fetchCategories, createCategory, updateCategory, deleteCategory,uploadCategoryImage,
  type ApiCategory,
} from '@/lib/admin-api';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

export default function CategoriesPage() {
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
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Sections of this branch&apos;s menu, shown to guests in display order.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={ghost}><RefreshCw size={14} /> Refresh</button>
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
            style={primary}
          >
            <Plus size={16} /> New Category
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</div>}

      {!loading && error && <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
        <AlertCircle size={20} /> {error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: C.subtle }}>
          <Tags size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No categories yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Add one — items are grouped under categories on the guest menu.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr> <th style={th}>Image</th><th style={th}>Name</th><th style={th}>Order</th>
                <th style={th}>Visible</th><th style={th}></th></tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => a.displayOrder - b.displayOrder).map(c => (
                <tr
                  key={c.categoryId}
                  style={{ borderTop: `1px solid ${C.border}` }}
                >
                  {/* Category Image */}
                  <td style={cell}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: '#FFF3E0',
                        border: '1px solid #FED7AA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 10,
                          }}
                        />
                      ) : (
                        <Tags
                          size={18}
                          color={C.subtle}
                        />
                      )}
                    </div>
                  </td>

                  {/* Name */}
                  <td style={{ ...cell, fontWeight: 600 }}>
                    {c.name}
                  </td>

                  {/* Order */}
                  <td style={cell}>
                    {c.displayOrder}
                  </td>

                  {/* Visible */}
                  <td style={cell}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: c.isActive ? C.green : C.subtle,
                      }}
                    >
                      {c.isActive ? '● shown' : '● hidden'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    style={{
                      ...cell,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <button
                      onClick={() => setModal({ open: true, edit: c })}
                      style={{ ...ghost, marginRight: 6 }}
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      onClick={() => onDelete(c)}
                      style={{ ...ghost, color: C.red }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            background: toast.kind === 'ok' ? C.green : C.red,
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            zIndex: 100,
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
}: {
  restaurantId: string;
  edit?: ApiCategory;
  initialDisplayOrder?: number;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
}) {
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

      // 1. Update category data
      await updateCategory(
        edit.categoryId,
        {
          name: f.name,
          displayOrder: f.displayOrder,
          isActive: f.isActive,
        },
        restaurantId
      );

      // 2. Upload image separately if a new image was selected
      if (imageFile) {
        await uploadCategoryImage(
          imageFile,
          edit.categoryId,
          restaurantId
        );
      }

      say('Category updated');
    } else {
      // Create category first
      const created = await createCategory(
        {
          name: f.name,
          displayOrder: f.displayOrder,
          isActive: f.isActive,
        },
        restaurantId
      );

      // Then upload image using newly created category ID
      if (imageFile && created?.categoryId) {
        await uploadCategoryImage(
          imageFile,
          created.categoryId,
          restaurantId
        );
      }

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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
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
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          width: '100%',
          maxWidth: 420,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {edit ? 'Edit Category' : 'New Category'}
          </h3>
          <button onClick={onClose} style={{ ...ghost, border: 'none' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label}>Name</label>
            <input
              className="searchInput"
              style={input}
              value={f.name}
              placeholder="Burgers"
              onChange={e => set('name', e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>
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
                border: `2px dashed ${imageFile ? '#FED7AA' : C.border}`,
                background: imageFile ? '#FFF8F1' : C.bg,
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
                color={imageFile ? C.dark : C.subtle}
              />

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: imageFile ? C.dark : C.subtle,
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
                <img
                  src={imagePreview}
                  alt="category"
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                  }}
                />
              </div>
            )}
          </div>
          <div>
            <label style={label}>Display Order</label>
            <input
              style={input}
              type="number"
              min={1}
              value={f.displayOrder}
              onChange={e =>
                set(
                  'displayOrder',
                  Math.max(1, parseInt(e.target.value, 10) || 1)
                )
              }
            />
            <p style={{ fontSize: 12, color: C.subtle, margin: '4px 0 0' }}>
              Lower numbers appear first on the guest menu.
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text }}>
            <input type="checkbox" checked={f.isActive}
              onChange={e => set('isActive', e.target.checked)} /> Show to guests
          </label>
          <button
            type="submit"
            disabled={saving || !f.name.trim()}
            style={{
              ...primary, justifyContent: 'center',
              opacity: saving || !f.name.trim() ? 0.6 : 1
            }}>
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {edit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </form>
    </div >
  );
}


const primary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: 'none', borderRadius: 8, background: C.red, color: '#fff',
  fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
const cell: React.CSSProperties = { padding: '11px 12px', fontSize: 14, color: C.text };
const th: React.CSSProperties = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
  textTransform: 'uppercase', color: C.subtle, textAlign: 'left',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  color: '#000',
  background: '#fff',
  outline: 'none',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 5,
};
<style>{`
  .category-modal-input::placeholder {
    color: #999;
    opacity: 1;
  }
`}</style>
