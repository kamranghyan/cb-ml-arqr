'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Bell, Plus, Edit2, Trash2,
  X, CloudUpload, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import { formatPrice } from '@/lib/data';
import { Toggle, StatusChip } from '@/components/ui';
import {
  fetchMenuItems, fetchMenuItem, updateMenuItem, normaliseItem, type ApiMenuItem,
} from '@/lib/menu-api';
import { TENANT_ID } from '@/lib/api-config';

type ModalState = { open: boolean; item?: ApiMenuItem };
type LoadState  = 'idle' | 'loading' | 'success' | 'error';
type GlbStatus  = 'idle' | 'uploading' | 'approved' | 'error';

const ADMIN_RESTAURANT_ID = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID ?? 'eea190fd-b8dd-470d-aff1-7d75be5c2efb';
const MENU_BASE_URL = '/api/menu';

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

async function createMenuItemWithFiles(
  payload: { name: string; description: string; price: number; categoryId: string; isActive: boolean; allergens?: string[]; prepTime?: string; calories?: number; },
  imageFile?: File | null, glbFile?: File | null,
): Promise<any> {
  const fd = new FormData();
  fd.append('name',            payload.name);
  fd.append('description',     payload.description);
  fd.append('priceMinorUnits', String(Math.round(payload.price * 100)));
  fd.append('categoryId',      payload.categoryId);
  fd.append('isActive',        String(payload.isActive));
  fd.append('restaurantId',    ADMIN_RESTAURANT_ID);
  if (payload.allergens?.length) fd.append('allergens', payload.allergens.join(','));
  if (payload.prepTime)  fd.append('prepTime', payload.prepTime);
  if (payload.calories)  fd.append('calories',  String(payload.calories));
  if (imageFile)         fd.append('file',      imageFile);
  if (glbFile)           fd.append('arFile',    glbFile);
  const { getValidIdToken } = await import('@/lib/cognito');
  const token = await getValidIdToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;
  const res = await fetch(`${MENU_BASE_URL}/restaurants/${ADMIN_RESTAURANT_ID}/items`, { method: 'POST', headers, body: fd });
  if (!res.ok) { const txt = await res.text().catch(() => res.statusText); throw new Error(`Create failed (${res.status}): ${txt}`); }
  return res.json();
}

function FieldLabel({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 6 }}>
      {children}{extra && <span style={{ marginLeft: 8, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>{extra}</span>}
    </label>
  );
}

