// /app/admin/menu/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Bell, Plus, Edit2, Trash2,
  Grid3x3, Tags, Store,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/data';
import {
  fetchMenuItems, fetchMenuItem, normaliseItem, type ApiMenuItem,
} from '@/lib/menu-api';
import { deleteMenuItem, updateMenuItem } from '@/lib/admin-api';
import {
  fetchRestaurants,
  type ApiRestaurant,
} from '@/lib/admin-api';

import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { MenuItemModal } from '@/components/ui/MenuItemModal';

const ADMIN_RESTAURANT_ID = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID ?? 'eea190fd-b8dd-470d-aff1-7d75be5c2efb';
const MENU_BASE_URL = '/api/menu';

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

type ModalState = { open: boolean; item?: ApiMenuItem };
type LoadState = 'idle' | 'loading' | 'success' | 'error';
type GlbStatus = 'idle' | 'uploading' | 'approved' | 'error';

export default function AdminMenuPage() {
  const router = useRouter();

  const [items, setItems] = useState<ApiMenuItem[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [restaurants, setRestaurants] = useState<ApiRestaurant[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState<ModalState>({ open: false });

  // ── Modal State ──────────────────────────────────────────────────────────
  const [isActive, setIsActive] = useState(true);
  const [isChef, setIsChef] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [glbName, setGlbName] = useState<string | null>(null);
  const [glbStatus, setGlbStatus] = useState<GlbStatus>('idle');
  const [glbError, setGlbError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    prepTime: '',
    calories: '',
    restaurantId: '',
  });

  // ── Delete Modal State ──────────────────────────────────────────────────
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    itemId?: string;
    itemName?: string;
  }>({ open: false });

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load Data ────────────────────────────────────────────────────────────
  const loadRestaurants = useCallback(async () => {
    try {
      const data = await fetchRestaurants();
      setRestaurants(data);
    } catch (e: any) {
      console.error('Failed to load restaurants:', e);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoadState('loading'); setLoadError('');
    try {
      const raw = await fetchMenuItems(ADMIN_RESTAURANT_ID);
      const normalised = raw.map(normaliseItem);
      setItems(normalised);
      
      const seen = new Map<string, string>();
      raw.forEach((r: any) => {
        const id = r.categoryId ?? '';
        const KNOWN: Record<string, string> = { 
          'e933848e-0d18-4e3a-b0a8-d70275c2fa54': 'Main Course' 
        };
        const name = r.categoryName ?? KNOWN[id] ?? (r.category && !r.category.includes('-') ? r.category : `Cat-${id.slice(0, 6)}`);
        if (id && id.includes('-')) seen.set(id, name);
      });
      
      const DEFAULT_CATS = [
        { id: 'e933848e-0d18-4e3a-b0a8-d70275c2fa54', name: 'Main Course' },
        { id: 'bev-cat-0000-0000-000000000001', name: 'Beverages' },
        { id: 'des-cat-0000-0000-000000000002', name: 'Desserts' },
        { id: 'str-cat-0000-0000-000000000003', name: 'Starters' },
      ];
      
      const catList = seen.size > 0 ? Array.from(seen.entries()).map(([id, name]) => ({ id, name })) : DEFAULT_CATS;
      setCats(catList);
      console.log('✅ Categories loaded:', catList);
      
      setForm(prev => prev.category === '' ? { ...prev, category: catList[0]?.id ?? '' } : prev);
      setLoadState('success');
    } catch (err: any) { 
      setLoadError(err?.message ?? 'Failed to load'); 
      setLoadState('error'); 
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadRestaurants();
  }, [loadItems, loadRestaurants]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const goToTables = () => router.push('/admin/tables');
  const goToCategories = () => router.push('/admin/categories');

  // ── Open Modal Functions ────────────────────────────────────────────────
  const openCreateModal = () => {
    setModal({ open: true });
    setIsActive(true);
    setIsChef(false);
    setForm({
      name: '',
      description: '',
      price: '',
      category: cats[0]?.id ?? '',
      prepTime: '',
      calories: '',
      restaurantId: '',
    });
    setUploadFile(null);
    setUploadName(null);
    setGlbFile(null);
    setGlbName(null);
    setGlbStatus('idle');
    setGlbError('');
    setSaveMsg('');
    setSaveErr('');
  };

  const openEditModal = (item: ApiMenuItem) => {
    setModal({ open: true, item });
    setIsActive(item.status === 'active');
    setIsChef((item.tags ?? []).includes('chef'));
    setForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: (item as any).categoryId ?? item.category ?? cats[0]?.id ?? '',
      prepTime: item.prepTime ?? '',
      calories: item.calories ? String(item.calories) : '',
      restaurantId: (item as any).restaurantId || '',
    });
    setUploadFile(null);
    setUploadName(null);
    setGlbFile(null);
    setGlbName(null);
    setGlbStatus('idle');
    setGlbError('');
    setSaveMsg('');
    setSaveErr('');
  };

  // ── Delete Functions ────────────────────────────────────────────────────
  function onDeleteItem(item: ApiMenuItem) {
    console.log('🗑️ Deleting item:', item.id, item.name);
    setDeleteModal({
      open: true,
      itemId: item.id,
      itemName: item.name,
    });
  }

  async function confirmDeleteItem() {
    if (!deleteModal.itemId) {
      console.error('❌ No item ID to delete');
      return;
    }

    console.log('🗑️ Deleting item:', deleteModal.itemId);

    try {
      await deleteMenuItem(deleteModal.itemId, ADMIN_RESTAURANT_ID);
      console.log('✅ Item deleted permanently');
      setItems(prev => prev.filter(i => i.id !== deleteModal.itemId));
      showToast('Item deleted permanently! 🗑️');
    } catch (err: any) {
      console.error('❌ Delete failed:', err);
      setItems(prev => prev.filter(i => i.id !== deleteModal.itemId));
      showToast('Item removed from list! 🗑️');
    } finally {
      setDeleteModal({ open: false });
    }
  }

  // ── Save/Update Functions ──────────────────────────────────────────────
  async function handleSaveItem(data: any) {
    setSaving(true);
    setSaveMsg('');
    setSaveErr('');

    try {
      if (modal.item) {
        // Edit mode
        const raw = await updateMenuItem(
          modal.item.id,
          {
            name: data.name.trim(),
            description: data.description.trim(),
            price: parseFloat(data.price),
            categoryId: data.category,
            status: data.isActive ? 'active' : 'inactive',
            tags: data.isChef ? ['chef'] : [],
            prepTime: data.prepTime || '20 min',
            calories: data.calories ? parseInt(data.calories) : undefined,
            restaurantId: data.restaurantId,
          }
        );
        setItems(prev => prev.map(i => i.id === modal.item.id ? normaliseItem(raw) : i));
        setSaveMsg('Item updated successfully! ✅');
      } else {
        // Create mode
        const raw = await createMenuItemWithFiles(
          {
            name: data.name.trim(),
            description: data.description.trim(),
            price: parseFloat(data.price),
            categoryId: data.category,
            isActive: data.isActive,
            prepTime: data.prepTime || undefined,
            calories: data.calories ? parseInt(data.calories) : undefined,
            restaurantId: data.restaurantId,
          },
          uploadFile,
          glbFile
        );
        setItems(prev => [...prev, normaliseItem(raw)]);
        setSaveMsg('Item created successfully! ✅');
      }

      setTimeout(() => {
        setModal({ open: false });
        loadItems();
        setSaveMsg('');
        setUploadFile(null);
        setUploadName(null);
        setGlbFile(null);
        setGlbName(null);
        setGlbStatus('idle');
      }, 1400);
    } catch (err: any) {
      setSaveErr(err?.message ?? 'Save failed.');
      if (glbStatus === 'uploading') {
        setGlbStatus('error');
        setGlbError(err?.message ?? 'Upload failed');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRecreateItem(data: any) {
    if (!modal.item) return;
    if (!confirm('Deactivate old item and create fresh with files? Continue?')) return;

    setSaving(true);
    setSaveErr('');
    setSaveMsg('Deactivating old item…');

    try {
      const latest = await fetchMenuItem(modal.item.id, ADMIN_RESTAURANT_ID);
      const version = (latest as any).version ?? 1;

      await updateMenuItem(
        modal.item.id,
        {
          name: latest.name,
          description: latest.description ?? '',
          categoryId: latest.categoryId,
          price: latest.price,
          status: 'inactive'
        },
        version
      );

      setItems(prev => prev.filter(i => i.id !== modal.item.id));
      setSaveMsg('Creating fresh item with files…');

      if (glbFile) setGlbStatus('uploading');

      const raw = await createMenuItemWithFiles(
        {
          name: data.name.trim(),
          description: data.description.trim(),
          price: parseFloat(data.price),
          categoryId: data.category,
          isActive: true,
          prepTime: data.prepTime || undefined,
          calories: data.calories ? parseInt(data.calories) : undefined,
          restaurantId: data.restaurantId,
        },
        uploadFile,
        glbFile
      );

      setItems(prev => [...prev, normaliseItem(raw)]);

      if (raw.arModelKey) {
        setGlbStatus('approved');
        setSaveMsg('Recreated with 3D model! ✓');
      } else {
        setSaveMsg('Recreated! ✓');
      }

      setTimeout(() => {
        setModal({ open: false });
        loadItems();
      }, 1500);

    } catch (err: any) {
      console.error('❌ Recreate error:', err);
      setSaveErr(err?.message ?? 'Recreate failed.');
      if (glbStatus === 'uploading') {
        setGlbStatus('error');
        setGlbError(err?.message ?? 'Failed');
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────
  const filtered = items.filter(item => {
    const mc = category === 'all' || (item as any).categoryId === category || item.category === category;
    return mc && item.name.toLowerCase().includes(search.toLowerCase());
  });
  const activeItems = items.filter(i => i.status === 'active');

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: C.white, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>
            Menu Management
          </h1>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>
            Live API · {activeItems.length} active items
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.subtle, pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{ height: 36, paddingLeft: 36, paddingRight: 14, borderRadius: 10, width: 200, fontSize: 13, background: C.bg, border: `1.5px solid ${C.border}`, color: C.text, outline: 'none' }}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
            />
          </div>
          <button onClick={loadItems} title="Refresh"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} color={C.dark} className={loadState === 'loading' ? 'animate-spin' : ''} />
          </button>
          <button style={{ width: 36, height: 36, borderRadius: 10, background: C.bg, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Bell size={15} color={C.muted} />
          </button>

          <button
            onClick={goToTables}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 10,
              background: C.dark,
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.red; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.dark; }}
          >
            <Grid3x3 size={15} /> Tables
          </button>

          <button
            onClick={goToCategories}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 10,
              background: C.dark,
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.red; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.dark; }}
          >
            <Tags size={15} /> Categories
          </button>

          <button
            onClick={openCreateModal}
            style={{ height: 36, padding: '0 16px', borderRadius: 10, background: C.red, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,37,27,0.25)' }}
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Error */}
        {loadState === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#FFF0F0', border: '1.5px solid #FFD0D0', borderRadius: 14 }}>
            {/* <AlertCircle size={16} color={C.red} style={{ flexShrink: 0 }} /> */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.red, margin: 0 }}>Failed to load menu items</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>{loadError}</p>
            </div>
            <button onClick={loadItems} style={{ padding: '6px 14px', borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, maxWidth: 360 }}>
          {[
            { label: 'Total Items', val: activeItems.length, color: C.text },
            { label: 'Active', val: activeItems.length, color: C.red },
          ].map(s => (
            <div key={s.label} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '16px' }}>
              <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 6px' }}>{s.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Georgia, serif', margin: 0 }}>
                {loadState === 'loading' ? '…' : s.val}
              </p>
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[{ id: 'all', name: '🍽️ All' }, ...cats].map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${category === cat.id ? C.red : C.border}`, background: category === cat.id ? '#FFF0EE' : C.white, color: category === cat.id ? C.red : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loadState === 'loading' && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0E8E0' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 10, width: '33%', background: '#F0E8E0', borderRadius: 6 }} />
                  <div style={{ height: 8, width: '50%', background: '#F0E8E0', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {(loadState === 'success' || loadState === 'idle' || loadState === 'error') && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(137,28,28,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px', gap: 12, padding: '10px 20px', borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
              {['', 'Item', 'Category', 'Price', 'Rating', 'Status', 'Actions'].map(h => (
                <p key={h} style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>

            {filtered.length === 0 && loadState === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
                <span style={{ fontSize: 36, opacity: 0.2 }}>🍽️</span>
                <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>No items found</p>
                <button onClick={openCreateModal} style={{ padding: '8px 20px', borderRadius: 24, background: '#FFF3E0', border: '1.5px solid #FED7AA', color: C.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add First Item</button>
              </div>
            )}

            {filtered.map((item, idx) => (
              <div key={item.id ?? `item-${idx}`}
                style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.bg}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, overflow: 'hidden', flexShrink: 0 }}>
                  {(item as any).imageUrl
                    ? <img src={(item as any).imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                    : item.emoji}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    {(item as any).arModelKey && (
                      <span style={{ fontSize: 9, background: '#FAF5FF', border: '1px solid #DDD6FE', color: '#7c3aed', padding: '2px 6px', borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>3D</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: C.subtle, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</p>
                </div>

                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{item.category}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.red, margin: 0, fontFamily: 'Georgia, serif' }}>{formatPrice(item.price)}</p>
                <p style={{ fontSize: 12, color: '#d97706', fontWeight: 600, margin: 0 }}>★ {item.rating?.toFixed(1) ?? '—'}</p>

                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: item.status === 'active' ? '#F0FFF4' : '#F9FAFB',
                  color: item.status === 'active' ? '#16a34a' : C.subtle,
                  border: `1px solid ${item.status === 'active' ? '#BBF7D0' : C.border}`,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.status === 'active' ? '#22c55e' : C.border, display: 'inline-block' }} />
                  {item.status}
                </span>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openEditModal(item)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#FFF0EE'; b.style.borderColor = '#FED0CC'; }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#FFF3E0'; b.style.borderColor = '#FED7AA'; }}
                  >
                    <Edit2 size={12} color={C.dark} />
                  </button>
                  <button
                    onClick={() => onDeleteItem(item)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <Trash2 size={12} color={C.red} />
                  </button>
                </div>
              </div>
            ))}

            {(loadState === 'success' || loadState === 'idle') && activeItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: `1.5px solid ${C.border}`, background: C.bg }}>
                <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>Showing {filtered.length} of {activeItems.length} active items</p>
                <p style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'monospace', margin: 0 }}>Source: AWS API Gateway</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Menu Item Modal ────────────────────────────────────────────────── */}
      <MenuItemModal
        open={modal.open}
        item={modal.item}
        categories={cats}
        restaurants={restaurants}
        onClose={() => setModal({ open: false })}
        onSave={handleSaveItem}
        onRecreate={handleRecreateItem}
        isActive={isActive}
        setIsActive={setIsActive}
        isChef={isChef}
        setIsChef={setIsChef}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        uploadName={uploadName}
        setUploadName={setUploadName}
        glbFile={glbFile}
        setGlbFile={setGlbFile}
        glbName={glbName}
        setGlbName={setGlbName}
        glbStatus={glbStatus}
        setGlbStatus={setGlbStatus}
        glbError={glbError}
        setGlbError={setGlbError}
        form={form}
        setForm={setForm}
        saving={saving}
        saveMsg={saveMsg}
        saveErr={saveErr}
        setSaveMsg={setSaveMsg}
        setSaveErr={setSaveErr}
      />

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      <DeleteConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false })}
        onConfirm={confirmDeleteItem}
        title="Delete Menu Item?"
        message="Are you sure you want to delete"
        itemName={deleteModal.itemName || ''}
        itemType="menu item"
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 18px',
            borderRadius: 10,
            background: toast.kind === 'ok' ? '#0F9D58' : C.red,
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 100,
          }}
        >
          {toast.msg}
        </div>
      )}

      <style>{`
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// ── Helper function for creating item with files ─────────────────────────────
async function createMenuItemWithFiles(
  payload: {
    name: string;
    description: string;
    price: number;
    categoryId: string;
    isActive: boolean;
    allergens?: string[];
    prepTime?: string;
    calories?: number;
    restaurantId?: string;
  },
  imageFile?: File | null,
  glbFile?: File | null,
): Promise<any> {
  const fd = new FormData();
  fd.append('name', payload.name);
  fd.append('description', payload.description);
  fd.append('priceMinorUnits', String(Math.round(payload.price * 100)));
  fd.append('categoryId', payload.categoryId);
  fd.append('isActive', String(payload.isActive));

  const restaurantId = payload.restaurantId || ADMIN_RESTAURANT_ID;
  fd.append('restaurantId', restaurantId);

  if (payload.allergens?.length) fd.append('allergens', payload.allergens.join(','));
  if (payload.prepTime) fd.append('prepTime', payload.prepTime);
  if (payload.calories) fd.append('calories', String(payload.calories));

  if (imageFile) {
    console.log('📸 Adding image file:', { name: imageFile.name, type: imageFile.type, size: imageFile.size });
    fd.append('file', imageFile);
  }

  if (glbFile) {
    console.log('📦 Adding GLB file:', { name: glbFile.name, type: glbFile.type, size: glbFile.size });
    fd.append('arFile', glbFile);
  }

  const { getValidIdToken } = await import('@/lib/cognito');
  const token = await getValidIdToken();

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;

  let tenantId = '';
  try {
    if (token) {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      tenantId = decoded?.['custom:tenant_id'] || decoded?.tenantId || '';
    }
  } catch (e) {}

  if (!tenantId && payload.restaurantId) {
    tenantId = payload.restaurantId;
  } else if (!tenantId && ADMIN_RESTAURANT_ID) {
    tenantId = ADMIN_RESTAURANT_ID;
  }

  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }

  console.log('📤 Creating item with headers:', headers);
  console.log('📤 FormData contents:');
  for (const [key, value] of fd.entries()) {
    console.log(`  ${key}: ${value instanceof File ? `${value.name} (${value.type})` : value}`);
  }

  const url = `${MENU_BASE_URL}/restaurants/${restaurantId}/items`;
  console.log('📤 POST:', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: fd
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    console.error('❌ Create failed:', res.status, txt);
    throw new Error(`Create failed (${res.status}): ${txt}`);
  }

  const data = await res.json();
  console.log('✅ Create response:', data);
  return data;
}