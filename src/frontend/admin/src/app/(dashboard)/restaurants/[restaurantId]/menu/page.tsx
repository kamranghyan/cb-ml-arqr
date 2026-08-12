'use client';

import { useParams } from 'next/navigation';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Bell, Plus, Edit2, Trash2,
  X, CloudUpload, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import { formatPrice } from '@/lib/data';
import { Toggle, StatusChip } from '@/components/ui';
import {
  fetchMenuItems,
  fetchMenuItem,
  updateMenuItem,
  fetchCategories,
  normaliseItem,
  type ApiMenuItem,
  deleteMenuItem,
} from '@/lib/menu-api';
import { TENANT_ID } from '@/lib/api-config';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import Image from 'next/image';
import { useTheme } from '@/hooks/useTheme';

const BRAND = '#ff5723';

type ModalState = { open: boolean; item?: ApiMenuItem };
type LoadState = 'idle' | 'loading' | 'success' | 'error';
type GlbStatus = 'idle' | 'uploading' | 'approved' | 'error';

// The branch is whichever restaurant the tenant opened.
const MENU_BASE_URL = '/api/menu';

// Theme colors
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFF8F1',
  card: isDark ? '#1C1C1C' : '#ffffff',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  text: isDark ? '#F5F0E8' : '#1A1A1A',
  muted: isDark ? '#9CA3AF' : '#687780',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  inputBg: isDark ? '#1C1C1C' : '#FFF8F1',
  inputBorder: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  inputText: isDark ? '#F5F0E8' : '#1A1A1A',
  placeholder: isDark ? '#6B7280' : '#999999',
  brand: BRAND,
  brandHover: '#e04a1a',
  success: isDark ? '#4ade80' : '#0F9D58',
  danger: isDark ? '#ff8a5c' : '#E1251B',
  warning: isDark ? '#fb923c' : '#d97706',
  imageBg: isDark ? 'rgba(255,87,35,0.08)' : '#FFF3E0',
  imageBorder: isDark ? 'rgba(255,87,35,0.2)' : '#FED7AA',
  shadow: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(137,28,28,0.15)',
  statusBg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
  statusBorder: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
  statusText: isDark ? '#4ade80' : '#16a34a',
  inactiveBg: isDark ? 'rgba(156,163,175,0.12)' : '#F9FAFB',
  inactiveBorder: isDark ? 'rgba(156,163,175,0.2)' : '#F0E8E0',
  inactiveText: isDark ? '#9CA3AF' : '#687780',
  activeDot: isDark ? '#4ade80' : '#22c55e',
  inactiveDot: isDark ? '#6B7280' : '#D1D5DB',
  modalOverlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
  glbBg: isDark ? 'rgba(124,58,237,0.12)' : '#FAF5FF',
  glbBorder: isDark ? 'rgba(124,58,237,0.3)' : '#DDD6FE',
  glbText: isDark ? '#a78bfa' : '#7c3aed',
});

async function createMenuItemWithFiles(
  restaurantId: string,
  payload: { name: string; description: string; price: number; categoryId: string; isActive: boolean; allergens?: string[]; prepTime?: string; calories?: number; },
  imageFile?: File | null, glbFile?: File | null,
): Promise<any> {
  const fd = new FormData();
  fd.append('name', payload.name);
  fd.append('description', payload.description);
  fd.append('priceMinorUnits', String(Math.round(payload.price * 100)));
  fd.append('categoryId', payload.categoryId);
  fd.append('isActive', String(payload.isActive));
  fd.append('restaurantId', restaurantId);
  if (payload.allergens?.length) fd.append('allergens', payload.allergens.join(','));
  if (payload.prepTime) fd.append('prepTime', payload.prepTime);
  if (payload.calories) fd.append('calories', String(payload.calories));
  if (imageFile) fd.append('file', imageFile);
  if (glbFile) fd.append('arFile', glbFile);
  const { getValidIdToken } = await import('@/lib/cognito');
  const token = await getValidIdToken();

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;
  headers['x-tenant-id'] = TENANT_ID;

  const res = await fetch(`${MENU_BASE_URL}/restaurants/${restaurantId}/items`, { method: 'POST', headers, body: fd });
  if (!res.ok) { const txt = await res.text().catch(() => res.statusText); throw new Error(`Create failed (${res.status}): ${txt}`); }
  return res.json();
}