export default function AdminMenuPage() {
  const [items,      setItems]      = useState<ApiMenuItem[]>([]);
  const [cats,       setCats]       = useState<{id:string; name:string}[]>([]);
  const [loadState,  setLoadState]  = useState<LoadState>('idle');
  const [loadError,  setLoadError]  = useState('');
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('all');
  const [modal,      setModal]      = useState<ModalState>({ open: false });
  const [isActive,   setIsActive]   = useState(true);
  const [isChef,     setIsChef]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState('');
  const [saveErr,    setSaveErr]    = useState('');
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [glbFile,    setGlbFile]    = useState<File | null>(null);
  const [glbName,    setGlbName]    = useState<string | null>(null);
  const [glbStatus,  setGlbStatus]  = useState<GlbStatus>('idle');
  const [glbError,   setGlbError]   = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', prepTime: '', calories: '' });

  const loadItems = useCallback(async () => {
    setLoadState('loading'); setLoadError('');
    try {
      const raw        = await fetchMenuItems(ADMIN_RESTAURANT_ID);
      const normalised = raw.map(normaliseItem);
      setItems(normalised);
      const seen = new Map<string, string>();
      raw.forEach((r: any) => {
        const id   = r.categoryId ?? '';
        const KNOWN: Record<string,string> = { 'e933848e-0d18-4e3a-b0a8-d70275c2fa54': 'Main Course' };
        const name = r.categoryName ?? KNOWN[id] ?? (r.category && !r.category.includes('-') ? r.category : `Cat-${id.slice(0,6)}`);
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
      setForm(prev => prev.category === '' ? { ...prev, category: catList[0]?.id ?? '' } : prev);
      setLoadState('success');
    } catch (err: any) { setLoadError(err?.message ?? 'Failed to load'); setLoadState('error'); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered    = items.filter(item => { if (item.status === 'inactive') return false; const mc = category === 'all' || (item as any).categoryId === category || item.category === category; return mc && item.name.toLowerCase().includes(search.toLowerCase()); });
  const activeItems = items.filter(i => i.status === 'active');

  const openModal = (item?: ApiMenuItem) => {
    setModal({ open: true, item });
    setIsActive(item ? item.status === 'active' : true);
    setIsChef(item ? (item.tags ?? []).includes('chef') : false);
    setUploadFile(null); setUploadName(null); setGlbFile(null); setGlbName(null);
    setGlbStatus('idle'); setGlbError(''); setSaveMsg(''); setSaveErr('');
    setForm({ name: item?.name ?? '', description: item?.description ?? '', price: item?.price ? String(item.price) : '', category: (item as any)?.categoryId ?? item?.category ?? cats[0]?.id ?? '', prepTime: item?.prepTime ?? '', calories: item?.calories ? String(item.calories) : '' });
  };

  const uploadToS3 = async (url: string, file: File, ct: string) => {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
  };

  const saveItem = async () => {
    if (!form.name.trim() || !form.price) { setSaveErr('Name and price are required.'); return; }
    if (cats.length === 0) { setSaveErr('Categories are still loading. Please wait a moment and try again.'); return; }
    if (!form.category) { setSaveErr('Please select a category.'); return; }
    setSaving(true); setSaveMsg(''); setSaveErr('');
    try {
      if (modal.item?.id) {
        const version = (modal.item as any).version ?? 1;
        const raw = await updateMenuItem(modal.item.id, { name: form.name.trim(), description: form.description.trim(), price: parseFloat(form.price), categoryId: form.category, status: isActive ? 'active' : 'inactive', tags: isChef ? ['chef'] : [], prepTime: form.prepTime || '20 min', calories: form.calories ? parseInt(form.calories) : undefined }, version);
        setItems(prev => prev.map(i => i.id === ((raw as any).id ?? (raw as any).itemId) ? normaliseItem(raw) : i));
        setSaveMsg('Item updated!');
        if (uploadFile) { setSaveMsg('Getting image upload URL…'); const fetched = await fetchMenuItem(modal.item.id, ADMIN_RESTAURANT_ID) as any; if (fetched.imageUrl) { setSaveMsg('Uploading image…'); await uploadToS3(fetched.imageUrl, uploadFile, uploadFile.type || 'image/png'); setSaveMsg('Image uploaded! ✓'); } }
        if (glbFile && !(modal.item as any).arModelKey) { setSaveErr('This item has no AR model slot. Use "Recreate & Upload Files" to create a fresh item with GLB.'); setSaving(false); return; }
      } else {
        setSaveMsg('Creating item…');
        if (glbFile) { setGlbStatus('uploading'); setSaveMsg('Uploading item + 3D model…'); }
        const raw = await createMenuItemWithFiles({ name: form.name.trim(), description: form.description.trim(), price: parseFloat(form.price), categoryId: form.category, isActive, prepTime: form.prepTime || undefined, calories: form.calories ? parseInt(form.calories) : undefined }, uploadFile, glbFile);
        setItems(prev => [...prev, normaliseItem(raw)]);
        if (raw.arModelKey) { setGlbStatus('approved'); setSaveMsg('Item created with 3D model! ✓'); }
        else setSaveMsg('Item created!');
      }
      setTimeout(() => { setModal({ open: false }); loadItems(); setSaveMsg(''); }, 1400);
    } catch (err: any) { setSaveErr(err?.message ?? 'Save failed.'); if (glbStatus === 'uploading') { setGlbStatus('error'); setGlbError(err?.message ?? 'Upload failed'); } }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this item from the menu?')) return;
    setDeleting(id);
    try { const latest = await fetchMenuItem(id, ADMIN_RESTAURANT_ID) as any; await updateMenuItem(id, { name: latest.name, description: latest.description ?? '', categoryId: latest.categoryId, price: (latest.priceMinorUnits ?? 0) / 100, status: 'inactive' }, latest.version ?? 1); setItems(prev => prev.filter(i => i.id !== id)); }
    catch (err: any) { alert(`Failed: ${err?.message}`); }
    finally { setDeleting(null); }
  };

  const handleRecreate = async () => {
    if (!modal.item) return;
    if (!confirm('Deactivate old item and create fresh with files? Continue?')) return;
    setSaving(true); setSaveErr(''); setSaveMsg('Deactivating old item…');
    try {
      const latest = await fetchMenuItem(modal.item.id, ADMIN_RESTAURANT_ID) as any;
      await updateMenuItem(modal.item.id, { name: latest.name, description: latest.description ?? '', categoryId: latest.categoryId, price: (latest.priceMinorUnits ?? 0) / 100, status: 'inactive' }, latest.version ?? 1);
      setItems(prev => prev.filter(i => i.id !== modal.item!.id));
      setSaveMsg('Creating fresh item with files…');
      if (glbFile) setGlbStatus('uploading');
      const raw = await createMenuItemWithFiles({ name: form.name.trim(), description: form.description.trim(), price: parseFloat(form.price), categoryId: form.category, isActive: true, prepTime: form.prepTime || undefined, calories: form.calories ? parseInt(form.calories) : undefined }, uploadFile, glbFile);
      setItems(prev => [...prev, normaliseItem(raw)]);
      if (raw.arModelKey) { setGlbStatus('approved'); setSaveMsg('Recreated with 3D model! ✓'); }
      else setSaveMsg('Recreated! ✓');
      setTimeout(() => { setModal({ open: false }); loadItems(); }, 1500);
    } catch (err: any) { setSaveErr(err?.message ?? 'Recreate failed.'); if (glbStatus === 'uploading') { setGlbStatus('error'); setGlbError(err?.message ?? 'Failed'); } }
    finally { setSaving(false); }
  };

  const inputStyle = (focus = false): React.CSSProperties => ({ width: '100%', height: 42, borderRadius: 10, padding: '0 12px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif', transition: 'border-color 0.2s' });

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: C.white, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>Menu Management</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Live API · {activeItems.length} active items</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.subtle, pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
              style={{ height: 36, paddingLeft: 36, paddingRight: 14, borderRadius: 10, width: 200, fontSize: 13, background: C.bg, border: `1.5px solid ${C.border}`, color: C.text, outline: 'none' }}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
              onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
            />
          </div>
          <button onClick={loadItems} title="Refresh"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} color={C.dark} className={loadState === 'loading' ? 'animate-spin' : ''} />
          </button>
          <button style={{ width: 36, height: 36, borderRadius: 10, background: C.bg, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Bell size={15} color={C.muted} />
          </button>
          <button onClick={() => openModal()}
            style={{ height: 36, padding: '0 16px', borderRadius: 10, background: C.red, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,37,27,0.25)' }}>
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Error */}
        {loadState === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#FFF0F0', border: '1.5px solid #FFD0D0', borderRadius: 14 }}>
            <AlertCircle size={16} color={C.red} style={{ flexShrink: 0 }} />
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
            { label: 'Total Items', val: activeItems.length, color: C.text   },
            { label: 'Active',      val: activeItems.length, color: C.red    },
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px', gap: 12, padding: '10px 20px', borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
              {['', 'Item', 'Category', 'Price', 'Rating', 'Status', 'Actions'].map(h => (
                <p key={h} style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>

            {/* Empty */}
            {filtered.length === 0 && loadState === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
                <span style={{ fontSize: 36, opacity: 0.2 }}>🍽️</span>
                <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>No items found</p>
                <button onClick={() => openModal()} style={{ padding: '8px 20px', borderRadius: 24, background: '#FFF3E0', border: '1.5px solid #FED7AA', color: C.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add First Item</button>
              </div>
            )}

            {/* Rows */}
            {filtered.map((item, idx) => (
              <div key={item.id ?? `item-${idx}`}
                style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.bg}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

                {/* Thumb */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, overflow: 'hidden', flexShrink: 0 }}>
                  {(item as any).imageUrl
                    ? <img src={(item as any).imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                    : item.emoji}
                </div>

                {/* Name */}
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

                {/* Status */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: item.status === 'active' ? '#F0FFF4' : '#F9FAFB',
                  color:      item.status === 'active' ? '#16a34a' : C.subtle,
                  border:     `1px solid ${item.status === 'active' ? '#BBF7D0' : C.border}`,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.status === 'active' ? '#22c55e' : C.border, display: 'inline-block' }} />
                  {item.status}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openModal(item)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#FFF0EE'; b.style.borderColor = '#FED0CC'; }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#FFF3E0'; b.style.borderColor = '#FED7AA'; }}>
                    <Edit2 size={12} color={C.dark} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                    style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: deleting === item.id ? 0.4 : 1, transition: 'all 0.2s' }}>
                    {deleting === item.id ? <Loader2 size={12} color={C.subtle} className="animate-spin" /> : <Trash2 size={12} color={C.red} />}
                  </button>
                </div>
              </div>
            ))}

            {/* Footer */}
            {(loadState === 'success' || loadState === 'idle') && activeItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: `1.5px solid ${C.border}`, background: C.bg }}>
                <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>Showing {filtered.length} of {activeItems.length} active items</p>
                <p style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'monospace', margin: 0 }}>Source: AWS API Gateway</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          onClick={e => e.target === e.currentTarget && setModal({ open: false })}>
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 24, width: 460, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(137,28,28,0.15)' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>{modal.item ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <p style={{ fontSize: 11, color: C.subtle, margin: '2px 0 0' }}>{modal.item ? `ID: ${modal.item.id?.slice(0,8)}…` : 'POST to AWS API Gateway'}</p>
              </div>
              <button onClick={() => setModal({ open: false })}
                style={{ width: 32, height: 32, borderRadius: 10, background: C.bg, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color={C.muted} />
              </button>
            </div>

            {/* Alerts */}
            {saveMsg && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 12, marginBottom: 14 }}><CheckCircle size={14} color="#16a34a" /><p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, margin: 0 }}>{saveMsg}</p></div>}
            {saveErr && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: 12, marginBottom: 14 }}><AlertCircle size={14} color={C.red} /><p style={{ fontSize: 12, color: C.red, margin: 0 }}>{saveErr}</p></div>}

            {/* Item Name */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Item Name *</FieldLabel>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Chicken Karahi" style={inputStyle()}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border} />
            </div>

            {/* Category + Price */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <FieldLabel>{!form.category ? <span style={{ color: '#d97706' }}>Category ⚠</span> : 'Category'}</FieldLabel>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  style={{ ...inputStyle(), appearance: 'none' as any }}
                  onFocus={e => (e.target as HTMLSelectElement).style.borderColor = C.red}
                  onBlur={e  => (e.target as HTMLSelectElement).style.borderColor = C.border}>
                  {cats.length === 0 && <option value="">⚠ Loading…</option>}
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Price (Rs) *</FieldLabel>
                <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0" style={inputStyle()}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                  onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border} />
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Description</FieldLabel>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description…" rows={2}
                style={{ ...inputStyle(), height: 'auto', padding: '10px 12px', resize: 'none', fontFamily: 'sans-serif' } as React.CSSProperties}
                onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = C.red}
                onBlur={e  => (e.target as HTMLTextAreaElement).style.borderColor = C.border} />
            </div>

            {/* Prep + Calories */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <FieldLabel>Prep Time</FieldLabel>
                <input value={form.prepTime} onChange={e => setForm(p => ({ ...p, prepTime: e.target.value }))} placeholder="e.g. 25 min" style={inputStyle()}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                  onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border} />
              </div>
              <div>
                <FieldLabel>Calories</FieldLabel>
                <input type="number" value={form.calories} onChange={e => setForm(p => ({ ...p, calories: e.target.value }))} placeholder="e.g. 680" style={inputStyle()}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                  onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border} />
              </div>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel extra={modal.item && !(modal.item as any).imageKey ? <span style={{ color: '#d97706', fontSize: 11 }}>— no image yet</span> : modal.item && (modal.item as any).imageKey ? <span style={{ color: '#16a34a', fontSize: 11 }}>✓ uploaded</span> : null}>Item Image</FieldLabel>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, borderRadius: 16, border: `2px dashed ${uploadName ? '#FED7AA' : C.border}`, background: uploadName ? '#FFF8F1' : C.bg, cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0] ?? null; setUploadFile(f); setUploadName(f?.name ?? null); }} />
                <CloudUpload size={24} color={uploadName ? C.dark : C.subtle} />
                <span style={{ fontSize: 12, fontWeight: 600, color: uploadName ? C.dark : C.subtle }}>{uploadName ? `✓ ${uploadName}` : 'Click to upload · PNG, JPG'}</span>
              </label>
            </div>

            {/* GLB upload */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel extra={modal.item && !(modal.item as any).arModelKey ? <span style={{ color: '#d97706', fontSize: 11 }}>— no model yet</span> : modal.item && (modal.item as any).arModelKey ? <span style={{ color: '#16a34a', fontSize: 11 }}>✓ uploaded</span> : null}>3D AR Model (.glb)</FieldLabel>
              {glbStatus === 'idle' && (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, borderRadius: 16, border: `2px dashed ${glbName ? '#DDD6FE' : C.border}`, background: glbName ? '#FAF5FF' : C.bg, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <input type="file" accept=".glb,.gltf" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0] ?? null; setGlbFile(f); setGlbName(f?.name ?? null); setGlbError(''); }} />
                  <span style={{ fontSize: 24 }}>🫙</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: glbName ? '#7c3aed' : C.subtle }}>{glbName ? `✓ ${glbName}` : 'Click to upload · .glb / .gltf'}</span>
                  {glbName && !modal.item && <span style={{ fontSize: 11, color: '#7c3aed', opacity: 0.7 }}>Will upload with item on Save</span>}
                  {glbName && modal.item  && <span style={{ fontSize: 11, color: '#d97706', opacity: 0.8 }}>Use Recreate button below to attach GLB</span>}
                </label>
              )}
              {glbStatus === 'uploading' && <div style={{ padding: '14px 16px', borderRadius: 16, border: '2px dashed #DDD6FE', background: '#FAF5FF', display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={13} color="#7c3aed" className="animate-spin" /><span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>{saveMsg || 'Uploading 3D model…'}</span></div>}
              {glbStatus === 'approved' && <div style={{ padding: '14px 16px', borderRadius: 16, border: '2px dashed #BBF7D0', background: '#F0FFF4', display: 'flex', alignItems: 'center', gap: 10 }}><CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} /><div><p style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, margin: 0 }}>✓ 3D Model Uploaded</p><p style={{ fontSize: 11, color: '#16a34a', opacity: 0.6, margin: '2px 0 0' }}>Refresh to see AR badge on item</p></div></div>}
              {glbStatus === 'error' && <div style={{ padding: '14px 16px', borderRadius: 16, border: '2px dashed #FFD0D0', background: '#FFF0F0' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><AlertCircle size={14} color={C.red} style={{ flexShrink: 0 }} /><p style={{ fontSize: 12, color: C.red, fontWeight: 700, margin: 0 }}>Upload Error</p></div><p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>{glbError}</p><button onClick={() => { setGlbStatus('idle'); setGlbFile(null); setGlbName(null); }} style={{ fontSize: 11, color: C.red, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Try again</button></div>}
            </div>

            {/* Recreate warning */}
            {modal.item && glbFile && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14 }}>
                <p style={{ fontSize: 11, color: '#92400e', fontWeight: 700, margin: '0 0 8px' }}>⚠ GLB upload requires recreating the item.</p>
                <button onClick={handleRecreate} disabled={saving}
                  style={{ width: '100%', height: 36, borderRadius: 10, background: '#d97706', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? <><Loader2 size={13} className="animate-spin" /> {saveMsg}</> : '🔄 Recreate & Upload Files'}
                </button>
              </div>
            )}

            {/* Toggles */}
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ fontSize: 13, color: C.muted }}>Active on guest menu</span>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.muted }}>Mark as Chef's Special</span>
                <Toggle checked={isChef} onChange={setIsChef} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setModal({ open: false })}
                style={{ flex: 1, height: 40, borderRadius: 10, background: C.bg, border: `1.5px solid ${C.border}`, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveItem} disabled={saving || glbStatus === 'uploading' || (cats.length === 0 && !modal.item)}
                style={{ flex: 2, height: 40, borderRadius: 10, background: C.red, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', opacity: (saving || glbStatus === 'uploading' || (cats.length === 0 && !modal.item)) ? 0.5 : 1, boxShadow: '0 4px 12px rgba(225,37,27,0.25)' }}>
                {saving || glbStatus === 'uploading'
                  ? <><Loader2 size={14} className="animate-spin" /> {saveMsg || 'Saving…'}</>
                  : cats.length === 0 && !modal.item ? '⏳ Loading categories…'
                  : modal.item ? '✓ Update Item' : '✓ Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}