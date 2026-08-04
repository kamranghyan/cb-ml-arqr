// /components/ui/MenuItemModal.tsx

'use client';

import { useState, useEffect } from 'react';
import {
  X, CloudUpload, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';

const C = {
  red: '#E1251B',
  dark: '#891C1C',
  gold: '#FFC72C',
  bg: '#FFF8F1',
  white: '#fff',
  border: '#F0E8E0',
  text: '#1A1A1A',
  muted: '#687780',
  subtle: '#9CA3AF',
};

type GlbStatus = 'idle' | 'uploading' | 'approved' | 'error';

interface MenuItemModalProps {
  open: boolean;
  item?: any | null;
  categories: { id: string; name: string }[];
  restaurants: { restaurantId: string; name: string }[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onRecreate?: (data: any) => Promise<void>;
  isActive: boolean;
  setIsActive: (val: boolean) => void;
  isChef: boolean;
  setIsChef: (val: boolean) => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  uploadName: string | null;
  setUploadName: (name: string | null) => void;
  glbFile: File | null;
  setGlbFile: (file: File | null) => void;
  glbName: string | null;
  setGlbName: (name: string | null) => void;
  glbStatus: GlbStatus;
  setGlbStatus: (status: GlbStatus) => void;
  glbError: string;
  setGlbError: (error: string) => void;
  form: {
    name: string;
    description: string;
    price: string;
    category: string;
    prepTime: string;
    calories: string;
    restaurantId: string;
  };
  setForm: (form: any) => void;
  saving: boolean;
  saveMsg: string;
  saveErr: string;
  setSaveMsg: (msg: string) => void;
  setSaveErr: (err: string) => void;
  isMobile?: boolean;
}

function FieldLabel({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <label style={{ 
      display: 'block', 
      fontSize: 11, 
      color: C.subtle, 
      fontWeight: 700, 
      letterSpacing: 1.5, 
      textTransform: 'uppercase' as const, 
      marginBottom: 6 
    }}>
      {children}
      {extra && <span style={{ marginLeft: 8, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>{extra}</span>}
    </label>
  );
}

export function MenuItemModal({
  open,
  item,
  categories,
  restaurants,
  onClose,
  onSave,
  onRecreate,
  isActive,
  setIsActive,
  isChef,
  setIsChef,
  uploadFile,
  setUploadFile,
  uploadName,
  setUploadName,
  glbFile,
  setGlbFile,
  glbName,
  setGlbName,
  glbStatus,
  setGlbStatus,
  glbError,
  setGlbError,
  form,
  setForm,
  saving,
  saveMsg,
  saveErr,
  setSaveMsg,
  setSaveErr,
  isMobile = false,
}: MenuItemModalProps) {
  const [catsLoading, setCatsLoading] = useState(categories.length === 0);

  useEffect(() => {
    if (categories.length > 0) {
      setCatsLoading(false);
    }
  }, [categories]);

  if (!open) return null;

  const isEditMode = !!item;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      setSaveErr('Name and price are required.');
      return;
    }
    if (!form.category) {
      setSaveErr('Please select a category.');
      return;
    }
    if (!form.restaurantId) {
      setSaveErr('Please select a restaurant.');
      return;
    }
    await onSave({
      ...form,
      isActive,
      isChef,
    });
  };

  const handleRecreate = async () => {
    if (!onRecreate) return;
    if (!form.name.trim() || !form.price) {
      setSaveErr('Name and price are required.');
      return;
    }
    if (!form.category) {
      setSaveErr('Please select a category.');
      return;
    }
    if (!form.restaurantId) {
      setSaveErr('Please select a restaurant.');
      return;
    }
    await onRecreate({
      ...form,
      isActive: true,
      isChef,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: C.white,
          border: `1.5px solid ${C.border}`,
          borderRadius: 24,
          width: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '0 20px 60px rgba(137,28,28,0.15)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>
              {isEditMode ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>
            <p style={{ fontSize: 11, color: C.subtle, margin: '2px 0 0' }}>
              {isEditMode ? `ID: ${item?.id?.slice(0, 8)}…` : 'POST to AWS API Gateway'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: C.bg,
              border: `1.5px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} color={C.muted} />
          </button>
        </div>

        {/* Messages */}
        {saveMsg && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            padding: '10px 14px', 
            background: '#F0FFF4', 
            border: '1px solid #BBF7D0', 
            borderRadius: 12, 
            marginBottom: 14 
          }}>
            <CheckCircle size={14} color="#16a34a" />
            <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, margin: 0 }}>{saveMsg}</p>
          </div>
        )}
        {saveErr && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            padding: '10px 14px', 
            background: '#FFF0F0', 
            border: '1px solid #FFD0D0', 
            borderRadius: 12, 
            marginBottom: 14 
          }}>
            <AlertCircle size={14} color={C.red} />
            <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{saveErr}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Restaurant Dropdown */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Restaurant *</FieldLabel>
            <select
              value={form.restaurantId}
              onChange={(e) => setForm((p: any) => ({ ...p, restaurantId: e.target.value }))}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 10,
                padding: '0 12px',
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                fontSize: 13,
                color: C.text,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'sans-serif',
                transition: 'border-color 0.2s',
                appearance: 'none',
              }}
              onFocus={(e) => (e.target as HTMLSelectElement).style.borderColor = C.red}
              onBlur={(e) => (e.target as HTMLSelectElement).style.borderColor = C.border}
            >
              <option value="">Select a restaurant...</option>
              {restaurants.map((r) => (
                <option key={r.restaurantId} value={r.restaurantId}>
                  {r.name}
                </option>
              ))}
            </select>
            {!form.restaurantId && (
              <p style={{ fontSize: 11, color: '#d97706', margin: '4px 0 0' }}>
                ⚠ Please select a restaurant
              </p>
            )}
          </div>

          {/* Item Name */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Item Name *</FieldLabel>
            <input
              value={form.name}
              onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Chicken Karahi"
              style={{
                width: '100%',
                height: 42,
                borderRadius: 10,
                padding: '0 12px',
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                fontSize: 13,
                color: C.text,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'sans-serif',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = C.red}
              onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = C.border}
            />
          </div>

          {/* Category + Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <FieldLabel>{!form.category ? <span style={{ color: '#d97706' }}>Category ⚠</span> : 'Category'}</FieldLabel>
              <select
                value={form.category}
                onChange={(e) => setForm((p: any) => ({ ...p, category: e.target.value }))}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 10,
                  padding: '0 12px',
                  background: C.bg,
                  border: `1.5px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'sans-serif',
                  transition: 'border-color 0.2s',
                  appearance: 'none',
                }}
                onFocus={(e) => (e.target as HTMLSelectElement).style.borderColor = C.red}
                onBlur={(e) => (e.target as HTMLSelectElement).style.borderColor = C.border}
              >
                {catsLoading && <option value="">⚠ Loading…</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Price (Rs) *</FieldLabel>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((p: any) => ({ ...p, price: e.target.value }))}
                placeholder="0"
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 10,
                  padding: '0 12px',
                  background: C.bg,
                  border: `1.5px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'sans-serif',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = C.red}
                onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = C.border}
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))}
              placeholder="Short description…"
              rows={2}
              style={{
                width: '100%',
                borderRadius: 10,
                padding: '10px 12px',
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                fontSize: 13,
                color: C.text,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'sans-serif',
                transition: 'border-color 0.2s',
                height: 'auto',
                resize: 'none',
              }}
              onFocus={(e) => (e.target as HTMLTextAreaElement).style.borderColor = C.red}
              onBlur={(e) => (e.target as HTMLTextAreaElement).style.borderColor = C.border}
            />
          </div>

          {/* Prep Time + Calories */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <FieldLabel>Prep Time</FieldLabel>
              <input
                value={form.prepTime}
                onChange={(e) => setForm((p: any) => ({ ...p, prepTime: e.target.value }))}
                placeholder="e.g. 25 min"
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 10,
                  padding: '0 12px',
                  background: C.bg,
                  border: `1.5px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'sans-serif',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = C.red}
                onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = C.border}
              />
            </div>
            <div>
              <FieldLabel>Calories</FieldLabel>
              <input
                type="number"
                value={form.calories}
                onChange={(e) => setForm((p: any) => ({ ...p, calories: e.target.value }))}
                placeholder="e.g. 680"
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 10,
                  padding: '0 12px',
                  background: C.bg,
                  border: `1.5px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'sans-serif',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = C.red}
                onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = C.border}
              />
            </div>
          </div>

          {/* Image Upload */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Item Image</FieldLabel>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 20,
                borderRadius: 16,
                border: `2px dashed ${uploadName ? '#FED7AA' : C.border}`,
                background: uploadName ? '#FFF8F1' : C.bg,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setUploadFile(f);
                  setUploadName(f?.name ?? null);
                }}
              />
              <CloudUpload size={24} color={uploadName ? C.dark : C.subtle} />
              <span style={{ fontSize: 12, fontWeight: 600, color: uploadName ? C.dark : C.subtle }}>
                {uploadName ? `✓ ${uploadName}` : 'Click to upload · PNG, JPG'}
              </span>
              {uploadFile && (
                <span style={{ fontSize: 10, color: C.muted }}>
                  {Math.round(uploadFile.size / 1024)} KB
                </span>
              )}
            </label>
          </div>

          {/* GLB Upload */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel extra={isEditMode && !(item as any)?.arModelKey ? <span style={{ color: '#d97706', fontSize: 11 }}>— no model yet</span> : isEditMode && (item as any)?.arModelKey ? <span style={{ color: '#16a34a', fontSize: 11 }}>✓ uploaded</span> : null}>
              3D AR Model (.glb)
            </FieldLabel>
            {glbStatus === 'idle' && (
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 20,
                  borderRadius: 16,
                  border: `2px dashed ${glbName ? '#DDD6FE' : C.border}`,
                  background: glbName ? '#FAF5FF' : C.bg,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="file"
                  accept=".glb,.gltf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setGlbFile(f);
                    setGlbName(f?.name ?? null);
                    setGlbError('');
                  }}
                />
                <span style={{ fontSize: 24 }}>🫙</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: glbName ? '#7c3aed' : C.subtle }}>
                  {glbName ? `✓ ${glbName}` : 'Click to upload · .glb / .gltf'}
                </span>
                {glbName && !isEditMode && (
                  <span style={{ fontSize: 11, color: '#7c3aed', opacity: 0.7 }}>Will upload with item on Save</span>
                )}
                {glbName && isEditMode && (
                  <span style={{ fontSize: 11, color: '#d97706', opacity: 0.8 }}>Use Recreate button below to attach GLB</span>
                )}
              </label>
            )}
            {glbStatus === 'uploading' && (
              <div style={{ padding: '14px 16px', borderRadius: 16, border: '2px dashed #DDD6FE', background: '#FAF5FF', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={13} color="#7c3aed" className="animate-spin" />
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>{saveMsg || 'Uploading 3D model…'}</span>
              </div>
            )}
            {glbStatus === 'approved' && (
              <div style={{ padding: '14px 16px', borderRadius: 16, border: '2px dashed #BBF7D0', background: '#F0FFF4', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, margin: 0 }}>✓ 3D Model Uploaded</p>
                  <p style={{ fontSize: 11, color: '#16a34a', opacity: 0.6, margin: '2px 0 0' }}>Refresh to see AR badge on item</p>
                </div>
              </div>
            )}
            {glbStatus === 'error' && (
              <div style={{ padding: '14px 16px', borderRadius: 16, border: '2px dashed #FFD0D0', background: '#FFF0F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AlertCircle size={14} color={C.red} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: C.red, fontWeight: 700, margin: 0 }}>Upload Error</p>
                </div>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>{glbError}</p>
                <button
                  onClick={() => {
                    setGlbStatus('idle');
                    setGlbFile(null);
                    setGlbName(null);
                  }}
                  style={{ fontSize: 11, color: C.red, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Recreate Warning */}
          {isEditMode && glbFile && (
            <div style={{ marginBottom: 14, padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14 }}>
              <p style={{ fontSize: 11, color: '#92400e', fontWeight: 700, margin: '0 0 8px' }}>
                ⚠ GLB upload requires recreating the item.
              </p>
              <button
                onClick={handleRecreate}
                disabled={saving}
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 10,
                  background: '#d97706',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#b45309'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#d97706'; }}
              >
                {saving ? (
                  <><Loader2 size={13} className="animate-spin" /> {saveMsg}</>
                ) : (
                  '🔄 Recreate & Upload Files'
                )}
              </button>
            </div>
          )}

          {/* Toggle: Active */}
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <span style={{ fontSize: 13, color: C.muted }}>Active on guest menu</span>
              <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 24, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    inset: 0,
                    background: isActive ? C.red : C.border,
                    borderRadius: 24,
                    transition: 'all 0.3s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: 18,
                      width: 18,
                      left: 3,
                      bottom: 3,
                      background: 'white',
                      borderRadius: '50%',
                      transition: 'all 0.3s',
                      transform: isActive ? 'translateX(18px)' : 'none',
                    }}
                  />
                </span>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.muted }}>Mark as Chef's Special</span>
              <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 24, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isChef}
                  onChange={(e) => setIsChef(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    inset: 0,
                    background: isChef ? C.red : C.border,
                    borderRadius: 24,
                    transition: 'all 0.3s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: 18,
                      width: 18,
                      left: 3,
                      bottom: 3,
                      background: 'white',
                      borderRadius: '50%',
                      transition: 'all 0.3s',
                      transform: isChef ? 'translateX(18px)' : 'none',
                    }}
                  />
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                color: C.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || glbStatus === 'uploading' || (categories.length === 0 && !isEditMode) || !form.restaurantId}
              style={{
                flex: 2,
                height: 40,
                borderRadius: 10,
                background: C.red,
                color: '#fff',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                opacity: (saving || glbStatus === 'uploading' || (categories.length === 0 && !isEditMode) || !form.restaurantId) ? 0.5 : 1,
                boxShadow: '0 4px 12px rgba(225,37,27,0.25)',
              }}
            >
              {saving || glbStatus === 'uploading'
                ? <><Loader2 size={14} className="animate-spin" /> {saveMsg || 'Saving…'}</>
                : categories.length === 0 && !isEditMode ? '⏳ Loading categories…'
                : !form.restaurantId ? '⚠ Select Restaurant'
                : isEditMode ? '✓ Update Item' : '✓ Create Item'}
            </button>
          </div>
        </form>

        <style>{`
          .animate-spin {
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}