function FieldLabel({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  
  return (
    <label style={{ 
      display: 'block', 
      fontSize: 11, 
      color: colors.subtle, 
      fontWeight: 700, 
      letterSpacing: 1.5, 
      textTransform: 'uppercase' as const, 
      marginBottom: 6 
    }}>
      {children}{extra && <span style={{ marginLeft: 8, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>{extra}</span>}
    </label>
  );
}

export default function BranchMenuPage() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const restaurantId = String(useParams().restaurantId ?? '');
  const [items, setItems] = useState<ApiMenuItem[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [isActive, setIsActive] = useState(true);
  const [isChef, setIsChef] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [glbName, setGlbName] = useState<string | null>(null);
  const [glbStatus, setGlbStatus] = useState<GlbStatus>('idle');
  const [glbError, setGlbError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', prepTime: '', calories: '' });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    item?: ApiMenuItem;
  }>({
    open: false,
  });

  const loadItems = useCallback(async () => {
    setLoadState("loading");

    try {
      const raw = await fetchMenuItems(restaurantId);
      const categoriesResponse = await fetchCategories(restaurantId);

      const catList = categoriesResponse.map((cat: any) => ({
        id: cat.id ?? cat.categoryId,
        name: cat.name ?? cat.categoryName
      }));

      setCats(catList);

      const categoryMap = new Map(
        catList.map(cat => [
          cat.id,
          cat.name
        ])
      );

      const updatedItems = raw.map((item: any) => {
        const categoryId =
          item.categoryId ??
          item.category?.id ??
          '';

        const categoryName =
          categoryMap.get(categoryId) ??
          item.categoryName ??
          item.category?.name ??
          (typeof item.category === 'string' ? item.category : '') ??
          'Unknown';

        return normaliseItem({
          ...item,
          categoryId,
          categoryName,
        });
      });

      setItems(updatedItems);
      setLoadState("success");
    }
    catch (err: any) {
      console.error(err);
      setLoadError(err?.message ?? 'Failed to load menu items.');
      setLoadState('error');
    }
  }, [restaurantId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter(item => {
    if (item.status === 'inactive') return false;
    const matchCategory =
      category === 'all' ||
      item.categoryId === category;
    const matchSearch =
      item.name
        .toLowerCase()
        .includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });
  
  const activeItems = items.filter(i => i.status === 'active');

  const openModal = (item?: ApiMenuItem) => {
    setModal({ open: true, item });
    setIsActive(item ? item.status === 'active' : true);
    setIsChef(item ? (item.tags ?? []).includes('chef') : false);
    setUploadFile(null);
    setUploadName(null);
    setGlbFile(null);
    setImagePreview(null);
    setGlbName(null);
    setGlbStatus('idle');
    setGlbError('');
    setSaveMsg('');
    setSaveErr('');

    let selectedCategory = '';

    if (item) {
      const itemCategoryId = String(
        item.categoryId ??
        (item as any).category?.id ??
        ''
      );

      const itemCategoryName = String(
        item.categoryName ??
        (item as any).category?.name ??
        (typeof (item as any).category === 'string'
          ? (item as any).category
          : '') ??
        ''
      ).trim().toLowerCase();

      const categoryById = cats.find(
        c => String(c.id) === itemCategoryId
      );

      const categoryByName = cats.find(
        c =>
          c.name.trim().toLowerCase() ===
          itemCategoryName
      );

      selectedCategory =
        categoryById?.id ??
        categoryByName?.id ??
        '';
    } else {
      selectedCategory = cats[0]?.id ?? '';
    }

    setForm({
      name: item?.name ?? '',
      description: item?.description ?? '',
      price:
        item?.price !== undefined && item?.price !== null
          ? String(item.price)
          : '',
      category: selectedCategory,
      prepTime: item?.prepTime ?? '',
      calories:
        item?.calories !== undefined &&
          item?.calories !== null
          ? String(item.calories)
          : '',
    });
  };

  const uploadToS3 = async (url: string, file: File, ct: string) => {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
  };

  const saveItem = async () => {
    if (!form.name.trim() || !form.price) { setSaveErr('Name and price are required.'); return; }
    if (cats.length === 0) { setSaveErr('Categories are still loading. Please wait a moment and try again.'); return; }
    if (!form.category) { setSaveErr('Please select a category.'); return; }
    if (!/^[0-9a-fA-F-]{36}$/.test(form.category)) {
      setSaveErr('Invalid category selected.');
      return;
    }
    setSaving(true); setSaveMsg(''); setSaveErr('');
    try {
      if (modal.item?.id) {
        const version = (modal.item as any).version ?? 1;
        const raw = await updateMenuItem(modal.item.id, { 
          name: form.name.trim(), 
          description: form.description.trim(), 
          price: parseFloat(form.price), 
          categoryId: form.category, 
          status: isActive ? 'active' : 'inactive', 
          tags: isChef ? ['chef'] : [], 
          prepTime: form.prepTime || '20 min', 
          calories: form.calories ? parseInt(form.calories) : undefined 
        }, version);
        setItems(prev => prev.map(i => i.id === ((raw as any).id ?? (raw as any).itemId) ? normaliseItem(raw) : i));
        setSaveMsg('Item updated!');
        if (uploadFile) { 
          setSaveMsg('Getting image upload URL…'); 
          const fetched = await fetchMenuItem(modal.item.id, restaurantId) as any; 
          if (fetched.imageUrl) { 
            setSaveMsg('Uploading image…'); 
            await uploadToS3(fetched.imageUrl, uploadFile, uploadFile.type || 'image/png'); 
            setSaveMsg('Image uploaded! ✓'); 
          } 
        }
        if (glbFile && !(modal.item as any).arModelKey) { 
          setSaveErr('This item has no AR model slot. Use "Recreate & Upload Files" to create a fresh item with GLB.'); 
          setSaving(false); 
          return; 
        }
      } else {
        setSaveMsg('Creating item…');
        if (glbFile) { setGlbStatus('uploading'); setSaveMsg('Uploading item + 3D model…'); }
        const raw = await createMenuItemWithFiles(
          restaurantId,
          {
            name: form.name.trim(),
            description: form.description.trim(),
            price: parseFloat(form.price),
            categoryId: form.category,
            isActive: true,
            prepTime: form.prepTime || undefined,
            calories: form.calories ? parseInt(form.calories) : undefined,
          },
          uploadFile,
          glbFile
        ); 
        setItems(prev => [...prev, normaliseItem(raw)]);
        if (raw.arModelKey) { setGlbStatus('approved'); setSaveMsg('Item created with 3D model! ✓'); }
        else setSaveMsg('Item created!');
      }
      setTimeout(() => { setModal({ open: false }); loadItems(); setSaveMsg(''); }, 1400);
    } catch (err: any) { 
      setSaveErr(err?.message ?? 'Save failed.'); 
      if (glbStatus === 'uploading') { setGlbStatus('error'); setGlbError(err?.message ?? 'Upload failed'); } 
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    const item = deleteModal.item;
    if (!item?.id) return;
    setDeleting(item.id);
    try {
      await deleteMenuItem(item.id, restaurantId);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setDeleteModal({ open: false });
    } catch (err: any) {
      console.error('DELETE ITEM ERROR:', err);
      setSaveErr(err?.message ?? 'Unable to delete item');
    } finally {
      setDeleting(null);
    }
  };

  const handleRecreate = async () => {
    if (!modal.item) return;
    if (!confirm('Deactivate old item and create fresh with files? Continue?')) return;
    setSaving(true); setSaveErr(''); setSaveMsg('Deactivating old item…');
    try {
      const latest = await fetchMenuItem(modal.item.id, restaurantId) as any;
      await updateMenuItem(modal.item.id, { 
        name: latest.name, 
        description: latest.description ?? '', 
        categoryId: latest.categoryId, 
        price: (latest.priceMinorUnits ?? 0) / 100, 
        status: 'inactive' 
      }, latest.version ?? 1);
      setItems(prev => prev.filter(i => i.id !== modal.item!.id));
      setSaveMsg('Creating fresh item with files…');
      if (glbFile) setGlbStatus('uploading');
      const raw = await createMenuItemWithFiles(
        restaurantId,
        {
          name: form.name.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price),
          categoryId: form.category,
          isActive: true,
          prepTime: form.prepTime || undefined,
          calories: form.calories ? parseInt(form.calories) : undefined,
        },
        uploadFile,
        glbFile
      ); 
      setItems(prev => [...prev, normaliseItem(raw)]);
      if (raw.arModelKey) { setGlbStatus('approved'); setSaveMsg('Recreated with 3D model! ✓'); }
      else setSaveMsg('Recreated! ✓');
      setTimeout(() => { setModal({ open: false }); loadItems(); }, 1500);
    } catch (err: any) { 
      setSaveErr(err?.message ?? 'Recreate failed.'); 
      if (glbStatus === 'uploading') { setGlbStatus('error'); setGlbError(err?.message ?? 'Failed'); } 
    } finally { setSaving(false); }
  };

  const inputStyle = (focus = false): React.CSSProperties => ({ 
    width: '100%', 
    height: 42, 
    borderRadius: 10, 
    padding: '0 12px', 
    background: colors.inputBg, 
    border: `1.5px solid ${colors.inputBorder}`, 
    fontSize: 13, 
    color: colors.inputText, 
    outline: 'none', 
    boxSizing: 'border-box', 
    fontFamily: 'sans-serif', 
    transition: 'border-color 0.2s' 
  });

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: colors.bg 
    }}>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '16px 32px', 
        background: colors.card, 
        borderBottom: `1.5px solid ${colors.border}`, 
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{ 
            fontSize: 20, 
            fontWeight: 800, 
            color: colors.text, 
            margin: 0, 
            fontFamily: 'Georgia, serif' 
          }}>Menu Management</h1>
          <p style={{ 
            fontSize: 12, 
            color: colors.muted, 
            margin: '2px 0 0' 
          }}>Live API · {activeItems.length} active items</p>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10,
          flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ 
              position: 'absolute', 
              left: 12, 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: colors.subtle, 
              pointerEvents: 'none' 
            }} />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search items…"
              style={{ 
                height: 36, 
                paddingLeft: 36, 
                paddingRight: 14, 
                borderRadius: 10, 
                width: 200, 
                fontSize: 13, 
                background: colors.inputBg, 
                border: `1.5px solid ${colors.inputBorder}`, 
                color: colors.inputText, 
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = colors.inputBorder}
            />
          </div>
          <button onClick={loadItems} title="Refresh"
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 10, 
              background: colors.imageBg, 
              border: `1.5px solid ${colors.imageBorder}`, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer' 
            }}>
            <RefreshCw size={14} color={colors.text} className={loadState === 'loading' ? 'animate-spin' : ''} />
          </button>
          <button style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 10, 
            background: colors.inputBg, 
            border: `1.5px solid ${colors.inputBorder}`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer' 
          }}>
            <Bell size={15} color={colors.muted} />
          </button>
          <button onClick={() => openModal()}
            style={{ 
              height: 36, 
              padding: '0 16px', 
              borderRadius: 10, 
              background: BRAND, 
              color: '#fff', 
              border: 'none', 
              fontSize: 13, 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              cursor: 'pointer', 
              boxShadow: `0 4px 12px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(225,37,27,0.25)'}` 
            }}>
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      <div style={{ 
        flex: 1, 
        padding: '24px 32px', 
        overflowY: 'auto', 
        background: colors.bg, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 20 
      }}>

        {/* Error */}
        {loadState === 'error' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            padding: '14px 16px', 
            background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0', 
            border: `1.5px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`, 
            borderRadius: 14 
          }}>
            <AlertCircle size={16} color={colors.danger} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: colors.danger, margin: 0 }}>Failed to load menu items</p>
              <p style={{ fontSize: 12, color: colors.muted, margin: '2px 0 0' }}>{loadError}</p>
            </div>
            <button onClick={loadItems} style={{ 
              padding: '6px 14px', 
              borderRadius: 8, 
              background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0', 
              border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`, 
              color: colors.danger, 
              fontSize: 12, 
              fontWeight: 700, 
              cursor: 'pointer' 
            }}>Retry</button>
          </div>
        )}

        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: 12, 
          maxWidth: 360 
        }}>
          {[
            { label: 'Total Items', val: activeItems.length, color: colors.text },
            { label: 'Active', val: activeItems.length, color: BRAND },
          ].map(s => (
            <div key={s.label} style={{ 
              background: colors.card, 
              border: `1.5px solid ${colors.border}`, 
              borderRadius: 16, 
              padding: '16px' 
            }}>
              <p style={{ 
                fontSize: 10, 
                color: colors.subtle, 
                fontWeight: 700, 
                letterSpacing: 2, 
                textTransform: 'uppercase', 
                margin: '0 0 6px' 
              }}>{s.label}</p>
              <p style={{ 
                fontSize: 28, 
                fontWeight: 800, 
                color: s.color, 
                fontFamily: 'Georgia, serif', 
                margin: 0 
              }}>
                {loadState === 'loading' ? '…' : s.val}
              </p>
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ id: 'all', name: '🍽️ All' }, ...cats].map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              style={{ 
                padding: '6px 16px', 
                borderRadius: 20, 
                border: `1.5px solid ${category === cat.id ? BRAND : colors.border}`, 
                background: category === cat.id ? (isDark ? 'rgba(255,87,35,0.12)' : '#FFF0EE') : colors.card, 
                color: category === cat.id ? BRAND : colors.muted, 
                fontSize: 12, 
                fontWeight: 700, 
                cursor: 'pointer', 
                transition: 'all 0.2s' 
              }}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loadState === 'loading' && (
          <div style={{ 
            background: colors.card, 
            border: `1.5px solid ${colors.border}`, 
            borderRadius: 16, 
            overflow: 'hidden' 
          }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 14, 
                padding: '14px 20px', 
                borderBottom: `1px solid ${colors.border}` 
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: colors.inputBg }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 10, width: '33%', background: colors.inputBg, borderRadius: 6 }} />
                  <div style={{ height: 8, width: '50%', background: colors.inputBg, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {(loadState === 'success' || loadState === 'idle' || loadState === 'error') && (
          <div style={{ 
            background: colors.card, 
            border: `1.5px solid ${colors.border}`, 
            borderRadius: 16, 
            overflow: 'hidden', 
            boxShadow: `0 2px 8px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(137,28,28,0.05)'}` 
          }}>
            {/* Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px', 
              gap: 12, 
              padding: '10px 20px', 
              borderBottom: `1.5px solid ${colors.border}`, 
              background: colors.card2 
            }}>
              {['', 'Item', 'Category', 'Price', 'Rating', 'Status', 'Actions'].map(h => (
                <p key={h} style={{ 
                  fontSize: 10, 
                  color: colors.subtle, 
                  fontWeight: 700, 
                  letterSpacing: 2, 
                  textTransform: 'uppercase', 
                  margin: 0 
                }}>{h}</p>
              ))}
            </div>

            {/* Empty */}
            {filtered.length === 0 && loadState === 'success' && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '48px 0', 
                gap: 12 
              }}>
                <span style={{ fontSize: 36, opacity: 0.2 }}>🍽️</span>
                <p style={{ fontSize: 13, color: colors.subtle, margin: 0 }}>No items found</p>
                <button onClick={() => openModal()} style={{ 
                  padding: '8px 20px', 
                  borderRadius: 24, 
                  background: colors.imageBg, 
                  border: `1.5px solid ${colors.imageBorder}`, 
                  color: BRAND, 
                  fontSize: 13, 
                  fontWeight: 700, 
                  cursor: 'pointer' 
                }}>Add First Item</button>
              </div>
            )}

            {/* Rows */}
            {filtered.map((item, idx) => (
              <div key={item.id ?? `item-${idx}`}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px', 
                  gap: 12, 
                  padding: '12px 20px', 
                  borderBottom: `1px solid ${colors.border}`, 
                  alignItems: 'center', 
                  transition: 'background 0.15s' 
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = colors.card2}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

                {/* Thumb */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: colors.imageBg,
                    border: `1px solid ${colors.imageBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {(item as any).imageUrl ? (
                    <Image
                      src={(item as any).imageUrl}
                      alt={item.name}
                      fill
                      sizes="40px"
                      unoptimized
                      style={{
                        objectFit: 'cover',
                        borderRadius: 10,
                      }}
                    />
                  ) : (
                    <span>{item.emoji}</span>
                  )}
                </div>

                {/* Name */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ 
                      fontSize: 13, 
                      fontWeight: 700, 
                      color: colors.text, 
                      margin: 0, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>{item.name}</p>
                    {(item as any).arModelKey && (
                      <span style={{ 
                        fontSize: 9, 
                        background: colors.glbBg, 
                        border: `1px solid ${colors.glbBorder}`, 
                        color: colors.glbText, 
                        padding: '2px 6px', 
                        borderRadius: 10, 
                        fontWeight: 700, 
                        flexShrink: 0 
                      }}>3D</span>
                    )}
                  </div>
                  <p style={{ 
                    fontSize: 11, 
                    color: colors.subtle, 
                    margin: 0, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}>{item.description}</p>
                </div>

                <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                  {item.categoryName || item.category || "—"}
                </p>
                <p style={{ 
                  fontSize: 13, 
                  fontWeight: 700, 
                  color: BRAND, 
                  margin: 0, 
                  fontFamily: 'Georgia, serif' 
                }}>{formatPrice(item.price)}</p>
                <p style={{ 
                  fontSize: 12, 
                  color: colors.warning, 
                  fontWeight: 600, 
                  margin: 0 
                }}>★ {item.rating?.toFixed(1) ?? '—'}</p>

                {/* Status */}
                <span style={{
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 5, 
                  padding: '4px 10px', 
                  borderRadius: 20, 
                  fontSize: 11, 
                  fontWeight: 700,
                  background: item.status === 'active' ? colors.statusBg : colors.inactiveBg,
                  color: item.status === 'active' ? colors.statusText : colors.inactiveText,
                  border: `1px solid ${item.status === 'active' ? colors.statusBorder : colors.inactiveBorder}`,
                }}>
                  <span style={{ 
                    width: 5, 
                    height: 5, 
                    borderRadius: '50%', 
                    background: item.status === 'active' ? colors.activeDot : colors.inactiveDot, 
                    display: 'inline-block' 
                  }} />
                  {item.status}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openModal(item)}
                    style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 8, 
                      background: colors.imageBg, 
                      border: `1px solid ${colors.imageBorder}`, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s' 
                    }}
                    onMouseEnter={e => { 
                      const b = e.currentTarget as HTMLButtonElement; 
                      b.style.background = isDark ? 'rgba(255,87,35,0.2)' : '#FFF0EE'; 
                      b.style.borderColor = isDark ? 'rgba(255,87,35,0.3)' : '#FED0CC'; 
                    }}
                    onMouseLeave={e => { 
                      const b = e.currentTarget as HTMLButtonElement; 
                      b.style.background = colors.imageBg; 
                      b.style.borderColor = colors.imageBorder; 
                    }}>
                    <Edit2 size={12} color={colors.text} />
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, item })}
                    disabled={deleting === item.id}
                    style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 8, 
                      background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0', 
                      border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer', 
                      opacity: deleting === item.id ? 0.4 : 1, 
                      transition: 'all 0.2s' 
                    }}>
                    {deleting === item.id ? <Loader2 size={12} color={colors.subtle} className="animate-spin" /> : <Trash2 size={12} color={colors.danger} />}
                  </button>
                </div>
              </div>
            ))}

            {/* Footer */}
            {(loadState === 'success' || loadState === 'idle') && activeItems.length > 0 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '10px 20px', 
                borderTop: `1.5px solid ${colors.border}`, 
                background: colors.card2 
              }}>
                <p style={{ fontSize: 11, color: colors.subtle, margin: 0 }}>Showing {filtered.length} of {activeItems.length} active items</p>
                <p style={{ 
                  fontSize: 11, 
                  color: colors.subtle, 
                  fontFamily: 'monospace', 
                  margin: 0 
                }}>Source: AWS API Gateway</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modal.open && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: colors.modalOverlay, 
          backdropFilter: 'blur(4px)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 50, 
          padding: 24 
        }}
          onClick={e => e.target === e.currentTarget && setModal({ open: false })}>
          <div style={{ 
            background: colors.card, 
            border: `1.5px solid ${colors.border}`, 
            borderRadius: 24, 
            width: 460, 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            padding: 24, 
            boxShadow: `0 20px 60px ${colors.shadow}` 
          }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ 
                  fontSize: 18, 
                  fontWeight: 800, 
                  color: colors.text, 
                  margin: 0, 
                  fontFamily: 'Georgia, serif' 
                }}>{modal.item ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <p style={{ 
                  fontSize: 11, 
                  color: colors.subtle, 
                  margin: '2px 0 0' 
                }}>{modal.item ? `ID: ${modal.item.id?.slice(0, 8)}…` : 'POST to AWS API Gateway'}</p>
              </div>
              <button onClick={() => setModal({ open: false })}
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 10, 
                  background: colors.inputBg, 
                  border: `1.5px solid ${colors.inputBorder}`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer' 
                }}>
                <X size={14} color={colors.muted} />
              </button>
            </div>

            {/* Alerts */}
            {saveMsg && <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '10px 14px', 
              background: colors.statusBg, 
              border: `1px solid ${colors.statusBorder}`, 
              borderRadius: 12, 
              marginBottom: 14 
            }}><CheckCircle size={14} color={colors.statusText} /><p style={{ 
              fontSize: 12, 
              color: colors.statusText, 
              fontWeight: 600, 
              margin: 0 
            }}>{saveMsg}</p></div>}
            {saveErr && <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '10px 14px', 
              background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0', 
              border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`, 
              borderRadius: 12, 
              marginBottom: 14 
            }}><AlertCircle size={14} color={colors.danger} /><p style={{ 
              fontSize: 12, 
              color: colors.danger, 
              margin: 0 
            }}>{saveErr}</p></div>}

            {/* Item Name */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Item Name *</FieldLabel>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Chicken Karahi" style={inputStyle()}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = colors.inputBorder} />
            </div>

            {/* Category + Price */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <FieldLabel>{!form.category ? <span style={{ color: colors.warning }}>Category ⚠</span> : 'Category'}</FieldLabel>
                <select
                  value={form.category}
                  onChange={e =>
                    setForm(p => ({
                      ...p,
                      category: e.target.value,
                    }))
                  }
                  style={{ ...inputStyle(), appearance: 'none' as any }}
                  onFocus={e =>
                    (e.target as HTMLSelectElement).style.borderColor = BRAND
                  }
                  onBlur={e =>
                    (e.target as HTMLSelectElement).style.borderColor = colors.inputBorder
                  }
                >
                  {cats.length === 0 ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    <>
                      <option value="">Select category</option>
                      {cats.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div>
                <FieldLabel>Price (Rs) *</FieldLabel>
                <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0" style={inputStyle()}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = colors.inputBorder} />
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Description</FieldLabel>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description…" rows={2}
                style={{ ...inputStyle(), height: 'auto', padding: '10px 12px', resize: 'none', fontFamily: 'sans-serif' } as React.CSSProperties}
                onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = BRAND}
                onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = colors.inputBorder} />
            </div>

            {/* Prep + Calories */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <FieldLabel>Prep Time</FieldLabel>
                <input value={form.prepTime} onChange={e => setForm(p => ({ ...p, prepTime: e.target.value }))} placeholder="e.g. 25 min" style={inputStyle()}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = colors.inputBorder} />
              </div>
              <div>
                <FieldLabel>Calories</FieldLabel>
                <input type="number" value={form.calories} onChange={e => setForm(p => ({ ...p, calories: e.target.value }))} placeholder="e.g. 680" style={inputStyle()}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = colors.inputBorder} />
              </div>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel extra={modal.item && !(modal.item as any).imageKey ? <span style={{ color: colors.warning, fontSize: 11 }}>— no image yet</span> : modal.item && (modal.item as any).imageKey ? <span style={{ color: colors.statusText, fontSize: 11 }}>✓ uploaded</span> : null}>Item Image</FieldLabel>
              <label style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: 8, 
                padding: 20, 
                borderRadius: 16, 
                border: `2px dashed ${uploadName ? colors.imageBorder : colors.inputBorder}`, 
                background: uploadName ? colors.imageBg : colors.inputBg, 
                cursor: 'pointer', 
                transition: 'all 0.2s' 
              }}>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadFile(f);
                    setUploadName(f?.name ?? null);
                    if (f) {
                      const previewUrl = URL.createObjectURL(f);
                      setImagePreview(previewUrl);
                    } else {
                      setImagePreview(null);
                    }
                  }} />
                <CloudUpload size={24} color={uploadName ? colors.text : colors.subtle} />
                <span style={{ 
                  fontSize: 12, 
                  fontWeight: 600, 
                  color: uploadName ? colors.text : colors.subtle 
                }}>{uploadName ? `✓ ${uploadName}` : 'Click to upload · PNG, JPG'}</span>
              </label>
              {imagePreview && (
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    src={imagePreview}
                    alt="Selected item"
                    width={90}
                    height={90}
                    unoptimized
                    style={{
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* GLB upload */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel extra={modal.item && !(modal.item as any).arModelKey ? <span style={{ color: colors.warning, fontSize: 11 }}>— no model yet</span> : modal.item && (modal.item as any).arModelKey ? <span style={{ color: colors.statusText, fontSize: 11 }}>✓ uploaded</span> : null}>3D AR Model (.glb)</FieldLabel>
              {glbStatus === 'idle' && (
                <label style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: 20, 
                  borderRadius: 16, 
                  border: `2px dashed ${glbName ? colors.glbBorder : colors.inputBorder}`, 
                  background: glbName ? colors.glbBg : colors.inputBg, 
                  cursor: 'pointer', 
                  transition: 'all 0.2s' 
                }}>
                  <input type="file" accept=".glb,.gltf" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0] ?? null; setGlbFile(f); setGlbName(f?.name ?? null); setGlbError(''); }} />
                  <span style={{ fontSize: 24 }}>🫙</span>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: glbName ? colors.glbText : colors.subtle 
                  }}>{glbName ? `✓ ${glbName}` : 'Click to upload · .glb / .gltf'}</span>
                  {glbName && !modal.item && <span style={{ 
                    fontSize: 11, 
                    color: colors.glbText, 
                    opacity: 0.7 
                  }}>Will upload with item on Save</span>}
                  {glbName && modal.item && <span style={{ 
                    fontSize: 11, 
                    color: colors.warning, 
                    opacity: 0.8 
                  }}>Use Recreate button below to attach GLB</span>}
                </label>
              )}
              {glbStatus === 'uploading' && <div style={{ 
                padding: '14px 16px', 
                borderRadius: 16, 
                border: `2px dashed ${colors.glbBorder}`, 
                background: colors.glbBg, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8 
              }}><Loader2 size={13} color={colors.glbText} className="animate-spin" /><span style={{ 
                fontSize: 12, 
                color: colors.glbText, 
                fontWeight: 600 
              }}>{saveMsg || 'Uploading 3D model…'}</span></div>}
              {glbStatus === 'approved' && <div style={{ 
                padding: '14px 16px', 
                borderRadius: 16, 
                border: `2px dashed ${colors.statusBorder}`, 
                background: colors.statusBg, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10 
              }}><CheckCircle size={20} color={colors.statusText} style={{ flexShrink: 0 }} /><div><p style={{ 
                fontSize: 12, 
                color: colors.statusText, 
                fontWeight: 700, 
                margin: 0 
              }}>✓ 3D Model Uploaded</p><p style={{ 
                fontSize: 11, 
                color: colors.statusText, 
                opacity: 0.6, 
                margin: '2px 0 0' 
              }}>Refresh to see AR badge on item</p></div></div>}
              {glbStatus === 'error' && <div style={{ 
                padding: '14px 16px', 
                borderRadius: 16, 
                border: `2px dashed ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`, 
                background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0' 
              }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><AlertCircle size={14} color={colors.danger} style={{ flexShrink: 0 }} /><p style={{ 
                fontSize: 12, 
                color: colors.danger, 
                fontWeight: 700, 
                margin: 0 
              }}>Upload Error</p></div><p style={{ 
                fontSize: 11, 
                color: colors.muted, 
                margin: '0 0 8px' 
              }}>{glbError}</p><button onClick={() => { setGlbStatus('idle'); setGlbFile(null); setGlbName(null); }} style={{ 
                fontSize: 11, 
                color: colors.danger, 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                textDecoration: 'underline', 
                padding: 0 
              }}>Try again</button></div>}
            </div>

            {/* Recreate warning */}
            {modal.item && glbFile && (
              <div style={{ 
                marginBottom: 14, 
                padding: '12px 14px', 
                background: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB', 
                border: `1px solid ${isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A'}`, 
                borderRadius: 14 
              }}>
                <p style={{ 
                  fontSize: 11, 
                  color: isDark ? '#fb923c' : '#92400e', 
                  fontWeight: 700, 
                  margin: '0 0 8px' 
                }}>⚠ GLB upload requires recreating the item.</p>
                <button onClick={handleRecreate} disabled={saving}
                  style={{ 
                    width: '100%', 
                    height: 36, 
                    borderRadius: 10, 
                    background: colors.warning, 
                    color: '#fff', 
                    border: 'none', 
                    fontSize: 12, 
                    fontWeight: 700, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 6, 
                    cursor: 'pointer', 
                    opacity: saving ? 0.6 : 1 
                  }}>
                  {saving ? <><Loader2 size={13} className="animate-spin" /> {saveMsg}</> : '🔄 Recreate & Upload Files'}
                </button>
              </div>
            )}

            {/* Toggles */}
            <div style={{ borderTop: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ fontSize: 13, color: colors.muted }}>Active on guest menu</span>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${colors.border}` }}>
                <span style={{ fontSize: 13, color: colors.muted }}>Mark as Chef's Special</span>
                <Toggle checked={isChef} onChange={setIsChef} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setModal({ open: false })}
                style={{ 
                  flex: 1, 
                  height: 40, 
                  borderRadius: 10, 
                  background: colors.inputBg, 
                  border: `1.5px solid ${colors.inputBorder}`, 
                  color: colors.muted, 
                  fontSize: 13, 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}>
                Cancel
              </button>
              <button onClick={saveItem} disabled={saving || glbStatus === 'uploading' || (cats.length === 0 && !modal.item)}
                style={{ 
                  flex: 2, 
                  height: 40, 
                  borderRadius: 10, 
                  background: BRAND, 
                  color: '#fff', 
                  border: 'none', 
                  fontSize: 13, 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 6, 
                  cursor: 'pointer', 
                  opacity: (saving || glbStatus === 'uploading' || (cats.length === 0 && !modal.item)) ? 0.5 : 1, 
                  boxShadow: `0 4px 12px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(225,37,27,0.25)'}` 
                }}>
                {saving || glbStatus === 'uploading'
                  ? <><Loader2 size={14} className="animate-spin" /> {saveMsg || 'Saving…'}</>
                  : cats.length === 0 && !modal.item ? '⏳ Loading categories…'
                    : modal.item ? '✓ Update Item' : '✓ Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Menu Item"
        message="Are you sure you want to delete this menu item?"
        itemName={deleteModal.item?.name}
        onCancel={() => {
          if (!deleting) {
            setDeleteModal({ open: false });
          }
        }}
        onConfirm={handleDelete}
      />
      
      <style>{`
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
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
    </div>
  );
}